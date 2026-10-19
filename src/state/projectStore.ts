import type * as M from '../model/types';
import { assertProjectSnapshot } from '../model/validateProject';

interface ContentMap {
  sources: M.SourceContent;
  categories: M.ResearchCategoryContent;
  evidence: M.EvidenceContent;
  claims: M.ClaimContent;
  relationships: M.RelationshipContent;
  dimensions: M.DimensionContent;
  dimensionPositions: M.DimensionPositionContent;
  explorationNodes: M.ExplorationNodeContent;
  explorationConnections: M.ExplorationConnectionContent;
  directions: M.DirectionContent;
}
type Collection = keyof ContentMap;
type Item<K extends Collection> = M.Project[K][number];
type Extras<K extends Collection> = K extends 'sources'
  ? Pick<M.Source, 'processingState' | 'processingError'>
  : K extends 'claims' | 'relationships' ? { mapPosition?: { x: number; y: number } }
  : K extends 'categories' ? Pick<M.ResearchCategory, 'order'>
  : K extends 'explorationNodes' ? Pick<M.ExplorationNode, 'position'>
  : Record<never, never>;
type Input<K extends Collection> = ContentMap[K] & Extras<K>;

export interface EditOptions {
  actor?: M.Actor;
  note?: string;
}

const kinds = {
  sources: 'source', categories: 'research_category', evidence: 'evidence',
  claims: 'claim', relationships: 'relationship', dimensions: 'dimension',
  dimensionPositions: 'dimension_position', explorationNodes: 'exploration_node',
  explorationConnections: 'exploration_connection', directions: 'direction',
} as const;

/** Only these fields enter meaningful history; operational/layout fields do not. */
const contentKeys = {
  sources: ['title', 'originalFile', 'sourceType', 'primaryCategoryId', 'summary', 'limitations', 'preparedContent'],
  categories: ['name', 'description', 'passages', 'review', 'analysis'],
  evidence: ['categories', 'passage', 'source', 'text', 'form', 'location', 'context', 'limitations'],
  claims: ['statement', 'evidence', 'context', 'stakeholder', 'limitations', 'review'],
  relationships: ['evidence', 'description', 'type', 'claims', 'explanation', 'contextCheck', 'challenge', 'limitations', 'review'],
  dimensions: ['evidence', 'researchPassages', 'generation', 'name', 'lowLabel', 'midLabel', 'highLabel', 'lowExplanation', 'midExplanation', 'highExplanation', 'rationale', 'grounding', 'draftPosition', 'explanation', 'claims', 'relationships', 'limitations', 'review'],
  dimensionPositions: ['dimension', 'selected', 'value', 'reasoning', 'confirmedAt'],
  explorationNodes: ['title', 'content', 'references', 'dimensionPositions', 'limitations'],
  explorationConnections: ['fromNodeId', 'toNodeId', 'label', 'directional'],
  directions: ['title', 'description', 'reasoning', 'openQuestions', 'state', 'explorationNodes', 'references', 'tuningSnapshot', 'limitations'],
} as const satisfies { [K in Collection]: readonly (keyof ContentMap[K])[] };

function pick<T>(value: object, keys: readonly string[]): T {
  return Object.fromEntries(keys.map(key => [key, (value as Record<string, unknown>)[key]])) as T;
}

function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = Object.keys(a).filter(key => (a as Record<string, unknown>)[key] !== undefined);
  const right = Object.keys(b).filter(key => (b as Record<string, unknown>)[key] !== undefined);
  return left.length === right.length && left.every(key =>
    right.includes(key) && equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

/** In-memory only. Callers receive detached copies, never the live project. */
export function createProjectStore() {
  let project: M.Project | null = null;
  const listeners = new Set<() => void>();
  const now = () => new Date().toISOString();
  const id = <K extends string>() => crypto.randomUUID() as M.EntityId<K>;
  function current(): M.Project {
    if (!project) throw new Error('Create a project before editing its content.');
    return project;
  }
  function publish(next: M.Project) {
    project = structuredClone(next);
    for (const listener of listeners) listener();
  }
  function find<K extends Collection>(collection: K, entityId: Item<K>['id']): Item<K> {
    const item = current()[collection].find(item => item.id === entityId);
    if (!item) throw new Error(`Unknown ${kinds[collection]} reference.`);
    return item as Item<K>;
  }
  function resolve<K extends Collection>(collection: K, ref: { id: Item<K>['id']; revision: number }): ContentMap[K] {
    const item = find(collection, ref.id);
    if (item.revision === ref.revision) return pick(item, contentKeys[collection]);
    const previous = item.history.find(entry => entry.revision === ref.revision);
    if (!previous) throw new Error(`Unknown ${kinds[collection]} revision.`);
    return previous.content as ContentMap[K];
  }
  function references(refs: M.ResearchReferences) {
    for (const ref of refs.evidence) resolve('evidence', ref);
    for (const ref of refs.claims) resolve('claims', ref);
    for (const ref of refs.relationships) resolve('relationships', ref);
    for (const ref of refs.dimensions) resolve('dimensions', ref);
  }
  function validate<K extends Collection>(collection: K, value: Input<K>) {
    if ('mapPosition' in value && value.mapPosition && (!Number.isFinite(value.mapPosition.x) || !Number.isFinite(value.mapPosition.y))) throw new Error('Map coordinates must be finite.');
    // Runtime checks protect provenance even when inputs arrive from untyped callers.
    switch (collection) {
      case 'sources': {
        const source = value as M.Source;
        if (source.primaryCategoryId) find('categories', source.primaryCategoryId);
        break;
      }
      case 'categories': {
        const category = value as M.ResearchCategoryContent;
        for (const passage of category.passages ?? []) {
          const source = resolve('sources', passage.source);
          const section = source.preparedContent?.sections[passage.sectionIndex];
          if (!Number.isInteger(passage.sectionIndex) || passage.sectionIndex < 0 || !section
            || !Number.isInteger(passage.start) || !Number.isInteger(passage.end)
            || passage.start < 0 || passage.end <= passage.start || passage.end > section.text.length)
            throw new Error('A category passage must refer to readable source text.');
        }
        break;
      }
      case 'evidence': {
        const evidence = value as M.EvidenceContent;
        const source = resolve('sources', evidence.source);
        evidence.categories?.forEach(ref => resolve('categories', ref));
        if (evidence.passage) {
          const p = evidence.passage;
          const section = source.preparedContent?.sections[p.sectionIndex];
          if (p.source.id !== evidence.source.id || p.source.revision !== evidence.source.revision || !section || !Number.isInteger(p.start) || !Number.isInteger(p.end) || p.start < 0 || p.end <= p.start || p.end > section.text.length || section.text.slice(p.start,p.end) !== evidence.text) throw new Error('Evidence must match its verified source passage.');
        }
        break;
      }
      case 'claims': {
        const claim = value as M.Claim;
        if (!claim.evidence.length) throw new Error('A claim needs supporting evidence.');
        claim.evidence.forEach(ref => resolve('evidence', ref));
        break;
      }
      case 'relationships': {
        const relationship = value as M.Relationship;
        if (new Set(relationship.claims.map(entry => entry.claim.id)).size < 2)
          throw new Error('A relationship needs two distinct claims.');
        relationship.claims.forEach(entry => resolve('claims', entry.claim));
        relationship.evidence?.forEach(ref => resolve('evidence', ref));
        if (['connection','potential_tension'].includes(relationship.type) && (relationship.claims.length !== 2 || new Set(relationship.claims.map(entry => entry.claim.id)).size !== 2)) throw new Error('A classified relationship must connect exactly two claims.');
        break;
      }
      case 'dimensions': {
        const dimension = value as M.Dimension;
        dimension.evidence?.forEach(ref=>resolve('evidence',ref));
        dimension.researchPassages?.forEach(({category,passage})=>{
          const content=resolve('categories',category);
          if(!content.passages?.some(p=>equal(p,passage)))throw new Error('A dimension passage must match its original category revision.');
          resolve('sources',passage.source);
        });
        dimension.claims.forEach(ref => resolve('claims', ref));
        dimension.relationships.forEach(ref => resolve('relationships', ref));
        break;
      }
      case 'dimensionPositions': {
        const position = value as M.DimensionPosition;
        resolve('dimensions', position.dimension);
        if (position.value !== null && (!Number.isFinite(position.value) || position.value < 0 || position.value > 1))
          throw new Error('A dimension position must be between 0 and 1, or undecided.');
        break;
      }
      case 'explorationNodes': {
        const node = value as M.ExplorationNode;
        references(node.references);
        node.dimensionPositions.forEach(ref => resolve('dimensionPositions', ref));
        if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y))
          throw new Error('Board coordinates must be finite numbers.');
        break;
      }
      case 'explorationConnections': {
        const connection = value as M.ExplorationConnection;
        find('explorationNodes', connection.fromNodeId);
        find('explorationNodes', connection.toNodeId);
        break;
      }
      case 'directions': {
        const direction = value as M.Direction;
        references(direction.references);
        direction.explorationNodes.forEach(ref => resolve('explorationNodes', ref));
        break;
      }
    }
  }
  function revise<C extends object, K extends string>(entity: M.Entity<K, C> & C, before: C, content: C, options: EditOptions, reviewOnly = false) {
    const time = now();
    const actor = options.actor ?? 'researcher';
    const origin = !reviewOnly && actor === 'researcher' && entity.origin !== 'researcher'
      ? 'dave_edited_by_researcher' : entity.origin;
    return {
      ...entity, ...content, origin, updatedAt: time, revision: entity.revision + 1,
      history: [...entity.history, {
        revision: entity.revision, content: structuredClone(before),
        origin: entity.origin, savedAt: time, changedBy: actor, note: options.note,
      }],
    };
  }
  function allowedKeys(collection: Collection): readonly string[] {
    return [...contentKeys[collection], ...(['claims', 'relationships'].includes(collection) ? ['mapPosition'] : []), ...(collection === 'sources' ? ['processingState', 'processingError']
      : collection === 'categories' ? ['order'] : collection === 'explorationNodes' ? ['position'] : [])];
  }
  function add<K extends Collection>(collection: K, input: Input<K>, actor: M.Actor = 'researcher'): Item<K> {
    const state = current();
    validate(collection, input);
    const time = now();
    const entity = {
      ...structuredClone(pick<object>(input, allowedKeys(collection))), id: id(), origin: actor, createdAt: time,
      updatedAt: time, revision: 1, history: [],
      ...(collection === 'directions' ? { designatedBy: 'researcher' } : {}),
    } as unknown as Item<K>;
    publish({ ...state, [collection]: [...state[collection], entity] });
    return structuredClone(entity);
  }
  function update<K extends Collection>(collection: K, entityId: Item<K>['id'], patch: Partial<Input<K>>, options: EditOptions = {}): Item<K> {
    const state = current();
    const old = find(collection, entityId);
    const allowed = allowedKeys(collection);
    const supplied = Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.includes(key)));
    const next = { ...old, ...structuredClone(supplied) } as Item<K>;
    validate(collection, next as unknown as Input<K>);
    if (equal(old, next)) return structuredClone(old);
    const before = pick<ContentMap[K]>(old, contentKeys[collection]);
    const after = pick<ContentMap[K]>(next, contentKeys[collection]);
    const withoutReview = contentKeys[collection].filter(key => key !== 'review');
    const reviewOnly = equal(pick(old, withoutReview), pick(next, withoutReview));
    const result = equal(before, after) ? { ...next, updatedAt: now() }
      : revise(next as unknown as M.Entity<string, ContentMap[K]> & ContentMap[K], before, after, options, reviewOnly);
    publish({ ...state, [collection]: state[collection].map(item => item.id === entityId ? result : item) });
    return structuredClone(result) as Item<K>;
  }
  function operations<K extends Collection>(collection: K) {
    return {
      add: (input: Input<K>, actor?: M.Actor) => add(collection, input, actor),
      update: (entityId: Item<K>['id'], patch: Partial<Input<K>>, options?: EditOptions) => update(collection, entityId, patch, options),
    };
  }

  return {
    getProject: (): M.Project | null => structuredClone(project),
    /** Restore a complete snapshot without edits, new IDs, or new history. */
    restoreProject(snapshot: M.Project): void {
      assertProjectSnapshot(snapshot);
      publish(snapshot);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    createProject(content: M.ProjectContent): M.Project {
      if (project) throw new Error('A current project already exists.');
      const time = now();
      publish({ name: content.name, context: content.context, id: id<'project'>(), origin: 'researcher',
        createdAt: time, updatedAt: time, revision: 1, history: [], modelVersion: 1,
        sources: [], categories: [], evidence: [], claims: [], relationships: [],
        dimensions: [], dimensionPositions: [], explorationNodes: [], explorationConnections: [], directions: [],
      });
      return structuredClone(current());
    },
    updateProject(patch: Partial<M.ProjectContent>, options: EditOptions = {}): M.Project {
      const old = current();
      const content = { name: patch.name ?? old.name, context: patch.context ?? old.context };
      const before = { name: old.name, context: old.context };
      if (!equal(content, before)) publish({ ...old, ...revise(old, before, content, options) });
      return structuredClone(current());
    },
    sources: operations('sources'),
    categories: {
      ...operations('categories'),
      remove(categoryId: M.EntityId<'research_category'>) {
        const state = current();
        find('categories', categoryId);
        const time = now();
        publish({ ...state,
          categories: state.categories.map(category => category.id === categoryId
            ? { ...category, archivedAt: time, updatedAt: time } : category),
          sources: state.sources.map(source => {
            if (source.primaryCategoryId !== categoryId) return source;
            const before = pick<M.SourceContent>(source, contentKeys.sources);
            return { ...source, ...revise(source, before, { ...before, primaryCategoryId: undefined }, { note: 'Category deleted.' }) };
          }),
        });
      },
    },
    addResearchAnalysis(inputs: M.ResearchCategoryContent[]): M.ResearchCategory[] {
      // Validate the entire response before publishing any of it.
      inputs.forEach(input => validate('categories', { ...input, order: 0 }));
      const state = current();
      const time = now();
      const order = Math.max(-1, ...state.categories.map(category => category.order)) + 1;
      const categories: M.ResearchCategory[] = inputs.map((input, index) => ({
        ...structuredClone(input), id: id<'research_category'>(), origin: 'dave',
        createdAt: time, updatedAt: time, revision: 1, history: [], order: order + index,
      }));
      publish({ ...state, categories: [...state.categories, ...categories] });
      return structuredClone(categories);
    },
    evidence: operations('evidence'),
    claims: operations('claims'),
    setClaimMapPositions(positions: {id: M.Claim['id']; position: {x:number;y:number}}[]) {
      const state=current();
      for(const entry of positions){find('claims',entry.id);if(!Number.isFinite(entry.position.x)||!Number.isFinite(entry.position.y))throw new Error('Map coordinates must be finite.');}
      const byId=new Map(positions.map(p=>[p.id,p.position]));
      publish({...state,claims:state.claims.map(c=>byId.has(c.id)?{...c,mapPosition:structuredClone(byId.get(c.id)!),updatedAt:now()}:c)});
    },
    relationships: operations('relationships'),
    dimensions: {
      ...operations('dimensions'),
      remove(dimensionId: M.Dimension['id']) {
        const state = current();
        find('dimensions', dimensionId);
        const time = now();
        publish({ ...state, dimensions: state.dimensions.map(d => d.id === dimensionId
          ? { ...d, archivedAt: time, updatedAt: time } : d) });
      },
    },
    explorationNodes: operations('explorationNodes'),
    explorationConnections: operations('explorationConnections'),
    setDimensionPosition(input: M.DimensionPositionContent, options: EditOptions = {}): M.DimensionPosition {
      const existing = current().dimensionPositions.find(item => item.dimension.id === input.dimension.id);
      return existing ? update('dimensionPositions', existing.id, input, options)
        : add('dimensionPositions', input, options.actor);
    },
    createDirection(input: Omit<M.DirectionContent, 'tuningSnapshot'>, positionIds?: M.EntityId<'dimension_position'>[]): M.Direction {
      const positions = positionIds ? positionIds.map(positionId => find('dimensionPositions', positionId))
        : current().dimensionPositions.filter(position => position.selected);
      const tuningSnapshot = positions.map(position => {
        const dimension = resolve('dimensions', position.dimension);
        return { dimension: position.dimension, position: { id: position.id, revision: position.revision },
          dimensionName: dimension.name, lowLabel: dimension.lowLabel, highLabel: dimension.highLabel,
          selected: position.selected, value: position.value, reasoning: position.reasoning };
      });
      return add('directions', { ...input, tuningSnapshot });
    },
    updateDirection(entityId: M.EntityId<'direction'>, patch: Partial<Omit<M.DirectionContent, 'tuningSnapshot'>>, options?: EditOptions): M.Direction {
      // Creation-time tuning is retained even if current positions change later.
      const { tuningSnapshot: _ignored, ...safePatch } = patch as Partial<M.DirectionContent>;
      return update('directions', entityId, safePatch, options);
    },
  };
}

/** Shared instance for later interfaces; no project or sample data is created. */
export const projectStore = createProjectStore();
