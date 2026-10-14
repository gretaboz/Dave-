import { categoryStyle } from '../../app/categoryStyles';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { EntityId, ResearchCategory, Source } from '../../model/types';
import { useProject, useProjectStore, useProjectSession } from '../../state/ProjectProvider';
import { extractSource, uploadResearch } from './uploadResearch';
import { prepareAnalysis, verifyProposals } from './clustering';
import { ExcerptCard } from './ExcerptCard';

function CategoryName({ category, onRename }: {
  category: ResearchCategory;
  onRename: (name: string) => boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (onRename(name)) setEditing(false);
  }
  return editing ? (
    <form className="research-inline-form" onSubmit={submit}>
      <label className="research-field">Category name
        <input value={name} onChange={event => setName(event.target.value)} autoFocus required />
      </label>
      <button className="project-button" disabled={!name.trim()}>Save name</button>
      <button className="research-text-button" type="button" onClick={() => setEditing(false)}>Cancel</button>
    </form>
  ) : (
    <div className="research-category-heading">
      <button className="research-text-button" type="button" aria-label={`Rename ${category.name}`}
        onClick={() => { setName(category.name); setEditing(true); }}>Rename</button>
    </div>
  );
}

/** Project data comes only from the shared store; local state holds selection and form drafts. */
export function ResearchWorkspace({ mode = 'live', modeControl }: { mode?: 'demo' | 'live'; modeControl?: ReactNode }) {
  const { project, status, errorOperation } = useProject();
  const store = useProjectStore();
  const session = useProjectSession();
  const [busy, setBusy] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [selectedId, setSelectedId] = useState<EntityId<'source'> | null>(null);
  const [newName, setNewName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<EntityId<'research_category'> | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!project || status === 'loading' || errorOperation === 'load') return <>{modeControl}</>;

  const sources = project.sources.filter(source => !source.archivedAt);
  const categories = project.categories.filter(category => !category.archivedAt).sort((a, b) => a.order - b.order);
  const selected = sources.find(source => source.id === selectedId);
  const selectedCategory = categories.find(category => category.id === selectedCategoryId);
  const visibleCategories = categories.filter(category => category.review?.state !== 'rejected');
  const visibleSources = sources;
  // One card per exact source range; shared passages retain all their category links.
  const excerpts = new Map<string, { passage: NonNullable<ResearchCategory['passages']>[number]; categoryIds: string[]; categoryNames: string[] }>();
  for (const category of visibleCategories) for (const passage of category.passages ?? []) {
    const key = `${passage.source.id}:${passage.source.revision}:${passage.sectionIndex}:${passage.start}:${passage.end}`;
    const existing = excerpts.get(key);
    if (existing) { existing.categoryIds.push(category.id); existing.categoryNames.push(category.name); }
    else excerpts.set(key, { passage, categoryIds: [category.id], categoryNames: [category.name] });
  }
  const linkedSourceIds = new Set(selectedCategory?.passages?.map(passage => passage.source.id) ?? []);


  async function analyse() {
    // Demo has a separate project and an unconditional early return: never fetch.
    if (mode === 'demo') {
      setError(null);
      setAnalysisStatus('Using pre-generated synthetic citrus press categories. No OpenAI request was made. Your demo edits are kept.');
      return;
    }
    setAnalysing(true); setError(null); setAnalysisStatus('Analysing research…');
    try {
      const chunks = prepareAnalysis(sources);
      const skipped = sources.filter(source => source.processingState !== 'ready' || !source.preparedContent).length;
      const response = await fetch('/api/research/cluster', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunks, context: project!.context }), signal: AbortSignal.timeout(100_000),
      });
      if (!response.headers.get('content-type')?.includes('application/json'))
        throw new Error('The AI server is unavailable. Start the DAVE server and retry.');
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Research analysis failed. Please retry.');
      if (typeof result.model !== 'string' || typeof result.promptVersion !== 'string'
        || !Array.isArray(result.warnings) || result.warnings.some((item: unknown) => typeof item !== 'string'))
        throw new Error('The AI server returned an invalid result. No categories were added.');
      const latest = store.getProject();
      if (!latest || latest.id !== project!.id || latest.context !== project!.context || JSON.stringify(prepareAnalysis(latest.sources)) !== JSON.stringify(chunks))
        throw new Error('The research changed during analysis. No categories were added. Please retry.');
      const inputs = verifyProposals(result.categories, chunks, latest.sources);
      const analysis = { id: crypto.randomUUID(), model: result.model, promptVersion: result.promptVersion, analysedAt: new Date().toISOString() };
      const added = inputs.length ? store.addResearchAnalysis(inputs.map(input => ({ ...input, analysis }))) : [];
      if (added.length) { setSelectedCategoryId(added[0].id); setSelectedId(null); }
      const limitations = [...result.warnings, ...(skipped ? [`${skipped} document(s) had no ready text and were not analysed.`] : []),
        ...(sources.some(source => source.preparedContent?.limitations.some(item => /failed|no readable|not supported/i.test(item)))
          ? ['Some source content could not be extracted. Check document processing limitations.'] : [])];
      setAnalysisStatus([added.length ? `${added.length} new categories proposed. Existing categories are unchanged.` : 'No thematic categories could be identified from this material.', ...limitations].join(' '));
    } catch (error) {
      setAnalysisStatus('');
      setError(error instanceof Error && error.name !== 'TimeoutError' && error.name !== 'TypeError' ? error.message
        : 'Could not reach the AI server or the request timed out. Your categories are unchanged. Please retry.');
    } finally { setAnalysing(false); }
  }

  async function upload(files: File[]) {
    setBusy(true);
    setError(null);
    const failures: string[] = [];
    try {
      for (const file of files) {
        setUploadStatus(`Preparing ${file.name}…`);
        try {
          const source = await uploadResearch(session, file);
          setSelectedId(source.id); setSelectedCategoryId(null);
        } catch (error) {
          failures.push(`${file.name}: ${error instanceof Error ? error.message : 'Upload failed.'}`);
        }
      }
      setError(failures.length ? failures.join(' ') : null);
    } finally { setBusy(false); setUploadStatus(''); }
  }
  async function original(source: Source, retry = false) {
    setBusy(true);
    setError(null);
    try {
      const file = await session.loadFile(source.originalFile.id);
      if (!file) throw new Error('The original file is missing from local storage. Upload it again.');
      if (retry) await extractSource(session, source, file);
      else {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = source.originalFile.filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not read the original file.'); }
    finally { setBusy(false); }
  }

  function change(action: () => void) {
    try { action(); setError(null); return true; }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save this change.'); return false; }
  }
  function createCategory(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (change(() => {
      const category = store.categories.add({ name, order: Math.max(-1, ...project!.categories.map(category => category.order)) + 1 });
      setSelectedCategoryId(category.id); setSelectedId(null);
    })) setNewName('');
  }
  function deleteCategory(category: ResearchCategory) {
    if (!window.confirm(`Delete “${category.name}”? Your uploaded documents will be kept.`)) return;
    if (change(() => store.categories.remove(category.id)) && selectedCategoryId === category.id)
      setSelectedCategoryId(null);
  }

  async function deleteFile(source: Source) {
    if (!window.confirm(`Delete “${source.originalFile.filename}”? Its stored file, extracted text, and category excerpts will be removed. Affected summaries will be cleared. This cannot be undone.`)) return;
    setBusy(true); setError(null);
    try {
      await session.deleteSource(source.id);
      setSelectedId(null); setAnalysisStatus('');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not delete this file.'); }
    finally { setBusy(false); }
  }

  return (
    <section className="research-workspace research-organiser" aria-label="Research workspace">
      {error && <p role="alert" className="project-error">{error}</p>}
      {uploadStatus && <p role="status">{uploadStatus}</p>}
      {analysisStatus && <p role="status" className="research-feedback">{analysisStatus}</p>}
      <label className="research-context">Optional project context
        <textarea key={project.id} defaultValue={project.context} rows={2} maxLength={4000} disabled={busy || analysing}
          placeholder="A few sentences about your project…"
          onBlur={event => change(() => { store.updateProject({ context: event.target.value }); })} />
      </label>
      <section className="research-files research-library" aria-label="Uploaded files">
        <div className="research-library-heading"><h4>Research Library</h4>{modeControl}</div>
        <div className="research-upload-area">
          <label className="research-upload-button"><span className="research-upload-plus" aria-hidden="true">+</span><span>Upload project files</span>
            <input className="research-file-input" aria-label="Upload research documents" type="file" accept=".pdf,.txt,.docx" multiple disabled={busy || analysing || mode === 'demo'}
              onChange={event => {
                const files = Array.from(event.target.files ?? []); event.target.value = '';
                if (files.length) void upload(files);
              }} />
          </label>
        <details className="research-library-files"><summary>Uploaded files ({sources.length})</summary>
        {visibleSources.length ? <ul>{visibleSources.map(source => <li key={source.id} className={selectedCategory ? linkedSourceIds.has(source.id) ? 'research-file-linked' : 'research-file-other' : undefined}>
          <button className="research-file-name" aria-label={source.processingState === 'failed' ? `${source.title} — Extraction failed` : source.title}
            onClick={() => { setSelectedId(source.id); setSelectedCategoryId(null); }}>{source.title}</button>
          <span className="research-file-status">{({ ready: 'Ready', failed: 'Could not read file', processing: 'Reading…', unprocessed: 'Not read yet' })[source.processingState]}</span>
          <button className="research-text-button" aria-label={`Delete ${source.originalFile.filename}`} disabled={busy || analysing || status === 'saving' || status === 'error'} onClick={() => { void deleteFile(source); }}>Delete</button>
        </li>)}</ul> : <p className="research-empty">No research sources yet. Upload project files to begin.</p>}
        </details>
        </div>
        <p className="research-file-note">PDF, TXT, DOCX · up to 20 MB each. {mode === 'demo' ? 'Synthetic demo files. No API calls in Demo mode.' : 'Analysis sends readable text to OpenAI; original files stay here.'}</p>
      </section>
      <div className="research-analyse-action">
        <div><strong>Let DAVE organise your research into categories</strong><p>{mode === 'demo' ? 'Explore the pre-generated synthetic example. Switch to Live AI for your own files.' : 'Upload files, then analyse their content when you’re ready.'}</p></div>
          <button className="project-button research-analyse-button" type="button" disabled={busy || analysing || !sources.some(source => source.processingState === 'ready' && source.preparedContent)}
            onClick={() => { void analyse(); }}>{analysing ? 'Analysing research…' : 'Analyse research'}</button>
      </div>
      <div className="research-folder-workspace" aria-label="Categories and Sources">
      <div className="research-layout">
        <section className="research-category-list" aria-label="Research categories">
          <h4>Categories</h4>
          <p className="research-category-empty">DAVE proposes categories after you upload files and click Analyse research.</p>
          <div className="research-category-options">
            {visibleCategories.map(category => {
              const count = new Set(category.passages?.map(p => p.source.id) ?? sources.filter(s => s.primaryCategoryId === category.id).map(s => s.id)).size;
              return <div key={category.id} className="research-category-row" style={categoryStyle(project, category.id)}><button className="research-category-option" type="button" aria-label={`Inspect ${category.name}`} aria-pressed={selectedCategoryId === category.id}
                onClick={() => { setSelectedCategoryId(category.id); setSelectedId(null); }}>
                <span>{category.name}</span><small>{category.review?.state === 'rejected' ? 'Rejected' : `${count} ${count === 1 ? 'source' : 'sources'}`}</small>
              </button>
                <div className="research-category-controls">
                  <CategoryName key={category.id} category={category} onRename={name => !!name.trim() && change(() => store.categories.update(category.id, { name: name.trim() }))} />
                  <button className="research-text-button" type="button" aria-label={`Delete category ${category.name}`} disabled={busy} onClick={() => deleteCategory(category)}>Delete</button>
                </div>
              </div>;
            })}
            {!visibleCategories.length && <p className="research-category-empty">{categories.length ? 'No active categories.' : 'No categories yet.'}</p>}
          </div>
        </section>
        <section className="research-inspector" aria-label="Research details">
          <h4 className="research-column-title">Sources</h4>
          {selectedCategory ? <>
            <h4>{selectedCategory.name}</h4>
            <p className="research-description-label">{selectedCategory.origin === 'researcher' ? 'Your category description' : selectedCategory.analysis?.promptVersion === 'demo-citrus-1' ? 'Synthetic demo description' : 'DAVE’s category description'}</p>
            <p className="research-summary">{selectedCategory.description || (selectedCategory.passages ? 'A source was deleted. Analyse again to propose a new summary, or keep exploring the remaining excerpts.' : 'A category organised by you.')}</p>
            <div className="research-inspector-meta"><span>{selectedCategory.analysis?.promptVersion === 'demo-citrus-1' ? 'Synthetic demo proposal' : selectedCategory.origin === 'dave' ? 'Proposed by DAVE' : selectedCategory.origin === 'dave_edited_by_researcher' ? 'Edited by you' : 'Created by you'}</span>
              <button className="research-text-button" type="button" disabled={busy} onClick={() => change(() => store.categories.update(selectedCategory.id,
                { review: { state: selectedCategory.review?.state === 'rejected' ? 'proposed' : 'rejected' } }))}>
                {selectedCategory.review?.state === 'rejected' ? 'Restore category' : 'Reject category'}</button>
            </div>
            {selectedCategory.review?.state === 'rejected' && <p className="research-empty">This category is rejected. You can restore it at any time.</p>}
            {!selectedCategory.passages && sources.filter(source => source.primaryCategoryId === selectedCategory.id).map(source => <p key={source.id}>
              <button className="research-text-button" onClick={() => { void original(source); }}>{source.title} · Download original</button>
            </p>)}
          </> : selected ? <>
            <h4>{selected.title}</h4>
            {selected.processingError && <p role="alert" className="project-error">{selected.processingError}</p>}
            <button className="research-text-button" disabled={busy || analysing} onClick={() => { void original(selected); }}>Download original</button>
            {selected.processingState !== 'ready' && <button className="research-text-button" disabled={busy || analysing} onClick={() => { void original(selected, true); }}>Retry text extraction</button>}
            {selected.preparedContent?.limitations.length ? <details><summary>Extraction limitations</summary><ul>{selected.preparedContent.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></details> : null}
            {selected.summary && <p>{selected.summary}</p>}
          </> : <div className="research-inspector-empty"><h4>Your research, connected</h4><p>Select a category to see its summary and the passages behind it.</p></div>}
          {excerpts.size > 0 && <div className="research-supporting-excerpts">
            <h5>Supporting research</h5>
            <p className="research-excerpt-note">{selectedCategory ? `Research excerpts linked to ${selectedCategory.name}.` : 'Original wording from your sources.'} Previews show only part of longer excerpts.</p>
            {[...excerpts.entries()].filter(([, excerpt]) => !selectedCategory || excerpt.categoryIds.includes(selectedCategory.id)).map(([key, { passage, categoryIds, categoryNames }]) => {
              const source = project.sources.find(source => source.id === passage.source.id);
              const content = source?.revision === passage.source.revision ? source
                : source?.history.find(entry => entry.revision === passage.source.revision)?.content;
              const section = content?.preparedContent?.sections[passage.sectionIndex];
              return source && section ? <ExcerptCard key={key}
                text={section.text.slice(passage.start, passage.end)} filename={source.originalFile.filename}
                location={section.location} categoryName={categoryNames.join(' ')} categoryNames={categoryNames}
                linked={selectedCategory ? categoryIds.includes(selectedCategory.id) : undefined} disabled={busy || analysing}
                onViewSource={() => { void original(source); }} />
                : <p key={key} role="alert">The referenced source excerpt is unavailable.</p>;
            })}
          </div>}
        </section>
      </div>
      </div>
      <section className="research-add-category" aria-label="Add your own category">
        <h4>Add your own category</h4>
          <p className="research-manual-note">You can also add your own category if needed.</p>
          <form className="research-inline-form research-create-category" onSubmit={createCategory}>
            <label className="research-field">New category<input value={newName} onChange={event => setNewName(event.target.value)} required /></label>
            <button className="project-button" disabled={!newName.trim() || busy}>Create category</button>
          </form>
      </section>
    </section>
  );
}
