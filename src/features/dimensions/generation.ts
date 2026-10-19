import type { Project, EntityReference, Entity, Dimension } from '../../model/types';
import type { DimensionInput } from './contract.mjs';
import {validateDimensionInput,validateDimensionOutput} from './contract.mjs';
import {createProjectStore} from '../../state/projectStore';
const reviewed=(state:string)=>['accepted','partially_accepted'].includes(state);
function resolve<K extends string,C>(items:(Entity<K,C>&C)[],ref:EntityReference<K>):C|undefined {
  const item=items.find(i=>i.id===ref.id);
  return item?.revision===ref.revision?item:item?.history.find(h=>h.revision===ref.revision)?.content;
}
export function prepareDimensions(project:Project):DimensionInput {
  const categories=project.categories.filter(c=>!c.archivedAt&&c.review?.state!=='rejected');
  const evidence=new Map<string,DimensionInput['evidence'][number]>();
  const claims:DimensionInput['claims']=[];
  for(const c of project.claims.filter(c=>!c.archivedAt&&reviewed(c.review.state))) {
    const excerpts=c.evidence.map(ref=>{
      const e=resolve(project.evidence,ref);
      const source=e&&resolve(project.sources,e.source);
      return e&&source?{...ref,text:e.text,source:e.source,title:source.title,location:e.location,context:e.context,limitations:e.limitations}:null;
    });
    if(excerpts.some(e=>!e))continue;
    // A single entity ID must not ambiguously denote different evidence revisions.
    if(excerpts.some(e=>e&&evidence.has(e.id)&&evidence.get(e.id)!.revision!==e.revision))continue;
    excerpts.forEach(e=>{if(e)evidence.set(e.id,e);});
    claims.push({id:c.id,revision:c.revision,statement:c.statement,context:c.context,stakeholder:c.stakeholder,limitations:c.limitations,review:c.review.state,evidence:c.evidence});
  }
  const relationships=project.relationships.filter(r=>!r.archivedAt&&reviewed(r.review.state)&&['connection','potential_tension'].includes(r.type)&&r.claims.every(ref=>claims.some(c=>c.id===ref.claim.id&&c.revision===ref.claim.revision)))
    .map(r=>({id:r.id,revision:r.revision,description:r.description,type:r.type,review:r.review.state,explanation:r.explanation,contextCheck:r.contextCheck,challenge:r.challenge,limitations:r.limitations,claims:r.claims.map(c=>c.claim)}));
  const passages:DimensionInput['passages']=[];
  for(const c of categories)for(const [index,p] of (c.passages??[]).entries()) {
    const source=resolve(project.sources,p.source);
    const section=source?.preparedContent?.sections[p.sectionIndex];
    if(!source||!section||!Number.isInteger(p.start)||!Number.isInteger(p.end)||p.start<0||p.end<=p.start||p.end>section.text.length)throw new Error('A research excerpt is unavailable. Review Research before generating dimensions.');
    passages.push({categoryId:c.id,revision:c.revision,index,text:section.text.slice(p.start,p.end),source:p.source,title:source.title,location:section.location,limitations:source.limitations});
  }
  const skipped=project.relationships.filter(r=>!r.archivedAt&&reviewed(r.review.state)&&['connection','potential_tension'].includes(r.type)).length-relationships.length;
  const limitations=skipped?[`${skipped} reviewed relationship(s) were omitted because their claim revisions are no longer available as current reviewed claims.`]:[];
  const input:DimensionInput={context:project.context,projectName:project.name,limitations,categories:categories.map(c=>({id:c.id,revision:c.revision,name:c.name,review:c.review?.state??'unreviewed'})),claims,relationships,evidence:[...evidence.values()],passages,
    existingDimensions:project.dimensions.map(d=>({id:d.id,revision:d.revision,name:d.name,explanation:d.explanation,lowLabel:d.lowLabel,midLabel:d.midLabel,highLabel:d.highLabel,review:d.review.state}))};
  validateDimensionInput(input);return input;
}
/** Validate the complete batch against current research before publishing any proposal. */
export function applyDimensions(project:Project,input:DimensionInput,raw:unknown):{project:Project;count:number;warnings:string[]} {
  if(JSON.stringify(prepareDimensions(project))!==JSON.stringify(input))throw new Error('Research or dimensions changed during generation. Nothing was added. Retry.');
  const output=validateDimensionOutput(raw,input);
  const metadata=raw as {model?:unknown;promptVersion?:unknown};
  if(typeof metadata.model!=='string'||typeof metadata.promptVersion!=='string')throw new Error('Missing dimension generation metadata. Nothing was added.');
  const staged=createProjectStore();staged.restoreProject(project);
  for(const d of output.dimensions) {
    const {claimIds,relationshipIds,evidenceIds,passages,...content}=d;
    const refs=<K extends string>(ids:string[],items:{id:EntityReference<K>['id'];revision:number}[])=>ids.map(id=>{const item=items.find(i=>i.id===id)!;return {id:item.id,revision:item.revision};});
    staged.dimensions.add({...content,claims:refs(claimIds,project.claims),relationships:refs(relationshipIds,project.relationships),
      // Evidence may intentionally refer to a prior revision used by a reviewed claim.
      ...{evidence:evidenceIds.map(id=>{const e=input.evidence.find(e=>e.id===id)!;return {id:e.id as Project['evidence'][number]['id'],revision:e.revision};})},
      researchPassages:passages.map(ref=>{
        const c=project.categories.find(c=>c.id===ref.categoryId&&c.revision===ref.revision)!;
        return {category:{id:c.id,revision:c.revision},passage:structuredClone(c.passages![ref.index])};
      }),generation:{model:metadata.model,promptVersion:metadata.promptVersion,generatedAt:new Date().toISOString()},review:{state:'proposed'}},'dave');
  }
  return {project:staged.getProject()!,count:output.dimensions.length,warnings:[...(input.limitations??[]),...output.warnings]};
}
export function reviewDimension(project:Project,id:Dimension['id'],state:'accepted'|'rejected'):Project {
  const staged=createProjectStore();staged.restoreProject(project);
  const d=staged.dimensions.update(id,{review:{state}},{note:`Designer ${state} dimension proposal.`});
  if(state==='accepted'&&!project.dimensionPositions.some(p=>p.dimension.id===id))staged.setDimensionPosition({dimension:{id:d.id,revision:d.revision},selected:true,value:.5});
  return staged.getProject()!;
}
