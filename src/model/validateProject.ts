import type { Project } from './types';

const collections = [
  'sources', 'categories', 'evidence', 'claims', 'relationships', 'dimensions',
  'dimensionPositions', 'explorationNodes', 'explorationConnections', 'directions',
] as const;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function entity(value: unknown): boolean {
  return record(value) && typeof value.id === 'string' && value.id.length > 0
    && typeof value.createdAt === 'string' && typeof value.updatedAt === 'string'
    && ['dave', 'researcher', 'dave_edited_by_researcher'].includes(value.origin as string)
    && Number.isInteger(value.revision) && (value.revision as number) >= 1
    && Array.isArray(value.history) && value.history.every(entry => record(entry)
      && Number.isInteger(entry.revision) && (entry.revision as number) >= 1
      && (entry.revision as number) < (value.revision as number) && record(entry.content)
      && typeof entry.savedAt === 'string'
      && ['dave', 'researcher'].includes(entry.changedBy as string)
      && ['dave', 'researcher', 'dave_edited_by_researcher'].includes(entry.origin as string));
}

/** Basic check for our own local snapshots, not an external import/migration system. */
export function assertProjectSnapshot(value: unknown): asserts value is Project {
  if (!record(value) || value.modelVersion !== 1)
    throw new Error('The saved project has an unsupported model version.');
  if (!entity(value) || typeof value.name !== 'string' || typeof value.context !== 'string')
    throw new Error('The saved project is invalid.');
  if (value.exploration !== undefined) {
    const exploration = value.exploration;
    if (!record(exploration) || !Array.isArray(exploration.sessions) || !exploration.sessions.every(s => entity(s) && record(s) && Array.isArray(s.tuningSnapshot) && (s.name===undefined||typeof s.name==='string') && (s.expanded===undefined||typeof s.expanded==='boolean') && (s.position===undefined||(record(s.position)&&[s.position.x,s.position.y].every(n=>typeof n==='number'&&Number.isFinite(n)))))
      || !exploration.sessions.some(s => record(s) && s.id === exploration.activeSessionId))
      throw new Error('The saved exploration context is invalid.');
  }
  if (value.mapViews !== undefined && (!record(value.mapViews) || !Object.values(value.mapViews).every(v => record(v) && [v.x, v.y, v.scale].every(n => typeof n === 'number' && Number.isFinite(n)) && (v.scale as number) >= .2 && (v.scale as number) <= 2)))
    throw new Error('The saved map view is invalid.');
  for (const key of collections) {
    if (!Array.isArray(value[key]) || !value[key].every(entity))
      throw new Error(`The saved project has an invalid ${key} collection.`);
  }
}
