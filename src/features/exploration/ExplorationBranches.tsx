import {useState} from 'react';
import type {Dimension,ExplorationSession,Project} from '../../model/types';
import {branchHeight,branchName,branchPoint} from './layout';
export function ExplorationBranches({project,onSelect,onRename,onExpand,onInspectDimension}:{project:Project;onSelect:(id:ExplorationSession['id'])=>void;onRename:(id:ExplorationSession['id'],name:string)=>void;onExpand:(id:ExplorationSession['id'],expanded:boolean)=>void;onInspectDimension:(id:Dimension['id'])=>void}) {
 return <>{project.exploration?.sessions.map(branch=><BranchCard key={branch.id} {...{project,branch,onSelect,onRename,onExpand,onInspectDimension}}/>)}</>;
}
function BranchCard({project,branch,onSelect,onRename,onExpand,onInspectDimension}:{project:Project;branch:ExplorationSession;onSelect:(id:ExplorationSession['id'])=>void;onRename:(id:ExplorationSession['id'],name:string)=>void;onExpand:(id:ExplorationSession['id'],expanded:boolean)=>void;onInspectDimension:(id:Dimension['id'])=>void}) {
 const [editing,setEditing]=useState(false),[name,setName]=useState('');
 const title=branchName(project,branch),p=branchPoint(project,branch),active=project.exploration?.activeSessionId===branch.id;
 return <section data-exploration-branch={branch.id} className={`exploration-branch${active?' is-active':''}${branch.expanded?' is-expanded':''}`} aria-label={`Tuning branch: ${title}`} style={{left:p.x,top:p.y,height:Math.max(branchHeight(branch),editing?120:0)}} onPointerDown={e=>e.stopPropagation()}>
   <div className="exploration-branch-heading">{editing?<form onSubmit={e=>{e.preventDefault();if(!name.trim())return;onRename(branch.id,name.trim());setEditing(false);}}>
    <label className="sr-only" htmlFor={`branch-${branch.id}`}>Branch name</label><input id={`branch-${branch.id}`} autoFocus maxLength={100} value={name} onChange={e=>setName(e.target.value)}/><button>Save name</button><button type="button" onClick={()=>setEditing(false)}>Cancel</button>
   </form>:<><button className="exploration-branch-name" title={title} aria-pressed={active} onClick={()=>onSelect(branch.id)}>{title}</button><button className="exploration-branch-rename" aria-label={`Rename ${title}`} onClick={()=>{setName(title);setEditing(true);}}>Rename</button></>}
    <button className="exploration-branch-toggle" aria-label={`${branch.expanded?'Collapse':'Expand'} ${title}`} aria-expanded={branch.expanded??false} onClick={()=>onExpand(branch.id,!branch.expanded)}>{branch.expanded?'⌃':'⌄'}</button>
   </div>
   <small>{active?'Active tuning branch':'Tuning branch'} · {branch.tuningSnapshot.length} settings</small>
   {branch.expanded&&<div className="exploration-branch-settings" aria-label={`Confirmed settings for ${title}`}><ul>{branch.tuningSnapshot.map(s=><li key={s.position.id}><button className="research-text-button" onClick={()=>onInspectDimension(s.dimension.id)}>{s.dimensionName}</button><span>{s.value===0?'−1':s.value===.5?'0':s.value===1?'+1':s.value===null?'Undecided':`${Math.round(s.value*100)}%`} · {s.positionLabel}</span></li>)}</ul></div>}
 </section>;
}
