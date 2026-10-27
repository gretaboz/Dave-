import { useState } from 'react';

/** A contiguous slice only: presentation never changes the verified text. */
function previewRange(text: string, categoryName: string) {
  if (text.length <= 320) return { start: 0, end: text.length };
  const terms = categoryName.toLowerCase().match(/[\p{L}]{4,}/gu) ?? [];
  const positions = terms.map(term => text.toLowerCase().indexOf(term)).filter(position => position >= 0);
  const anchor = positions.length ? Math.min(...positions) : 0;
  let start = Math.max(0, anchor - 80);
  // Prefer a sentence boundary before the matched topic; keep the original slice.
  const boundary = text.lastIndexOf('. ', anchor);
  if (boundary >= start) start = boundary + 2;
  else if (start > 0) {
    const space = text.indexOf(' ', start);
    if (space >= 0 && space < anchor) start = space + 1;
  }
  let end = Math.min(text.length, start + 320);
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    if (space > start + 180) end = space;
  }
  return { start, end };
}

export function ExcerptCard({ text, filename, location, categoryName, categoryNames, linked, disabled, onViewSource, compact=false }: {
  text: string; filename: string; location: string; categoryName: string; categoryNames: string[]; linked?: boolean; disabled: boolean; onViewSource: () => void; compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const range = previewRange(text, categoryName);
  const shortened = range.start > 0 || range.end < text.length;
  return <article className={`research-excerpt${linked === true ? ' research-excerpt-linked' : linked === false ? ' research-excerpt-other' : ''}`} data-linked={linked} aria-label={`Excerpt from ${filename}`}>
    <div className="research-excerpt-source"><strong>{filename}</strong><span>{location}</span></div>
    {!compact && <p className="research-excerpt-categories">{categoryNames.join(' · ')}{linked === true ? ' · Linked to selected category' : ''}</p>}
    {!compact && shortened && !expanded && <p className="research-excerpt-preview-label">Shortened preview</p>}
    <blockquote>{expanded ? text : text.slice(range.start, range.end)}</blockquote>
    <div className="research-excerpt-actions">
      {!compact && shortened && <button className="research-text-button" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Show less' : 'Show more'}</button>}
      <button className="research-text-button" type="button" disabled={disabled} onClick={onViewSource}>View source</button>
    </div>
  </article>;
}
