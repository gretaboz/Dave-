import type { SourceContent } from '../../model/types';

type PreparedContent = NonNullable<SourceContent['preparedContent']>;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function researchFormat(filename: string): PreparedContent['format'] {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'pdf' || extension === 'txt' || extension === 'docx') return extension;
  throw new Error('Choose a PDF, TXT, or DOCX file.');
}

/** Local parsing only. Empty or unreadable documents never receive invented text. */
export async function prepareContent(file: Blob, filename: string): Promise<PreparedContent> {
  const format = researchFormat(filename);
  if (file.size > MAX_FILE_BYTES) throw new Error('This prototype supports files up to 20 MB.');
  const sections: PreparedContent['sections'] = [];
  const limitations: string[] = [];
  const buffer = await file.arrayBuffer();
  if (format === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer), stopAtErrors: true });
    try {
      const document = await task.promise;
      if (document.numPages > 500) throw new Error('This prototype supports PDFs up to 500 pages.');
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        try {
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          const text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
          sections.push({ location: `Page ${pageNumber}`, text });
          if (!text) limitations.push(`Page ${pageNumber}: no readable text found. Scanned pages need OCR, which is not supported.`);
          page.cleanup();
        } catch {
          sections.push({ location: `Page ${pageNumber}`, text: '' });
          limitations.push(`Page ${pageNumber}: text extraction failed.`);
        }
      }
      limitations.push('PDF reading order and layout may differ from the original. Check passages against the source.');
    } finally {
      await task.destroy();
    }
  } else {
    let text: string;
    if (format === 'docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      text = result.value;
      limitations.push(...result.messages.map(message => message.message));
      limitations.push('Paragraph numbers refer to extracted text, not Word pages. Formatting and images are not included.');
    } else {
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        throw new Error('Could not read this TXT file as UTF-8. Save it as UTF-8 and upload it again.');
      }
      if (text.includes('\u0000')) throw new Error('This TXT file contains binary or unsupported encoded content. Save it as UTF-8.');
      limitations.push('Paragraphs are separated by blank lines in the text file.');
    }
    text.replace(/\r\n?/g, '\n').split(/\n\s*\n/).filter(part => part.trim()).forEach((part, index) => {
      sections.push({ location: `Paragraph ${index + 1}`, text: part.trim() });
    });
  }
  if (!sections.some(section => section.text.trim()))
    throw new Error(format === 'pdf' ? 'No readable text found. This PDF may be scanned; OCR is not supported.' : 'No readable text found in this document.');
  if (sections.reduce((total, section) => total + section.text.length, 0) > 2_000_000)
    throw new Error('The extracted text exceeds the prototype limit of 2 million characters. Upload a smaller document.');
  return { format, extractedAt: new Date().toISOString(), sections, limitations };
}
