import { createProjectStore } from '../../state/projectStore';
import { createProjectSession } from '../../state/projectSession';
import { createLocalPersistence } from '../../persistence/localPersistence';
import type { EntityId } from '../../model/types';

const documents = [
  { title: 'Synthetic kitchen interviews.txt', paragraphs: [
    'Participant A squeezed three oranges for breakfast. They held the bowl with one hand because the press moved on the worktop.',
    'Participant B said the handle felt slippery when their hands were wet. They paused between oranges because their wrist felt tired.',
    'Participant A rinsed the strainer immediately. Pulp caught around the holes when it was left until later.',
  ] },
  { title: 'Synthetic use observations.txt', paragraphs: [
    'During a fictional kitchen session, the press shifted on a damp counter while a participant pushed the handle.',
    'The participant tipped the collection cup toward a glass. Juice dripped down the side of the cup after pouring.',
    'After use, the participant separated the strainer and cup for washing. They stored the press beside a kettle on a narrow shelf.',
  ] },
  { title: 'Synthetic household notes.txt', paragraphs: [
    'The household described making a small glass of juice on weekdays and a larger jug when visitors arrived.',
    'The press stayed in a cupboard between uses. The household placed its removable cup inside the frame to save shelf space.',
    'The household reported finding dried pulp in the strainer after rinsing it without taking it apart.',
  ] },
];
const themes = [
  { name: 'Holding and pressing', description: 'Accounts of grip, wrist effort, and movement of the press during use.', refs: [[0,0],[0,1],[1,0]] },
  { name: 'Pulp and cleaning', description: 'Descriptions of rinsing, dried pulp, and separating parts for washing.', refs: [[0,2],[1,2],[2,2]] },
  { name: 'Collecting and pouring juice', description: 'An observation of transferring juice from the collection cup into a glass.', refs: [[1,1]] },
  { name: 'Storage between uses', description: 'Descriptions of shelf space and how removable parts are stored.', refs: [[1,2],[2,1]] },
  { name: 'Everyday and shared use', description: 'Accounts of different quantities of juice prepared for breakfast and visitors.', refs: [[0,0],[2,0]] },
];

export function createDemoSession(databaseName = 'dave-synthetic-demo') {
  const store = createProjectStore();
  const persistence = createLocalPersistence({ databaseName });
  return createProjectSession(store, { ...persistence,
    async loadIntoStore(target) {
      const existing = await persistence.loadIntoStore(target);
      if (existing) return existing;
      const seed = createProjectStore();
      seed.createProject({ name: 'Citrus press redesign · Synthetic demo', context: 'A fictional project exploring how a household uses, cleans, and stores a manual citrus press. All research is synthetic.' });
      const time = new Date().toISOString();
      const files = documents.map(document => ({ id: crypto.randomUUID() as EntityId<'asset'>, blob: new Blob([document.paragraphs.join('\n\n')], { type: 'text/plain' }) }));
      const sources = documents.map((document, index) => seed.sources.add({ title: document.title,
        originalFile: { id: files[index].id, filename: document.title, mediaType: 'text/plain' },
        limitations: ['Synthetic demo material. These participants and observations are fictional.'], processingState: 'ready',
        preparedContent: { format: 'txt', extractedAt: time, limitations: ['Synthetic demo material.'], sections: document.paragraphs.map((text, i) => ({ location: `Paragraph ${i+1}`, text })) },
      }));
      seed.addResearchAnalysis(themes.map(theme => ({ name: theme.name, description: theme.description,
        review: { state: 'proposed' }, analysis: { id: 'synthetic-citrus-demo', model: 'pre-generated synthetic demo', promptVersion: 'demo-citrus-1', analysedAt: time },
        passages: theme.refs.map(([document, paragraph]) => ({ source: { id: sources[document].id, revision: sources[document].revision }, sectionIndex: paragraph, start: 0, end: documents[document].paragraphs[paragraph].length })),
      })));
      const project = seed.getProject()!;
      await persistence.saveProject(project, files);
      target.restoreProject(project);
      return project;
    },
  });
}
