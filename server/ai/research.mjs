import { instructions, schema, PROMPT_VERSION } from '../prompts/research.mjs';

export function validateInput(input) {
  if (!input || !Array.isArray(input.chunks) || !input.chunks.length || input.chunks.length > 2000)
    throw new Error('Supply readable research passages.');
  if (input.context !== undefined && (typeof input.context !== 'string' || input.context.length > 4000)) throw new Error('Project context is too long.');
  let total = 0;
  const ids = new Set();
  for (const chunk of input.chunks) {
    if (!chunk || typeof chunk.id !== 'string' || ids.has(chunk.id)
      || typeof chunk.text !== 'string' || !chunk.text.trim() || chunk.text.length > 4000
      || typeof chunk.title !== 'string' || chunk.title.length > 1000
      || typeof chunk.location !== 'string' || chunk.location.length > 1000)
      throw new Error('Invalid research passages.');
    ids.add(chunk.id); total += chunk.text.length;
  }
  if (total > 120000) throw new Error('Research exceeds the 120,000 character prototype limit.');
}

export function validateOutput(output, chunks) {
  if (!output || !Array.isArray(output.categories) || output.categories.length > 20
    || !Array.isArray(output.warnings) || output.warnings.length > 30
    || output.warnings.some(item => typeof item !== 'string' || item.length > 1500))
    throw new Error('The model returned invalid output. No categories were added.');
  for (const category of output.categories) {
    if (!category || typeof category.name !== 'string' || !category.name.trim() || category.name.length > 120
      || typeof category.description !== 'string' || !category.description.trim() || category.description.length > 1500
      || !Array.isArray(category.passages) || !category.passages.length || category.passages.length > 100)
      throw new Error('The model returned an incomplete category. No categories were added.');
    for (const passage of category.passages) {
      const chunk = chunks.find(item => item.id === passage?.chunkId);
      if (!chunk || Object.keys(passage).length !== 1)
        throw new Error('An AI selection refers to an unknown research passage or contains generated quotation text. No categories were added. Please retry.');
    }
  }
  return output;
}

export async function analyseResearch(input, { apiKey, model = 'gpt-4.1-mini', fetchImpl = fetch } = {}) {
  validateInput(input);
  if (!apiKey) throw new Error('OpenAI is not configured on the server.');
  let response;
  try {
    response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({ model, store: false, instructions,
        input: JSON.stringify({ context: input.context ?? '', chunks: input.chunks.map(({ id, title, location, text }) => ({ id, title, location, text })) }),
        max_output_tokens: 12000,
        text: { format: { type: 'json_schema', name: 'research_categories', strict: true, schema } },
      }),
    });
  } catch {
    throw new Error('Could not reach OpenAI or the request timed out. Your research is unchanged. Please retry.');
  }
  if (!response.ok) {
    const messages = { 401: 'OpenAI rejected the server API key.', 403: 'This API key cannot access the selected model.',
      429: 'OpenAI usage or rate limits were reached. Check API billing or retry later.' };
    throw new Error(messages[response.status] ?? 'OpenAI could not complete the analysis. Please retry.');
  }
  const result = await response.json();
  if (result.status !== 'completed') throw new Error('OpenAI returned an incomplete analysis. No categories were added. Please retry.');
  const content = result.output?.flatMap(item => item.content ?? []) ?? [];
  if (content.some(item => item.type === 'refusal')) throw new Error('OpenAI declined this analysis. No categories were added.');
  const text = content.filter(item => item.type === 'output_text').map(item => item.text).join('');
  let output;
  try { output = JSON.parse(text); }
  catch { throw new Error('OpenAI returned unreadable output. No categories were added. Please retry.'); }
  validateOutput(output, input.chunks);
  return { ...output, model: result.model ?? model, promptVersion: PROMPT_VERSION };
}
