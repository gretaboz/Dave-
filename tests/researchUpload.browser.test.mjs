// Synthetic document fixtures test extraction; they are never seeded in the app.
import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
let server, browser;
before(async () => {
  const { chromium } = await import(process.env.DAVE_PLAYWRIGHT_MODULE ?? 'playwright');
  server = await createServer({ server: { host: '127.0.0.1', port: 5198, strictPort: false } });
  await server.listen();
  browser = await chromium.launch({ headless: true, executablePath: process.env.DAVE_BROWSER_EXECUTABLE });
});
after(async () => { await browser?.close(); await server?.close(); });
async function setup() {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Live AI', exact: true }).click();
  await page.getByLabel('Project name', { exact: true }).fill('Upload test');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Saved locally.' }).waitFor();
  return { context, page };
}
async function project(page) {
  return page.evaluate(async () => (await import('/src/state/projectStore.ts')).projectStore.getProject());
}
async function upload(page, payload) {
  await page.getByLabel('Upload research documents').setInputFiles(payload);
  await page.waitForFunction(async () => {
    const state = (await import('/src/state/projectStore.ts')).projectStore.getProject();
    return state.sources.length && state.sources.every(source => ['ready', 'failed'].includes(source.processingState));
  });
  await page.getByLabel('Upload research documents').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('input[type=file]').disabled);
  await page.getByRole('status').filter({ hasText: 'Saved locally.' }).waitFor();
}
test('TXT uploads preserve manual categories, original bytes, and located text across refresh', async () => {
  const { context, page } = await setup();
  try {
    await page.getByLabel('New category').fill('Manual notes');
    await page.getByRole('button', { name: 'Create category', exact: true }).click();
    const before = await project(page);
    const text = 'First observation.\r\n\r\nSecond observation with café.';
    await upload(page, { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
    const saved = await project(page);
    assert.deepEqual(saved.categories, before.categories);
    assert.equal(saved.sources[0].primaryCategoryId, undefined);
    assert.deepEqual(saved.sources[0].preparedContent.sections, [
      { location: 'Paragraph 1', text: 'First observation.' },
      { location: 'Paragraph 2', text: 'Second observation with café.' },
    ]);
    for (const key of ['evidence', 'claims', 'relationships', 'dimensions', 'directions']) assert.deepEqual(saved[key], []);
    const original = await page.evaluate(async id => (await (await import('/src/persistence/localPersistence.ts')).createLocalPersistence().loadFile(id)).text(), saved.sources[0].originalFile.id);
    assert.equal(original, text);
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download original' }).click();
    assert.equal((await downloadEvent).suggestedFilename(), 'notes.txt');
    await page.reload();
    await page.getByRole('status').filter({ hasText: 'Saved locally.' }).waitFor();
    assert.deepEqual(await project(page), saved);
    await page.locator('.research-library-files > summary').click();
    await page.getByRole('button', { name: 'notes.txt', exact: true }).first().click();
    assert.equal(await page.getByText('Second observation with café.', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('heading', { name: 'Extracted text' }).count(), 0);
  } finally { await context.close(); }
});
test('PDF pages and DOCX paragraphs are extracted, including a visible blank-page limitation', async () => {
  const { context, page } = await setup();
  try {
    await upload(page, [
      { name: 'research.pdf', mimeType: 'application/pdf', buffer: await readFile(new URL('./fixtures/research.pdf', import.meta.url)) },
      { name: 'research.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await readFile(new URL('./fixtures/research.docx', import.meta.url)) },
    ]);
    const saved = await project(page);
    assert.equal(saved.sources.length, 2);
    const [pdf, docx] = saved.sources;
    assert.equal(pdf.processingState, 'ready', pdf.processingError);
    assert.deepEqual(pdf.preparedContent.sections, [{ location: 'Page 1', text: 'Research on page one.' }, { location: 'Page 2', text: '' }]);
    assert.ok(pdf.preparedContent.limitations.some(text => text.startsWith('Page 2:')));
    assert.equal(docx.processingState, 'ready', docx.processingError);
    assert.deepEqual(docx.preparedContent.sections, [{ location: 'Paragraph 1', text: 'Visitor interview.' }, { location: 'Paragraph 2', text: 'I found the entrance easily.' }]);
    await page.locator('.research-library-files > summary').click();
    await page.getByRole('button', { name: 'research.pdf', exact: true }).first().click();
    await page.getByText('Extraction limitations', { exact: true }).click();
    await page.getByText(/Page 2: no readable text found/).waitFor();
  } finally { await context.close(); }
});
test('failed extraction retains original files, invents no content, and allows retry', async () => {
  const { context, page } = await setup();
  try {
    await upload(page, [
      { name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') },
      { name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.from('   ') },
      { name: 'broken.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('not a zip') },
      { name: 'encoded.txt', mimeType: 'text/plain', buffer: Buffer.from([0xff, 0xfe, 0]) },
    ]);
    const state = await project(page);
    assert.equal(state.sources.length, 4);
    for (const source of state.sources) {
      assert.equal(source.processingState, 'failed');
      assert.ok(source.processingError);
      assert.equal(source.preparedContent, undefined);
      assert.ok(await page.evaluate(async id => !!await (await import('/src/persistence/localPersistence.ts')).createLocalPersistence().loadFile(id), source.originalFile.id));
    }
    await page.locator('.research-library-files > summary').click();
    await page.getByRole('button', { name: /broken.pdf — Extraction failed/ }).first().click();
    await page.getByRole('button', { name: 'Retry text extraction' }).click();
    await page.waitForFunction(() => !document.querySelector('input[type=file]').disabled);
    assert.equal((await project(page)).sources[0].processingState, 'failed');
    await page.reload();
    await page.getByRole('status').filter({ hasText: 'Saved locally.' }).waitFor();
    assert.equal((await project(page)).sources[0].processingState, 'failed');
  } finally { await context.close(); }
});
test('unsupported, oversized, and storage-failed uploads do not alter existing research', async () => {
  const { context, page } = await setup();
  try {
    const result = await page.evaluate(async () => {
      const { uploadResearch } = await import('/src/features/research/uploadResearch.ts');
      const { createProjectSession } = await import('/src/state/projectSession.ts');
      const { createProjectStore } = await import('/src/state/projectStore.ts');
      const store = createProjectStore();
      const session = createProjectSession(store, { loadIntoStore: async () => null,
        saveProject: async () => {}, saveFile: async () => { throw new Error('Storage full'); } });
      const stop = session.connect();
      await new Promise(resolve => setTimeout(resolve, 0));
      session.createProject({ name: 'Existing', context: '' });
      store.categories.add({ name: 'Keep me', order: 0 });
      const before = store.getProject();
      const errors = [];
      for (const file of [new File(['data'], 'data.csv'), new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.txt'), new File(['text'], 'notes.txt')]) {
        try { await uploadResearch(session, file); } catch (error) { errors.push(error.message); }
      }
      const after = store.getProject();
      stop();
      return { before, after, errors };
    });
    assert.deepEqual(result.after, result.before);
    assert.match(result.errors[0], /PDF, TXT, or DOCX/);
    assert.match(result.errors[1], /20 MB/);
    assert.equal(result.errors[2], 'Storage full');
  } finally { await context.close(); }
});
