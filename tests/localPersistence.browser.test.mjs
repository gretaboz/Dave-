// Run with node --test tests/localPersistence.browser.test.mjs.
// Playwright can be supplied by DAVE_PLAYWRIGHT_MODULE (absolute module path).
// DAVE_BROWSER_EXECUTABLE can select an installed Chromium/Chrome executable.
import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

let server, context, profile, chromium;
const browserOptions = { headless: true, executablePath: process.env.DAVE_BROWSER_EXECUTABLE };
before(async () => {
  ({ chromium } = await import(process.env.DAVE_PLAYWRIGHT_MODULE ?? 'playwright'));
  profile = await mkdtemp(join(tmpdir(), 'dave-persistence-tests-'));
  server = await createServer({ server: { host: '127.0.0.1', port: 5190, strictPort: false } });
  await server.listen();
  context = await chromium.launchPersistentContext(profile, browserOptions);
});
after(async () => {
  await context?.close();
  await server?.close();
  if (profile) await rm(profile, { recursive: true, force: true });
});

async function pageForTest() {
  const page = await context.newPage();
  // An isolated test document, with no application UI or sample data injected into it.
  await page.route('**/__persistence-tests', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Persistence tests</title>',
  }));
  await page.goto(`${server.resolvedUrls.local[0]}__persistence-tests`);
  await initialise(page);
  return page;
}

async function initialise(page) {
  await page.evaluate(async () => {
    const { createLocalPersistence } = await import('/src/persistence/localPersistence.ts');
    const { createProjectStore } = await import('/src/state/projectStore.ts');
    const refs = () => ({ evidence: [], claims: [], relationships: [], dimensions: [] });
    const makeProject = () => {
      const store = createProjectStore();
      store.createProject({ name: 'Persistence test', context: 'Test-only fixture' });
      const category = store.categories.add({ name: 'Interviews', order: 0 });
      const assetId = crypto.randomUUID();
      const source = store.sources.add({ title: 'Research file', limitations: [], processingState: 'ready',
        primaryCategoryId: category.id,
        originalFile: { id: assetId, filename: 'research.txt', mediaType: 'text/plain' } });
      const evidence = store.evidence.add({ source: { id: source.id, revision: 1 }, text: 'Test excerpt',
        form: 'quotation', location: 'Page 1', context: 'Test context', limitations: [] });
      const first = store.claims.add({ statement: 'First interpretation', evidence: [{ id: evidence.id, revision: 1 }],
        context: 'Test context', limitations: ['Limited research'], review: { state: 'proposed' } }, 'dave');
      const second = store.claims.add({ ...first, statement: 'Second interpretation' });
      const relationship = store.relationships.add({ description: 'Context difference', type: 'contextual_variation',
        claims: [{ claim: { id: first.id, revision: 1 } }, { claim: { id: second.id, revision: 1 } }],
        explanation: 'Test explanation', limitations: [], review: { state: 'accepted', note: 'Reviewed' } }, 'dave');
      const dimension = store.dimensions.add({ name: 'Guidance', lowLabel: 'Minimal', highLabel: 'Detailed',
        explanation: 'Test dimension', claims: [{ id: first.id, revision: 1 }],
        relationships: [{ id: relationship.id, revision: 1 }], limitations: [], review: { state: 'accepted' } }, 'dave');
      const position = store.setDimensionPosition({ dimension: { id: dimension.id, revision: 1 }, selected: true, value: null });
      const node = store.explorationNodes.add({ content: { type: 'idea', text: 'An exploration' },
        references: { ...refs(), dimensions: [{ id: dimension.id, revision: 1 }] },
        dimensionPositions: [{ id: position.id, revision: 1 }], limitations: [], position: { x: 12, y: 25 } });
      const other = store.explorationNodes.add({ ...node, content: { type: 'note', text: 'Another branch' } });
      store.explorationConnections.add({ fromNodeId: node.id, toNodeId: other.id, directional: false, label: 'Related' });
      store.createDirection({ title: 'Chosen direction', description: '', reasoning: 'Designer decision',
        state: 'draft', openQuestions: ['What next?'], explorationNodes: [{ id: node.id, revision: 1 }],
        references: refs(), limitations: [] });
      store.dimensions.update(dimension.id, { name: 'Amount of guidance' });
      store.claims.update(first.id, { review: { state: 'partially_accepted', note: 'Context matters' } });
      store.setDimensionPosition({ dimension: { id: dimension.id, revision: 2 }, selected: true, value: 0.5 });
      store.updateProject({ context: 'Updated project context' });
      return { store, assetId };
    };
    window.persistenceTest = { createLocalPersistence, createProjectStore, makeProject };
  });
}

test('all project collections, history, and blobs survive refresh and browser reopening', async () => {
  let page = await pageForTest();
  const saved = await page.evaluate(async () => {
    const { makeProject, createLocalPersistence } = window.persistenceTest;
    const { store, assetId } = makeProject();
    const name = `roundtrip-${crypto.randomUUID()}`;
    const persistence = createLocalPersistence({ databaseName: name });
    await persistence.saveCurrentProject(store, [{ id: assetId, blob: new Blob(['Original research'], { type: 'text/plain' }) }]);
    return { name, assetId, project: store.getProject() };
  });
  await page.reload();
  await initialise(page);
  assert.deepEqual(await page.evaluate(async name =>
    window.persistenceTest.createLocalPersistence({ databaseName: name }).loadProject(), saved.name), saved.project);
  await context.close();
  context = await chromium.launchPersistentContext(profile, browserOptions);
  page = await pageForTest();
  const result = await page.evaluate(async ({ name, assetId }) => {
    const { createLocalPersistence, createProjectStore } = window.persistenceTest;
    const persistence = createLocalPersistence({ databaseName: name });
    const store = createProjectStore();
    await persistence.loadIntoStore(store);
    const blob = await persistence.loadFile(assetId);
    return { project: store.getProject(), file: await blob.text(), mediaType: blob.type };
  }, saved);
  assert.deepEqual(result.project, saved.project);
  assert.equal(result.file, 'Original research');
  assert.equal(result.mediaType, 'text/plain');
  await page.close();
});

test('missing or unreadable blobs do not prevent project restoration', async () => {
  const page = await pageForTest();
  const result = await page.evaluate(async () => {
    const { makeProject, createLocalPersistence, createProjectStore } = window.persistenceTest;
    const { store, assetId } = makeProject();
    const name = `missing-${crypto.randomUUID()}`;
    const persistence = createLocalPersistence({ databaseName: name });
    await persistence.saveCurrentProject(store); // No blob uploaded.
    const restored = createProjectStore();
    await persistence.loadIntoStore(restored);
    const missing = await persistence.loadFile(assetId);
    await new Promise((resolve, reject) => {
      const open = indexedDB.open(name, 1);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put('Not a blob', assetId);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
      open.onerror = () => reject(open.error);
    });
    let fileFailed = false;
    try { await persistence.loadFile(assetId); } catch { fileFailed = true; }
    return { missing, fileFailed, unchanged: JSON.stringify(restored.getProject()) === JSON.stringify(store.getProject()) };
  });
  assert.deepEqual(result, { missing: null, fileFailed: true, unchanged: true });
  await page.close();
});

test('a failed file transaction rolls back the project and preserves the original blob', async () => {
  const page = await pageForTest();
  const result = await page.evaluate(async () => {
    const { makeProject, createLocalPersistence } = window.persistenceTest;
    const { store, assetId } = makeProject();
    const persistence = createLocalPersistence({ databaseName: `rollback-${crypto.randomUUID()}` });
    await persistence.saveCurrentProject(store, [{ id: assetId, blob: new Blob(['Original']) }]);
    const before = await persistence.loadProject();
    store.updateProject({ name: 'New unsaved name' });
    let failed = false;
    try { await persistence.saveCurrentProject(store, [{ id: assetId, blob: new Blob(['Replacement']) }]); }
    catch { failed = true; }
    return { failed, unchanged: JSON.stringify(await persistence.loadProject()) === JSON.stringify(before),
      original: await (await persistence.loadFile(assetId)).text(), currentName: store.getProject().name };
  });
  assert.deepEqual(result, { failed: true, unchanged: true, original: 'Original', currentName: 'New unsaved name' });
  await page.close();
});

test('empty databases are distinct from unavailable storage and invalid saved projects', async () => {
  const page = await pageForTest();
  const result = await page.evaluate(async () => {
    const { makeProject, createLocalPersistence } = window.persistenceTest;
    const { store } = makeProject();
    const before = JSON.stringify(store.getProject());
    const name = `errors-${crypto.randomUUID()}`;
    const persistence = createLocalPersistence({ databaseName: name });
    const empty = await persistence.loadIntoStore(store);
    const failing = createLocalPersistence({ indexedDB: { open() { throw new Error('Storage denied'); } } });
    const failures = [];
    for (const action of [() => failing.saveCurrentProject(store), () => failing.loadIntoStore(store)]) {
      try { await action(); failures.push(false); } catch { failures.push(true); }
    }
    for (const invalid of [{ modelVersion: 2 }, { ...store.getProject(), claims: null }]) {
      await new Promise((resolve, reject) => {
        const open = indexedDB.open(name, 1);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('projects', 'readwrite');
          tx.objectStore('projects').put(invalid, 'current');
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onabort = () => { db.close(); reject(tx.error); };
        };
        open.onerror = () => reject(open.error);
      });
      try { await persistence.loadIntoStore(store); failures.push(false); } catch { failures.push(true); }
    }
    return { empty, failures, unchanged: JSON.stringify(store.getProject()) === before };
  });
  assert.deepEqual(result, { empty: null, failures: [true, true, true, true], unchanged: true });
  await page.close();
});

test('continued saves persist later edits; edits during loading are protected', async () => {
  const page = await pageForTest();
  const result = await page.evaluate(async () => {
    const { makeProject, createLocalPersistence } = window.persistenceTest;
    const { store } = makeProject();
    const name = `continued-${crypto.randomUUID()}`;
    const persistence = createLocalPersistence({ databaseName: name });
    await persistence.saveCurrentProject(store);
    store.updateProject({ name: 'Continued work' });
    await persistence.saveCurrentProject(store);
    const continued = await persistence.loadProject();
    const loading = persistence.loadIntoStore(store);
    store.updateProject({ name: 'Edited during loading' });
    let failed = false;
    try { await loading; } catch { failed = true; }
    return { continuedName: continued.name, failed, currentName: store.getProject().name };
  });
  assert.deepEqual(result, { continuedName: 'Continued work', failed: true, currentName: 'Edited during loading' });
  await page.close();
});

test('a legacy current-only project survives creation of a second project', async () => {
  const page = await pageForTest();
  const result = await page.evaluate(async () => {
    const { makeProject, createLocalPersistence } = window.persistenceTest;
    const { store } = makeProject();
    const legacy = store.getProject();
    const name = `legacy-projects-${crypto.randomUUID()}`;
    const persistence = createLocalPersistence({ databaseName: name });
    await persistence.loadProject(); // Initialise the existing schema.
    await new Promise((resolve, reject) => {
      const open = indexedDB.open(name, 1);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('projects', 'readwrite');
        tx.objectStore('projects').put(legacy, 'current');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
      open.onerror = () => reject(open.error);
    });
    const { createProjectStore } = await import('/src/state/projectStore.ts');
    const next = createProjectStore().createProject({ name: 'New blank project', context: '' });
    await persistence.saveProject(next);
    return {
      legacyUnchanged: JSON.stringify(await persistence.loadProject(legacy.id)) === JSON.stringify(legacy),
      current: (await persistence.loadProject()).id,
      next: next.id,
      projects: (await persistence.listProjects()).length,
    };
  });
  assert.equal(result.legacyUnchanged, true);
  assert.equal(result.current, result.next);
  assert.equal(result.projects, 2);
  await page.close();
});
