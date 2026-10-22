import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createProjectStore } from '../src/state/projectStore';
import type { DimensionContent, EntityId } from '../src/model/types';

const references = () => ({ evidence: [], claims: [], relationships: [], dimensions: [] });
const dimensionContent = (): DimensionContent => ({
  name: 'Guidance', lowLabel: 'Minimal', highLabel: 'Detailed', explanation: 'Test interpretation',
  claims: [], relationships: [], limitations: [], review: { state: 'proposed' },
});
function setup() {
  const store = createProjectStore();
  store.createProject({ name: 'Test project', context: 'Store behaviour checks' });
  return store;
}

test('starts empty, protects state from external mutation, and notifies only on changes', () => {
  const store = createProjectStore();
  assert.equal(store.getProject(), null);
  assert.throws(() => store.updateProject({ name: 'Missing' }));
  let changes = 0;
  const unsubscribe = store.subscribe(() => changes++);
  const project = store.createProject({ name: 'Initial', context: '' });
  project.name = 'External mutation';
  assert.equal(store.getProject()?.name, 'Initial');
  store.updateProject({ name: 'Initial' });
  assert.equal(changes, 1);
  store.updateProject({ name: 'Renamed' });
  assert.equal(store.getProject()?.history[0].content.name, 'Initial');
  assert.equal(store.getProject()?.revision, 2);
  assert.deepEqual(store.getProject()?.directions, []);
  unsubscribe();
  store.updateProject({ context: 'Updated' });
  assert.equal(changes, 2);
  assert.throws(() => store.createProject({ name: 'Replace', context: '' }));
});

test('review retains DAVE authorship; interpretation edits retain the previous version and ID', () => {
  const store = setup();
  const dimension = store.dimensions.add(dimensionContent(), 'dave');
  const accepted = store.dimensions.update(dimension.id, { review: { state: 'accepted' } });
  assert.equal(accepted.origin, 'dave');
  const edited = store.dimensions.update(dimension.id, { name: 'Amount of guidance' });
  assert.equal(edited.id, dimension.id);
  assert.equal(edited.origin, 'dave_edited_by_researcher');
  assert.equal(edited.revision, 3);
  assert.equal(edited.history[0].content.review.state, 'proposed');
  assert.equal(edited.history[1].content.name, 'Guidance');
  store.dimensions.update(dimension.id, { name: 'Amount of guidance' });
  assert.equal(store.getProject()?.dimensions[0].history.length, 2);
});

test('research corrections and downstream edits preserve source, evidence, and old references', () => {
  const store = setup();
  const category = store.categories.add({ name: 'Interviews', order: 0 });
  const source = store.sources.add({ title: 'Transcript', limitations: [],
    originalFile: { id: 'test-asset' as EntityId<'asset'>, filename: 'test.txt', mediaType: 'text/plain' },
    primaryCategoryId: category.id, processingState: 'unprocessed' });
  store.categories.update(category.id, { name: 'User research' });
  store.sources.update(source.id, { processingState: 'ready' });
  assert.equal(store.getProject()?.sources[0].revision, 1);
  const evidence = store.evidence.add({ source: { id: source.id, revision: source.revision },
    text: 'Original excerpt', form: 'quotation', location: 'Page 1', context: 'Interview', limitations: [] });
  const claim = store.claims.add({ statement: 'Initial claim',
    evidence: [{ id: evidence.id, revision: 1 }], context: 'Interview', limitations: [], review: { state: 'proposed' } }, 'dave');
  store.claims.update(claim.id, { statement: 'Edited claim' });
  assert.deepEqual(store.getProject()?.evidence[0], evidence);
  assert.equal(store.getProject()?.sources[0].title, 'Transcript');
  store.evidence.update(evidence.id, { text: 'Corrected extraction' });
  assert.equal(store.getProject()?.evidence[0].history[0].content.text, 'Original excerpt');
  assert.equal(store.getProject()?.claims[0].evidence[0].revision, 1);
  // Referencing the retained evidence revision still works.
  const second = store.claims.add({ ...claim, statement: 'Another interpretation' });
  const relationship = store.relationships.add({ description: 'Context difference', type: 'contextual_variation',
    claims: [{ claim: { id: claim.id, revision: 1 } }, { claim: { id: second.id, revision: 1 } }],
    explanation: 'Needs inspection', limitations: [], review: { state: 'proposed' } });
  store.relationships.update(relationship.id, { review: { state: 'unresolved' } });
  assert.equal(store.getProject()?.relationships[0].history.length, 1);
  assert.deepEqual(store.getProject()?.dimensions, []);
  assert.deepEqual(store.getProject()?.directions, []);
});

test('moving board elements skips history while content and connection edits retain it', () => {
  const store = setup();
  const input = { content: { type: 'idea' as const, text: 'Initial idea' },
    references: references(), dimensionPositions: [], limitations: [], position: { x: 0, y: 0 } };
  const first = store.explorationNodes.add(input, 'dave');
  const second = store.explorationNodes.add(input);
  input.content.text = 'External mutation';
  const moved = store.explorationNodes.update(first.id, { position: { x: 20, y: 30 } });
  assert.equal(moved.revision, 1);
  assert.equal(moved.history.length, 0);
  assert.equal(moved.origin, 'dave');
  const edited = store.explorationNodes.update(first.id, { content: { type: 'idea', text: 'Edited idea' } });
  assert.equal(edited.history[0].content.content.text, 'Initial idea');
  assert.equal('position' in edited.history[0].content, false);
  const connection = store.explorationConnections.add({ fromNodeId: first.id, toNodeId: second.id, directional: false });
  store.explorationConnections.update(connection.id, { label: 'Alternative' });
  assert.equal(store.getProject()?.explorationConnections[0].revision, 2);
  assert.deepEqual(store.getProject()?.directions, []);
});

test('invalid references and tuning fail without changing the current project', () => {
  const store = setup();
  const dimension = store.dimensions.add(dimensionContent());
  const before = store.getProject();
  assert.throws(() => store.setDimensionPosition({ dimension: { id: dimension.id, revision: 1 }, selected: true, value: 2 }));
  assert.throws(() => store.setDimensionPosition({ dimension: { id: dimension.id, revision: 99 }, selected: true, value: null }));
  assert.throws(() => store.claims.add({ statement: 'Unsupported', evidence: [] as never,
    context: '', limitations: [], review: { state: 'proposed' } }));
  assert.throws(() => store.explorationConnections.add({ fromNodeId: 'missing' as EntityId<'exploration_node'>,
    toNodeId: 'also-missing' as EntityId<'exploration_node'>, directional: true }));
  assert.deepEqual(store.getProject(), before);
});

test('category deletion preserves source content, files and category revision history', () => {
  const store = setup();
  const category = store.categories.add({ name: 'hello', order: 0 });
  const source = store.sources.add({ title: 'Notes', originalFile: { id: 'original' as EntityId<'asset'>, filename: 'notes.txt', mediaType: 'text/plain' }, primaryCategoryId: category.id, limitations: [], processingState: 'ready' });
  store.categories.update(category.id, { name: 'Renamed' });
  store.categories.remove(category.id);
  const project = store.getProject()!;
  assert.ok(project.categories[0].archivedAt);
  assert.equal(project.categories[0].history[0].content.name, 'hello');
  assert.deepEqual(project.sources[0].originalFile, source.originalFile);
  assert.equal(project.sources[0].primaryCategoryId, undefined);
  assert.equal(project.sources[0].history[0].content.primaryCategoryId, category.id);
});

test('deleting interpretations archives them without changing evidence or downstream references',()=>{
 const store=setup();const source=store.sources.add({title:'Interview',originalFile:{id:'test' as never,filename:'test.txt',mediaType:'text/plain'},processingState:'ready',limitations:[]});
 const evidence=store.evidence.add({source:{id:source.id,revision:1},text:'Original wording',form:'quotation',location:'Paragraph 1',context:'Test',limitations:[]});
 const claim=store.claims.add({statement:'Interpretation',evidence:[{id:evidence.id,revision:1}],limitations:[],review:{state:'proposed'}},'dave');
 const d=store.dimensions.add({...dimensionContent(),claims:[{id:claim.id,revision:1}]},'dave');
 store.claims.remove(claim.id);const p=store.getProject()!;
 assert.ok(p.claims[0].archivedAt);assert.equal(p.claims[0].revision,1);
 assert.deepEqual(p.evidence[0],evidence);assert.deepEqual(p.sources[0],source);assert.deepEqual(p.dimensions[0],d);
});

test('legacy Directions records and dimension reviews survive restoration and ordinary edits', () => {
  const store = setup();
  const dimension = store.dimensions.add(dimensionContent());
  const legacy = store.getProject()!;
  const review = { state: 'included', orientation: { status: 'undecided' }, extra: ['retained'] };
  legacy.dimensions[0].directionReview = review;
  legacy.directions.push({ id: 'legacy-direction' as EntityId<'direction'>, revision: 2,
    origin: 'researcher', createdAt: legacy.createdAt, updatedAt: legacy.updatedAt,
    history: [{ revision: 1, content: { title: 'Original direction' }, savedAt: legacy.updatedAt,
      changedBy: 'researcher', origin: 'researcher' }], title: 'Saved direction',
    parameterSnapshot: [{ dimension: { id: dimension.id, revision: 1 } }], unknown: { keep: true } });
  store.restoreProject(legacy);
  assert.deepEqual(store.getProject(), legacy);
  store.updateProject({ name: 'Continued work' });
  store.dimensions.update(dimension.id, { name: 'Updated guidance' });
  const saved = store.getProject()!;
  assert.deepEqual(saved.directions, legacy.directions);
  assert.deepEqual(saved.dimensions[0].directionReview, review);
  assert.deepEqual(saved.dimensions[0].history[0].content.directionReview, review);
  const reopened = createProjectStore();
  reopened.restoreProject(saved);
  assert.deepEqual(reopened.getProject(), saved);
  assert.equal('createDirection' in store, false);
  assert.equal('updateDirection' in store, false);
});
