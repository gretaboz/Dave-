import { withoutResearchSource } from '../features/research/deleteSource';
import type { Project, ProjectContent, EntityId } from '../model/types';
import type { createLocalPersistence } from '../persistence/localPersistence';
import type { createProjectStore } from './projectStore';

type Store = ReturnType<typeof createProjectStore>;
type Persistence = Pick<ReturnType<typeof createLocalPersistence>, 'loadIntoStore' | 'saveProject'>
  & Partial<Pick<ReturnType<typeof createLocalPersistence>, 'saveFile' | 'loadFile'>>;

export interface ProjectSnapshot {
  project: Project | null;
  status: 'loading' | 'empty' | 'saving' | 'saved' | 'error';
  error: string | null;
  errorOperation: 'load' | 'save' | null;
}

/** Coordinates the existing store and persistence; contains no workflow/UI state. */
export function createProjectSession(store: Store, persistence: Persistence) {
  let snapshot: ProjectSnapshot = {
    project: store.getProject(), status: 'loading', error: null, errorOperation: null,
  };
  const listeners = new Set<() => void>();
  let initialised = false;
  let loadPromise: Promise<void> | null = null;
  let saving = false;
  let savePromise: Promise<void> | null = null;
  const deletedAssets = new Set<EntityId<'asset'>>();
  let pending: Project | null = null;
  let connections = 0;
  let unsubscribeStore: (() => void) | null = null;
  let observed = JSON.stringify(snapshot.project);

  function publish(next: ProjectSnapshot) {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  async function saveNow() {
    if (saving || !pending) return;
    saving = true;
    publish({ ...snapshot, status: 'saving', error: null, errorOperation: null });
    try {
      // Coalesce changes during a write and save the newest snapshot next.
      // Never let an older completion label newer, unsaved work as saved.
      while (pending) {
        const next = pending;
        pending = null;
        const deletions = [...deletedAssets];
        try {
          await persistence.saveProject(next, [], deletions);
          deletions.forEach(id => deletedAssets.delete(id));
        }
        catch (error) {
          pending ??= next;
          publish({ ...snapshot, status: 'error', errorOperation: 'save',
            error: error instanceof Error ? error.message : 'Local saving failed.' });
          return;
        }
      }
      publish({ ...snapshot, status: 'saved', error: null, errorOperation: null });
    } finally {
      saving = false;
    }
  }

  function save(): Promise<void> {
    if (savePromise) return savePromise;
    savePromise = saveNow().finally(() => { savePromise = null; });
    return savePromise;
  }

  function storeChanged() {
    const project = store.getProject();
    const key = JSON.stringify(project);
    if (key === observed) return;
    observed = key;
    if (!initialised) {
      // Restoration is not an edit and must not trigger a new save.
      snapshot = { ...snapshot, project };
      return;
    }
    if (!project) return;
    pending = project;
    if (saving) publish({ ...snapshot, project, status: 'saving', error: null, errorOperation: null });
    else {
      snapshot = { ...snapshot, project };
      void save();
    }
  }

  function load(): Promise<void> {
    if (initialised) return Promise.resolve();
    if (loadPromise) return loadPromise;
    publish({ ...snapshot, status: 'loading', error: null, errorOperation: null });
    loadPromise = (async () => {
      try {
        const saved = await persistence.loadIntoStore(store);
        initialised = true;
        const project = store.getProject();
        observed = JSON.stringify(project);
        if (!saved && project) {
          snapshot = { project, status: 'empty', error: null, errorOperation: null };
          pending = project;
          void save();
        } else publish({ project, status: saved ? 'saved' : 'empty', error: null, errorOperation: null });
      } catch (error) {
        publish({ ...snapshot, project: store.getProject(), status: 'error', errorOperation: 'load',
          error: error instanceof Error ? error.message : 'Local loading failed.' });
      } finally {
        loadPromise = null;
      }
    })();
    return loadPromise;
  }

  return {
    store,
    async saveFile(file: Parameters<ReturnType<typeof createLocalPersistence>['saveFile']>[0]) {
      if (!initialised || !store.getProject()) throw new Error('Load or create a project before uploading.');
      if (!persistence.saveFile) throw new Error('File storage is unavailable.');
      await persistence.saveFile(file);
    },
    async loadFile(id: Parameters<ReturnType<typeof createLocalPersistence>['loadFile']>[0]) {
      if (!persistence.loadFile) throw new Error('File storage is unavailable.');
      return persistence.loadFile(id);
    },
    async deleteSource(sourceId: EntityId<'source'>) {
      const project = store.getProject();
      if (!initialised || !project) throw new Error('Load the project before deleting files.');
      const next = withoutResearchSource(project, sourceId);
      const source = project.sources.find(item => item.id === sourceId)!;
      if (!next.sources.some(item => item.originalFile.id === source.originalFile.id))
        deletedAssets.add(source.originalFile.id);
      store.restoreProject(next);
      await save();
    },
    // Cached between changes: safe for React's useSyncExternalStore.
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    connect() {
      connections++;
      if (connections === 1) {
        unsubscribeStore = store.subscribe(storeChanged);
        if (initialised) storeChanged();
        else void load();
      }
      let connected = true;
      return () => {
        if (!connected) return;
        connected = false;
        if (--connections === 0) {
          unsubscribeStore?.();
          unsubscribeStore = null;
        }
      };
    },
    createProject(content: ProjectContent) {
      if (!initialised) throw new Error('Load the saved project before creating a new one.');
      if (!content.name.trim()) throw new Error('Enter a project name.');
      return store.createProject({ name: content.name.trim(), context: content.context });
    },
    retry(): Promise<void> {
      return snapshot.errorOperation === 'load' ? load() : save();
    },
  };
}
