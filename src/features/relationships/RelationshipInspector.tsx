import { useState } from 'react';
import type { Claim, ClaimContent, Project, Relationship, ReviewState } from '../../model/types';
import { useProjectStore, useProjectSession } from '../../state/ProjectProvider';
import { claimTitle, relationshipLabels, relationshipType } from './presentation';
import { claimCategories } from './mapLayout';
const label=(s:string)=>s.replaceAll('_',' ');
export function RelationshipInspector({project,item,onClose,onError}:{project:Project;item:Claim|Relationship;onClose:()=>void;onError:(s:string)=>void}) {
 const store=useProjectStore();const session=useProjectSession();
 const [editing,setEditing]=useState(false);
 const isClaim='statement' in item;
 const wording=isClaim?item.statement:item.description;
 const [draft,setDraft]=useState(wording);
 const [explanation,setExplanation]=useState(isClaim?'':item.explanation);
 const [type,setType]=useState(isClaim?'':relationshipType(item.type));
 function review(state:ReviewState) {
   if(isClaim)store.claims.update(item.id,{review:{...item.review,state}});
   else store.relationships.update(item.id,{review:{...item.review,state}});
 }
 function content(c:Claim,revision:number):ClaimContent|undefined {return c.revision===revision?c:c.history.find(h=>h.revision===revision)?.content;}
 const connected=isClaim?[]:item.claims.map(ref=>{const c=project.claims.find(c=>c.id===ref.claim.id);return {claim:c,content:c?content(c,ref.claim.revision):undefined};});
 const evidenceClaims=isClaim?[{claim:item,content:item as ClaimContent}]:connected;
 async function download(source:Project['sources'][number]) {try{const blob=await session.loadFile(source.originalFile.id);if(!blob)throw new Error('Original source unavailable.');const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=source.originalFile.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){onError(e instanceof Error?e.message:'Could not open source.');}}
 return <div className="relationship-inspector-content"><button className="research-text-button" onClick={onClose}>Close inspector</button>
 <h3 className="inspector-title">{isClaim?claimTitle(item.statement):relationshipLabels[relationshipType(item.type)]}</h3>
 <p className="inspector-interpretation">{wording}</p>
 {!isClaim&&<>{relationshipType(item.type)==='unclassified'&&<p>This earlier relationship has not been safely classified. Its original type was {label(item.type)}. Keep it unclassified if the meaning is unclear.</p>}<h4>Why DAVE connected these</h4><p>{item.explanation}</p><div className="inspector-connected"><h4>Connected claims</h4>{connected.map((c,i)=><div key={i}><strong>{c.content?claimTitle(c.content.statement):'Claim unavailable'}</strong><p>{c.content?.statement}</p>{c.claim&&c.content&&c.content.statement!==c.claim.statement&&<small>This connection uses earlier wording. The claim has since been edited.</small>}</div>)}</div></>}
 <p className="inspector-origin">{item.origin==='researcher'?'Designer interpretation':item.review.state==='proposed'?'AI proposal · Not reviewed yet':`Designer reviewed · ${label(item.review.state)}${item.origin==='dave_edited_by_researcher'?' · Edited by you':''}`}</p>
 {!editing?<button className="project-button" onClick={()=>{setDraft(wording);setEditing(true);}}>Edit</button>:<form className="inspector-edit" onSubmit={e=>{e.preventDefault();if(!draft.trim())return;if(isClaim)store.claims.update(item.id,{statement:draft.trim(),review:{state:'unresolved'}});else store.relationships.update(item.id,{description:draft.trim(),explanation:explanation.trim(),type:(relationshipType(item.type)==='unclassified'&&type==='unclassified'?item.type:type) as Relationship['type'],review:{state:'unresolved'}});setEditing(false);}}><label className="research-field">{isClaim?'Claim wording':'Relationship wording'}<textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={5} required /></label>{!isClaim&&<><label className="research-field">Explanation<textarea value={explanation} onChange={e=>setExplanation(e.target.value)} rows={4} required /></label><label className="research-field">Connection type<select value={type} onChange={e=>setType(e.target.value)}>{Object.entries(relationshipLabels).map(([t,name])=><option key={t} value={t} disabled={!isClaim && item.claims.length!==2 && t!=='unclassified'}>{name}</option>)}</select></label></>}<button className="project-button" disabled={!draft.trim()||(!isClaim&&!explanation.trim())||(draft===wording&&(isClaim||(explanation===item.explanation&&type===relationshipType(item.type))))}>Save wording</button><button type="button" className="research-text-button" onClick={()=>setEditing(false)}>Cancel</button></form>}
 <details className="inspector-support"><summary>Supporting research</summary>
 {evidenceClaims.map(({claim,content:c},i)=><div key={i}>{!isClaim&&<h4>{c?claimTitle(c.statement):'Claim unavailable'}</h4>}{c?.evidence.filter(ref => isClaim || !item.evidence?.length || item.evidence.some(e => e.id===ref.id && e.revision===ref.revision)).map((ref,index)=>{const entity=project.evidence.find(e=>e.id===ref.id);const ev=entity?.revision===ref.revision?entity:entity?.history.find(h=>h.revision===ref.revision)?.content;const source=project.sources.find(s=>s.id===ev?.source.id);return <details className="inspector-excerpt" key={`${ref.id}-${index}`}><summary>{source?.title??'Source unavailable'}<span>{ev?.location??'Location unavailable'}</span></summary><blockquote>{ev?.text??'Evidence unavailable'}</blockquote>{ev?.context&&<p>{ev.context}</p>}{ev?.limitations.map((l,i)=><p key={i}>{l}</p>)}{source&&<button className="research-text-button" onClick={()=>void download(source)}>Download original source</button>}</details>;})}{isClaim&&claim&&<p className="inspector-context">Categories: {claimCategories(project,claim).map(id=>project.categories.find(c=>c.id===id)?.name).join(' · ')||'Unassigned'}</p>}</div>)}
 </details>
 {(item.limitations.length>0 || (isClaim?item.context||item.stakeholder:item.contextCheck||item.challenge))&&<details className="inspector-context"><summary>Context and uncertainty</summary>{isClaim?<><p>{item.context}</p><p>{item.stakeholder}</p></>:<><p>{item.contextCheck}</p><p>{item.challenge}</p></>}{item.limitations.map((l,i)=><p key={i}>{l}</p>)}</details>}
 <div className="inspector-review" aria-label="Review controls">{(['accepted','rejected','unresolved'] as ReviewState[]).map(state=><button key={state} className="project-button" aria-pressed={item.review.state===state} onClick={()=>review(state)}>{state==='accepted'?'Accept':state==='rejected'?'Reject':'Unresolved'}</button>)}<details><summary>Other review options</summary><button className="research-text-button" onClick={()=>review('partially_accepted')}>Partially accept</button><button className="research-text-button" onClick={()=>review('proposed')}>Return to proposal</button></details></div>
 {item.history.length>0&&<details className="inspector-history"><summary>Earlier wording</summary>{item.history.map(h=><p key={h.revision}>{'statement' in h.content?h.content.statement:h.content.description}</p>)}</details>}
 </div>;
}
