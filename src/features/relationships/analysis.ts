import type { Project, ResearchPassage, ClaimContent, RelationshipContent, EvidenceContent } from '../../model/types';
import { claimCategories } from './mapLayout';
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
// Fingerprint research inputs only; editing claims must not unlock another batch.
export function relationshipResearchKey(project: Project): string {
  const text = JSON.stringify({ context: project.context,
    sources: project.sources.filter(s=>!s.archivedAt).map(s=>[s.id,s.revision]).sort(),
    passages: prepareRelationships(project).map(p=>({passage:p.passage,text:p.text,categories:p.categoryReferences.map(c=>c.id).sort()})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
  });
  let a=2166136261,b=5381;
  for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}
  return text.length+':'+(a>>>0).toString(16)+':'+(b>>>0).toString(16);
}
export function relationshipsUpToDate(project: Project): boolean {
  try { return project.relationshipResearchKey === relationshipResearchKey(project); } catch { return false; }
}
/**
 * Older projects predate the saved analysis key. Adopt the latest existing batch
 * instead of making the designer run generation again to remove accumulated work.
 * Archive superseded proposals; keep IDs and all upstream evidence intact.
 */
export function stabiliseExistingRelationships(project: Project): Project {
  if(project.relationshipResearchKey) return project;
  const proposals=project.claims.filter(c=>!c.archivedAt&&c.origin==='dave'&&c.review.state==='proposed')
    .sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
  if(!proposals.length)return project;
  let key:string;try{key=relationshipResearchKey(project);}catch{return project;}
  // Adding one response is synchronous. A gap of five seconds separates old runs.
  const batch:typeof proposals=[];
  for(const c of proposals){
    if(batch.length && Date.parse(batch[batch.length-1].createdAt)-Date.parse(c.createdAt)>5000)break;
    batch.push(c);
  }
  const counts=new Map<string,number>();
  // Retain designer work and count it before choosing any untouched AI proposals.
  for(const c of project.claims.filter(c=>!c.archivedAt&&c.origin!=='researcher'&&!proposals.some(p=>p.id===c.id))){
    const category=claimCategories(project,c)[0]??'unassigned';
    counts.set(category,(counts.get(category)??0)+1);
  }
  const keep=new Set<string>();
  // Prefer claims with more directly linked evidence within the latest batch.
  batch.sort((a,b)=>b.evidence.length-a.evidence.length||a.createdAt.localeCompare(b.createdAt));
  const statements=new Set<string>();
  for(const c of batch){
    const category=claimCategories(project,c)[0]??'unassigned';
    const statement=c.statement.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
    if((counts.get(category)??0)>=10||statements.has(statement))continue;
    keep.add(c.id);statements.add(statement);counts.set(category,(counts.get(category)??0)+1);
  }
  const removed=new Set(proposals.filter(c=>!keep.has(c.id)).map(c=>c.id));
  const time=new Date().toISOString();
  return {...project,relationshipResearchKey:key,
    claims:project.claims.map(c=>removed.has(c.id)?{...c,archivedAt:time}:c),
    relationships:project.relationships.map(r=>!r.archivedAt&&r.origin==='dave'&&r.review.state==='proposed'&&r.claims.some(ref=>removed.has(ref.claim.id))?{...r,archivedAt:time}:r),
  };
}
interface Output {
  claims: { id: string; statement: string; passageIds: string[]; context: string; stakeholder: string; limitations: string[] }[];
  relationships: { description: string; type: RelationshipContent['type']; claimIds: string[]; passageIds: string[]; explanation: string; contextCheck: string; challenge: string; limitations: string[] }[];
}
/** Build against a detached store: publish all entities together only after every reference validates. */
export function applyRelationships(project: Project, passages: PassageInput[], output: Output): Project {
  if(relationshipsUpToDate(project)) return project;
  const expected=prepareRelationships(project);
  if(JSON.stringify(expected)!==JSON.stringify(passages))throw new Error('Research category references changed or are invalid. Nothing was added.');
  const counts=new Map<string,number>();
  for(const claim of output.claims){
    const categoryIds=new Set(claim.passageIds.flatMap(id=>passages.find(p=>p.id===id)?.categoryReferences.map(c=>c.id)??[]));
    for(const id of categoryIds){const count=(counts.get(id)??0)+1;if(count>10)throw new Error('Too many claims for one category. Nothing was added.');counts.set(id,count);}
  }
  const time=new Date().toISOString();
  const superseded=new Set(project.claims.filter(c=>!c.archivedAt&&c.origin==='dave'&&c.review.state==='proposed').map(c=>c.id));
  const refreshed={...project,
    claims:project.claims.map(c=>superseded.has(c.id)?{...c,archivedAt:time}:c),
    relationships:project.relationships.map(r=>!r.archivedAt&&r.origin==='dave'&&r.review.state==='proposed'?{...r,archivedAt:time}:r),
  };
  const staged = createProjectStore(); staged.restoreProject(refreshed);
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
  return {...staged.getProject()!,relationshipResearchKey:relationshipResearchKey(project)};
}
