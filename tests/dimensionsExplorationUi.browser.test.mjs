import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createServer } from 'vite';
import { questionOutput } from './fixtures/exploration.mjs';

test('tuning panel, visible choice meanings and Exploration card types remain usable across viewport sizes', async () => {
  const { chromium } = await import(process.env.DAVE_PLAYWRIGHT_MODULE ?? 'playwright');
  const server = await createServer({ server: { host: '127.0.0.1', port: 5222, strictPort: false } });
  await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.DAVE_BROWSER_EXECUTABLE });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Live AI', exact: true }).click();
    await page.getByLabel('Project name', { exact: true }).fill('Isolated UI check');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    const before = await page.evaluate(async () => {
      const store = (await import('/src/state/projectStore.ts')).projectStore;
      const dimension = store.dimensions.add({ name: 'Amount of guidance during a first visit', explanation: 'Explore how much guidance someone can choose during a visit.',
        lowLabel: 'Choose independently', midLabel: 'Optional support', highLabel: 'Step-by-step guidance',
        lowExplanation: 'The visitor chooses the sequence.', midExplanation: 'Support is available when wanted.', highExplanation: 'A sequence guides the visit.',
        claims: [], relationships: [], limitations: [], review: { state: 'accepted' } });
      store.setDimensionPosition({ dimension: { id: dimension.id, revision: 1 }, selected: true, value: .5 });
      return store.getProject();
    });
    const stage = name => page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
    await stage('Dimensions');
    assert.equal(await page.locator('.dimension-stage-panel .dimension-card').count(), 1);
    assert.equal(await page.locator('.map-dimensions-area .dimension-card').count(), 0);
    assert.equal(await page.locator('.dimension-map-reference').count(), 1);
    const confirmBox = await page.getByRole('button', { name: 'Confirm tuning', exact: true }).boundingBox();
    const panelBox = await page.locator('.dimension-stage-panel').boundingBox();
    assert.ok(confirmBox.y + confirmBox.height <= panelBox.y + panelBox.height);
    const current = page.getByRole('button', { name: '0: Optional support', exact: true });
    assert.equal(await current.getAttribute('aria-pressed'), 'true');
    assert.match(await current.innerText(), /Optional support/);
    for (const width of [1440, 1280, 1100, 792, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
      assert.equal(await current.isVisible(), true);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.route('**/api/exploration/question', route => {
      const input = route.request().postDataJSON();
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...questionOutput(input,
        'What would change if a visitor wanted support only halfway through the visit?'), model: 'synthetic', promptVersion: 'test' }) });
    });
    await page.getByRole('button', { name: 'Confirm tuning', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Exploration', exact: true }).getAttribute('aria-current'), 'step');
    await page.getByRole('button', { name: 'Dave asks', exact: true }).click();
    await page.locator('.exploration-question').waitFor();
    assert.equal(await page.locator('.exploration-question .exploration-card-eyebrow').innerText(), 'DAVE QUESTION');
    await page.getByRole('button', { name: 'Add text', exact: true }).click();
    const editor = page.locator('.exploration-editor');
    await editor.getByLabel('Card type', { exact: true }).selectOption('note');
    await editor.getByLabel('Idea title', { exact: true }).fill('Visitor response');
    await editor.getByLabel('Idea text', { exact: true }).fill('A note to explore this question.');
    await editor.getByRole('button', { name: 'Save idea', exact: true }).click();
    await editor.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('[data-content-type="note"] .exploration-card-eyebrow').innerText(), 'YOUR NOTE');
    for (const width of [1440, 1280, 1100, 792, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
    }
    const hitArea = page.locator('.exploration-arrow-hit').first();
    assert.equal(await hitArea.evaluate(el => getComputedStyle(el).stroke), 'rgba(0, 0, 0, 0)');
    const after = await page.evaluate(async () => (await import('/src/state/projectStore.ts')).projectStore.getProject());
    assert.deepEqual(after.dimensions, before.dimensions);
    assert.deepEqual(after.dimensionPositions, before.dimensionPositions);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});
