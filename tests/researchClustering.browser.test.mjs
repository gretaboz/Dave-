import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { createServer } from 'vite';
let server, browser;
before(async () => {
  const { chromium } = await import(process.env.DAVE_PLAYWRIGHT_MODULE ?? 'playwright');
  server = await createServer({ server: { host: '127.0.0.1', port: 5199, strictPort: false } });
  await server.listen();
  browser = await chromium.launch({ headless: true, executablePath: process.env.DAVE_BROWSER_EXECUTABLE });
});
after(async () => { await browser?.close(); await server?.close(); });

test('explicit analysis, category inspection, rename, reject, refresh and failed retry preserve research', async () => {
  const context = await browser.newContext(); const page = await context.newPage();
  try {
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Live AI', exact: true }).click();
    await page.getByLabel('Project name', { exact: true }).fill('Clustering test');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Saved locally.' }).waitFor();
    let calls = 0;
    // A controlled transport response tests UI behaviour; real OpenAI is separately smoke-tested.
    await page.route('**/api/research/cluster', async route => {
      calls++;
      const { chunks } = route.request().postDataJSON();
      await route.fulfill({ json: { model: 'transport-test', promptVersion: 'test', warnings: [], categories: [
        { name: 'Finding the entrance', description: 'Accounts of locating the entrance.', passages: chunks.map(chunk => ({ chunkId: chunk.id })) },
      ] } });
    });
    await page.getByLabel('Upload research documents').setInputFiles([
      { name: 'interview.txt', mimeType: 'text/plain', buffer: Buffer.from('The entrance was hard to find.') },
      { name: 'observation.txt', mimeType: 'text/plain', buffer: Buffer.from('Visitors asked where the entrance was.') },
    ]);
    await page.waitForFunction(() => !document.querySelector('input[type=file]').disabled);
    assert.equal(calls, 0);
    assert.equal(await page.getByText('The entrance was hard to find.', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Analyse research', exact: true }).click();
    await page.getByText('1 new categories proposed.', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Inspect Finding the entrance' }).click();
    await page.getByText('The entrance was hard to find.', { exact: true }).waitFor();
    await page.getByText('Visitors asked where the entrance was.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'View source' }).count(), 2);
    assert.equal(await page.getByLabel('Search research').count(), 0);
    await page.getByRole('button', { name: 'Rename Finding the entrance' }).click();
    await page.getByLabel('Category name', { exact: true }).fill('Entrances');
    await page.getByRole('button', { name: 'Save name', exact: true }).click();
    await page.getByRole('button', { name: 'Reject category' }).click();
    await page.getByRole('status').filter({ hasText: 'Saved locally.' }).waitFor();
    const before = await page.evaluate(async () => (await import('/src/state/projectStore.ts')).projectStore.getProject());
    await page.reload();
    await page.getByText('No active categories.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Inspect Entrances' }).count(), 0);
    assert.equal(await page.getByLabel('Show rejected categories').count(), 0);
    await page.unroute('**/api/research/cluster');
    await page.route('**/api/research/cluster', route => route.fulfill({ status: 502, json: { error: 'OpenAI usage limits were reached.' } }));
    await page.getByRole('button', { name: 'Analyse research', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'OpenAI usage limits' }).waitFor();
    const after = await page.evaluate(async () => (await import('/src/state/projectStore.ts')).projectStore.getProject());
    assert.deepEqual(after, before);
  } finally { await context.close(); }
});

test('file deletion confirms, clears affected summaries and stored text, preserves remaining passages across refresh', async () => {
  const context = await browser.newContext(); const page = await context.newPage();
  try {
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Live AI', exact: true }).click();
    await page.getByLabel('Project name', { exact: true }).fill('Deletion test');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Saved locally.' }).waitFor();
    await page.getByLabel('Upload research documents').setInputFiles([
      { name: 'remove.txt', mimeType: 'text/plain', buffer: Buffer.from('Unique deleted research.') },
      { name: 'keep.txt', mimeType: 'text/plain', buffer: Buffer.from('Remaining research.') },
    ]);
    await page.waitForFunction(() => !document.querySelector('input[type=file]').disabled);
    const fileId = await page.evaluate(async () => {
      const { projectStore: store } = await import('/src/state/projectStore.ts');
      const sources = store.getProject().sources;
      const category = store.addResearchAnalysis([{ name: 'Shared topic', description: 'Summary including unique deleted research.',
        passages: sources.map(source => ({ source: { id: source.id, revision: source.revision }, sectionIndex: 0, start: 0, end: source.preparedContent.sections[0].text.length })), review: { state: 'proposed' } }])[0];
      store.categories.update(category.id, { name: 'Renamed topic' });
      return sources[0].originalFile.id;
    });
    await page.getByRole('status').filter({ hasText: 'Saved locally.' }).waitFor();
    await page.locator('.research-library-files > summary').click();
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Delete remove.txt' }).click();
    assert.equal(await page.getByRole('button', { name: 'remove.txt', exact: true }).count(), 1);
    page.once('dialog', async dialog => { assert.match(dialog.message(), /cannot be undone/); await dialog.accept(); });
    await page.getByRole('button', { name: 'Delete remove.txt' }).click();
    await page.getByRole('status').filter({ hasText: 'Saved locally.' }).waitFor();
    await page.getByRole('button', { name: 'Inspect Renamed topic' }).click();
    await page.getByText('Remaining research.', { exact: true }).waitFor();
    assert.equal(await page.getByText('Unique deleted research.', { exact: true }).count(), 0);
    const saved = await page.evaluate(async id => {
      const { createLocalPersistence } = await import('/src/persistence/localPersistence.ts');
      const persistence = createLocalPersistence();
      return { project: await persistence.loadProject(), file: await persistence.loadFile(id) };
    }, fileId);
    assert.equal(saved.file, null);
    assert.equal(saved.project.sources.length, 1);
    assert.equal(saved.project.categories[0].description, undefined);
    assert.equal(saved.project.categories[0].history[0].content.name, 'Shared topic');
    assert.equal(JSON.stringify(saved.project).includes('Unique deleted research'), false);
    await page.reload();
    assert.equal(await page.getByRole('button', { name: 'remove.txt', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Inspect Renamed topic' }).click();
    await page.getByText('Remaining research.', { exact: true }).waitFor();
    await page.locator('.research-library-files > summary').click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete keep.txt' }).click();
    await page.getByRole('status').filter({ hasText: 'Saved locally.' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Inspect Renamed topic' }).count(), 0);
  } finally { await context.close(); }
});

test('long excerpt cards preview an exact slice and expand without changing stored research', async () => {
  const context = await browser.newContext(); const page = await context.newPage();
  try {
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Live AI', exact: true }).click();
    await page.getByLabel('Project name', { exact: true }).fill('Excerpt presentation');
    await page.getByRole('button', { name: 'Create project' }).click();
    const text = 'Document header and metadata. '.repeat(18) + 'Seating was comfortable, but the participant stood to reach the counter. ' + 'The participant described the kitchen visit in detail. '.repeat(12);
    await page.getByLabel('Upload research documents').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
    await page.waitForFunction(() => !document.querySelector('input[type=file]').disabled);
    await page.evaluate(async () => {
      const { projectStore: store } = await import('/src/state/projectStore.ts');
      const source = store.getProject().sources[0];
      store.addResearchAnalysis([{ name: 'Seating', description: 'Descriptions of seating comfort.', passages: [{ source: { id: source.id, revision: source.revision }, sectionIndex: 0, start: 0, end: source.preparedContent.sections[0].text.length }] }]);
    });
    await page.getByRole('button', { name: 'Inspect Seating' }).click();
    const quote = page.locator('blockquote');
    const preview = await quote.textContent();
    assert.ok(text.includes(preview)); assert.ok(preview.length <= 320);
    assert.equal(preview.includes('Document header'), false);
    await page.getByRole('button', { name: 'Show more' }).click();
    assert.equal(await quote.textContent(), text.trim());
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'View source' }).click();
    assert.equal((await download).suggestedFilename(), 'notes.txt');
    await page.getByRole('button', { name: 'Show less' }).click();
    assert.equal(await quote.textContent(), preview);
    const stored = await page.evaluate(async () => (await import('/src/state/projectStore.ts')).projectStore.getProject().sources[0].preparedContent.sections[0].text);
    assert.equal(stored, text.trim());
  } finally { await context.close(); }
});
