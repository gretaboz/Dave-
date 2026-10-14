import type { Project, ResearchPassage, ClaimContent, RelationshipContent, EvidenceContent } from '../../model/types';
import { createProjectStore } from '../../state/projectStore';
export interface PassageInput { id: string; title: string; location: string; text: string; categories: string[]; categoryReferences: {id:string;revision:number}[]; passage: ResearchPassage; limitations: string[] }
export function prepareRelationships(project: Project): PassageInput[] {
  const passages = new Map<string, PassageInput>();
  for (const category of project.categories.filter(c => !c.archivedAt && c.review?.state !== 'rejected')) {
    for (const passage of category.passages ?? []) {
      const source = project.sources.find(s => s.id === passage.source.id && !s.archivedAt);
      const content = source?.revision === passage.source.revision ? source : source?.history.find(h => h.revision === passage.source.revision)?.content;
      const section = content?.preparedContent?.sections[passage.sectionIndex];
      if (!source || !section || !Number.isInteger(passage.start) || !Number.isInteger(passage.end) || passage.start < 0 || passage.end <= passage.start || passage.end > section.text.length) throw new Error('A research passage is unavailable. Review Research before analysing.');
      const key = JSON.stringify(passage);
      const existing = passages.get(key);
      if (existing) {existing.categories.push(category.name);existing.categoryReferences.push({id:category.id,revision:category.revision});}
      else passages.set(key, { id: `passage-${passages.size}`, title: source.title, location: section.location, text: section.text.slice(passage.start, passage.end), categories: [category.name], categoryReferences:[{id:category.id,revision:category.revision}], passage, limitations: [...content!.limitations, ...content!.preparedContent!.limitations] });
    }
  }
  const result = [...passages.values()];
  if (!result.length) throw new Error('Analyse research in Live AI first to create categories with supporting passages.');
  if (result.length > 2000 || result.some(p => p.text.length > 4000) || result.reduce((n,p) => n + p.text.length,0) > 120000) throw new Error('The selected research exceeds the prototype analysis limit. Use a smaller set; nothing was omitted.');
  return result;
}
interface Output {
  claims: { id: string; statement: string; passageIds: string[]; context: string; stakeholder: string; limitations: string[] }[];
  relationships: { description: string; type: RelationshipContent['type']; claimIds: string[]; passageIds: string[]; explanation: string; contextCheck: string; challenge: string; limitations: string[] }[];
}
/** Build against a detached store: publish all entities together only after every reference validates. */
export function applyRelationships(project: Project, passages: PassageInput[], output: Output): Project {
  const expected=prepareRelationships(project);
  if(JSON.stringify(expected)!==JSON.stringify(passages))throw new Error('Research category references changed or are invalid. Nothing was added.');
  const staged = createProjectStore(); staged.restoreProject(project);
  const evidence = new Map<string, ReturnType<typeof staged.evidence.add>>();
  const claims = new Map<string, ReturnType<typeof staged.claims.add>>();
  for (const c of output.claims) {
    const refs = c.passageIds.map(id => {
      const p = passages.find(p => p.id === id);
      if (!p) throw new Error('Unknown supporting passage. Nothing was added.');
      let e = evidence.get(id);
      if (!e) {
        const content: EvidenceContent = { source: p.passage.source, text: p.text, form: 'quotation', location: p.location, context: `Research categories: ${p.categories.join(', ')}`, limitations: p.limitations, passage: p.passage, categories: project.categories.filter(c => !c.archivedAt && c.review?.state !== 'rejected' && c.passages?.some(range => JSON.stringify(range) === JSON.stringify(p.passage))).map(c => ({id:c.id,revision:c.revision})) };
        e = staged.evidence.add(content, 'dave'); evidence.set(id,e);
      }
      return { id: e.id, revision: e.revision };
    });
    if (claims.has(c.id) || !c.statement.trim()) throw new Error('Invalid claim. Nothing was added.');
    claims.set(c.id, staged.claims.add({ statement: c.statement, evidence: refs as ClaimContent['evidence'], context: c.context, stakeholder: c.stakeholder, limitations: c.limitations, review: { state: 'proposed' } }, 'dave'));
  }
  for (const r of output.relationships) {
    const refs = r.claimIds.map(id => { const c = claims.get(id); if (!c) throw new Error('Unknown connected claim. Nothing was added.'); return { claim: { id: c.id, revision: c.revision } }; });
    const supportingEvidence = r.passageIds.map(id => {const e=evidence.get(id);if(!e)throw new Error('Unknown relationship evidence. Nothing was added.');return {id:e.id,revision:e.revision};});
    staged.relationships.add({ ...r, evidence: supportingEvidence, claims: refs as RelationshipContent['claims'], review: { state: 'proposed' } }, 'dave');
  }
  return staged.getProject()!;
}
