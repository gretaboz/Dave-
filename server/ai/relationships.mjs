import { claimSchema, relationshipSchema, claimInstructions, relationshipInstructions, PROMPT_VERSION, types } from '../prompts/relationships.mjs';
import { validateInput as validatePassages } from './research.mjs';
export function validateInput(input) {
  validatePassages(input);
  if(input.categories!==undefined){
    if(!Array.isArray(input.categories)||new Set(input.categories.map(c=>c?.id)).size!==input.categories.length||input.categories.some(c=>!c||typeof c.id!=='string'||!c.id||!Number.isInteger(c.revision)||c.revision<1||typeof c.name!=='string'))throw new Error('Invalid research category catalogue.');
    for(const p of input.chunks){if(!Array.isArray(p.categoryReferences)||!p.categoryReferences.length||p.categoryReferences.some(ref=>!input.categories.some(c=>c.id===ref.id&&c.revision===ref.revision))||p.categoryReferences.length!==p.categories?.length||p.categoryReferences.some((ref,i)=>input.categories.find(c=>c.id===ref.id)?.name!==p.categories[i]))throw new Error('Unknown or stale research category reference.');}
  }
  for (const p of input.chunks) if (!Array.isArray(p.categories) || p.categories.some(c => typeof c !== 'string' || c.length > 120)) throw new Error('Invalid categories.');
}
const text = (v, max = 2000) => typeof v === 'string' && v.length <= max;
const strings = v => Array.isArray(v) && v.length <= 30 && v.every(x => text(x));
export function validateClaims(output, chunks) {
  if (!output || !strings(output.warnings) || !Array.isArray(output.claims) || output.claims.length > 16) throw new Error('Invalid claim output. Nothing was added.');
  const ids = new Set();
  for (const c of output.claims) {
    if (!c || !text(c.id, 100) || !c.id || ids.has(c.id) || !text(c.statement) || !c.statement.trim() || !text(c.context) || !text(c.stakeholder) || !strings(c.limitations) || !strings(c.passageIds) || !c.passageIds.length || c.passageIds.some(id => !chunks.some(p => p.id === id))) throw new Error('Invalid claim or unknown passage reference. Nothing was added.');
    ids.add(c.id);
  }
  return output;
}
export function validateRelationships(output, claims) {
  if (!output || !strings(output.warnings) || !Array.isArray(output.relationships) || output.relationships.length > 16) throw new Error('Invalid relationship output. Nothing was added.');
  for (const r of output.relationships) {
    if (!r || !text(r.description) || !r.description.trim() || !types.includes(r.type) || !strings(r.claimIds) || r.claimIds.length !== 2 || new Set(r.claimIds).size !== 2 || r.claimIds.some(id => !claims.some(c => c.id === id)) || !text(r.explanation) || !r.explanation.trim() || !text(r.contextCheck) || !text(r.challenge) || !strings(r.limitations)) throw new Error('Invalid relationship or unknown claim reference. Nothing was added.');
    const linked = r.claimIds.map(id => claims.find(c => c.id === id));
    const allowed = new Set(linked.flatMap(c => c.passageIds));
    if (!strings(r.passageIds) || !r.passageIds.length || r.passageIds.some(id => !allowed.has(id)) || linked.some(c => !c.passageIds.some(id => r.passageIds.includes(id)))) throw new Error('Relationship evidence must support both connected claims. Nothing was added.');
    if (!r.contextCheck.trim()) throw new Error('Relationship context must be checked. Nothing was added.');
  }
  return output;
}
async function request(instructions, schema, input, options) {
  const { apiKey, model, fetchImpl } = options;
  let response;
  try { response = await fetchImpl('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(90000), body: JSON.stringify({ model, store: false, instructions, input: JSON.stringify(input), max_output_tokens: 10000, text: { format: { type: 'json_schema', name: 'relationships_task', strict: true, schema } } }) }); }
  catch { throw new Error('Could not reach OpenAI or analysis timed out. Your work is unchanged. Retry.'); }
  if (!response.ok) throw new Error(response.status === 429 ? 'OpenAI usage or rate limits were reached. Retry later.' : 'OpenAI could not complete analysis. Check the server configuration and retry.');
  const result = await response.json();
  if (result.status !== 'completed') throw new Error('OpenAI returned incomplete analysis. Your work is unchanged.');
  const content = result.output?.flatMap(x => x.content ?? []) ?? [];
  if (content.some(x => x.type === 'refusal')) throw new Error('OpenAI declined this analysis. Your work is unchanged.');
  try { return JSON.parse(content.filter(x => x.type === 'output_text').map(x => x.text).join('')); }
  catch { throw new Error('OpenAI returned unreadable analysis. Your work is unchanged.'); }
}
export async function analyseRelationships(input, { apiKey, model = 'gpt-4.1-mini', fetchImpl = fetch } = {}) {
  validateInput(input);
  if (!apiKey) throw new Error('OpenAI is not configured on the server.');
  const options = { apiKey, model, fetchImpl };
  const claims = validateClaims(await request(claimInstructions, claimSchema, input, options), input.chunks);
  const relationships = claims.claims.length < 2 ? { relationships: [], warnings: ['Fewer than two grounded claims; no relationships proposed.'] } : validateRelationships(await request(relationshipInstructions, relationshipSchema, { context: input.context, claims: claims.claims, passages: input.chunks }, options), claims.claims);
  return { claims: claims.claims, relationships: relationships.relationships, warnings: [...claims.warnings, ...relationships.warnings], model, promptVersion: PROMPT_VERSION };
}
