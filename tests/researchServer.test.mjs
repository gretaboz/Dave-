import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { analyseResearch, validateInput } from '../server/ai/research.mjs';
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
