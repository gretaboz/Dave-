import { memo, useState } from 'react';
import type { EntityId } from '../model/types';
import type { FormEvent } from 'react';
import { useProject, useProjectSession } from '../state/ProjectProvider';

const statusText = {
  loading: 'Loading project…',
  empty: 'No project yet.',
  saving: 'Saving…',
  saved: 'Saved locally.',
} as const;

/** Shared project context, independent of which workflow stage is open. */
export const ProjectWorkspace = memo(function ProjectWorkspace({ onProjectOpened }: { onProjectOpened: () => void }) {
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
      <div className="project-controls">
        {project && <select aria-label="Project" value={project.id} disabled={busy} onChange={event => {
          setFormError(null);
          void session.switchProject(event.target.value as EntityId<'project'>).then(() => {
            setCreating(false); setEditingName(false); onProjectOpened();
          }).catch(error => setFormError(error instanceof Error ? error.message : 'Could not open the project.'));
        }}>
          {(!projects.some(item => item.id === project.id) ? [...projects, project] : projects).map(item =>
            <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>}
        <button className="project-button" type="button" disabled={busy} onClick={() => {
          setName(''); setContext(''); setEditingName(false); setFormError(null); setCreating(true);
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
      {project ? (
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
            <button className="research-text-button" type="button" aria-label="Edit project title" onClick={() => { setName(project.name); setEditingName(true); }}>Edit</button>
          </div>}

        </div>
      ) : status === 'empty' && !creating ? (
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
