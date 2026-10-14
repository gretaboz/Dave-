import type { EntityId, Source } from '../../model/types';
import type { createProjectSession } from '../../state/projectSession';
import { MAX_FILE_BYTES, prepareContent, researchFormat } from './prepareContent';

type Session = ReturnType<typeof createProjectSession>;

export async function extractSource(session: Session, source: Source, file: Blob) {
  session.store.sources.update(source.id, { processingState: 'processing', processingError: undefined });
  try {
    const preparedContent = await prepareContent(file, source.originalFile.filename);
    session.store.sources.update(source.id, { preparedContent, processingState: 'ready', processingError: undefined });
  } catch (error) {
    session.store.sources.update(source.id, { processingState: 'failed',
      processingError: error instanceof Error ? error.message : 'Could not extract text from this document.' });
  }
}

export async function uploadResearch(session: Session, file: File): Promise<Source> {
  researchFormat(file.name);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}: choose a file up to 20 MB.`);
  const assetId = crypto.randomUUID() as EntityId<'asset'>;
  // Commit the original before exposing a source that refers to it. Snapshot saves
  // remain serialised by the existing session; older saves cannot erase this blob.
  await session.saveFile({ id: assetId, blob: file });
  const source = session.store.sources.add({ title: file.name,
    originalFile: { id: assetId, filename: file.name, mediaType: file.type },
    limitations: [], processingState: 'unprocessed' });
  await extractSource(session, source, file);
  return session.store.getProject()!.sources.find(item => item.id === source.id)!;
}
