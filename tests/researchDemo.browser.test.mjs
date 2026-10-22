import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { createServer } from 'vite';
let server, browser;
before(async () => {
  const { chromium } = await import(process.env.DAVE_PLAYWRIGHT_MODULE ?? 'playwright');
  server = await createServer({ server: { host: '127.0.0.1', port: 5201, strictPort: false } });
  await server.listen(); browser = await chromium.launch({ headless: true, executablePath: process.env.DAVE_BROWSER_EXECUTABLE });
});
after(async () => { await browser?.close(); await server?.close(); });
test('demo is isolated, editable, persistent and never calls the AI endpoint', async () => {
  const context = await browser.newContext(); const page = await context.newPage(); let requests = 0;
  await page.route('**/api/**', route => { requests++; return route.abort(); });
  try {
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Inspect Holding and pressing' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Demo', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Analyse research', exact: true }).click();
    await page.getByRole('button', { name: 'Inspect Holding and pressing' }).click();
    await page.getByText('Synthetic demo proposal', { exact: true }).waitFor();
    assert.ok(await page.locator('blockquote').count());
    await page.getByRole('button', { name: 'Rename Holding and pressing' }).click();
    await page.getByLabel('Category name', { exact: true }).fill('Demo grip');
    await page.getByRole('button', { name: 'Save name' }).click();
    await page.getByRole('status').filter({ hasText: 'Saved locally.' }).waitFor();
    await page.getByRole('button',{name:'Relationships',exact:true}).click();
    await page.getByRole('heading',{name:'Demo grip',exact:true}).waitFor();
    assert.equal(await page.getByRole('heading',{name:'Pulp and cleaning',exact:true}).count(),1);
    await page.getByRole('button',{name:'Analyse relationships',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Demo project'}).waitFor();
    assert.equal(requests,0);
    await page.getByRole('button',{name:'Dimensions',exact:true}).click();
    await page.locator('.dimensions-workspace').getByRole('button', {name:'Show dimensions',exact:true}).waitFor();
    await page.locator('.dimensions-workspace').getByRole('heading',{name:'Demo grip',exact:true}).waitFor();
    await page.getByRole('button',{name:'Research',exact:true}).click();
    await page.getByRole('button', { name: 'Live AI', exact: true }).click();
    await page.getByLabel('Project name', { exact: true }).fill('Real project');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Saved locally.' }).waitFor();
    const original = await page.evaluate(async () => (await import('/src/state/projectStore.ts')).projectStore.getProject());
    assert.equal(original.sources.length, 0);
    await page.getByRole('button', { name: 'Demo', exact: true }).click();
    await page.getByRole('button', { name: 'Inspect Demo grip' }).click();
    page.once('dialog', async dialog => {
      assert.equal(dialog.type(), 'confirm');
      assert.match(dialog.message(), /Delete “Demo grip”/);
      await dialog.accept();
    });
    await page.getByRole('button', { name: 'Delete category Demo grip', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Saved locally.' }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Inspect Pulp and cleaning' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Inspect Demo grip' }).count(), 0);
    await page.getByRole('button', { name: 'Analyse research', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Inspect Demo grip' }).count(), 0);
    await page.getByRole('button', { name: 'Live AI', exact: true }).click();
    assert.deepEqual(await page.evaluate(async () => (await import('/src/state/projectStore.ts')).projectStore.getProject()), original);
    assert.equal(requests, 0);
  } finally { await context.close(); }
});

test('category selection shows only linked excerpts and preserves the file library', async () => {
  const context = await browser.newContext(); const page = await context.newPage();
  try {
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Inspect Holding and pressing' }).waitFor();
    const allCards = await page.locator('article.research-excerpt').count();
    assert.ok(allCards > 3);
    await page.getByRole('button', { name: 'Inspect Holding and pressing' }).click();
    assert.equal(await page.getByRole('button', { name: 'Inspect Holding and pressing' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.research-excerpt-linked').count(), 3);
    assert.equal(await page.locator('.research-excerpt-other').count(), 0);
    assert.equal(await page.locator('article.research-excerpt').count(), 3);
    const shared = page.locator('article.research-excerpt').filter({ hasText: 'Participant A squeezed three oranges' });
    assert.equal(await shared.count(), 1);
    assert.equal(await shared.getAttribute('data-linked'), 'true');
    await page.getByRole('button', { name: 'Inspect Collecting and pouring juice' }).click();
    assert.equal(await page.locator('.research-excerpt-linked').count(), 1);
    assert.equal(await shared.count(), 0);
    assert.equal(await page.locator('article.research-excerpt').count(), 1);
    assert.equal(await page.getByRole('region', { name: 'Uploaded files' }).locator('li').count(), 3);
    await page.getByRole('button', { name: 'Inspect Everyday and shared use' }).click();
    assert.equal(await shared.getAttribute('data-linked'), 'true');
  } finally { await context.close(); }
});

test('redesigned layout keeps upload and analysis above category cards beside the research map', async () => {
  const context = await browser.newContext(); const page = await context.newPage();
  try {
    await page.setViewportSize({ width: 1100, height: 1000 });
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Inspect Holding and pressing' }).waitFor();
    const library = page.locator('.research-library');
    assert.equal(await library.locator('input[type=file]').count(), 1);
    await library.locator('.research-library-files > summary').click();
    assert.equal(await library.getByRole('button', { name: /Delete Synthetic/ }).count(), 3);
    await library.locator('.research-library-files > summary').click();
    const positions = await page.evaluate(() => {
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
      return { library: rect('.research-library'), analyse: rect('.research-analyse-action'), categories: rect('.research-category-list'), sources: rect('.research-inspector'), map: rect('.relationship-map-canvas') };
    });
    assert.equal(await page.getByLabel('Optional project context').count(), 0);
    assert.equal(await page.getByText('Your research, connected', { exact: true }).count(), 0);
    assert.ok(positions.library.bottom <= positions.analyse.top);
    assert.ok(positions.analyse.bottom <= positions.categories.top);
    assert.ok(positions.categories.right <= positions.map.left + 1);
    assert.ok(positions.sources.top >= positions.categories.bottom);
    await page.screenshot({ path: '/private/tmp/dave-wireframe-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 792, height: 924 });
    const columns = await page.evaluate(() => {
      const a = document.querySelector('.research-category-list').getBoundingClientRect();
      const b = document.querySelector('.relationship-map-canvas').getBoundingClientRect();
      return a.right <= b.left + 1;
    });
    assert.equal(columns, true);
    await page.screenshot({ path: '/private/tmp/dave-wireframe-792.png', fullPage: true });
  } finally { await context.close(); }
});

test('library retracts, selected folders connect to sources, and category creation has a separate box', async () => {
  const context = await browser.newContext(); const page = await context.newPage();
  try {
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Inspect Holding and pressing' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Delete Synthetic kitchen interviews.txt' }).isVisible(), false);
    await page.locator('.research-library-files > summary').click();
    assert.equal(await page.getByRole('button', { name: 'Delete Synthetic kitchen interviews.txt' }).isVisible(), true);
    await page.locator('.research-library-files > summary').click();
    assert.equal(await page.getByRole('button', { name: 'Delete Synthetic kitchen interviews.txt' }).isVisible(), false);
    await page.getByRole('button', { name: 'Inspect Holding and pressing' }).click();
    assert.equal(await page.getByRole('button', { name: 'Inspect Holding and pressing' }).evaluate(el => getComputedStyle(el, '::after').content), 'none');
    assert.equal(await page.locator('.research-category-list').getByLabel('New category', { exact: true }).count(), 0);
    const box = page.getByRole('region', { name: 'Add your own category' });
    await box.getByLabel('New category', { exact: true }).fill('Custom demo category');
    await box.getByRole('button', { name: 'Create category' }).click();
    await page.getByRole('button', { name: 'Inspect Custom demo category' }).waitFor();
    assert.ok(await box.evaluate(el => el.getBoundingClientRect().top >= document.querySelector('.research-folder-workspace').getBoundingClientRect().bottom));
  } finally { await context.close(); }
});

test('research map and source dialog preserve research, focus and category colours across stages', async () => {
  const context = await browser.newContext(); const page = await context.newPage();
  try {
    await page.goto(server.resolvedUrls.local[0]);
    const inspect = page.getByRole('button', { name: 'Inspect Holding and pressing', exact: true });
    await inspect.waitFor();
    const accent = await page.locator('.research-category-row').first().evaluate(el => getComputedStyle(el).getPropertyValue('--category-accent').trim());
    const node = page.locator('.map-category').first();
    assert.equal(await node.evaluate(el => getComputedStyle(el).getPropertyValue('--category-accent').trim()), accent);
    await page.getByRole('button', { name: 'Hide panel', exact: true }).click();
    assert.equal(await inspect.isVisible(), false);
    await node.getByRole('button', {name:'Inspect sources',exact:true}).click();
    await page.getByRole('button', { name: 'Open source details ↗', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Source details' });
    await dialog.waitFor();
    assert.equal(await dialog.locator('.research-excerpt').count(), 3);
    const originalText = await dialog.locator('blockquote').first().textContent();
    await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(), false);
    assert.equal(await inspect.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.research-inspector blockquote').first().textContent(), originalText);
    await page.getByRole('button', { name: 'Open source details ↗', exact: true }).click();
    await dialog.waitFor();
    await page.getByRole('button', { name: 'Close source details', exact: true }).click();
    await page.getByRole('button', { name: 'Relationships', exact: true }).click();
    const group = page.locator('.progressive-map-workspace .map-category').first();
    assert.equal(await group.evaluate(el => getComputedStyle(el).getPropertyValue('--category-accent').trim()), accent);
    for (const width of [1440, 1280, 1100, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.getByRole('button', { name: 'Research', exact: true }).click();
      assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
      await page.getByRole('button', { name: 'Relationships', exact: true }).click();
      assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
    }
  } finally { await context.close(); }
});
