import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createServer } from 'vite';

test('manual dimensions share the map, preserve research and earlier data, and persist all tuning and edits', async () => {
  const { chromium } = await import(process.env.DAVE_PLAYWRIGHT_MODULE ?? 'playwright');
  const server = await createServer({ server: { host: '127.0.0.1', port: 5199, strictPort: false } });
  await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.DAVE_BROWSER_EXECUTABLE });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let requests = 0; await page.route('**/api/**', route => { requests++; return route.abort(); });
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Live AI', exact: true }).click();
    await page.getByLabel('Project name', { exact: true }).fill('Dimension test');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await page.getByRole('button', { name: 'Dimensions', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Show dimensions', exact: true }).isEnabled(), true);
    await page.getByRole('button', { name: 'Show dimensions', exact: true }).click();
    await page.getByRole('button', { name: 'Add dimension', exact: true }).click();
    await page.getByRole('form', { name: 'Add dimension', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByText('Add dimensions manually to explore design considerations.', { exact: false }).waitFor();
    const original = await page.evaluate(async () => {
      const s = (await import('/src/state/projectStore.ts')).projectStore;
      const category = s.categories.add({ name: 'Use', order: 0 });
      const source = s.sources.add({ title: 'Test interview', originalFile: { id: 'test', filename: 'test.txt', mediaType: 'text/plain' }, limitations: [], processingState: 'ready' });
      const evidence = s.evidence.add({ source: { id: source.id, revision: 1 }, categories: [{ id: category.id, revision: 1 }], text: 'Force varies.', form: 'quotation', location: 'Paragraph 1', context: 'Test', limitations: [] });
      const claims = ['Force varies between users.', 'Assistance changes effort.'].map(statement => s.claims.add({ statement, evidence: [{ id: evidence.id, revision: 1 }], context: 'Test', limitations: [], review: { state: 'accepted' } }));
      s.relationships.add({ description: 'Effort and assistance', type: 'connection', claims: claims.map(c => ({ claim: { id: c.id, revision: 1 } })), explanation: 'Test relationship', limitations: [], review: { state: 'accepted' } });
      const old = s.dimensions.add({ name: 'Earlier dimension', lowLabel: 'Less', highLabel: 'More', explanation: 'Saved earlier', claims: [], relationships: [], limitations: [], review: { state: 'accepted' } }, 'dave');
      s.setDimensionPosition({ dimension: { id: old.id, revision: 1 }, selected: false, value: .37, reasoning: 'Keep this choice' });
      return s.getProject();
    });
    const snapshot = () => page.evaluate(async () => (await import('/src/state/projectStore.ts')).projectStore.getProject());
    const openDimensions = async () => {
      await page.getByRole('button', { name: 'Dimensions', exact: true }).click();
      await page.getByRole('button', { name: 'Show dimensions', exact: true }).click();
    };
    const saved = () => page.getByText('Saved locally.', { exact: true }).waitFor();
    await openDimensions();
    assert.equal(await page.locator('.dimensions-workspace [data-map-id]').count(), 2);
    await page.getByRole('button', { name: 'Add dimension', exact: true }).click();
    const editor = page.getByRole('form', { name: 'Add dimension', exact: true });
    await editor.getByLabel('Title', { exact: true }).fill('Mechanical assistance');
    await editor.getByLabel('Brief explanation', { exact: true }).fill('How much force the mechanism provides.');
    for (const [value, label] of [[-1, 'Manual'], [0, 'Supported'], [1, 'Highly assisted']]) {
      await editor.getByLabel(`Position ${value} label`, { exact: true }).fill(label);
      await editor.getByLabel(`Position ${value} explanation (optional)`, { exact: true }).fill(`${label} explanation`);
    }
    await editor.getByText('Associate findings (0)', { exact: true }).click();
    await editor.getByRole('checkbox', { name: 'Force varies between users.' }).check();
    await editor.getByRole('checkbox', { name: 'Effort and assistance' }).check();
    await editor.getByRole('button', { name: 'Save dimension', exact: true }).click();
    const card = page.locator('.dimension-card').filter({ has: page.getByRole('heading', { name: 'Mechanical assistance', exact: true }) });
    assert.equal(await card.getByRole('button', { name: '0: Supported', exact: true }).getAttribute('aria-pressed'), 'true');
    for (const [name, value] of [['-1: Manual', 0], ['+1: Highly assisted', 1], ['0: Supported', .5]]) {
      await card.getByRole('button', { name, exact: true }).click();
      await saved(); await page.reload(); await openDimensions();
      assert.equal((await snapshot()).dimensionPositions.at(-1).value, value);
      assert.equal(await card.getByRole('button', { name, exact: true }).getAttribute('aria-pressed'), 'true');
    }
    const lines=page.locator('.dimensions-workspace [data-association-from]');
    assert.equal(await lines.count(),2);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-association-from]')].every(line => getComputedStyle(line).opacity === '0.32'));
    assert.deepEqual(await lines.evaluateAll(items => items.map(line => line.dataset.active)), ['false', 'false']);
    await card.getByRole('heading',{name:'Mechanical assistance',exact:true}).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-association-from]')].every(line => getComputedStyle(line).opacity === '0.95'));
    assert.deepEqual(await lines.evaluateAll(items => items.map(line => line.dataset.active)), ['true', 'true']);
    // The same findings control toggles the dimension inspector and its highlights.
    await card.getByRole('button', { name: 'Associated findings (2)', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-association-from]')].every(line => getComputedStyle(line).opacity === '0.32'));
    assert.deepEqual(await lines.evaluateAll(items => items.map(line => line.dataset.active)), ['false', 'false']);
    await card.getByRole('button', { name: 'Associated findings (2)', exact: true }).click();
    assert.equal(await page.locator('.dimensions-workspace [data-association-from]').count(), 2);
    await page.getByLabel('Dimension and research inspector').getByText('Force varies between users.', { exact: true }).waitFor();
    await card.getByRole('button', { name: 'Edit Mechanical assistance', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Assistance level');
    await page.getByRole('button', { name: 'Save dimension', exact: true }).click();
    await saved(); await page.reload(); await openDimensions();
    let project = await snapshot();
    const added = project.dimensions.at(-1);
    assert.equal(added.name, 'Assistance level'); assert.equal(added.history[0].content.name, 'Mechanical assistance');
    assert.equal(added.lowExplanation, 'Manual explanation'); assert.equal(added.midExplanation, 'Supported explanation');
    assert.deepEqual(added.claims, [{ id: original.claims[0].id, revision: 1 }]);
    assert.deepEqual(added.relationships, [{ id: original.relationships[0].id, revision: 1 }]);
    await page.getByRole('button', { name: 'Edit Assistance level', exact: true }).click();
    await page.getByRole('button', { name: 'Remove dimension', exact: true }).click();
    await saved(); await page.reload(); await openDimensions();
    project = await snapshot();
    assert.ok(project.dimensions.at(-1).archivedAt);
    assert.equal(await page.locator('.dimension-card').count(), 1);
    assert.deepEqual(project.dimensions[0], original.dimensions[0]);
    assert.deepEqual(project.dimensionPositions[0], original.dimensionPositions[0]);
    for (const key of ['sources', 'categories', 'evidence', 'claims', 'relationships', 'directions', 'explorationNodes']) assert.deepEqual(project[key], original[key]);
    assert.equal(requests, 0); assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});
