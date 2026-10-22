import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createProjectStore } from '../src/state/projectStore';
import { createProjectSession } from '../src/state/projectSession';
import type { Project } from '../src/model/types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test('deduplicates startup loading across reconnects and cleans up store subscriptions', async () => {
  const store = createProjectStore();
  const startup = deferred<Project | null>();
  let loads = 0, activeSubscriptions = 0, saves = 0;
  const originalSubscribe = store.subscribe;
  store.subscribe = listener => {
    activeSubscriptions++;
    const unsubscribe = originalSubscribe(listener);
    return () => { activeSubscriptions--; unsubscribe(); };
  };
  const session = createProjectSession(store, {
    loadIntoStore: async () => { loads++; return startup.promise; },
    saveProject: async () => { saves++; },
  });
  assert.equal(session.getSnapshot(), session.getSnapshot());
  const disconnect = session.connect();
  assert.throws(() => session.createProject({ name: 'Too early', context: '' }));
  disconnect();
  const disconnectAgain = session.connect();
  assert.equal(activeSubscriptions, 1);
  assert.equal(loads, 1);
  startup.resolve(null);
  await settle();
  assert.equal(session.getSnapshot().status, 'empty');
  session.createProject({ name: 'Project', context: 'Brief' });
  await settle();
  assert.equal(saves, 1);
  assert.equal(session.getSnapshot().status, 'saved');
  const snapshot = session.getSnapshot();
  store.updateProject({ name: 'Project' });
  assert.equal(session.getSnapshot(), snapshot);
  disconnectAgain();
  disconnectAgain(); // Cleanup is idempotent.
  assert.equal(activeSubscriptions, 0);
  store.updateProject({ context: 'Disconnected edit' });
  await settle();
  assert.equal(saves, 1);
  const stop = session.connect();
  await settle();
  assert.equal(saves, 2);
  assert.equal(session.getSnapshot().project?.context, 'Disconnected edit');
  stop();
});

test('serialises saves and reports saved only after the latest snapshot succeeds', async () => {
  const store = createProjectStore();
  const writes: { project: Project; completion: ReturnType<typeof deferred<void>> }[] = [];
  const session = createProjectSession(store, {
    loadIntoStore: async () => null,
    saveProject: project => {
      const completion = deferred<void>();
      writes.push({ project, completion });
      return completion.promise;
    },
  });
  const stop = session.connect();
  await settle();
  session.createProject({ name: 'Initial', context: '' });
  assert.equal(session.getSnapshot().status, 'saving');
  store.updateProject({ name: 'Intermediate' });
  store.updateProject({ name: 'Latest' });
  assert.equal(writes.length, 1);
  writes[0].completion.resolve();
  await settle();
  assert.equal(writes.length, 2);
  assert.equal(writes[1].project.name, 'Latest');
  assert.equal(session.getSnapshot().status, 'saving');
  writes[1].completion.resolve();
  await settle();
  assert.equal(session.getSnapshot().status, 'saved');
  assert.equal(session.getSnapshot().project?.name, 'Latest');
  stop();
});

test('failed saves retain unsaved work and retry the newest snapshot', async () => {
  const store = createProjectStore();
  const first = deferred<void>();
  const writes: Project[] = [];
  const session = createProjectSession(store, {
    loadIntoStore: async () => null,
    saveProject: async project => {
      writes.push(project);
      if (writes.length === 1) await first.promise;
    },
  });
  const stop = session.connect();
  await settle();
  session.createProject({ name: 'Initial', context: '' });
  store.updateProject({ name: 'Latest unsaved work' });
  first.reject(new Error('Quota exceeded'));
  await settle();
  assert.equal(session.getSnapshot().status, 'error');
  assert.equal(session.getSnapshot().errorOperation, 'save');
  assert.equal(session.getSnapshot().error, 'Quota exceeded');
  assert.equal(store.getProject()?.name, 'Latest unsaved work');
  await session.retry();
  assert.equal(writes[1].name, 'Latest unsaved work');
  assert.equal(session.getSnapshot().status, 'saved');
  stop();
});

test('failed loading blocks project creation until a successful retry', async () => {
  const store = createProjectStore();
  let attempts = 0, saves = 0;
  const session = createProjectSession(store, {
    loadIntoStore: async () => { if (++attempts === 1) throw new Error('Storage unavailable'); return null; },
    saveProject: async () => { saves++; },
  });
  const stop = session.connect();
  await settle();
  assert.equal(session.getSnapshot().status, 'error');
  assert.equal(session.getSnapshot().errorOperation, 'load');
  assert.throws(() => session.createProject({ name: 'Would overwrite saved work', context: '' }));
  assert.equal(saves, 0);
  await session.retry();
  assert.equal(session.getSnapshot().status, 'empty');
  stop();
});

test('restoration preserves project contents and does not immediately rewrite them', async () => {
  const source = createProjectStore();
  source.createProject({ name: 'Existing', context: 'Saved context' });
  source.updateProject({ name: 'Existing edited' });
  const saved = source.getProject()!;
  const store = createProjectStore();
  let saves = 0;
  const session = createProjectSession(store, {
    loadIntoStore: async target => { target.restoreProject(saved); return saved; },
    saveProject: async () => { saves++; },
  });
  const stop = session.connect();
  await settle();
  assert.deepEqual(session.getSnapshot().project, saved);
  assert.deepEqual(store.getProject(), saved);
  assert.equal(session.getSnapshot().status, 'saved');
  assert.equal(saves, 0);
  stop();
});

test('failed deletion saves retain the pending asset removal for retry', async () => {
  const store = createProjectStore();
  const writes: { sourceCount: number; deletions: string[] }[] = [];
  let fail = false;
  const session = createProjectSession(store, {
    loadIntoStore: async () => null,
    saveProject: async (project, _files, deletions = []) => {
      writes.push({ sourceCount: project.sources.length, deletions });
      if (fail) throw new Error('Storage unavailable');
    },
  });
  const stop = session.connect(); await settle();
  session.createProject({ name: 'Deletion', context: '' }); await settle();
  const source = store.sources.add({ title: 'Remove', originalFile: { id: 'asset-to-remove' as never, filename: 'remove.txt', mediaType: 'text/plain' }, limitations: [], processingState: 'ready' });
  await settle(); fail = true;
  await session.deleteSource(source.id);
  assert.equal(session.getSnapshot().status, 'error');
  assert.deepEqual(writes.at(-1), { sourceCount: 0, deletions: ['asset-to-remove'] });
  fail = false; await session.retry();
  assert.equal(session.getSnapshot().status, 'saved');
  assert.deepEqual(writes.at(-1), { sourceCount: 0, deletions: ['asset-to-remove'] });
  stop();
});

test('failed project deletion preserves the open project and successful last deletion does not autosave it again', async () => {
  const store = createProjectStore();
  const project = store.createProject({ name: 'Saved project', context: '' });
  let fail = true, saves = 0;
  const session = createProjectSession(store, {
    loadIntoStore: async () => project,
    saveProject: async () => { saves++; },
    deleteProject: async () => {
      if (fail) throw new Error('Storage denied');
      return { project: null, projects: [] };
    },
  });
  const disconnect = session.connect();
  await settle();
  await assert.rejects(session.deleteProject(project.id), /Storage denied/);
  assert.deepEqual(store.getProject(), project);
  assert.equal(session.getSnapshot().status, 'saved');
  fail = false;
  await session.deleteProject(project.id);
  await settle();
  assert.equal(store.getProject(), null);
  assert.equal(session.getSnapshot().status, 'empty');
  assert.equal(saves, 0);
  disconnect();
});

test('a late edit during deletion cannot autosave and recreate the deleted project', async () => {
  const store = createProjectStore();
  const project = store.createProject({ name: 'Delete me', context: '' });
  const completion = deferred<{ project: Project | null; projects: [] }>();
  let saves = 0;
  const session = createProjectSession(store, {
    loadIntoStore: async () => project,
    saveProject: async () => { saves++; },
    deleteProject: () => completion.promise,
  });
  const disconnect = session.connect(); await settle();
  const deleting = session.deleteProject(project.id);
  store.updateProject({ context: 'Late response' });
  assert.equal(saves, 0);
  completion.resolve({ project: null, projects: [] });
  await deleting; await settle();
  assert.equal(saves, 0);
  assert.equal(store.getProject(), null);
  disconnect();
});
