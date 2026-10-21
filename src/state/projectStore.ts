import {nextBranchPoint,identicalTuning,branchName} from '../features/exploration/layout';
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
  : K extends 'explorationNodes' ? Pick<M.ExplorationNode, 'position' | 'coordinateSpace' | 'branchAligned'>
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
  dimensions: ['evidence', 'researchPassages', 'generation', 'name', 'lowLabel', 'midLabel', 'highLabel', 'lowExplanation', 'midExplanation', 'highExplanation', 'rationale', 'grounding', 'draftPosition', 'explanation', 'claims', 'relationships', 'limitations', 'review', 'directionReview'],
  dimensionPositions: ['dimension', 'selected', 'value', 'reasoning', 'confirmedAt'],
  explorationNodes: ['branchParent', 'questionState', 'question', 'explorationSession', 'title', 'content', 'references', 'dimensionPositions', 'limitations'],
  explorationConnections: ['fromNodeId', 'toNodeId', 'label', 'directional'],
  directions: ['title', 'description', 'reasoning', 'openQuestions', 'state', 'explorationNodes', 'references', 'tuningSnapshot', 'limitations', 'parameterSnapshot', 'confirmedAt', 'parentDirection'],
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
        if (dimension.directionReview) {
          const review = dimension.directionReview;
          if (!['proposed','included','excluded','deferred'].includes(review.state)) throw new Error('Invalid parameter review state.');
          if (review.variability && !['fixed','adjustable'].includes(review.variability)) throw new Error('Invalid parameter variability.');
          if (!['undecided','designer_set'].includes(review.orientation.status)) throw new Error('Invalid parameter orientation.');
          if (review.orientation.status === 'designer_set' && !review.orientation.text?.trim()) throw new Error('Describe the chosen orientation or leave it undecided.');
          review.relevanceEvidence.forEach(ref => resolve('evidence', ref));
          review.orientationEvidence.forEach(ref => resolve('evidence', ref));
        }
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
        if (node.branchParent) resolve('explorationNodes',node.branchParent);
        if (node.question) {
          if (node.content.type !== 'question') throw new Error('Question metadata needs a question card.');
          node.question.categories.forEach(ref=>resolve('categories',ref));
          node.question.researchPassages?.forEach(({category,passage})=>{
            const content=resolve('categories',category);
            if(!content.passages?.some(p=>equal(p,passage)))throw new Error('Question research must match its saved source passage.');
            resolve('sources',passage.source);
          });
          node.question.branch.forEach(ref=>resolve('explorationNodes',ref));
          node.question.consideredPositions.forEach(ref=>resolve('dimensionPositions',ref));
          references(node.question.considered);
        }
        if (node.explorationSession && !current().exploration?.sessions.some(s => s.id === node.explorationSession!.id && s.revision === node.explorationSession!.revision))
          throw new Error('Unknown exploration session.');
        node.dimensionPositions.forEach(ref => resolve('dimensionPositions', ref));
        if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y))
          throw new Error('Board coordinates must be finite numbers.');
        break;
      }
      case 'explorationConnections': {
        const connection = value as M.ExplorationConnection;
        if (connection.fromNodeId === connection.toNodeId) throw new Error('Connect two different ideas.');
        const from=find('explorationNodes',connection.fromNodeId),to=find('explorationNodes',connection.toNodeId);
        if(from.explorationSession&&to.explorationSession&&from.explorationSession.id!==to.explorationSession.id)throw new Error('Connect ideas within the same tuning branch.');
        if (from.archivedAt || to.archivedAt) throw new Error('Cannot connect a deleted idea.');
        break;
      }
      case 'directions': {
        const direction = value as M.Direction;
        references(direction.references);
        direction.explorationNodes.forEach(ref => resolve('explorationNodes', ref));
        if (direction.parentDirection) resolve('directions', direction.parentDirection);
        direction.parameterSnapshot?.forEach(parameter => {
          resolve('dimensions', parameter.dimension);
          parameter.relevanceEvidence.forEach(ref => resolve('evidence', ref));
          parameter.orientationEvidence.forEach(ref => resolve('evidence', ref));
          parameter.researchPassages.forEach(({category, passage}) => {
            const categoryContent = resolve('categories', category);
            if (!categoryContent.passages?.some(candidate => equal(candidate, passage))) throw new Error('Direction research must match its saved category revision.');
            resolve('sources', passage.source);
          });
        });
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
      : collection === 'categories' ? ['order'] : collection === 'explorationNodes' ? ['position', 'coordinateSpace', 'branchAligned'] : [])];
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
    const withoutReview = contentKeys[collection].filter(key => key !== 'review' && (collection !== 'explorationNodes' || key !== 'questionState'));
    const reviewOnly = equal(pick(old, withoutReview), pick(next, withoutReview));
    const result = equal(before, after) ? { ...next, updatedAt: now() }
      : revise(next as unknown as M.Entity<string, ContentMap[K]> & ContentMap[K], before, after, options, reviewOnly);
    publish({ ...state, [collection]: state[collection].map(item => item.id === entityId ? result : item) });
    return structuredClone(result) as Item<K>;
  }
  // Retain archived interpretations for saved downstream provenance.
  function removeInterpretation(collection: 'claims' | 'relationships', entityId: M.Claim['id'] | M.Relationship['id']) {
    const state = current(); find(collection, entityId); const time = now();
    publish({ ...state, [collection]: state[collection].map(item => item.id === entityId ? { ...item, archivedAt: time, updatedAt: time } : item) });
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
    claims: { ...operations('claims'), remove: (entityId: M.Claim['id']) => removeInterpretation('claims', entityId) },
    setClaimMapPositions(positions: {id: M.Claim['id']; position: {x:number;y:number}}[]) {
      const state=current();
      for(const entry of positions){find('claims',entry.id);if(!Number.isFinite(entry.position.x)||!Number.isFinite(entry.position.y))throw new Error('Map coordinates must be finite.');}
      const byId=new Map(positions.map(p=>[p.id,p.position]));
      publish({...state,claims:state.claims.map(c=>byId.has(c.id)?{...c,mapPosition:structuredClone(byId.get(c.id)!),updatedAt:now()}:c)});
    },
    relationships: { ...operations('relationships'), remove: (entityId: M.Relationship['id']) => removeInterpretation('relationships', entityId) },
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
    confirmExploration(): M.ExplorationSession {
      const state = current();
      const positions = state.dimensionPositions.filter(p => p.selected && !p.archivedAt && state.dimensions.some(d => d.id === p.dimension.id && !d.archivedAt && d.review.state !== 'rejected'));
      if (!positions.length) throw new Error('Select at least one dimension for exploration and choose its position before continuing.');
      const tuningSnapshot: M.ExplorationSetting[] = positions.map(p => {
        const d = find('dimensions', p.dimension.id);
        if (d.archivedAt || d.review.state === 'rejected')
          throw new Error(`Restore or deselect “${d.name}” before continuing.`);
        if (d.revision !== p.dimension.revision)
          throw new Error(`“${d.name}” has changed. Choose its position again before confirming.`);
        if (p.value === null) throw new Error(`Choose a position for “${d.name}” before continuing.`);
        const positionLabel = p.value === 0 ? d.lowLabel : p.value === .5 ? d.midLabel : p.value === 1 ? d.highLabel : `${Math.round(p.value * 100)}% between ${d.lowLabel} and ${d.highLabel}`;
        if (!positionLabel?.trim()) throw new Error(`Add a meaningful label for the chosen position of “${d.name}” before continuing.`);
        return { dimension: { ...p.dimension }, position: { id: p.id, revision: p.revision },
          dimensionName: d.name, lowLabel: d.lowLabel, midLabel: d.midLabel, highLabel: d.highLabel,
          value: p.value, selected: true, reasoning: p.reasoning, positionLabel,
          positionExplanation: p.value === 0 ? d.lowExplanation : p.value === .5 ? d.midExplanation : p.value === 1 ? d.highExplanation : undefined };
      });
      const matching=state.exploration?.sessions.find(s=>identicalTuning(s.tuningSnapshot,tuningSnapshot));
      if(matching)throw new Error(`This tuning already exists in ${branchName(state,matching)}. Change the tuning to create a new branch.`);
      const time = now();
      const session: M.ExplorationSession = { id: id<'exploration_session'>(), revision: 1, origin: 'researcher', createdAt: time, updatedAt: time, history: [], tuningSnapshot, name:`Branch ${(state.exploration?.sessions.length??0)+1}`,position:nextBranchPoint(state),expanded:false };
      publish({ ...state, exploration: { sessions: [...(state.exploration?.sessions ?? []), session], activeSessionId: session.id } });
      return structuredClone(session);
    },
    selectExplorationBranch(branchId:M.ExplorationSession['id']) {
      const state=current();
      if(!state.exploration?.sessions.some(s=>s.id===branchId))throw new Error('This exploration branch is unavailable.');
      if(state.exploration.activeSessionId!==branchId)publish({...state,exploration:{...state.exploration,activeSessionId:branchId}});
    },
    updateExplorationBranch(branchId:M.ExplorationSession['id'],patch:{name?:string;position?:{x:number;y:number};expanded?:boolean}) {
      const state=current();const branch=state.exploration?.sessions.find(s=>s.id===branchId);
      if(!branch||!state.exploration)throw new Error('This exploration branch is unavailable.');
      if(patch.name!==undefined&&(!patch.name.trim()||patch.name.trim().length>100))throw new Error('Give this branch a name of up to 100 characters.');
      if(patch.expanded!==undefined&&typeof patch.expanded!=='boolean')throw new Error('Invalid branch expansion state.');
      if(patch.position&&(!Number.isFinite(patch.position.x)||!Number.isFinite(patch.position.y)))throw new Error('Branch coordinates must be finite.');
      const safe:typeof patch={...(patch.name!==undefined?{name:patch.name.trim()}:{}),...(patch.position?{position:{...patch.position}}:{}),...(patch.expanded!==undefined?{expanded:patch.expanded}:{})};
      if(Object.entries(safe).every(([k,v])=>equal(branch[k as keyof M.ExplorationSession],v)))return;
      const time=now();const next={...branch,...safe,updatedAt:time,...(safe.name!==undefined&&safe.name!==branch.name?{nameHistory:[...(branch.nameHistory??[]),{name:branch.name??`Branch ${state.exploration.sessions.indexOf(branch)+1}`,changedAt:time}]}:{})};
      publish({...state,exploration:{...state.exploration,sessions:state.exploration.sessions.map(s=>s.id===branchId?next:s)}});
    },
    setMapView(stage: M.MapStage, view: M.MapViewport) {
      if (![view.x, view.y, view.scale].every(Number.isFinite) || view.scale < .2 || view.scale > 2) throw new Error('Invalid map view.');
      const state = current();
      if (!equal(state.mapViews?.[stage], view)) publish({ ...state, mapViews: { ...state.mapViews, [stage]: view } });
    },
    explorationNodes: {
      ...operations('explorationNodes'),
      remove(nodeId: M.ExplorationNode['id']) {
        const state = current(); find('explorationNodes', nodeId); const time = now();
        publish({ ...state,
          explorationNodes: state.explorationNodes.map(n => n.id === nodeId ? { ...n, archivedAt: time, updatedAt: time } : n),
          explorationConnections: state.explorationConnections.map(c => c.fromNodeId === nodeId || c.toNodeId === nodeId ? { ...c, archivedAt: time, updatedAt: time } : c) });
      },
    },
    explorationConnections: {
      ...operations('explorationConnections'),
      remove(connectionId: M.ExplorationConnection['id']) {
        const state = current(); find('explorationConnections', connectionId); const time = now();
        publish({ ...state, explorationConnections: state.explorationConnections.map(c => c.id === connectionId ? { ...c, archivedAt: time, updatedAt: time } : c) });
      },
    },
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
