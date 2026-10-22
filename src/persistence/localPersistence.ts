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
      const projects = tx.objectStore(PROJECTS);
      // Preserve the original single-project snapshot on the first multi-project save.
      const previous = projects.get(CURRENT);
      previous.onsuccess = () => {
        if (previous.result?.id && previous.result.id !== snapshot.id) {
          projects.put(previous.result, previous.result.id);
        }
        projects.put(snapshot, snapshot.id);
        projects.put(snapshot, CURRENT);
      };
      return previous;
    });
  }

  async function loadProject(id?: EntityId<'project'>): Promise<Project | null> {
    const saved: unknown = await transaction([PROJECTS], 'readonly', tx =>
      tx.objectStore(PROJECTS).get(id ?? CURRENT));
    if (saved === undefined || saved === null) return null;
    assertProjectSnapshot(saved);
    return saved; // IndexedDB returns a structured clone, preserving the full model.
  }

  return {
    saveProject,
    loadProject,
    async hasSavedSelection(): Promise<boolean> {
      return (await transaction([PROJECTS], 'readonly', tx => tx.objectStore(PROJECTS).get(CURRENT))) !== undefined;
    },
    async deleteProject(id: EntityId<'project'>): Promise<{ project: Project | null; projects: { id: EntityId<'project'>; name: string }[] }> {
      let result: { project: Project | null; projects: { id: EntityId<'project'>; name: string }[] };
      await transaction([PROJECTS, FILES], 'readwrite', tx => {
        const projects = tx.objectStore(PROJECTS);
        const request = projects.getAll();
        const current = projects.get(CURRENT);
        current.onsuccess = () => {
          try {
            const snapshots = request.result.filter(value => value !== null) as Project[];
            snapshots.forEach(assertProjectSnapshot);
            const removed = snapshots.filter(project => project.id === id);
            if (!removed.length) throw new Error('This project could not be found.');
            const remaining = new Map(snapshots.filter(project => project.id !== id).map(project => [project.id, project]));
            const next = current.result?.id === id ? [...remaining.values()][0] ?? null : current.result ?? null;
            projects.delete(id);
            // Null records an intentionally empty library, so Demo does not seed it again.
            projects.put(next, CURRENT);
            const assets = (values: unknown[]): Set<string> => {
              const ids = new Set<string>();
              const visit = (value: unknown) => {
                if (!value || typeof value !== 'object') return;
                const item = value as Record<string, unknown>;
                if (typeof item.id === 'string' && typeof item.filename === 'string' && typeof item.mediaType === 'string') ids.add(item.id);
                Object.values(item).forEach(visit);
              };
              values.forEach(visit); return ids;
            };
            const retainedAssets = assets([...remaining.values()]);
            for (const asset of assets(removed)) if (!retainedAssets.has(asset)) tx.objectStore(FILES).delete(asset);
            result = { project: next, projects: [...remaining.values()].map(project => ({ id: project.id, name: project.name })) };
          } catch { tx.abort(); }
        };
        return request;
      });
      return result!;
    },
    async listProjects(): Promise<{ id: EntityId<'project'>; name: string }[]> {
      const saved: unknown[] = await transaction([PROJECTS], 'readonly', tx => tx.objectStore(PROJECTS).getAll());
      const projects = new Map<EntityId<'project'>, { id: EntityId<'project'>; name: string }>();
      for (const value of saved) {
        if (value === null) continue;
        assertProjectSnapshot(value);
        projects.set(value.id, { id: value.id, name: value.name });
      }
      return [...projects.values()];
    },
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
