import { useState } from 'react';
import type { Claim, Relationship } from '../../model/types';
import { useProject, useProjectStore } from '../../state/ProjectProvider';
import type { MapSelection } from './RelationshipsMap';
import { RelationshipsMap } from './RelationshipsMap';
import { RelationshipInspector } from './RelationshipInspector';
import { applyRelationships, prepareRelationships } from './analysis';

export function RelationshipsWorkspace({mode='live',controlsOnly=false}:{mode?:'demo'|'live';controlsOnly?:boolean}) {
  const { project, errorOperation } = useProject();
  const store = useProjectStore();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [selection, setSelection] = useState<MapSelection | null>(null);
  if (!project || errorOperation === 'load') return null;
  const claims = project.claims.filter(c => !c.archivedAt); const relationships = project.relationships.filter(r => !r.archivedAt);
  const selected = selection?.kind === 'claim' ? claims.find(c => c.id === selection.id) : relationships.find(r => r.id === selection?.id);
  async function analyse() {
    if(mode==='demo'){setError('Demo project: Relationships uses the same synthetic research categories. Switch to Live AI in Research to analyse your own project. No API request was made.');return;}
    if (busy) return;
    setBusy(true); setError(''); setMessage('Generating grounded claims, then checking relationships…');
    try {
      const original = store.getProject()!; const passages = prepareRelationships(original);
      const response = await fetch('/api/relationships/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: original.context, categories: original.categories.filter(c=>!c.archivedAt&&c.review?.state!=='rejected').map(c=>({id:c.id,revision:c.revision,name:c.name})), chunks: passages.map(({ id, title, location, text, categories, categoryReferences, limitations }) => ({ id, title, location, text, categories, categoryReferences, limitations })) }), signal: AbortSignal.timeout(195000) });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The AI server is unavailable. Start the DAVE server and retry.');
      const result = await response.json();
      if (response.status === 404) throw new Error('The running DAVE AI server does not have the Relationships endpoint. Stop the old server with Ctrl+C, run npm run server from the DAVE folder, then retry. Your research is unchanged.');
      if (!response.ok) throw new Error(result.error || 'Analysis failed. Retry.');
      if (!Array.isArray(result.claims) || !Array.isArray(result.relationships) || !Array.isArray(result.warnings) || result.warnings.some((w: unknown) => typeof w !== 'string')) throw new Error('Invalid analysis response. Nothing was added.');
      const latest = store.getProject();
      if (!latest || latest.id !== original.id || latest.context !== original.context || JSON.stringify(prepareRelationships(latest)) !== JSON.stringify(passages)) throw new Error('Research changed during analysis. Nothing was added. Retry.');
      store.restoreProject(applyRelationships(latest, passages, result));
      setMessage(`${result.claims.length} claims and ${result.relationships.length} relationships proposed. ${result.warnings.join(' ')} Existing reviews and edits are kept.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Analysis failed. Your work is unchanged. Retry.'); setMessage(''); }
    finally { setBusy(false); }
  }
  return <section className="relationships-workspace"><p>Inspect interpretations and connections grounded in your Live AI research. All suggestions need your review.</p><button className="project-button" disabled={busy} onClick={() => void analyse()}>{busy ? 'Analysing…' : 'Analyse relationships'}</button><p>New analysis adds proposals. Only passages in active, non-rejected research categories are included.</p>{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {!controlsOnly && <div className="relationships-layout relationships-map-layout"><RelationshipsMap project={project} selection={selection} onReorganise={positions => store.setClaimMapPositions([...positions].map(([id,position])=>({id:id as Claim['id'],position})))} onSelect={setSelection} onMove={(node, mapPosition) => { if (node.kind === 'claim') store.claims.update(node.id as Claim['id'], {mapPosition}); else store.relationships.update(node.id as Relationship['id'], {mapPosition}); }} />
    <aside aria-label="Evidence inspector">{selected ? <RelationshipInspector key={selected.id} project={project} item={selected} onClose={() => setSelection(null)} onError={setError} /> : <p>Select a claim to explore its connections. Select a connection to understand why DAVE proposed it.</p>}</aside></div>}
  </section>;
}
