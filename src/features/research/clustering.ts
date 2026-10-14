import type { ResearchCategoryContent, Source } from '../../model/types';

export const MAX_ANALYSIS_CHARACTERS = 120_000;
export interface AnalysisChunk {
  id: string;
  sourceId: string;
  sourceRevision: number;
  title: string;
  sectionIndex: number;
  location: string;
  offset: number;
  text: string;
}
export interface ClusterProposal {
  name: string;
  description: string;
  passages: { chunkId: string }[];
}

/** Temporary analysis input, never a second persisted copy of research. */
export function prepareAnalysis(sources: Source[]): AnalysisChunk[] {
  const chunks: AnalysisChunk[] = [];
  let total = 0;
  for (const source of sources) {
    if (source.archivedAt || source.processingState !== 'ready' || !source.preparedContent) continue;
    source.preparedContent.sections.forEach((section, sectionIndex) => {
      total += section.text.length;
      for (let offset = 0; offset < section.text.length;) {
        let end = Math.min(offset + 800, section.text.length);
        if (end < section.text.length) {
          const boundary = section.text.lastIndexOf(' ', end);
          if (boundary > offset + 400) end = boundary;
        }
        const text = section.text.slice(offset, end);
        if (text.trim()) chunks.push({ id: `chunk-${chunks.length}`, sourceId: source.id,
          sourceRevision: source.revision, title: source.title, sectionIndex,
          location: section.location, offset, text });
        offset = end;
      }
    });
  }
  if (!chunks.length) throw new Error('There is no readable research to analyse. Upload or retry a document first.');
  if (total > MAX_ANALYSIS_CHARACTERS)
    throw new Error('This prototype can analyse up to 120,000 extracted characters at once. Use a smaller set of documents; no text has been omitted.');
  return chunks;
}

/** Model selects IDs only; every range is checked against the stored source revision. */
export function verifyProposals(value: unknown, chunks: AnalysisChunk[], sources: Source[]): ResearchCategoryContent[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error('The model returned invalid categories. Please retry.');
  return value.map(raw => {
    const category = raw as ClusterProposal;
    if (!category || typeof category.name !== 'string' || !category.name.trim() || category.name.length > 120
      || typeof category.description !== 'string' || !category.description.trim() || category.description.length > 1500
      || !Array.isArray(category.passages) || !category.passages.length || category.passages.length > 100)
      throw new Error('The model returned an incomplete category. Please retry.');
    const seen = new Set<string>();
    const passages = category.passages.map(selection => {
      if (!selection || typeof selection.chunkId !== 'string' || Object.keys(selection).length !== 1)
        throw new Error('The model returned an invalid passage selection. No categories were added. Please retry.');
      const chunk = chunks.find(item => item.id === selection.chunkId);
      if (!chunk) throw new Error('An AI selection refers to an unknown research passage. No categories were added. Please retry.');
      const source = sources.find(item => item.id === chunk.sourceId && !item.archivedAt);
      const content = source?.revision === chunk.sourceRevision ? source
        : source?.history.find(entry => entry.revision === chunk.sourceRevision)?.content;
      const section = content?.preparedContent?.sections[chunk.sectionIndex];
      if (!section || !Number.isInteger(chunk.offset) || chunk.offset < 0 || !chunk.text.trim()
        || section.text.slice(chunk.offset, chunk.offset + chunk.text.length) !== chunk.text)
        throw new Error('A selected passage no longer matches its stored source. No categories were added. Please retry.');
      return { source: { id: chunk.sourceId as Source['id'], revision: chunk.sourceRevision },
        sectionIndex: chunk.sectionIndex, start: chunk.offset, end: chunk.offset + chunk.text.length };
    }).filter(passage => {
      const key = JSON.stringify(passage);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    return { name: category.name.trim(), description: category.description.trim(), passages, review: { state: 'proposed' } };
  });
}
