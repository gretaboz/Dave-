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
export const ProjectWorkspace = memo(function ProjectWorkspace() {
  const { project, status, error, errorOperation } = useProject();
  const session = useProjectSession();
  const [name, setName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [context, setContext] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    try { session.createProject({ name, context }); }
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
      ) : status === 'empty' ? (
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
