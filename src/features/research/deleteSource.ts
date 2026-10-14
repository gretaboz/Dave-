import type { Project, EntityId } from '../../model/types';

/** Forget file content, including category history that referred to it. */
export function withoutResearchSource(project: Project, sourceId: EntityId<'source'>): Project {
  const source = project.sources.find(item => item.id === sourceId);
  if (!source) throw new Error('This file is no longer in the project.');
  // Later-stage evidence must be explicitly reviewed before removing its original.
  if (project.evidence.some(item => item.source.id === sourceId || item.history.some(entry => entry.content.source.id === sourceId)))
    throw new Error('This file supports later-stage evidence. Remove that evidence before deleting its original file.');
  const next = structuredClone(project);
  next.sources = next.sources.filter(item => item.id !== sourceId);
  next.categories = next.categories.flatMap(category => {
    const affected = source.primaryCategoryId === category.id || category.passages?.some(p => p.source.id === sourceId)
      || category.history.some(entry => entry.content.passages?.some(p => p.source.id === sourceId));
    if (!affected) return [category];
    category.passages = category.passages?.filter(p => p.source.id !== sourceId);
    // A former summary may describe deleted material; never keep it as current evidence.
    category.description = undefined;
    category.history = category.history.map(entry => ({ ...entry, content: {
      ...entry.content, description: undefined, analysis: undefined,
      passages: entry.content.passages?.filter(p => p.source.id !== sourceId),
    } }));
    category.analysis = undefined;
    category.updatedAt = new Date().toISOString();
    category.revision++;
    return !category.passages || category.passages.length ? [category] : [];
  });
  return next;
}
