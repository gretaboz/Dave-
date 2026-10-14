import type { EntityId, Project } from '../model/types';
import { assertProjectSnapshot } from '../model/validateProject';
import type { createProjectStore } from '../state/projectStore';

type ProjectStore = ReturnType<typeof createProjectStore>;
export interface UploadedFile {
  id: EntityId<'asset'>;
  blob: Blob;
}

export interface PersistenceOptions {
  databaseName?: string;
  /** Injectable for tests; normally uses the browser's IndexedDB. */
  indexedDB?: IDBFactory;
}

const PROJECTS = 'projects';
const FILES = 'files';
const CURRENT = 'current';

/** Local, explicit operations. Nothing opens or saves until a method is called. */
export function createLocalPersistence(options: PersistenceOptions = {}) {
  const databaseName = options.databaseName ?? 'dave-prototype';

  function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const factory = options.indexedDB ?? globalThis.indexedDB;
      if (!factory) {
        reject(new Error('IndexedDB is unavailable in this browser.'));
        return;
      }
      let settled = false;
      const request = factory.open(databaseName, 1);
      request.onupgradeneeded = () => {
        // Only initialise version 1. No project rewriting or automatic migration.
        request.result.createObjectStore(PROJECTS);
        request.result.createObjectStore(FILES);
      };
      request.onblocked = () => {
        settled = true;
        reject(new Error('Local storage is blocked by another open database connection.'));
      };
      request.onerror = () => reject(request.error ?? new Error('Could not open local storage.'));
      request.onsuccess = () => {
        if (settled) request.result.close();
        else {
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        }
      };
    });
  }

  async function transaction<T>(stores: string[], mode: IDBTransactionMode,
    run: (tx: IDBTransaction) => IDBRequest<T>): Promise<T> {
    const database = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = database.transaction(stores, mode);
        let request: IDBRequest<T>;
        // Request success alone is not a committed save. Wait for the transaction.
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(tx.error ?? new Error('The local storage transaction was aborted.'));
        tx.onerror = () => { /* IndexedDB aborts the transaction; onabort reports it. */ };
        try { request = run(tx); }
        catch (error) {
          tx.abort();
          reject(error);
        }
      });
    } finally {
      database.close();
    }
  }

  async function saveProject(project: Project, uploadedFiles: UploadedFile[] = [], deletedAssets: EntityId<'asset'>[] = []): Promise<void> {
    assertProjectSnapshot(project);
    const snapshot = structuredClone(project);
    const files = uploadedFiles.map(file => ({ id: file.id, blob: file.blob }));
    await transaction([PROJECTS, FILES], 'readwrite', tx => {
      // File IDs are immutable. Replacing an original requires a new asset ID.
      // If any file fails, the project write rolls back in the same transaction.
      for (const assetId of deletedAssets) tx.objectStore(FILES).delete(assetId);
      for (const file of files) tx.objectStore(FILES).add(file.blob, file.id);
      return tx.objectStore(PROJECTS).put(snapshot, CURRENT);
    });
  }

  async function loadProject(): Promise<Project | null> {
    const saved: unknown = await transaction([PROJECTS], 'readonly', tx =>
      tx.objectStore(PROJECTS).get(CURRENT));
    if (saved === undefined) return null;
    assertProjectSnapshot(saved);
    return saved; // IndexedDB returns a structured clone, preserving the full model.
  }

  return {
    saveProject,
    loadProject,
    async saveFile(file: UploadedFile): Promise<void> {
      await transaction([FILES], 'readwrite', tx => tx.objectStore(FILES).add(file.blob, file.id));
    },
    async loadFile(assetId: EntityId<'asset'>): Promise<Blob | null> {
      const saved: unknown = await transaction([FILES], 'readonly', tx => tx.objectStore(FILES).get(assetId));
      if (saved === undefined) return null;
      if (!(saved instanceof Blob)) throw new Error('The saved file is not a readable blob.');
      return saved;
    },
    async saveCurrentProject(store: ProjectStore, uploadedFiles: UploadedFile[] = []): Promise<void> {
      const project = store.getProject();
      if (!project) throw new Error('There is no current project to save.');
      await saveProject(project, uploadedFiles);
    },
    async loadIntoStore(store: ProjectStore): Promise<Project | null> {
      const before = store.getProject();
      const saved = await loadProject();
      // Do not overwrite edits made while the asynchronous load was in progress.
      if (JSON.stringify(store.getProject()) !== JSON.stringify(before))
        throw new Error('The project changed while loading. Retry when editing has finished.');
      if (saved) store.restoreProject(saved);
      return saved;
    },
  };
}
