import type { Entity, EntityReference, ExplorationNode, Project } from '../../model/types';
import type { QuestionInput } from './questionContract.mjs';
import { questionFingerprint, validateQuestionInput, validateQuestionOutput } from './questionContract.mjs';
import { createProjectStore } from '../../state/projectStore';
import { branchStart, IDEA_WIDTH, ideaPoint, freeIdeaPoint } from './layout';
const ref = <T extends {id:string;revision:number}>(x:T):Pick<T,'id'|'revision'> => ({id:x.id,revision:x.revision});
function at<K extends string,C>(items:(Entity<K,C>&C)[],r:{id:string;revision:number}):C|undefined {
 const item=items.find(x=>x.id===r.id);return item?.revision===r.revision?item:item?.history.find(h=>h.revision===r.revision)?.content;
}
const reviewed=(r:{review:{state:string}})=>['accepted','partially_accepted'].includes(r.review.state);
function parentOf(project:Project,node:ExplorationNode) {
 const parents=project.explorationConnections.filter(c=>!c.archivedAt&&c.directional&&c.toNodeId===node.id).map(c=>c.fromNodeId);
 if(node.branchParent&&parents.includes(node.branchParent.id))return node.branchParent.id;
 if(new Set(parents).size>1)throw new Error('This card joins multiple branches. Select a card within the branch you want DAVE to consider.');
 return parents[0]??null;
}
export function prepareQuestion(project:Project,selectedId:string|null=null,mode:QuestionInput['request']['mode']='initial',branchId?:string):QuestionInput {
 const selected=selectedId?project.explorationNodes.find(n=>n.id===selectedId&&!n.archivedAt):undefined;
 if(selectedId&&!selected)throw new Error('The selected card is no longer available.');
 const sessionId=selected?.explorationSession?.id??branchId??project.exploration?.activeSessionId;
 const session=project.exploration?.sessions.find(s=>s.id===sessionId);
 if(!session)throw new Error('Confirm your Dimensions before asking DAVE.');
 const branch:ExplorationNode[]=[];let node=selected;
 while(node){if(node.explorationSession&&node.explorationSession.id!==session.id)throw new Error('Select a card within one tuning branch.');if(branch.some(n=>n.id===node!.id))throw new Error('This branch loops back on itself. Select a card before the loop.');branch.unshift(node);const id=parentOf(project,node);node=id?project.explorationNodes.find(n=>n.id===id):undefined;if(id&&!node)throw new Error('A preceding branch card is unavailable.');if(branch.length>24)throw new Error('This branch is too long for one question request. Start a new idea or select an earlier card.');}
 const parentId=mode==='initial'?null:mode==='alternative'&&selected?parentOf(project,selected):selected?.id??null;
 const limitations:string[]=[];
 if(branch.some(n=>n.content.type==='image'||n.content.type==='sketch'))limitations.push('Images remain local. Only written captions are supplied; DAVE cannot see the images.');
 const claims:QuestionInput['claims']=[],relationships:QuestionInput['relationships']=[],evidence:QuestionInput['evidence']=[];
 const directEvidence=branch.flatMap(n=>n.references.evidence);
 const passageRefs:NonNullable<Project['dimensions'][number]['researchPassages']>=[];
 const categoryRefs:{id:string;revision:number}[]=[];
 const claimRefs:{id:string;revision:number}[]=branch.flatMap(n=>n.references.claims);
 const relationRefs:{id:string;revision:number}[]=branch.flatMap(n=>n.references.relationships);
 for(const setting of session.tuningSnapshot){const d=at(project.dimensions,setting.dimension);if(!d){limitations.push('Some confirmed dimension research is unavailable.');continue;}claimRefs.push(...d.claims);relationRefs.push(...d.relationships);categoryRefs.push(...(d.researchPassages??[]).map(p=>p.category));directEvidence.push(...(d.evidence??[]));passageRefs.push(...(d.researchPassages??[]));}
 // If the designer's dimensions have no explicit associations, select reviewed findings by shared topic words.
 const topics=new Set([project.context,...session.tuningSnapshot.map(s=>`${s.dimensionName} ${s.positionLabel}`),...branch.slice(-2).map(n=>n.content.text??'')].join(' ').toLowerCase().match(/[\p{L}]{4,}/gu)??[]);
 const relevant=(text:string)=>(text.toLowerCase().match(/[\p{L}]{4,}/gu)??[]).filter(w=>topics.has(w)).length;
 if(!claimRefs.length&&!relationRefs.length){
  claimRefs.push(...project.claims.filter(c=>!c.archivedAt&&reviewed(c)&&relevant(c.statement)>0).sort((a,b)=>relevant(b.statement)-relevant(a.statement)).slice(0,6).map(ref));
  relationRefs.push(...project.relationships.filter(r=>!r.archivedAt&&reviewed(r)&&r.claims.some(c=>claimRefs.some(x=>x.id===c.claim.id&&x.revision===c.claim.revision))).slice(0,4).map(ref));
 }
 for(const r of relationRefs.slice(0,8)){const content=at(project.relationships,r);if(content&&reviewed(content))claimRefs.push(...content.claims.map(c=>c.claim));}
 for(const r of claimRefs){
  if(claims.some(c=>c.id===r.id)||claims.length>=12)continue;
  const c=at(project.claims,r);if(!c||!reviewed(c))continue;
  const excerpts=c.evidence.map(e=>{const item=at(project.evidence,e);const source=item&&at(project.sources,item.source);return item&&source?{...e,text:item.text,source:item.source,title:source.title,location:item.location}:null;});
  if(excerpts.some(e=>!e||e.text.length>4000||evidence.some(existing=>existing.id===e.id&&existing.revision!==e.revision))||evidence.length+excerpts.filter(e=>e&&!evidence.some(x=>x.id===e.id)).length>24){limitations.push('Some supporting findings were omitted because excerpts were unavailable, too long or referred to conflicting revisions.');continue;}
  excerpts.forEach(e=>{if(e&&!evidence.some(x=>x.id===e.id))evidence.push(e);});
  c.evidence.forEach(e=>categoryRefs.push(...(at(project.evidence,e)?.categories??[])));
  claims.push({...r,text:c.statement,evidence:c.evidence,limitations:c.limitations});
 }
 for(const r of relationRefs){if(relationships.some(x=>x.id===r.id)||relationships.length>=8)continue;const content=at(project.relationships,r);if(content&&reviewed(content)&&content.claims.every(x=>claims.some(c=>c.id===x.claim.id&&c.revision===x.claim.revision)))relationships.push({...r,text:`${content.description} ${content.explanation}`,type:content.type,claims:content.claims.map(x=>x.claim),limitations:content.limitations});}
 for(const r of directEvidence){if(evidence.some(e=>e.id===r.id)||evidence.length>=24)continue;const e=at(project.evidence,r);const source=e&&at(project.sources,e.source);if(e&&source&&e.text.length<=4000){evidence.push({...r,text:e.text,source:e.source,title:source.title,location:e.location});categoryRefs.push(...(e.categories??[]));}}
 const passages:QuestionInput['passages']=[];
 for(const r of passageRefs){const c=at(project.categories,r.category),source=at(project.sources,r.passage.source);const index=c?.passages?.findIndex(p=>JSON.stringify(p)===JSON.stringify(r.passage))??-1;const section=source?.preparedContent?.sections[r.passage.sectionIndex];if(index<0||!section||r.passage.end>section.text.length)continue;const id=`${r.category.id}:${r.category.revision}:${index}`;if(passages.some(p=>p.id===id)||passages.length>=12)continue;const text=section.text.slice(r.passage.start,r.passage.end);if(text.length>4000)continue;passages.push({id,category:r.category,source:r.passage.source,sectionIndex:r.passage.sectionIndex,start:r.passage.start,end:r.passage.end,text,title:source!.title,location:section.location});}
 const categories:QuestionInput['categories']=[];
 for(const r of categoryRefs){if(categories.some(c=>c.id===r.id)||categories.length>=12)continue;const c=at(project.categories,r);if(c&&c.review?.state!=='rejected')categories.push({...r,name:c.name,review:c.review?.state??'unreviewed'});}
 if(!claims.length&&!relationships.length&&!evidence.length&&!passages.length)limitations.push('No relevant reviewed findings were available. This question can explore the project and confirmed settings, but is not a research finding.');
 const previous=project.explorationNodes.filter(n=>n.content.type==='question'&&(branch.some(b=>b.id===n.id)||(n.explorationSession?.id===session.id&&(n.branchParent?.id??null)===parentId)));
 const input:QuestionInput={project:{id:project.id,name:project.name,context:project.context},session:ref(session),request:{mode,selectedId:selected?.id??null,parentId},
  settings:session.tuningSnapshot.map(s=>({dimension:s.dimension,position:s.position,name:s.dimensionName,label:s.positionLabel,value:s.value!,meaning:s.positionExplanation??''})),
  branch:branch.map(n=>({...ref(n),title:n.title??'',kind:n.content.type,text:n.content.text??'',origin:n.origin})),previousQuestions:[...new Set(previous.map(n=>n.content.text??''))],questionFingerprints:[...new Set(project.explorationNodes.filter(n=>n.content.type==='question').map(n=>questionFingerprint(n.content.text??'')))],claims,relationships,evidence,categories,passages,limitations:[...new Set(limitations)]};
 return validateQuestionInput(input);
}
export function applyQuestion(project:Project,input:QuestionInput,raw:unknown):{project:Project;node:ExplorationNode} {
 if(JSON.stringify(prepareQuestion(project,input.request.selectedId,input.request.mode,input.session.id))!==JSON.stringify(input))throw new Error('The relevant project or branch changed during generation. Nothing was added. Retry.');
 const output=validateQuestionOutput(raw,input);
 if(typeof output.model!=='string'||typeof output.promptVersion!=='string')throw new Error('Question metadata is unavailable. Nothing was added.');
 const staged=createProjectStore();staged.restoreProject(project);
 const session=project.exploration!.sessions.find(s=>s.id===input.session.id)!;
 const refs=<K extends string>(ids:string[],items:{id:string;revision:number}[])=>ids.map(id=>{const r=items.find(x=>x.id===id)!;return ref(r) as EntityReference<K>;});
 const positions=refs<'dimension_position'>(output.positionIds,input.settings.map(s=>s.position));
 const references={claims:refs<'claim'>(output.claimIds,input.claims),relationships:refs<'relationship'>(output.relationshipIds,input.relationships),evidence:refs<'evidence'>(output.evidenceIds,input.evidence),dimensions:input.settings.filter(s=>output.positionIds.includes(s.position.id)).map(s=>s.dimension as EntityReference<'dimension'>)};
 const parent=project.explorationNodes.find(n=>n.id===input.request.parentId);
 const anchor=parent?ideaPoint(parent):branchStart(project,session);
 const node=staged.explorationNodes.add({title:'DAVE question',content:{type:'question',text:output.question},coordinateSpace:'design-map',branchAligned:true,position:freeIdeaPoint(project.explorationNodes.filter(n=>!n.archivedAt),parent?{x:anchor.x+IDEA_WIDTH+90,y:anchor.y}:anchor),explorationSession:ref(session),branchParent:parent?ref(parent):undefined,questionState:'open',dimensionPositions:positions,references,limitations:[...new Set([...input.limitations,...output.limitations])],
  question:{researchPassages:output.passageIds.map(id=>{const p=input.passages.find(p=>p.id===id)!;return {category:p.category as EntityReference<'research_category'>,passage:{source:p.source as EntityReference<'source'>,sectionIndex:p.sectionIndex,start:p.start,end:p.end}};}),purpose:output.purpose,grounding:output.grounding,categories:refs<'research_category'>(output.categoryIds,input.categories),branch:refs<'exploration_node'>(input.branch.map(n=>n.id),input.branch),considered:{claims:refs<'claim'>(input.claims.map(c=>c.id),input.claims),relationships:refs<'relationship'>(input.relationships.map(r=>r.id),input.relationships),evidence:refs<'evidence'>(input.evidence.map(e=>e.id),input.evidence),dimensions:input.settings.map(s=>s.dimension as EntityReference<'dimension'>)},consideredPositions:input.settings.map(s=>s.position as EntityReference<'dimension_position'>),generation:{model:output.model,promptVersion:output.promptVersion,generatedAt:new Date().toISOString()}}},'dave');
 if(parent)staged.explorationConnections.add({fromNodeId:parent.id,toNodeId:node.id,directional:true});
 if(input.request.mode==='alternative'&&input.request.selectedId)staged.explorationNodes.update(input.request.selectedId as ExplorationNode['id'],{questionState:'skipped'},{actor:'researcher',note:'Designer requested an alternative question.'});
 return {project:staged.getProject()!,node};
}
