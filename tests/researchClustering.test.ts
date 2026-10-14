import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createProjectStore } from '../src/state/projectStore';
import { prepareAnalysis, verifyProposals } from '../src/features/research/clustering';
import type { EntityId } from '../src/model/types';

function setup() {
  const store = createProjectStore();
  store.createProject({ name: 'Research', context: '' });
  const source = (title: string, text: string) => store.sources.add({ title, limitations: [], processingState: 'ready',
    originalFile: { id: crypto.randomUUID() as EntityId<'asset'>, filename: title, mediaType: 'text/plain' },
    preparedContent: { format: 'txt', extractedAt: new Date().toISOString(), limitations: [], sections: [{ location: 'Paragraph 1', text }] } });
  source('Interview.txt', 'The entrance was hard to find. Seating was comfortable.');
  source('Observation.txt', 'Visitors asked where the entrance was.');
  return store;
}

test('cross-document categories and multiple themes preserve source ranges, edits, rejection and refresh', () => {
  const store = setup(); const chunks = prepareAnalysis(store.getProject()!.sources);
  const proposals = verifyProposals([
    { name: 'Finding the entrance', description: 'Accounts of locating the entrance.', passages: [
      { chunkId: chunks[0].id },
      { chunkId: chunks[1].id }] },
    { name: 'Seating', description: 'An account of seating comfort.', passages: [{ chunkId: chunks[0].id }] },
  ], chunks, store.getProject()!.sources);
  const added = store.addResearchAnalysis(proposals);
  assert.equal(added[0].passages!.length, 2);
  assert.equal(added[0].passages![0].source.id, added[1].passages![0].source.id);
  store.categories.update(added[0].id, { name: 'Entrances' });
  store.categories.update(added[1].id, { review: { state: 'rejected' } });
  store.addResearchAnalysis(proposals);
  const snapshot = store.getProject()!;
  assert.equal(snapshot.categories[0].origin, 'dave_edited_by_researcher');
  assert.equal(snapshot.categories[0].history[0].content.name, 'Finding the entrance');
  assert.equal(snapshot.categories[1].review!.state, 'rejected');
  const restored = createProjectStore(); restored.restoreProject(snapshot);
  assert.deepEqual(restored.getProject(), snapshot);
  assert.equal(snapshot.claims.length, 0);
});

test('fabricated, ambiguous and incomplete excerpts are rejected; invalid runs are atomic', () => {
  const store = setup(); const chunks = prepareAnalysis(store.getProject()!.sources);
  assert.throws(() => verifyProposals([{ name: 'Topic', description: 'Topic', passages: [{ chunkId: 'fabricated-id' }] }], chunks, store.getProject()!.sources));
  assert.throws(() => verifyProposals([{ name: 'Topic', description: 'Topic', passages: [] }], chunks, store.getProject()!.sources));
  assert.throws(() => verifyProposals([{ name: 'Topic', description: 'Topic', passages: [{ chunkId: 'missing' }] }], chunks, store.getProject()!.sources));
  assert.throws(() => verifyProposals([{ name: 'Topic', description: 'Topic', passages: [{ chunkId: 'repeat' }] }], [{ ...chunks[0], id: 'repeat', text: 'same same' }], store.getProject()!.sources));
  const before = store.getProject();
  assert.throws(() => store.addResearchAnalysis([{ name: 'Valid' }, { name: 'Invalid', passages: [{ source: { id: chunks[0].sourceId as EntityId<'source'>, revision: 1 }, sectionIndex: 0, start: 0, end: 10000 }] }]));
  assert.deepEqual(store.getProject(), before);
});

test('analysis excludes failed sources and never silently truncates oversized research', () => {
  const store = setup(); const sources = store.getProject()!.sources;
  assert.equal(prepareAnalysis([{ ...sources[0], processingState: 'failed' }, sources[1]]).length, 1);
  assert.throws(() => prepareAnalysis([]));
  assert.throws(() => prepareAnalysis([{ ...sources[0], preparedContent: { ...sources[0].preparedContent!, sections: [{ location: 'Paragraph 1', text: 'x'.repeat(120001) }] } }]));
});

test('deleting a file with later-stage evidence is blocked without changing research', async () => {
  const { withoutResearchSource } = await import('../src/features/research/deleteSource');
  const store = setup(); const source = store.getProject()!.sources[0];
  store.evidence.add({ source: { id: source.id, revision: source.revision }, text: 'The entrance was hard to find.', form: 'quotation', location: 'Paragraph 1', context: '', limitations: [] });
  const before = store.getProject()!;
  assert.throws(() => withoutResearchSource(before, source.id), /later-stage evidence/);
  assert.deepEqual(store.getProject(), before);
});

test('regression: PDF whitespace and repeated wording no longer require AI quotation copying', () => {
  const store = setup(); const source = store.getProject()!.sources[0];
  const original = 'Press  the handle.\nRinse the filter. Rinse the filter.';
  store.sources.update(source.id, { preparedContent: { ...source.preparedContent!, sections: [{ location: 'Page 1', text: original }] } });
  // Old quote matching would reject whitespace-normalised text and repeated phrases.
  assert.equal(original.indexOf('Press the handle. Rinse the filter.'), -1);
  assert.notEqual(original.indexOf('Rinse the filter.'), original.lastIndexOf('Rinse the filter.'));
  const sources = store.getProject()!.sources; const chunks = prepareAnalysis(sources);
  const result = verifyProposals([{ name: 'Pressing and cleaning', description: 'Instructions for pressing and rinsing.', passages: [{ chunkId: chunks[0].id }] }], chunks, sources);
  const passage = result[0].passages![0];
  assert.equal(sources[0].preparedContent!.sections[passage.sectionIndex].text.slice(passage.start, passage.end), original);
  assert.throws(() => verifyProposals([{ name: 'Topic', description: 'Topic', passages: [{ chunkId: chunks[0].id, quote: 'Paraphrased material' }] }], chunks, sources), /invalid passage selection/);
  assert.throws(() => verifyProposals([{ name: 'Topic', description: 'Topic', passages: [{ chunkId: chunks[0].id }] }], chunks, []), /stored source/);
});
