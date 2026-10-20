# DAVE

A React + TypeScript university prototype for a shared design research workspace.

## Run locally

Use Node.js 22.13 or newer (with npm):

```sh
npm ci
npm run server # first terminal
npm run dev    # second terminal
```

Open http://127.0.0.1:5173. Create a project, then upload documents in Research.
Project snapshots and original files stay in this browser's IndexedDB. Original files are not sent to OpenAI. Clicking **Analyse research** sends readable
text through the local AI server to OpenAI. Clearing browser data removes the local project.

```sh
npm run typecheck
npm run build
npm run preview
```

## Current architecture

- `src/model/`: shared project entities, stable IDs, content revisions and provenance.
- `src/state/projectStore.ts`: immutable shared project operations and reference checks.
- `src/state/projectSession.ts`: startup restoration, serialised/coalesced snapshot saves,
  retry handling, and access to file persistence.
- `src/persistence/localPersistence.ts`: existing IndexedDB project and immutable file stores.
- `src/features/research/`: manual categories, uploads, local text extraction and inspection.
- `src/app/`: application shell and navigation. Later stages currently have placeholders.
- `server/`: localhost API server, dedicated research prompt, OpenAI Responses request and excerpt validation.

## Research content preparation

Upload one or more PDF, TXT or DOCX documents, up to 20 MB each. The original is
stored before its source record is created; source metadata and extracted text
are then saved through the existing shared project/session architecture.

- **PDF:** PDF.js extracts text per page, with page numbers. Up to 500 pages.
  Blank/unreadable pages are explicitly flagged, including in partially readable files.
  Layout and reading order can differ from the source. Scanned/image-only PDFs need
  OCR, which is not included. Password-protected or corrupt files may fail.
- **TXT:** UTF-8 text, with paragraphs separated by blank lines. Unsupported encoding
  or binary content is reported instead of guessed.
- **DOCX:** Mammoth extracts plain text, with extracted paragraph numbers. These are
  not Word page numbers. Formatting and images are omitted; parser warnings remain visible.
  Legacy `.doc` files are not supported.

Extracted content is limited to 2 million characters per document. Text extraction
is local, descriptive parsing: it creates no summaries, evidence entities, claims,
relationships, dimensions or design directions. Uploaded sources start unassigned.
Existing projects, source history and manual categories are preserved; no migration
is required because `SourceContent.preparedContent` is optional.

Select a source to inspect its processing status and extraction limitations, download its original,
or retry failed/interrupted extraction. Failed extraction retains the original and
an understandable error. File-storage failure creates no source; snapshot-save errors
use the existing project retry control. Interrupted extraction can be retried after
refresh. Full extracted text is internal only. Category inspection displays verified excerpts as plain text.

## Research AI clustering

Upload documents, then explicitly click **Analyse research**. The server calls a real
OpenAI model (default `gpt-4.1-mini`) with a dedicated descriptive organisation prompt
and strict structured output. No automatic analysis or mock results are used.

Click a category in the list to see its short summary, relevant excerpts, original filenames and PDF
pages or extracted paragraph numbers. Download original documents from the inspector.
Rename or reject proposals; rejected categories can be restored and retain their
source references. Optional project context is saved with the project and supplied to analysis. Manual categories remain available under Organise manually.

Categories optionally contain passage ranges referencing existing source IDs and
revisions. This allows several themes per document and several documents per theme,
without another copy of the text or file. Category origin, history, review and analysis
metadata are saved in the existing project snapshot. Existing version-1 snapshots
remain compatible because the new category fields are optional. No claims or design
conclusions are created.

The model returns existing passage IDs rather than generating quotation text. The
server rejects unknown IDs; the browser checks each selected range against stored
source text and revisions. Excerpts are retrieved verbatim from that stored text. The whole
proposal set is committed in one store change only after validation. Failures preserve
existing categories. New analysis adds proposals rather than overwriting prior work;
designers may reject duplicates. Changed research invalidates an in-flight result.

The first version analyses at most 120,000 extracted characters per request. It never
silently truncates input. Documents without ready text are excluded and reported.
Partially unreadable sources retain their extraction limitations. Passage ID and source-range checks
verify traceability, not the correctness of category descriptions: designers review them.

### File deletion

Each uploaded file has a Delete action with an explicit confirmation. A confirmed
removal deletes its original blob and the updated project snapshot in one IndexedDB
transaction. Extracted content and source references are removed, including category
history passages. Affected category summaries are cleared; empty thematic categories
are removed. Category names and remaining passages are kept. If saving fails, the
existing save-error control retains the pending deletion for retry.

Files already supporting later-stage Evidence cannot be deleted until that evidence
is removed. This protects future provenance rather than leaving dangling research.
Research uses a simple category list. The Design Map is deferred.

### Server credentials

The server reads `server/.env`, which is ignored by Git. It uses `OPENAI_API_KEY` and
an optional `OPENAI_MODEL`. Never use a `VITE_` prefix for secrets or import server
modules into frontend code. The model can be changed on the server without editing
the browser. Restart the server after changing environment settings.

The API binds to `127.0.0.1:3001`; Vite proxies `/api` to it. This is a local university
prototype. Vite preview also needs the AI server. API requests have input limits,
timeouts, no research logging, and `store: false`. This flag does not promise zero
provider retention. The server and key are never included in the frontend build.

## Browser checks

Install Playwright separately or provide its module path and an installed Chromium:

```sh
DAVE_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
DAVE_BROWSER_EXECUTABLE=/absolute/path/to/chrome \
node --test tests/*.browser.test.mjs
```

Browser tests cover Research controls, PDF/DOCX/TXT extraction, original file storage,
refresh restoration, failed extraction and retry, upload rejection, persistence errors,
and existing shell behavior. Files under `tests/fixtures/` are synthetic test documents,
not research seeded into the application.

Frontend code must not import server modules or include API credentials. Future AI
integration belongs behind server-side task-specific APIs.

## Demo / Live AI

The small switch in Research selects **Demo** or **Live AI**. A new local-development
session defaults to Demo; the current tab remembers the selected mode on refresh.

Demo contains a fictional citrus press redesign: three synthetic text documents and
five pre-generated descriptive categories. It is clearly labelled synthetic and never
calls OpenAI. Analyse research in Demo uses the existing pre-generated results and
keeps your edits. Uploading personal files is disabled in Demo.

Demo uses its own shared project store and separate IndexedDB database
(`dave-synthetic-demo`). Its edits, rejections and deletions survive refresh without
changing the real project in `dave-prototype`. Switching modes preserves both projects.
The other stages continue to use the real project. Live AI retains explicit analysis
and only contacts OpenAI when you click Analyse research.

## Relationships (Task 04)

Use **Live AI** Research, upload your citrus-press material and analyse research.
Then open **Relationships** and explicitly click **Analyse relationships**. Restart
`npm run server` after updating this code. The existing server key and model are reused.
The synthetic Research demo is separate and does not supply this stage.

Two dedicated OpenAI tasks propose claims from verified category passages, then
assess connections using those claims and passages. Select a claim or relationship
to inspect verbatim evidence, source location, context checks and challenges.
Edit wording or relationship explanation/type, and set its review to accepted,
partially accepted, rejected or unresolved. Wording changes require fresh review.
Original proposals remain in revision history. Relationships retain the claim revision
used in their reasoning, including when the current claim has since changed.

Results use the existing shared project and IndexedDB persistence. New analysis
appends proposals; it never replaces reviewed work, but may propose duplicates.
Evidence retains source ranges and category revision references for future stages.
Only non-rejected, active category passages are analysed; ungrouped research is excluded.
Limits remain 120,000 passage characters, 2,000 passages, and 16 proposals per task.
Validation verifies references and exact evidence, not the truth of interpretations.
Human review remains necessary. Dimensions and the Design Map are deferred.

Server tests use transport doubles, and the Relationships browser test uses clearly
synthetic test output to exercise review, persistence and failure handling without
spending API credits. These outputs never ship as application fallback results.

The `npm run server` command watches server files and restarts when they change.
If an older server is already running, stop it with Ctrl+C before starting this
command. A Relationships endpoint 404 means the running server needs updating;
refreshing the browser alone cannot reload server code. Keep the same browser
and http://127.0.0.1:5173 origin to retain your uploaded project.

## Relationships research map

Relationships now displays the existing claims in softly coloured Research category
regions. It makes no automatic AI calls. A primary category is chosen from verified
evidence references (most supporting evidence links, with category order breaking
ties); other category associations remain visible in the inspector. Older evidence
is matched only by exact source ranges/text. Unmatched claims appear in Unassigned.
Each claim appears once, even when supported by several categories.

Click cards or connection labels to inspect and review them. Selecting a claim
highlights its directly connected claims and relationships. Drag cards to arrange
positions, drag empty canvas space to pan, scroll or use +/− to zoom, and use Fit map
for an overview. Conflict, trade-off and expectation–experience interpretations use
separate cards; other relationship types retain their existing classification as
connections. A card is a proposal, not an automatically accepted tension.

Claim and relationship positions are optional layout fields on existing entities,
saved with the same project snapshot. Movement creates no wording revision or
change of authorship/review. Region membership remains grounded in evidence even
if a card is moved elsewhere. This is the Relationships view, not the future global
Design Map. Long text is previewed on cards and shown in full in the inspector.

### Relationships clarity refinement

The overview keeps connection lines faint and hides line labels until selection.
Selecting a claim brings its direct connections forward while other cards stay
visible. Default spacing is wider, curves connect card edges, and saved positions
remain unchanged. Short card headings are navigation labels extracted locally
from existing wording; no research or AI interpretations are regenerated.

The inspector presents interpretation and connection reasoning first. Edit opens
an optional form. Supporting research is collapsed by default; expanding it shows
source names and locations, with a second expansion for each exact excerpt.
Accept, Reject and Unresolved are explicit controls; partial acceptance and return
to proposed remain available under Other review options. History and context are
available on demand. All review decisions and evidence references persist as before.

### Simplified relationship vocabulary

New analysis proposes only **Connection** and **Potential tension**, each joining
exactly two claims. It selects verified evidence supporting both claims and checks
context before suggesting a tension. No meaningful relationship means no output
for that pair. The existing secure OpenAI transport and claim-generation task are
unchanged; the relationship task now uses prompt version `relationships-2`.

The canvas shows no lines until a claim is selected. Connections are solid;
potential tensions are dashed. Click a line or its label for explanation, context,
exact evidence and review controls. Explanatory relationship cards are removed.
Claim Read more, drag, zoom, pan and saved positions remain available.

Older types and all review decisions remain stored unchanged. They are displayed
under **earlier relationships need classification**, rather than inferred from old
labels. This is deliberately conservative because old labels can be misleading.
Inspect them, choose Edit and select Connection or Potential tension when justified.
Multi-claim legacy links remain unclassified; they are not automatically split or
converted. Their original types, references and history remain intact.

Dimension preparation and generation are deferred pending redesign.

### Compact Relationships overview

The current canvas uses short, locally derived claim topic labels and discreet
review states. Full claims remain unchanged and are available by clicking the card.
Read more and expandable paragraphs have been removed from the map.

Classified two-claim relationships appear as small Connection or Potential tension
nodes near the midpoint of their claims, with two connecting segments. Placement
seeks free space around claim cards and other visible relationship nodes. Selecting
a claim reveals its direct nodes; selecting a node opens the relationship inspector.
**Show all connections** optionally reveals the classified network. Existing legacy
links still require explicit classification and are preserved outside the canvas.

Node positions for relationships are derived views of existing IDs and references,
not new entities or AI output. Claim dragging still persists to the shared project.
Local topic labels are navigation cues; full wording, uncertainty, sources and review
controls remain authoritative in the inspectors. No AI or Dimensions changes were
made for this overview refinement.

### Relationship-aware spatial layout

Categories now use a deterministic spatial packing layout weighted by meaningful
cross-category relationships. Connected categories are favoured as neighbours;
claims are packed into approximately square regions. Manual claim positions remain
unchanged, and their category regions enclose them. Older manual arrangements can
therefore still produce overlapping regions; **Reorganise map** explicitly replaces
layout positions in one shared-store update, without changing any interpretation,
evidence, origin, review, revision history or research reference.

Meaningful classified relationships are visible by default and become subdued
outside the current focus. Small nodes remain clickable and open the existing
inspector. Connections use a detour where a direct route would pass through another
card; routing is heuristic and does not guarantee zero crossings in dense networks.

Click a claim to expand its complete interpretation, click again to collapse it.
Only one card expands at a time; longer interpretations scroll inside a bounded
panel. Inspect research opens the existing evidence/review inspector. Unrelated
claims remain visible, including isolated claims. No AI prompts or analysis changed.

### Reliable bounded layout (current)

The category placement is now a predictable two-column layout with fixed gaps.
Each category has its own bounds; cards use two columns, consistent padding,
160px collapsed heights and a reserved 320px row when one claim expands.
No category region grows into another region after placement.

Saved coordinates are retained in the shared project. Older coordinates outside
their category are clamped for display; colliding arrangements use safe category
slots, without mutating the research snapshot. New drags are bounded to the primary
category. Reorganise map explicitly saves the regular layout. Relationships are
hidden by default and only direct links are displayed for the selected claim (or
the selected relationship). One continuous route joins the actual two card edges,
and its clickable node sits on that route; the global top-of-map detours are removed.

### Horizontal Relationships layout (current)

The map now follows the sketch's layered structure: softly coloured category
regions stack vertically in a single left column, with one column of claim cards
inside each region. Classified Connection and Potential tension entities appear
in a separate right column. Connection nodes are blue; potential tension nodes
are coral. Unclassified legacy relationships remain accessible without guessing
new types or generating extra records.

Relationship nodes are sorted by the vertical midpoint of their supporting claims,
with fixed spacing to prevent overlap. Each claim connects from its right edge to
a separate visible input port on its relationship node. Curves run through the
space between columns instead of across category headings or other claim cards.
Existing IDs, full wording, evidence and reviews remain unchanged. No layout library,
AI request, prompt change or database was introduced for this structure.

Default zoom is 85%; pan to reach lower categories. Clicking a claim expands its
full interpretation and exposes Inspect research. Relationship nodes open the
existing side inspector. Reorganise map explicitly saves the fresh claim layout.
Old saved positions remain in storage and are displayed safely within the new
column bounds. Adding a claim or relationship extends the existing shared project;
it does not regenerate or replace prior research or review decisions.

### Landscape overview refinement (current)

Categories are distributed into approximately two to three rows, with compact
multi-column claim arrangements inside each region. Relationship cards seek free
space near the midpoint of their connected claims, keeping clear of claim cards
and other relationship cards. Type colours and existing inspectors are preserved.
Cards include concise clauses retrieved from saved explanation/description text;
no interpretation or AI output is regenerated. Full reasoning remains authoritative
in the inspector. Placement and routing remain heuristics, so dense networks can
still contain crossings.

Fit map keeps at least 55% scale to prevent illegible labels. A network larger than
the viewport therefore remains pannable rather than shrinking every item to tiny
text. Old saved coordinates remain stored and are bounded to the current category
regions for presentation; only explicit dragging/reorganisation changes positions.

### Dimensions reset

Dimensions displays only “Dimensions — To be redesigned”. The previous interface,
map extension, generation endpoint, prompts and confirmation logic were removed.
Shared dimension entities, revision history and saved positions remain intact.
Research, Relationships and their map continue to use the existing shared state.

### One selected project across the workflow

Demo/Live AI selection now scopes the entire workspace, including Research,
Relationships and Dimensions. Previously only Research switched to the synthetic
project provider, so navigating to later stages could display the live project's
categories instead. The databases remain separate to protect uploaded research;
stages within the selected mode now use the same shared project session and IDs.
Demo analysis actions never send its synthetic project to OpenAI.

Map grouping uses current active ResearchCategory names and passage membership.
Evidence's original category references remain historical provenance, but when a
verified passage is moved between categories its current map membership follows
the edited Research categories. Rejected/archived categories are omitted consistently;
unmatched claims remain visible in the neutral Unassigned region rather than being
regenerated or deleted. No new category entities are created by relationship AI.

Relationship requests include the existing category catalogue (IDs, revisions,
names) and passage category references. The server validates references against
that catalogue; the browser verifies the complete passage/category input against
the latest shared project before publishing any result. Existing interpre­tations,
reviews, source files and reference histories are preserved.

### Manual Dimensions

Dimensions now extends the shared Research/Relationships map to the right. Use
Show dimensions or pan across the map. Add dimension opens a manual editor with a
title, brief explanation, three required position labels and optional position
explanations. The middle position represents an approach, rather than indecision.
Existing claims and relationships can be associated by their original IDs and
revisions. Associated findings shows the saved wording and exposes the existing
research inspector; dotted blue lines stay faintly visible and brighten when a dimension is selected.
Upstream map arrangement remains editable in Relationships.

Creation, edits, associations and tuning use the existing project store and local
persistence. UI positions -1 / 0 / +1 map to the existing stored values 0 / .5 / 1.
Earlier continuous or undecided values remain intact until explicitly changed.
Earlier dimensions missing a middle label remain intact and can be completed in
Edit. Remove archives the dimension, retaining its history, positions and downstream
references. There is no archive restoration UI in this increment.

The manual increment initially added no generation AI; see AI-assisted proposals below. The browser check
`tests/dimensions.browser.test.mjs` exercises manual creation, editing, removal,
all three positions across reloads, associations and preservation of old project data.

### AI-assisted dimension proposals

Generate dimensions calls `/api/dimensions/generate` through the existing local
backend and server-side key. Its separate prompt asks for approximately four to
six distinct design considerations, each with three meaningful positions. Sparse
research can legitimately yield fewer or no proposals. Research excerpts use
original source revisions; claim and relationship references use existing IDs.
Only accepted/partially accepted interpretations are supplied as findings. Research
category review status is explicit. Stale relationship-to-claim revisions are
excluded with a limitation; unreviewed category material alone can motivate only
an explicitly labelled inference.

Proposals persist in the shared dimension collection with DAVE origin, generation
metadata, source references and proposed review status. Inspect proposal shows
reasoning, position meanings, original excerpts, limitations and inference status.
The existing editor can edit proposals before acceptance. Accept activates the
card in the existing map and initialises a middle position only if no prior tuning
exists. Reject keeps the record and history outside the active map. Manual dimensions
retain their existing behavior. No new visual association lines are added for
AI-generated dimensions.

Regeneration appends new proposals and supplies all earlier dimensions, including
rejected/archived decisions, to avoid repeating them. Browser and backend validate
the complete reference catalogue and reject invalid batches. Normalised names and
matching endpoint labels suppress duplicates; conceptual duplicates with entirely
different wording still require designer review. No automatic merging is performed.
Changes to research or dimensions during a request invalidate that response;
concurrent tuning is preserved. Network failures leave existing project state intact,
show a retryable error and leave manual creation available. Demo does not call AI.

Verification covers valid/invalid references, insufficient research, duplicates,
review/edit/reject, source inspection, persistence, stale responses and API failure.
The live endpoint was also checked with synthetic research without modifying the
user's project. Research/Relationships generation and later workflow stages are
unchanged.

### Exploration on the progressive Design Map

Research, Relationships, Dimensions and Explore now use one mounted
`RelationshipsMap` and its existing world transform. Research offers Show Design
Map alongside intake. Stage navigation focuses an area and restores its previous
pan/zoom; focus controls keep the rest of the map accessible. Research category
regions, claims, relationships, dimension cards, tuning and findings inspectors
are reused. Relationship analysis and research AI logic are unchanged.

Select dimensions with Use for exploration, choose their positions, then click
Confirm tuning. Confirmation validates active, reviewed dimensions and their
current tuning references and labels. An undecided position needs a human choice. If a Dimension was edited after
tuning, confirmation shows a readable review of the current labels and preserves
all numerical values. Explicit confirmation advances only the saved revision
references; cancellation leaves the project untouched. Concurrent edits invalidate
the review and require another check. It saves an immutable session
with dimension and position revision references, titles, endpoint/middle labels,
chosen labels and meanings. Confirming again appends a new session, retaining old
sessions and all ideas. Changes to dimensions never silently update a snapshot.

Exploration extends the same canvas to the right of Dimensions. Add idea creates
a text card; select it to edit, branch into a new linked idea, connect it to an
existing idea with an arrow, or delete it. Select an arrow to delete a connection.
New cards avoid occupied space; dropped cards move to a nearby free slot if needed.
Arrows express designer-created relationships, not evidence of causality. The
confirmed context links to the existing dimension card and findings inspector;
it adds no second set of tuning controls. Earlier-context ideas remain linked to
the session in which they were created.

The shared store and IndexedDB save sessions, cards, positions, connections and
per-stage map viewports. Content edits retain revision history; movement does not
create content revisions. Deleting archives a card and its incident connections,
retaining their IDs and history. There is no archive restoration UI in this
increment. Unfinished idea drafts and selections remain in memory across stage
navigation and reset on refresh. Demo keeps its existing isolated temporary session.

Optional version-1 fields preserve older saved projects. Ideas from the original
independent whiteboard retain their saved content, IDs, history and positions;
a read adapter places them in the Exploration area. Moving one stores its new
position in shared map coordinates. Older ideas are not retroactively assigned
a confirmed session. They remain editable even before new confirmation.

Fit map maintains a readable minimum zoom and can crop a very large map; pan or
use Show research / Show dimensions / Show exploration to reach other areas.
AI-guided questions are described below. Design Directions remain unimplemented.

`tests/exploration.browser.test.mjs` covers confirmation, a single surviving
canvas, editing, branching, arrow deduplication/deletion, card deletion, scaled
dragging, panning, viewport restoration, stage navigation, reload persistence,
stable snapshots, explicit reconfirmation, legacy data and no AI requests.
`tests/exploration.test.ts` checks the underlying store and layout behavior.


### AI-guided Exploration

After Confirm tuning, Start exploring explicitly requests one question. Nothing
is generated on entry. Select any card and use Ask DAVE for one follow-up. A DAVE
question has a subtle pastel treatment, Why this question?, Skip / Revisit, and
Different question. Alternatives append a sibling question and mark the previous
one skipped; they preserve its responses and history. Manual contributions remain
available during generation and after failures. No chat, design solutions, branch
ranking, automatic questions or Directions are added.

Respond creates a linked contribution. The editor supports ideas, written notes,
and sketches/images. Branch idea creates another linked alternative. Own
contributions remain editable, movable and deletable. Question movement does not
change its content revision; skipping records a designer decision while retaining
DAVE authorship. New cards are brought into view on the same canvas.

The separate `/api/exploration/question` task uses the existing server-only
OPENAI_API_KEY and Responses structured output with `store:false`. It validates
one short, open-ended question and all returned reference IDs on the server and
again against the current project before publishing. Loading, unavailable server,
rate limit, refusal, invalid references, repeated output and stale input produce
an understandable error and an explicit retry, never a placeholder question.

Context uses the selected card's original confirmed session, project name/brief,
preceding branch cards, and relevant research attached to those saved dimension
revisions. Only accepted/partially accepted claims and relationships are included.
Direct evidence and category/source passages retain original revisions and source
locations. When dimensions have no associations, a bounded word-overlap fallback
selects reviewed findings. Missing research remains an explicit limitation rather
than an invented finding. The explanation lists the confirmed settings, considered
findings, selected links, supporting excerpts, original-file access, purpose,
grounding/inference and limitations.

Each new branch card records its explicit parent reference. Follow-ups walk that
creation branch while its connection remains active; older cards use a unique
incoming arrow. Unrelated sibling responses never enter the request. Ambiguous
legacy merges and loops require selecting a clearer branch. Previous branch
questions discourage rephrasing; normalized fingerprints reject exact repeats
across the project without sending sibling responses. Distinct paraphrases may
still require designer judgment. A pending result is rejected if relevant content
changes; movement alone does not invalidate it.

Images (PNG/JPEG/WebP/GIF/AVIF, up to 10 MB and 25 million pixels) are saved as local
blobs using the existing persistence. Cards show thumbnails and an image inspection
view. No image bytes or asset IDs are sent to OpenAI; Ask DAVE uses only the written
caption and states that it cannot see the image. Visual image understanding is not
implemented. Context is bounded to 24 ancestor cards, 16 confirmed settings,
12 claims, 8 relationships, 24 evidence excerpts and 12 source passages. Long
branches need a narrower selection; unavailable or oversized research is omitted
with limitations. Question quality remains a model suggestion for human review.

Implementation files for this increment:
- `server/ai/exploration.mjs`, `server/prompts/exploration.mjs`, `server/index.mjs`
- `src/features/exploration/questions.ts`, `questionContract.mjs`, `questionContract.d.mts`
- `src/features/exploration/ExplorationWorkspace.tsx`, `QuestionInspector.tsx`, `SketchImage.tsx`, `layout.ts`, `exploration.css`
- `src/model/types.ts`, `src/state/projectStore.ts`
- `src/features/dimensions/DimensionsWorkspace.tsx`, `src/features/relationships/RelationshipsMap.tsx` (shared map focus and existing project context)
- `tests/explorationQuestions.test.ts`, `tests/explorationQuestions.browser.test.mjs`, `tests/explorationServer.test.mjs`, `tests/fixtures/exploration.mjs`

Verification includes initial/follow-up questions, branch isolation, confirmed
context, provenance, duplicate rejection, image persistence and inspection,
question movement, alternatives, stale responses, API failures and all existing
workflow regressions. Live OpenAI checks use synthetic research only and do not
change the user's saved project.


### Tuning branches on the Design Map

Confirm tuning creates a new numbered exploration branch from the existing
immutable session snapshot. The same action is available at the bottom of the
Dimensions panel. Edited dimension wording still uses the explicit review step;
no slider is silently retuned. Existing sessions display as earlier numbered
branches without rewriting their snapshots or entity IDs.

Each compact branch node connects to the Dimensions panel. Select its name to
activate it; Rename edits its name and the chevron expands/collapses all saved
dimension titles, selected positions and meaningful labels. Expanded settings
link back to the existing dimension/findings inspector. The active branch has a
subtle highlight and is also selectable in the Active branch control. Names,
positions, expansion state, active selection and content persist in IndexedDB.
Branch name history is separate from the immutable snapshot revision.

Selected-branch actions reuse Start exploring / Ask DAVE, Add idea, Add note and
Add sketch. Root contributions are connected visually to their tuning branch;
responses and idea sub-branches keep the existing node-to-node connections. A
tuning branch is a confirmed configuration; Branch idea is an alternative within
that configuration. Selecting a card also selects its tuning branch. New links
between different tuning branches are rejected to avoid mixing their contexts.

Confirm tuning is disabled when the selected tuning matches an existing branch,
with a hint naming that branch. Changing to a new configuration enables it again;
returning to any saved configuration disables it. Existing saved branches are preserved. New
branch nodes are placed vertically below existing occupied space, reserving room
for expansion. Contribution cards remain draggable and new placements avoid
existing cards. Older saved card positions are retained in storage with a view
adapter that leaves space for the branch column. Existing layouts are not
otherwise rearranged; growing an older exploration can extend below newer ones.

The AI prompt, schema and backend are unchanged. Context selection and placement
now pin root requests to the requested branch, even if the active branch changes
while waiting. Follow-ups retain the selected card's branch snapshot, never the
current sliders. Pending manual drafts retain their original branch as well.

Try: confirm tuning; rename and expand Branch 1; add an idea; change the sliders
and confirm again; switch back to Branch 1 and ask DAVE; refresh. Branch 1 should
still show its original settings and content, while Branch 2 retains the newer
configuration. Unchanged sliders should leave Confirm tuning disabled and name
Branch 2. Returning to Branch 1’s tuning should disable it and name Branch 1.

New verification: `tests/explorationBranches.test.ts` and
`tests/explorationBranches.browser.test.mjs` cover snapshot independence, branch
presentation, selection, duplicate prevention, associated content, AI context and
refresh/navigation persistence. Existing workflow regression tests remain in place.
