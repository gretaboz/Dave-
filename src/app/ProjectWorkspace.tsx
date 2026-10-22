import { memo, useState } from 'react';
import type { FormEvent } from 'react';
import { useProject, useProjectSession } from '../state/ProjectProvider';

const statusText = {
  loading: 'Loading project…',
  empty: 'No project yet.',
  saving: 'Saving…',
  saved: 'Saved locally.',
} as const;

/** Shared project context, independent of which workflow stage is open. */
export const ProjectWorkspace = memo(function ProjectWorkspace({ onProjectOpened, libraryOpen, onLibraryChange }: { onProjectOpened: () => void; libraryOpen: boolean; onLibraryChange: (open: boolean) => void }) {
  const { project, projects = [], status, error, errorOperation } = useProject();
  const session = useProjectSession();
  const [creating, setCreating] = useState(false);
  const busy = status === 'loading' || status === 'saving' || status === 'error';
  const [name, setName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [context, setContext] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    try { session.createProject({ name, context: project ? '' : context }); setCreating(false); setName(''); setContext(''); onProjectOpened(); }
    catch (error) { setFormError(error instanceof Error ? error.message : 'Could not create the project.'); }
  }

  return (
    <section className="project-workspace" aria-label="Current project">
      <p className="project-status" role="status">
      {status === 'error' ? (errorOperation === 'load' ? 'Could not load your project.' : 'Changes have not been saved.') : statusText[status]}
      </p>
      {error && (
        <div className="project-error">
          <p role="alert">{error}</p>
          <button className="project-button" type="button" onClick={() => { void session.retry(); }}>
            {errorOperation === 'load' ? 'Retry loading' : 'Retry saving'}
          </button>
        </div>
      )}
      {project && (
        <div className="project-summary">
          {editingName ? <form className="research-inline-form" onSubmit={event => {
            event.preventDefault();
            if (!name.trim()) return;
            try { session.store.updateProject({ name: name.trim() }); setEditingName(false); setFormError(null); }
            catch (error) { setFormError(error instanceof Error ? error.message : 'Could not save the project name.'); }
          }}>
            <label className="research-field">Project name<input value={name} onChange={event => setName(event.target.value)} required autoFocus /></label>
            <button className="project-button" disabled={!name.trim()}>Save title</button>
            <button className="research-text-button" type="button" onClick={() => { setEditingName(false); setFormError(null); }}>Cancel</button>
            {formError && <p role="alert">{formError}</p>}
          </form> : <div className="project-title-row"><h3>{project.name}</h3>
            <button className="research-text-button" type="button" aria-label="Edit project title" disabled={busy} onClick={() => { setName(project.name); setEditingName(true); }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z" /></svg></button>
          </div>}

        </div>
      )}
      <div className="project-controls">
        {project && <button className="project-button" type="button" disabled={busy} onClick={() => {
          setCreating(false); setEditingName(false); setFormError(null); onLibraryChange(!libraryOpen);
        }}>{libraryOpen ? 'Back to workspace' : 'Project library'}</button>}
        <button className="project-button" type="button" disabled={busy} onClick={() => {
          setName(''); setContext(''); setEditingName(false); setFormError(null); setCreating(true); onLibraryChange(false);
        }}>New Project</button>
      </div>
      {formError && !creating && !editingName && project && <p role="alert">{formError}</p>}
      {creating && <form className="project-form" onSubmit={createProject}>
        <label htmlFor="new-project-name">Project name</label>
        <input id="new-project-name" value={name} onChange={event => setName(event.target.value)} required autoFocus />
        {formError && <p role="alert">{formError}</p>}
        <div><button className="project-button" disabled={busy || !name.trim()}>Create project</button>
          <button className="research-text-button" type="button" onClick={() => setCreating(false)}>Cancel</button></div>
      </form>}
        {libraryOpen && <section className="project-library" aria-label="Project library">
        <h3>Project library</h3>
        <ul>{(!projects.some(item => item.id === project?.id) && project ? [...projects, project] : projects).map(item =>
          <li key={item.id}><button className="research-text-button" type="button" disabled={busy}
            aria-current={item.id === project?.id ? 'true' : undefined} onClick={() => {
              setFormError(null);
              void session.switchProject(item.id).then(() => {
                setCreating(false); setEditingName(false); onProjectOpened();
              }).catch(error => setFormError(error instanceof Error ? error.message : 'Could not open the project.'));
            }}>{item.name}</button>
            <button className="research-text-button project-delete" type="button" aria-label={`Delete project ${item.name}`} disabled={busy}
              onClick={() => {
                if (!window.confirm(`Delete “${item.name}”? This permanently removes this project and its saved research and exploration. This cannot be undone.`)) return;
                setFormError(null);
                void session.deleteProject(item.id).catch(error => setFormError(error instanceof Error ? error.message : 'Could not delete the project.'));
              }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg></button>
            </li>)}</ul>
      </section>}
      {status === 'empty' && !creating ? (
        <form className="project-form" onSubmit={createProject}>
          <p>Create a project to begin.</p>
          <label htmlFor="project-name">Project name</label>
          <input id="project-name" name="project-name" value={name} onChange={event => setName(event.target.value)} required />
          <label htmlFor="project-context">Brief / context</label>
          <textarea id="project-context" name="project-context" rows={4} value={context} onChange={event => setContext(event.target.value)} />
          {formError && <p role="alert">{formError}</p>}
          <button className="project-button" type="submit" disabled={!name.trim()}>Create project</button>
        </form>
      ) : null}
    </section>
  );
});
