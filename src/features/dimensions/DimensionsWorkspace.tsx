import { useCallback, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Claim, Dimension, DimensionContent, MapStage, MapViewport, Project, Relationship } from '../../model/types';
import { useProject, useProjectStore, useProjectSession } from '../../state/ProjectProvider';
import { RelationshipsMap } from '../relationships/RelationshipsMap';
import type { MapSelection } from '../relationships/RelationshipsMap';
import { prepareDimensions, applyDimensions } from './generation';
import { matchingExplorationBranch,explorationSettings, confirmReviewedExploration } from './explorationConfirmation';
import {branchPoint,branchName} from '../exploration/layout';
import { useExploration } from '../exploration/ExplorationWorkspace';
import { RelationshipInspector } from '../relationships/RelationshipInspector';

const positions = [-1, 0, 1] as const;
const labels = ['lowLabel', 'midLabel', 'highLabel'] as const;
const explanations = ['lowExplanation', 'midExplanation', 'highExplanation'] as const;
const ref = <T extends { id: string; revision: number }>(item: T): Pick<T, 'id' | 'revision'> => ({ id: item.id, revision: item.revision });
const blank = (): DimensionContent => ({ name: '', explanation: '', lowLabel: '', midLabel: '', highLabel: '',
  lowExplanation: '', midExplanation: '', highExplanation: '', claims: [], relationships: [], limitations: [], review: { state: 'accepted' } });

function DimensionEditor({ project, dimension, onSave, onClose, onRemove }: {
  project: Project; dimension?: Dimension; onSave: (content: DimensionContent) => void; onClose: () => void; onRemove: () => void;
}) {
  const [draft, setDraft] = useState<DimensionContent>(() => dimension ? { ...dimension } : blank());
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ ...draft, name: draft.name.trim(), explanation: draft.explanation.trim(),
      lowLabel: draft.lowLabel.trim(), midLabel: draft.midLabel?.trim(), highLabel: draft.highLabel.trim() });
  }
  return <form className="dimension-editor" onSubmit={submit} aria-label={dimension ? 'Edit dimension' : 'Add dimension'}>
    <h3>{dimension ? 'Edit dimension' : 'Add dimension'}</h3>
    <label className="research-field">Title<input required maxLength={100} autoFocus value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
    <label className="research-field">Brief explanation<textarea required maxLength={400} rows={2} value={draft.explanation} onChange={e => setDraft({ ...draft, explanation: e.target.value })} /></label>
    <p>Give each position a distinct approach. The middle is a meaningful choice.</p>
    {positions.map((value, i) => <fieldset key={value}><legend>{value > 0 ? '+1' : value}</legend>
      <label className="research-field">Position {value} label<input required maxLength={70} value={draft[labels[i]] ?? ''} onChange={e => setDraft({ ...draft, [labels[i]]: e.target.value })} /></label>
      <label className="research-field">Position {value} explanation (optional)<textarea rows={2} maxLength={400} value={draft[explanations[i]] ?? ''} onChange={e => setDraft({ ...draft, [explanations[i]]: e.target.value })} /></label>
    </fieldset>)}
    <details><summary>Associate findings ({draft.claims.length + draft.relationships.length})</summary>
      <p>Choose existing claims or relationships. Associations do not imply proof or causality.</p>
      {(['claims', 'relationships'] as const).map(kind => <fieldset key={kind}><legend>{kind === 'claims' ? 'Claims' : 'Relationships'}</legend>
        {project[kind].filter(item => !item.archivedAt).map(item => <label className="dimension-association" key={item.id}>
          <input type="checkbox" checked={draft[kind].some(r => r.id === item.id)} onChange={e => {
            if (kind === 'claims') setDraft({ ...draft, claims: e.target.checked ? [...draft.claims, ref(item as Claim)] : draft.claims.filter(r => r.id !== item.id) });
            else setDraft({ ...draft, relationships: e.target.checked ? [...draft.relationships, ref(item as Relationship)] : draft.relationships.filter(r => r.id !== item.id) });
          }} />{'statement' in item ? item.statement : item.description}
        </label>)}
        {!project[kind].some(item => !item.archivedAt) && <p>No {kind} yet.</p>}
      </fieldset>)}
    </details>
    <div className="dimension-actions"><button className="project-button" disabled={!draft.name.trim() || !draft.explanation.trim() || labels.some(key => !draft[key]?.trim())}>Save dimension</button>
      <button className="research-text-button" type="button" onClick={onClose}>Cancel</button>
      {dimension && <button className="research-text-button" type="button" onClick={onRemove}>Remove dimension</button>}
    </div>
  </form>;
}


function DimensionExcerpts({project,dimension}:{project:Project;dimension:Dimension}) {
  const session=useProjectSession();const [error,setError]=useState('');
  const excerpts:{key:string;text?:string;location?:string;sourceId?:string}[]=(dimension.evidence??[]).map(ref=>{
    const e=project.evidence.find(e=>e.id===ref.id);
    const content=e?.revision===ref.revision?e:e?.history.find(h=>h.revision===ref.revision)?.content;
    return {key:ref.id,text:content?.text,location:content?.location,sourceId:content?.source.id};
  });
  for(const [i,entry] of (dimension.researchPassages??[]).entries()) {
    const source=project.sources.find(s=>s.id===entry.passage.source.id);
    const content=source?.revision===entry.passage.source.revision?source:source?.history.find(h=>h.revision===entry.passage.source.revision)?.content;
    const section=content?.preparedContent?.sections[entry.passage.sectionIndex];
    excerpts.push({key:`passage-${i}`,text:section?.text.slice(entry.passage.start,entry.passage.end),location:section?.location,sourceId:entry.passage.source.id});
  }
  async function download(source:Project['sources'][number]) {
    try {const blob=await session.loadFile(source.originalFile.id);if(!blob)throw new Error('Original source file is unavailable.');const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=source.originalFile.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    catch(e){setError(e instanceof Error?e.message:'Could not open source.');}
  }
  return <>{excerpts.map(e=>{const source=project.sources.find(s=>s.id===e.sourceId);return <details className="inspector-excerpt" key={e.key}><summary>{source?.title??'Source unavailable'} · {e.location??'Location unavailable'}</summary><blockquote>{e.text??'Excerpt unavailable'}</blockquote>{source&&<button className="research-text-button" onClick={()=>void download(source)}>Download original source</button>}</details>;})}{error&&<p role="alert">{error}</p>}</>;
}

export function DimensionsWorkspace({mode='live',stage='Dimensions',onExplore}:{mode?:'live'|'demo';stage?:MapStage;onExplore?:()=>void}) {
  const { project, errorOperation } = useProject();
  const store = useProjectStore();
  const [busy,setBusy]=useState(false);
  const requestBusy=useRef(false);
  const [message,setMessage]=useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [associated, setAssociated] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [focusRequest,setFocusRequest]=useState<{dimensionId?:string;point?:{x:number;y:number};token:number}>();
  const onViewChange=useCallback((stage:MapStage,view:MapViewport)=>store.setMapView(stage,view),[store]);
  const exploration=useExploration({project,store,mode,onExplore,active:stage==='Explore',onFocusCard:point=>setFocusRequest({point,token:Date.now()}),onInspectDimension:id=>{
    setAssociated(id);setEditing(null);setSelection(null);setFocusRequest({dimensionId:id,token:Date.now()});
  }});
  if (!project || errorOperation === 'load') return null;
  const matchingBranch=matchingExplorationBranch(project);
  const matchHint=matchingBranch ? `This tuning already exists in ${branchName(project,matchingBranch)}. Change tuning to create a new branch.` : undefined;
  const allDimensions=project.dimensions.filter(d=>!d.archivedAt);
  const dimensions = allDimensions.filter(d=>d.review.state!=='rejected');
  const dimension = allDimensions.find(d => d.id === editing);
  const selected = selection?.kind === 'claim' ? project.claims.find(c => c.id === selection.id) : project.relationships.find(r => r.id === selection?.id);
  const inspected = project.dimensions.find(d => d.id === associated);
  const attempt = (action: () => void) => { try { action(); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your change.'); } };
  function focusConfirmedBranch() {
    const latest=store.getProject()!;const branch=latest.exploration!.sessions.find(s=>s.id===latest.exploration!.activeSessionId)!;
    setFocusRequest({point:branchPoint(latest,branch),token:Date.now()});
  }
  function confirmTuning() { attempt(()=>{
    const settings=explorationSettings(store.getProject()!);
    store.restoreProject(confirmReviewedExploration(store.getProject()!,settings));onExplore?.();focusConfirmedBranch();
  }); }
  async function generate() {
    if(requestBusy.current)return;
    if(mode==='demo'){setError('AI generation is available in Live AI mode. Manual dimensions remain available in Demo.');return;}
    requestBusy.current=true;setBusy(true);setError('');setMessage('');
    try {
      const original=store.getProject()!;const input=prepareDimensions(original);
      const response=await fetch('/api/dimensions/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(110000)});
      if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('The AI server is unavailable. Start the DAVE server and retry. Manual dimensions remain available.');
      const output=await response.json();
      if(response.status===404)throw new Error('Restart the DAVE backend to enable dimension generation. Your dimensions are unchanged.');
      if(!response.ok)throw new Error(output.error||'Dimension generation failed. Nothing was added.');
      const latest=store.getProject();if(!latest||latest.id!==original.id)throw new Error('The project changed during generation. Nothing was added.');
      const result=applyDimensions(latest,input,output);
      if(result.count)store.restoreProject(result.project);
      setMessage(`${result.count} new proposal${result.count===1?'':'s'}. ${!result.count?'No new dimensions were added. ':''}${result.warnings.join(' ')}`);
    }catch(e){setError(e instanceof Error?e.message:'Generation failed. Your dimensions are unchanged.');}
    finally{requestBusy.current=false;setBusy(false);}
  }
  const cards = <section aria-label="Dimensions area"><div className="dimension-area-heading"><h3>Dimensions</h3><button className="project-button" onClick={() => { setEditing('new'); setAssociated(null); }}>Add dimension</button></div>
    {!dimensions.length && <p className="dimension-empty">Add dimensions manually to explore design considerations. Define three meaningful approaches and connect them to your research if useful.</p>}
    {dimensions.map(d => {
      const position = project.dimensionPositions.find(p => p.dimension.id === d.id && !p.archivedAt);
      // Older continuous or undecided values stay untouched until the designer selects a new position.
      const index: number = position ? position.value === 0 ? 0 : position.value === .5 ? 1 : position.value === 1 ? 2 : -1 : (d.draftPosition ?? 0) + 1;
      return <article className="dimension-card" key={d.id} data-dimension-id={d.id} tabIndex={0} aria-label={`Dimension: ${d.name}`}
        onClick={event=>{if(!(event.target as HTMLElement).closest('button,input,textarea,summary,a')){setAssociated(d.id);setEditing(null);setSelection(null);}}}
        onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();setAssociated(d.id);setEditing(null);setSelection(null);}}}>
        <div className="dimension-area-heading"><h4>{d.name}</h4><button className="research-text-button" aria-label={`Edit ${d.name}`} onClick={() => { setEditing(d.id); setAssociated(null); }}>Edit</button></div>
        <p>{d.explanation}</p>
        {d.origin!=='researcher'&&<small>{d.grounding==='research_grounded'&&(d.evidence?.length||d.researchPassages?.length)?'Research-supported':'AI inference · Evidence not verified'}</small>}
        <label className="dimension-association"><input type="checkbox" checked={position?.selected ?? false} onChange={event=>attempt(()=>{
          if (!position) throw new Error('Choose a position before selecting this dimension.');
          store.setDimensionPosition({...position,selected:event.target.checked});
        })} />Use for exploration</label>
        <div className="dimension-tuning" role="group" aria-label={`Position for ${d.name}`}>{positions.map((value, i) => <button key={value} aria-pressed={index === i} aria-label={`${value > 0 ? '+1' : value}: ${d[labels[i]] || 'Middle label not set'}`} onClick={() => attempt(() => {
          store.setDimensionPosition({ ...position, dimension: ref(d), selected: position?.selected ?? true, value: i / 2 });
        })}>{value > 0 ? '+1' : value}</button>)}</div>
        <strong className="dimension-selected-label">{index < 0 ? 'Earlier position retained' : d[labels[index]] || 'Add a middle approach in Edit'}</strong>
        {index >= 0 && d[explanations[index]] && <details><summary>About this position</summary><p>{d[explanations[index]]}</p></details>}
        {index < 0 && <p>Your earlier tuning value is preserved. Select a position when ready.</p>}
        <button className="research-text-button" onClick={() => { setAssociated(associated === d.id ? null : d.id); setEditing(null); setSelection(null); }}>Associated findings ({d.claims.length + d.relationships.length + (d.evidence?.length??0) + (d.researchPassages?.length??0)})</button>
      </article>;
    })}
    <button className="project-button dimension-confirm-map" aria-label="Save tuning as a new branch" disabled={!!matchingBranch} aria-describedby={matchHint?'tuning-match-map':undefined} onClick={confirmTuning}>Confirm tuning</button>
    {matchHint&&<p id="tuning-match-map" className="relationship-map-help" role="status">{matchHint}</p>}
  </section>;
  return <section className="dimensions-workspace progressive-map-workspace" aria-label="Progressive Design Map">
    {stage==='Dimensions' && <>
    <button className="project-button" disabled={!!matchingBranch} aria-describedby={matchHint?'tuning-match-top':undefined} onClick={confirmTuning}>Confirm tuning</button>
    {matchHint&&<p id="tuning-match-top" className="relationship-map-help" role="status">{matchHint}</p>}
    {error && <p className="project-error" role="alert">{error}</p>}
    <p>Add design considerations, connect relevant findings, and choose a position for each.</p>
    <button className="project-button" disabled={busy} onClick={()=>void generate()}>{busy?'Generating dimensions…':'Generate dimensions'}</button>
    <p className="relationship-map-help">Dimensions use source excerpts and interpretations. Tune them immediately, or edit and remove them as you work.</p>
    {message && <p role="status">{message}</p>}
    </>}
    {exploration.toolbar}
    {stage==='Explore' && !exploration.session && <p>In Dimensions, select the considerations you want to explore, choose their positions, then use Confirm tuning.</p>}
    {stage!=='Dimensions' && error && <p role="alert">{error}</p>}
    <div className="relationships-layout relationships-map-layout">
      <RelationshipsMap key={project.id} readOnly={stage!=='Relationships'} stage={stage} onViewChange={onViewChange} focusRequest={focusRequest} exploration={exploration.hasContent || stage==='Explore' ? {content:exploration.content,bounds:exploration.bounds,focus:exploration.focus} : undefined} project={project} selection={selection} onSelect={s => { setSelection(s); setEditing(null); setAssociated(null); }}
        onMove={(node,mapPosition)=>attempt(()=>{if(node.kind==='claim')store.claims.update(node.id as Claim['id'],{mapPosition});else store.relationships.update(node.id as Relationship['id'],{mapPosition});})} onReorganise={positions=>attempt(()=>store.setClaimMapPositions([...positions].map(([id,position])=>({id:id as Claim['id'],position}))))} extension={{ content: cards, height: 200 + dimensions.length * 400, selectedDimensionId:associated, associations: dimensions.filter(d=>!d.generation).flatMap(d=>[...d.claims.map(r=>({kind:'claim' as const,id:r.id,dimensionId:d.id})),...d.relationships.map(r=>({kind:'relationship' as const,id:r.id,dimensionId:d.id}))]) }} />
      <aside aria-label={stage==='Relationships'?'Evidence inspector':'Dimension and research inspector'}>
        {exploration.editor}
        {editing && <DimensionEditor key={editing} project={project} dimension={dimension} onClose={() => setEditing(null)} onRemove={() => attempt(() => { if (dimension) store.dimensions.remove(dimension.id); setEditing(null); })}
          onSave={content => attempt(() => {
            if (dimension) store.dimensions.update(dimension.id, content);
            else {
              const added = store.dimensions.add(content);
              store.setDimensionPosition({ dimension: ref(added), selected: true, value: .5 });
            }
            setEditing(null);
          })} />}
        {inspected && <section><h3>{inspected.name}</h3>{inspected.archivedAt && <p>This dimension was removed. Its saved findings remain available.</p>}<p>Associated findings</p><p>Associations explain relevance, not proof or causality.</p>
          {inspected.origin!=='researcher'&&<p>{inspected.grounding==='research_grounded'&&(inspected.evidence?.length||inspected.researchPassages?.length)?'Research-supported consideration':'AI inference · Evidence not verified'}</p>}
          {inspected.rationale&&<p>{inspected.rationale}</p>}
          {inspected.limitations.map((text,i)=><p key={i}>{text}</p>)}
          {inspected.origin!=='researcher'&&<dl className="dimension-proposal-positions">{positions.map((value,i)=><div key={value}><dt>{value>0?'+1':value}: {inspected[labels[i]]}</dt><dd>{inspected[explanations[i]]||'No explanation saved.'}</dd></div>)}</dl>}
          <DimensionExcerpts project={project} dimension={inspected} />
          {!inspected.claims.length && !inspected.relationships.length && !inspected.evidence?.length && !inspected.researchPassages?.length && <p>No findings associated yet. Use Edit to choose existing findings.</p>}
          {(['claims', 'relationships'] as const).flatMap(kind => inspected[kind].map(reference => {
            const item = project[kind].find(item => item.id === reference.id);
            const content = item?.revision === reference.revision ? item : item?.history.find(h => h.revision === reference.revision)?.content;
            return <div className="dimension-finding" key={reference.id}><p>{content ? 'statement' in content ? content.statement : content.description : 'This finding is unavailable.'}</p>
              <small>Associated revision {reference.revision}{item?.archivedAt ? ' · Archived finding' : ''}</small>
              {item && <button className="research-text-button" onClick={() => setSelection({ kind: kind === 'claims' ? 'claim' : 'relationship', id: item.id })}>Inspect research{item.revision !== reference.revision ? ' (current version)' : ''}</button>}
            </div>;
          }))}
        </section>}
        {selected && !editing && <RelationshipInspector key={selected.id} project={project} item={selected} onClose={() => setSelection(null)} onError={setError} />}
        {!editing && !inspected && !selected && <p>{stage==='Explore'?'Add an idea or select one to edit, connect, or branch. Open a confirmed Dimension to inspect its findings.':stage==='Relationships'?'Select a claim or relationship to inspect its supporting research.':'Pan right to Dimensions. Add a dimension or select a finding to inspect its research.'}</p>}
      </aside>
    </div>
  </section>;
}
