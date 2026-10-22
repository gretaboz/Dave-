import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { AssetReference, Dimension, ExplorationSession, ExplorationConnection, ExplorationNode, Project } from '../../model/types';
import { createProjectStore } from '../../state/projectStore';
import { useProjectSession } from '../../state/ProjectProvider';
import { prepareQuestion, applyQuestion } from './questions';
import type { QuestionInput } from './questionContract.mjs';
import { QuestionInspector } from './QuestionInspector';
import { SketchImage } from './SketchImage';
import { ExplorationBranches } from './ExplorationBranches';
import { branchName,branchPoint,branchStart,branchHeight,BRANCH_WIDTH,CONTENT_X, EXPLORATION_X, IDEA_WIDTH, IDEA_HEIGHT, IDEA_TOP, ideaPoint, freeIdeaPoint } from './layout';
import './exploration.css';

type Point = { x: number; y: number };

/** Board tools and entities rendered inside RelationshipsMap's existing world. No canvas or viewport of its own. */
export function useExploration({ project, store, active, onInspectDimension, onFocusCard, onExplore, mode='live' }: {
  project: Project | null; store: ReturnType<typeof createProjectStore>; active: boolean;
  onFocusCard: (point:Point) => void; onExplore?:()=>void;
  onInspectDimension: (id: Dimension['id']) => void; mode?:'demo'|'live';
}) {
  const persistence=useProjectSession();
  const [busy,setBusy]=useState(false);
  const requestBusy=useRef(false);
  const requestAbort=useRef<AbortController|null>(null);
  useEffect(()=>()=>requestAbort.current?.abort(),[]);
  const [retry,setRetry]=useState<{id:string|null;mode:QuestionInput['request']['mode'];branchId?:string}|null>(null);
  const [inspecting,setInspecting]=useState<ExplorationNode['id']|null>(null);
  const [contributionType,setContributionType]=useState<'idea'|'note'|'sketch'>('idea');
  const [imageFile,setImageFile]=useState<File|null>(null);
  const [savingAttachment,setSavingAttachment]=useState(false);
  const marker = useId().replaceAll(':', '');
  const [selected, setSelected] = useState<ExplorationNode['id'] | null>(null);
  const selectedRef=useRef(selected);selectedRef.current=selected;
  const activeRef=useRef(active);activeRef.current=active;
  const [connection, setConnection] = useState<ExplorationConnection['id'] | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [editing, setEditing] = useState<ExplorationNode['id'] | 'new' | null>(null);
  const [draftBranch,setDraftBranch]=useState<string>();
  const [parent, setParent] = useState<ExplorationNode['id'] | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [moving, setMoving] = useState<{ id: ExplorationNode['id']; position: Point } | null>(null);
  const drag = useRef<{ id: ExplorationNode['id']; start: Point; initial: Point; current: Point; moved: boolean } | null>(null);
  const nodes = project?.explorationNodes.filter(n => !n.archivedAt) ?? [];
  const connections = project?.explorationConnections.filter(c => !c.archivedAt && nodes.some(n => n.id === c.fromNodeId) && nodes.some(n => n.id === c.toNodeId)) ?? [];
  const session = project?.exploration?.sessions.find(s => s.id === project.exploration?.activeSessionId);
  const sessions=project?.exploration?.sessions??[];
  const selectedNode = nodes.find(n => n.id === selected && (!n.explorationSession || n.explorationSession.id===session?.id));
  const selectedConnection = connections.find(c => c.id === connection);
  const point = (node: ExplorationNode) => moving?.id === node.id ? moving.position : ideaPoint(node);
  function attempt(action: () => void) {
    try { action(); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update the map.'); }
  }
  function activateBranch(id:ExplorationSession['id']) {
    attempt(()=>{store.selectExplorationBranch(id);setSelected(null);setConnection(null);setConnecting(false);setInspecting(null);if(!active)onExplore?.();const branch=store.getProject()!.exploration!.sessions.find(s=>s.id===id)!;onFocusCard(branchPoint(store.getProject()!,branch));});
  }
  function openEditor(id: ExplorationNode['id'] | 'new', branchFrom: ExplorationNode['id'] | null = null, kind:'idea'|'note'|'sketch'='idea') {
    const node = nodes.find(n => n.id === id);
    if(node?.question)return;
    const origin=nodes.find(n=>n.id===branchFrom);setDraftBranch(node?.explorationSession?.id??origin?.explorationSession?.id??store.getProject()?.exploration?.activeSessionId);
    setContributionType(node ? node.content.type==='note'?'note':node.content.type==='image'||node.content.type==='sketch'?'sketch':'idea' : kind);setImageFile(null);setInspecting(null);
    setTitle(node?.title ?? ''); setText(node?.content.text ?? ''); setEditing(id); setParent(branchFrom); setConnecting(false);
  }
  function choose(id: ExplorationNode['id']) {
    if (!active) return;
    if (connecting && selected && id !== selected) {
      attempt(() => {
        if (!connections.some(c => c.fromNodeId === selected && c.toNodeId === id)) store.explorationConnections.add({ fromNodeId: selected, toNodeId: id, directional: true });
        setConnecting(false);
      });
    } else { const target=nodes.find(n=>n.id===id);if(target?.explorationSession)store.selectExplorationBranch(target.explorationSession.id);setSelected(id); setConnection(null); }
  }
  function start(event: PointerEvent<HTMLElement>, node: ExplorationNode) {
    event.stopPropagation();
    if (!active || event.button !== 0 || (event.target as HTMLElement).closest('button,[contenteditable="true"]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const initial = point(node);
    drag.current = { id: node.id, start: { x: event.clientX, y: event.clientY }, initial, current: initial, moved: false };
  }
  function move(event: PointerEvent, scale: number) {
    const d = drag.current; if (!d) return;
    const dx = event.clientX - d.start.x, dy = event.clientY - d.start.y;
    if (Math.hypot(dx, dy) < 4 && !d.moved) return;
    d.moved = true;
    d.current = { x: Math.max(CONTENT_X, d.initial.x + dx / scale), y: Math.max(IDEA_TOP, d.initial.y + dy / scale) };
    setMoving({ id: d.id, position: d.current });
  }
  function finish(cancel = false) {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (!cancel) {
      if (d.moved) attempt(() => store.explorationNodes.update(d.id, { position: freeIdeaPoint(nodes, d.current, d.id), coordinateSpace: 'design-map', branchAligned:true }));
      else choose(d.id);
    }
    setMoving(null);
  }
  async function generate(id:string|null, requestMode:QuestionInput['request']['mode'],branchId?:string) {
    if(requestBusy.current)return;
    if(mode==='demo'){setError('AI questions are available in Live AI mode. You can keep exploring manually in Demo.');return;}
    requestBusy.current=true;setBusy(true);setError('');setRetry(null);
    try {
      const original=store.getProject();if(!original)throw new Error('Load your project before asking DAVE.');
      const input=prepareQuestion(original,id,requestMode,branchId);
      const controller=new AbortController();requestAbort.current=controller;
      const response=await fetch('/api/exploration/question',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(80000)])});
      if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('The DAVE AI server is unavailable. Start it and retry. Manual exploration remains available.');
      const output=await response.json();
      if(response.status===404)throw new Error('Restart the DAVE AI server to enable Exploration questions. Your map is unchanged.');
      if(!response.ok)throw new Error(output.error||'DAVE could not generate a question. Retry or continue manually.');
      if(controller.signal.aborted)throw new Error('Question generation was cancelled.');
      const latest=store.getProject();if(!latest||latest.id!==original.id)throw new Error('The project changed during generation. Nothing was added.');
      const result=applyQuestion(latest,input,output);store.restoreProject(result.project);if(activeRef.current&&selectedRef.current===id&&store.getProject()?.exploration?.activeSessionId===input.session.id){setSelected(result.node.id);onFocusCard(ideaPoint(result.node));setConnection(null);setInspecting(null);}
    }catch(e){setError(e instanceof Error?e.message:'Question generation failed. Manual exploration remains available.');setRetry({id,mode:requestMode,branchId:branchId??store.getProject()?.exploration?.activeSessionId});}
    finally{requestBusy.current=false;setBusy(false);}
  }
  async function saveContribution() {
    if(savingAttachment)return;
    setSavingAttachment(true);setError('');
    try {
      const original=store.getProject();if(!original)throw new Error('Load your project before editing.');
      const old=original.explorationNodes.find(n=>n.id===editing&&!n.archivedAt);
      let asset:AssetReference|undefined=old&&(old.content.type==='sketch'||old.content.type==='image')?old.content.asset:undefined;
      if(contributionType==='sketch'&&imageFile){
        if(!['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(imageFile.type)||imageFile.size>10*1024*1024)throw new Error('Choose a PNG, JPEG, WebP, GIF or AVIF image up to 10 MB.');
        let bitmap;try{bitmap=await createImageBitmap(imageFile);}catch{throw new Error('This file could not be read as an image. Choose another image.');}
        if(bitmap.width*bitmap.height>25000000){bitmap.close();throw new Error('Choose an image with fewer than 25 million pixels.');}bitmap.close();
        asset={id:crypto.randomUUID() as AssetReference['id'],filename:imageFile.name,mediaType:imageFile.type};
        await persistence.saveFile({id:asset.id,blob:imageFile});
      }
      if(contributionType==='sketch'&&!asset)throw new Error('Choose a sketch or image to attach.');
      const latest=store.getProject();if(!latest||latest.id!==original.id)throw new Error('The project changed while saving. Your draft is kept.');
      const staged=createProjectStore();staged.restoreProject(latest);
      const content=contributionType==='sketch'?{type:'sketch' as const,asset:asset!,text:text.trim()}:{type:contributionType,text:text.trim()};
      if(editing==='new'){
        const origin=latest.explorationNodes.find(n=>n.id===parent&&!n.archivedAt);
        if(parent&&!origin)throw new Error('The preceding card was removed. Your draft is kept.');
        const context=latest.exploration?.sessions.find(s=>s.id===(origin?.explorationSession?.id??draftBranch??latest.exploration?.activeSessionId));
        if(!context)throw new Error('Confirm your Dimensions before creating a card.');
        const activeNodes=latest.explorationNodes.filter(n=>!n.archivedAt);
        const p=origin?ideaPoint(origin):branchStart(latest,context);
        const node=staged.explorationNodes.add({title:title.trim(),content,position:freeIdeaPoint(activeNodes,origin?{x:p.x+IDEA_WIDTH+90,y:p.y}:p),coordinateSpace:'design-map',branchAligned:true,explorationSession:{id:context.id,revision:context.revision},branchParent:origin?{id:origin.id,revision:origin.revision}:undefined,references:{evidence:[],claims:[],relationships:[],dimensions:[]},dimensionPositions:context.tuningSnapshot.map(s=>({...s.position})),limitations:[]});
        staged.selectExplorationBranch(context.id);
        if(origin)staged.explorationConnections.add({fromNodeId:origin.id,toNodeId:node.id,directional:true});setSelected(node.id);if(activeRef.current)onFocusCard(ideaPoint(node));setConnection(null);
      }else{
        const current=latest.explorationNodes.find(n=>n.id===editing&&!n.archivedAt);
        if(!old||!current||old.revision!==current.revision||current.question)throw new Error('This card changed while saving. Your draft is kept.');
        staged.explorationNodes.update(current.id,{title:title.trim(),content});
      }
      store.restoreProject(staged.getProject()!);setEditing(null);setImageFile(null);
    }catch(e){setError(e instanceof Error?e.message:'Could not save this contribution. Your draft is kept.');}
    finally{setSavingAttachment(false);}
  }
  const changed = session?.tuningSnapshot.some(s => {
    const p = project?.dimensionPositions.find(p => p.id === s.position.id);
    const d = project?.dimensions.find(d => d.id === s.dimension.id);
    return !p || !d || p.revision !== s.position.revision || d.revision !== s.dimension.revision || !!d.archivedAt || !!p.archivedAt;
  });
  const earlierSession = selectedNode?.explorationSession && selectedNode.explorationSession.id !== session?.id
    ? project?.exploration?.sessions.find(s => s.id === selectedNode.explorationSession?.id) : undefined;
  const toolbar = active && <div className="exploration-tools">
    {!session && <p>Confirm your selected Dimensions to start a new exploration. Existing ideas are kept.</p>}
    {project&&session&&<div className="exploration-active-branch"><label htmlFor={`${marker}-branch`}>Active branch</label><select id={`${marker}-branch`} value={session.id} onChange={e=>activateBranch(e.target.value as ExplorationSession['id'])}>{sessions.map(s=><option key={s.id} value={s.id}>{branchName(project,s)}</option>)}</select></div>}
    {session?.duplicateOf&&project&&<p role="status">Identical tuning already exists in {branchName(project,sessions.find(s=>s.id===session.duplicateOf)!)}. A separate branch was created.</p>}
    <div className="exploration-toolbar">
      <button disabled={!session||busy} onClick={()=>void generate(selectedNode?.id??null,selectedNode?'followup':'initial',session?.id)}>Dave asks</button>
      {busy&&<span role="status">DAVE is considering this branch…</span>}
      <button disabled={!session} onClick={() => openEditor('new', selectedNode?.id ?? null)}>Add text</button>
      <button disabled={!session} onClick={()=>openEditor('new',selectedNode?.id??null,'sketch')}>Add sketch</button>
      <button disabled={!selectedNode} aria-pressed={connecting} onClick={() => setConnecting(v => !v)}>{connecting ? 'Cancel connection' : 'Connect ideas'}</button>
      <button disabled={!selectedNode} onClick={() => attempt(() => { if (selected) store.explorationNodes.remove(selected); setSelected(null); setEditing(null); setConnecting(false); })}>Delete idea</button>
      <button disabled={!selectedConnection} onClick={() => attempt(() => { if (connection) store.explorationConnections.remove(connection); setConnection(null); })}>Delete connection</button>
    </div>
    <p className="exploration-help" role="status">{connecting ? 'Select another idea to draw an arrow from the selected idea.' : 'Drag an idea to move it. Select an arrow to delete its connection. Arrows express your connections, not causality.'}</p>
    {earlierSession && <details><summary>This idea uses an earlier confirmed context</summary>{earlierSession.tuningSnapshot.map(s => <p key={s.position.id}>{s.dimensionName}: {s.positionLabel}</p>)}</details>}
    {selectedNode && !selectedNode.explorationSession && <p className="exploration-help">This idea was saved before exploration confirmation was available. Its original references are kept.</p>}
    {error && <p role="alert">{error}</p>}{retry&&!busy&&<button className="research-text-button" onClick={()=>void generate(retry.id,retry.mode,retry.branchId)}>Retry question</button>}
  </div>;
  const explained=project?.explorationNodes.find(n=>n.id===inspecting);
  const editor=active&&<>
    {explained&&project&&<QuestionInspector node={explained} project={project} onClose={()=>setInspecting(null)} onInspectDimension={onInspectDimension}/>}
    {editing&&<form className="dimension-editor exploration-editor" aria-label={parent?'Branch idea':editing==='new'?'Add idea':'Edit idea'} onSubmit={e=>{e.preventDefault();void saveContribution();}}>
      {project&&draftBranch&&<p>In {branchName(project,sessions.find(s=>s.id===draftBranch)!)}</p>}
      <h3>{parent?'Respond or branch':editing==='new'?'Add a contribution':'Edit contribution'}</h3>
      <label htmlFor={`${marker}-kind`}>Card type</label><select id={`${marker}-kind`} value={contributionType} onChange={e=>setContributionType(e.target.value as typeof contributionType)}><option value="idea">Idea</option><option value="note">Written response / note</option><option value="sketch">Sketch / image</option></select>
      <label htmlFor={`${marker}-title`}>Idea title</label><input id={`${marker}-title`} autoFocus required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} />
      <label htmlFor={`${marker}-text`}>{contributionType==='sketch'?'Image description':'Idea text'}</label><textarea id={`${marker}-text`} rows={5} maxLength={2400} value={text} onChange={e=>setText(e.target.value)} />
      {contributionType==='sketch'&&<><label htmlFor={`${marker}-image`}>Sketch or image</label><input id={`${marker}-image`} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={e=>setImageFile(e.target.files?.[0]??null)}/><small>Stored locally. DAVE receives only your written description, not the image.</small></>}
      <div><button className="project-button" disabled={!title.trim()||savingAttachment}>{savingAttachment?'Saving contribution…':'Save idea'}</button><button className="research-text-button" type="button" onClick={()=>setEditing(null)}>Cancel</button></div>
    </form>}
  </>;
  const bounds = { x: EXPLORATION_X, y: 40, width: Math.max(650, ...nodes.map(n => point(n).x + IDEA_WIDTH + 24 - EXPLORATION_X)), height: Math.max(560, ...nodes.map(n => point(n).y + IDEA_HEIGHT + 24 - 40),...sessions.map(s=>branchPoint(project!,s).y+branchHeight(s)-40)) };
  function content(scale: number) {
    return <>
      <section className="map-exploration-area" aria-label="Exploration area" style={{left:bounds.x,top:bounds.y,width:bounds.width,height:bounds.height}} />
      {project&&<>
        <svg className="exploration-arrows exploration-membership" aria-label="Tuning branch connections">
          {sessions.map(s=>{const p=branchPoint(project,s);return <path key={s.id} data-dimensions-branch={s.id} d={`M 1330 100 C 1380 100, 1380 ${p.y+36}, ${p.x} ${p.y+36}`} fill="none" stroke="#bbc8d7" strokeWidth="1.5"/>;})}
          {nodes.filter(n=>n.explorationSession&&!connections.some(c=>c.toNodeId===n.id&&c.directional)).map(n=>{const s=sessions.find(s=>s.id===n.explorationSession?.id);if(!s)return null;const p=branchPoint(project,s),q=point(n);return <path key={n.id} data-branch-root={n.id} d={`M ${p.x+BRANCH_WIDTH} ${p.y+36} C ${p.x+BRANCH_WIDTH+40} ${p.y+36}, ${q.x-40} ${q.y+IDEA_HEIGHT/2}, ${q.x-8} ${q.y+IDEA_HEIGHT/2}`} fill="none" stroke="#aab5c0" strokeWidth="1.5" markerEnd={`url(#${marker})`}/>;})}
        </svg>
        <ExplorationBranches project={project} onSelect={activateBranch} onRename={(id,name)=>attempt(()=>store.updateExplorationBranch(id,{name}))} onExpand={(id,expanded)=>attempt(()=>store.updateExplorationBranch(id,{expanded}))} onInspectDimension={onInspectDimension}/>
        {changed&&session&&<p className="exploration-branch-change" style={{left:branchPoint(project,session).x,top:branchPoint(project,session).y+branchHeight(session)+8}}>Current sliders have changed. This branch keeps its confirmed tuning.</p>}
      </>}
      <svg className="exploration-arrows" aria-label="Idea connections"><defs><marker id={marker} markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10" fill="#858c96" /></marker></defs>
        {connections.map(c => {
          const from = nodes.find(n => n.id === c.fromNodeId)!, to = nodes.find(n => n.id === c.toNodeId)!;
          const a = point(from), b = point(to), dx = b.x - a.x, dy = b.y - a.y;
          const factor = Math.max(Math.abs(dx) / (IDEA_WIDTH / 2 + 8), Math.abs(dy) / (IDEA_HEIGHT / 2 + 8), 1);
          const x1 = a.x + IDEA_WIDTH / 2 + dx / factor, y1 = a.y + IDEA_HEIGHT / 2 + dy / factor;
          const x2 = b.x + IDEA_WIDTH / 2 - dx / factor, y2 = b.y + IDEA_HEIGHT / 2 - dy / factor;
          return <g key={c.id} data-connection-id={c.id} data-selected={connection === c.id}>
            <title>{from.title || 'Idea'} → {to.title || 'Idea'}</title>
            <line x1={x1} y1={y1} x2={x2} y2={y2} markerEnd={c.directional ? `url(#${marker})` : undefined} />
            <line className="exploration-arrow-hit" role="button" aria-label={`Connection: ${from.title || 'Idea'} to ${to.title || 'Idea'}`} tabIndex={active ? 0 : -1} x1={x1} y1={y1} x2={x2} y2={y2} onPointerDown={e => e.stopPropagation()} onClick={() => { if (active) { setConnection(c.id); setSelected(null); setConnecting(false); } }} onKeyDown={e => { if (active && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setConnection(c.id); setSelected(null); } }} />
            {c.label && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8}>{c.label}</text>}
          </g>;
        })}
      </svg>
      {nodes.map(n => <article key={n.id} data-idea-id={n.id} className={`exploration-card${selected === n.id ? ' is-selected' : ''}${n.question?' exploration-question':''}${n.questionState==='skipped'?' is-skipped':''}`} style={{ left: point(n).x, top: point(n).y }} onPointerDown={e => start(e, n)} onPointerMove={e => { if (drag.current) { e.stopPropagation(); move(e, scale); } }} onPointerUp={e => { e.stopPropagation(); finish(); }} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish(true)}>
        <button className="exploration-card-title" aria-pressed={selected === n.id} onClick={() => choose(n.id)}>{n.title || 'Untitled idea'}</button>
        {(n.content.type==='image'||n.content.type==='sketch')&&<SketchImage asset={n.content.asset}/>}
        <p contentEditable={active && !n.question} suppressContentEditableWarning
          role={active && !n.question ? 'textbox' : undefined}
          aria-label={active && !n.question ? `Text for ${n.title || 'untitled card'}` : undefined}
          onBlur={event => {
            if (!active || n.question) return;
            const nextText = event.currentTarget.innerText;
            attempt(() => {
              if (nextText.length > 2400) throw new Error('Keep card text within 2400 characters.');
              const current = store.getProject()?.explorationNodes.find(item => item.id === n.id && !item.archivedAt);
              if (!current || current.question) return;
              if (nextText !== current.content.text) store.explorationNodes.update(n.id, { content: { ...current.content, text: nextText } });
            });
          }}>{n.content.text}</p>
        {n.question&&<><small>{n.questionState==='skipped'?'Skipped · ':''}Generated by DAVE</small>{active&&<div className="exploration-question-actions"><button onClick={()=>{setInspecting(n.id);setEditing(null);}}>Why this question?</button><button onClick={()=>attempt(()=>store.explorationNodes.update(n.id,{questionState:n.questionState==='skipped'?'open':'skipped'},{note:'Designer changed question visibility.'}))}>{n.questionState==='skipped'?'Revisit':'Skip'}</button><button disabled={busy} onClick={()=>{setConnecting(false);if(n.explorationSession)store.selectExplorationBranch(n.explorationSession.id);setSelected(n.id);void generate(n.id,'alternative',n.explorationSession?.id);}}>Different question</button></div>}</>}
        {active && !n.question && <button className="exploration-card-edit" aria-label={`Edit ${n.title || 'idea'}`} onClick={() => openEditor(n.id)}>Edit</button>}
      </article>)}
    </>;
  }
  return { toolbar, editor, content, bounds, hasContent: !!session || nodes.length > 0, focus:project&&session?branchPoint(project,session):undefined, session };
}
