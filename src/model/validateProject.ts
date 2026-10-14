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
  for (const key of collections) {
    if (!Array.isArray(value[key]) || !value[key].every(entity))
      throw new Error(`The saved project has an invalid ${key} collection.`);
  }
}
