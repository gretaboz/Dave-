import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { analyseResearch, validateInput, validateOutput } from '../server/ai/research.mjs';
const chunks = [{ id: 'a', title: 'Synthetic notes', location: 'Paragraph 1', text: 'Visitors asked for directions.' }];
const category = { name: 'Directions', description: 'Requests for directions.', passages: [{ chunkId: 'a' }] };
// Transport doubles exercise failure handling only; application output always uses OpenAI.
const response = output => async () => ({ ok: true, json: async () => ({ status: 'completed', model: 'test', output: [{ content: [{ type: 'output_text', text: JSON.stringify(output) }] }] }) });
test('server validates research and selected passage IDs', async () => {
  assert.throws(() => validateInput({ chunks: [...chunks, ...chunks] }));
  const output = await analyseResearch({ chunks }, { apiKey: 'test-only', fetchImpl: response({ categories: [category], warnings: [] }) });
  assert.equal(output.categories.length, 1);
  await assert.rejects(analyseResearch({ chunks }, { apiKey: 'test-only', fetchImpl: response({ categories: [{ ...category, passages: [{ chunkId: 'fabricated-id' }] }], warnings: [] }) }), /unknown research passage/);
});
test('missing credentials, rate limits, incomplete output and refusals fail honestly', async () => {
  await assert.rejects(analyseResearch({ chunks }), /not configured/);
  await assert.rejects(analyseResearch({ chunks }, { apiKey: 'test-only', fetchImpl: async () => ({ ok: false, status: 429 }) }), /limits/);
  await assert.rejects(analyseResearch({ chunks }, { apiKey: 'test-only', fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'incomplete' }) }) }), /incomplete/);
  await assert.rejects(analyseResearch({ chunks }, { apiKey: 'test-only', fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }) }) }), /declined/);
});

test('cluster validation rejects repeated groups, shared passages and more than six groups', () => {
  assert.throws(() => validateOutput({ categories: [category, { ...category, name: 'Wayfinding' }], warnings: [] }, chunks), /overlapping/);
  assert.throws(() => validateOutput({ categories: [category, { ...category, name: ' directions ' }], warnings: [] }, chunks), /duplicate/);
  assert.throws(() => validateOutput({ categories: Array(7).fill(category), warnings: [] }, chunks), /invalid output/);
  const other = { id: 'b', title: 'Other notes', location: 'Paragraph 2', text: 'Seating was comfortable.' };
  assert.equal(validateOutput({ categories: [category, { name: 'Seating', description: 'Seating accounts.', passages: [{ chunkId: 'b' }] }], warnings: [] }, [...chunks, other]).categories.length, 2);
});

test('semantic review merges neighbouring topics while preserving passage coverage', async () => {
  const input = { chunks: [...chunks, { id: 'b', title: 'Commuting notes', location: 'Paragraph 2', text: 'Carrying a bag on a train.' }] };
  const draft = { categories: [
    { name: 'Commutes', description: 'Travel routines.', passages: [{ chunkId: 'a' }] },
    { name: 'Bag use', description: 'Carrying routines.', passages: [{ chunkId: 'b' }] },
  ], warnings: [] };
  const merged = { categories: [{ name: 'Everyday use', description: 'Travel and carrying routines.', passages: [{ chunkId: 'a' }, { chunkId: 'b' }] }], warnings: [] };
  const requests = [];
  const fetchImpl = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return response(requests.length === 1 ? draft : merged)();
  };
  const result = await analyseResearch(input, { apiKey: 'test-only', fetchImpl });
  assert.equal(requests.length, 2);
  assert.equal(result.categories.length, 1);
  assert.equal(result.categories[0].passages.length, 2);
  assert.equal(JSON.parse(requests[1].input).chunks, undefined);
  let calls = 0;
  await assert.rejects(analyseResearch(input, { apiKey: 'test-only', fetchImpl: async () => response(++calls === 1 ? draft : { categories: [category], warnings: [] })() }), /coverage/);
});

test('oversized or overlapping drafts reach the merge review before final validation', async () => {
  const draft = { categories: Array.from({ length: 7 }, (_, i) => ({ ...category, name: 'Topic ' + i })), warnings: [] };
  let calls = 0;
  const result = await analyseResearch({ chunks }, { apiKey: 'test-only', fetchImpl: async () => response(++calls === 1 ? draft : { categories: [category], warnings: [] })() });
  assert.equal(calls, 2);
  assert.equal(result.categories.length, 1);
  calls = 0;
  await assert.rejects(analyseResearch({ chunks }, { apiKey: 'test-only', fetchImpl: async () => { calls++; return response(draft)(); } }), /invalid output/);
  assert.equal(calls, 2);
});
