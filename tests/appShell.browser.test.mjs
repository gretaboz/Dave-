// Run with node --test tests/appShell.browser.test.mjs.
// Optional: DAVE_PLAYWRIGHT_MODULE and DAVE_BROWSER_EXECUTABLE, as in persistence tests.
import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { createServer } from 'vite';
import { join } from 'node:path';

let server, browser;
before(async () => {
  const { chromium } = await import(process.env.DAVE_PLAYWRIGHT_MODULE ?? 'playwright');
  server = await createServer({ server: { host: '127.0.0.1', port: 5195, strictPort: false } });
  await server.listen();
  browser = await chromium.launch({ headless: true, executablePath: process.env.DAVE_BROWSER_EXECUTABLE });
});
after(async () => {
  await browser?.close();
  await server?.close();
});

async function openShell() {
  const context = await browser.newContext();
  // Error injection is confined to this isolated test browser context.
  await context.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args) {
      if (window.denyLocalStorage) throw new DOMException('Storage denied for test', 'SecurityError');
      return open.apply(this, args);
    };
  });
  const page = await context.newPage();
  // The existing shell has no favicon; avoid treating Chrome's optional request as an app error.
  await page.route('**/favicon.ico', route => route.fulfill({ status: 204, body: '' }));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return { context, page, errors };
}
async function waitForText(page, role, text) {
  await page.getByRole(role).filter({ hasText: text }).waitFor();
}
async function currentProject(page) {
  return page.evaluate(async () => (await import('/src/state/projectStore.ts')).projectStore.getProject());
}

test('creates a real empty project, keeps one project through every stage, and restores on refresh', async () => {
  const { context, page, errors } = await openShell();
  try {
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Live AI', exact: true }).click();
    await waitForText(page, 'status', 'No project yet.');
    assert.equal(await currentProject(page), null);
    if (process.env.DAVE_SHELL_SCREENSHOT_DIR)
      await page.screenshot({ path: join(process.env.DAVE_SHELL_SCREENSHOT_DIR, 'dave-empty-project.png'), fullPage: true });
    await page.getByLabel('Project name', { exact: true }).fill('Museum visit');
    await page.getByLabel('Brief / context', { exact: true }).fill('Support visitors during their first visit.');
    // Navigation also preserves an unfinished creation form.
    await page.getByRole('button', { name: /Dimensions$/ }).click();
    assert.equal(await page.getByLabel('Project name', { exact: true }).inputValue(), 'Museum visit');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await waitForText(page, 'status', 'Saved locally.');
    const project = await currentProject(page);
    assert.equal(project.name, 'Museum visit');
    assert.equal(project.context, 'Support visitors during their first visit.');
    for (const key of ['sources', 'categories', 'evidence', 'claims', 'relationships', 'dimensions',
      'dimensionPositions', 'explorationNodes', 'explorationConnections', 'directions']) assert.deepEqual(project[key], []);
    for (const stage of ['Research', 'Relationships', 'Dimensions', 'Explore', 'Directions']) {
      await page.getByRole('button', { name: stage, exact: true }).click();
      if (stage !== 'Research') await page.getByRole('heading', { name: stage, level: 2, exact: true }).waitFor();
      else assert.equal(await page.getByRole('heading', { name: stage, level: 2, exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: stage, exact: true }).getAttribute('aria-current'), 'step');
      await page.getByRole('heading', { name: 'Museum visit', exact: true }).waitFor();
      assert.deepEqual(await currentProject(page), project);
    }
    const persisted = await page.evaluate(async () =>
      (await import('/src/persistence/localPersistence.ts')).createLocalPersistence().loadProject());
    assert.deepEqual(persisted, project);
    await page.reload();
    await waitForText(page, 'status', 'Saved locally.');
    await page.getByRole('heading', { name: 'Museum visit', exact: true }).waitFor();
    assert.deepEqual(await currentProject(page), project);
    assert.equal(await page.getByRole('button', { name: 'Create project', exact: true }).count(), 0);
    if (process.env.DAVE_SHELL_SCREENSHOT_DIR)
      await page.screenshot({ path: join(process.env.DAVE_SHELL_SCREENSHOT_DIR, 'dave-restored-project.png'), fullPage: true });
    assert.deepEqual(errors, []); // Also catches unstable snapshot/re-render warnings.
  } finally { await context.close(); }
});

test('a loading error blocks creation and provides an honest retry', async () => {
  const { context, page, errors } = await openShell();
  try {
    await context.addInitScript(() => { window.denyLocalStorage = true; });
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Live AI', exact: true }).click();
    await waitForText(page, 'status', 'Could not load your project.');
    await waitForText(page, 'alert', 'Storage denied for test');
    assert.equal(await page.getByRole('button', { name: 'Create project', exact: true }).count(), 0);
    assert.equal(await currentProject(page), null);
    await page.evaluate(() => { window.denyLocalStorage = false; });
    await page.getByRole('button', { name: 'Retry loading', exact: true }).click();
    await waitForText(page, 'status', 'No project yet.');
    await page.getByRole('button', { name: 'Create project', exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('a saving error retains the project, never claims success, and retry persists it', async () => {
  const { context, page, errors } = await openShell();
  try {
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Live AI', exact: true }).click();
    await waitForText(page, 'status', 'No project yet.');
    await page.getByLabel('Project name', { exact: true }).fill('Unsaved project');
    await page.getByLabel('Brief / context', { exact: true }).fill('Keep this brief even if saving fails.');
    await page.evaluate(() => { window.denyLocalStorage = true; });
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await waitForText(page, 'status', 'Changes have not been saved.');
    await page.getByRole('heading', { name: 'Unsaved project', exact: true }).waitFor();
    const project = await currentProject(page);
    assert.equal(project.context, 'Keep this brief even if saving fails.');
    await page.getByRole('button', { name: /Explore$/ }).click();
    await waitForText(page, 'status', 'Changes have not been saved.');
    await page.evaluate(() => { window.denyLocalStorage = false; });
    await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
    await waitForText(page, 'status', 'Saved locally.');
    await page.reload();
    await waitForText(page, 'status', 'Saved locally.');
    assert.deepEqual(await currentProject(page), project);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('later store edits automatically save through the same connection', async () => {
  const { context, page, errors } = await openShell();
  try {
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Live AI', exact: true }).click();
    await waitForText(page, 'status', 'No project yet.');
    await page.getByLabel('Project name', { exact: true }).fill('Initial name');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await waitForText(page, 'status', 'Saved locally.');
    // Exercise a future stage action through the existing store, without building an editor.
    await page.evaluate(async () => {
      const { projectStore } = await import('/src/state/projectStore.ts');
      projectStore.updateProject({ name: 'Updated name', context: 'Updated brief' });
    });
    await page.getByRole('heading', { name: 'Updated name', exact: true }).waitFor();
    await waitForText(page, 'status', 'Saved locally.');
    const project = await currentProject(page);
    assert.equal(project.history.length, 1);
    await page.reload();
    await waitForText(page, 'status', 'Saved locally.');
    assert.deepEqual(await currentProject(page), project);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('legacy categories can be renamed and deleted while documents survive refresh', async () => {
  const { context, page, errors } = await openShell();
  try {
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Live AI', exact: true }).click();
    await waitForText(page, 'status', 'No project yet.');
    await page.getByLabel('Project name', { exact: true }).fill('Category management');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await waitForText(page, 'status', 'Saved locally.');
    const assetId = await page.evaluate(async () => {
      const { projectStore: store } = await import('/src/state/projectStore.ts');
      const { createLocalPersistence } = await import('/src/persistence/localPersistence.ts');
      const assetId = crypto.randomUUID();
      await createLocalPersistence().saveFile({ id: assetId, blob: new Blob(['Original research']) });
      const category = store.categories.add({ name: 'hello', order: 0 });
      store.sources.add({ title: 'Original notes', originalFile: { id: assetId, filename: 'notes.txt', mediaType: 'text/plain' }, primaryCategoryId: category.id, limitations: [], processingState: 'unprocessed' });
      return assetId;
    });
    await waitForText(page, 'status', 'Saved locally.'); await page.reload();
    await page.getByRole('button', { name: 'Rename hello', exact: true }).click();
    await page.getByLabel('Category name', { exact: true }).fill('Interviews');
    await page.getByRole('button', { name: 'Save name' }).click();
    await waitForText(page, 'status', 'Saved locally.'); await page.reload();
    await page.getByRole('button', { name: 'Inspect Interviews' }).waitFor();
    await page.locator('.research-library-files > summary').click();
    await page.getByRole('button', { name: 'Original notes', exact: true }).click();
    assert.equal(await page.getByLabel('Assigned category', { exact: true }).count(), 0);
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Delete category Interviews' }).click();
    assert.equal(await page.getByRole('button', { name: 'Inspect Interviews' }).count(), 1);
    page.once('dialog', async dialog => { assert.match(dialog.message(), /documents will be kept/); await dialog.accept(); });
    await page.getByRole('button', { name: 'Delete category Interviews' }).click();
    await waitForText(page, 'status', 'Saved locally.'); await page.reload();
    await page.locator('.research-library-files > summary').click();
    await page.getByRole('button', { name: 'Original notes', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Inspect Interviews' }).count(), 0);
    const file = await page.evaluate(async id => (await (await import('/src/persistence/localPersistence.ts')).createLocalPersistence().loadFile(id)).text(), assetId);
    assert.equal(file, 'Original research');
    await page.getByLabel('New category', { exact: true }).fill('New topic');
    await page.getByRole('button', { name: 'Create category' }).click();
    await waitForText(page, 'status', 'Saved locally.'); await page.reload();
    await page.getByRole('button', { name: 'Inspect New topic' }).waitFor();
    const project = await currentProject(page);
    assert.equal(project.sources.length, 1);
    assert.equal(project.sources[0].primaryCategoryId, undefined);
    assert.equal(project.categories[0].history[0].content.name, 'hello');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('project title can be edited and persists after refresh; Research heading is not repeated', async () => {
  const { context, page } = await openShell();
  try {
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Live AI', exact: true }).click();
    await waitForText(page, 'status', 'No project yet.');
    await page.getByLabel('Project name', { exact: true }).fill('Original title');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await page.getByRole('button', { name: 'Edit project title' }).click();
    await page.getByLabel('Project name', { exact: true }).fill('Updated title');
    await page.getByRole('button', { name: 'Save title' }).click();
    await waitForText(page, 'status', 'Saved locally.');
    await page.reload();
    await page.getByRole('heading', { name: 'Updated title', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Research', exact: true }).count(), 0);
    assert.equal(await page.getByLabel('Search research').count(), 0);
    assert.equal(await page.locator('.research-analyse-action').getByRole('button', { name: 'Analyse research' }).count(), 1);
  } finally { await context.close(); }
});

test('Opening manual Dimensions preserves saved research, reviews and dimensions without AI requests', async () => {
  const { context, page, errors } = await openShell();
  const requests = [];
  page.on('request', request => { if (request.url().includes('/api/dimensions/')) requests.push(request.url()); });
  try {
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Live AI', exact: true }).click();
    await waitForText(page, 'status', 'No project yet.');
    const before = await page.evaluate(async () => {
      const { projectStore: store } = await import('/src/state/projectStore.ts');
      store.createProject({ name: 'Saved reset fixture', context: 'Synthetic regression test' });
      const source = store.sources.add({ title: 'Notes', originalFile: { id: crypto.randomUUID(), filename: 'notes.txt', mediaType: 'text/plain' }, limitations: [], processingState: 'ready' });
      const evidence = store.evidence.add({ source: { id: source.id, revision: 1 }, text: 'Synthetic evidence', form: 'quotation', location: 'Paragraph 1', context: 'Test', limitations: [] });
      const claim = store.claims.add({ statement: 'Reviewed interpretation', evidence: [{ id: evidence.id, revision: 1 }], context: 'Test', limitations: [], review: { state: 'accepted', note: 'Keep this decision' } });
      const dimension = store.dimensions.add({ name: 'Saved variation', lowLabel: 'First', highLabel: 'Second', explanation: 'Existing saved dimension', claims: [{ id: claim.id, revision: 1 }], relationships: [], limitations: [], review: { state: 'accepted' } });
      store.setDimensionPosition({ dimension: { id: dimension.id, revision: 1 }, selected: true, value: .5 });
      return store.getProject();
    });
    await waitForText(page, 'status', 'Saved locally.');
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Dimensions', exact: true }).click();
      await page.getByRole('button', { name: 'Show dimensions', exact: true }).click();
      await page.locator('.dimension-card').getByRole('heading', { name: 'Saved variation', exact: true }).waitFor();
      assert.equal(await page.locator('.dimensions-workspace').count(), 1);
      assert.equal(await page.locator('.dimension-card').count(), 1);
      assert.equal(await page.getByRole('button', { name: /Confirm dimensions|Add custom dimension/ }).count(), 0);
      assert.deepEqual(await currentProject(page), before);
      assert.deepEqual(await page.evaluate(async () => (await import('/src/persistence/localPersistence.ts')).createLocalPersistence().loadProject()), before);
      if (i === 0) { await page.reload(); await waitForText(page, 'status', 'Saved locally.'); }
    }
    assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
