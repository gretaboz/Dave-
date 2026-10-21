# Directions MVP Backlog

Status values: `todo`, `in progress`, `blocked`, `done`. Every item should gain an owner, branch/PR, and evidence of its acceptance tests before it is marked done.

## P0 — pre-class and merge prerequisites

### ACCESS-01 — Verify collaboration access

**Outcome:** `luzpralta` can read the private repository, create and push a feature branch, and open a draft pull request without modifying protected branches.  
**Acceptance:** authenticated remote read succeeds; push targets only the feature branch; draft PR creation succeeds or the exact permission blocker is recorded; no direct push or edit occurs on `main` or `greta/dimensions`.

### DOC-01 — Agree the target behavior

**Outcome:** the team reviews the functional specification, AI contract, rubric, fixture catalogue, and meeting decisions.  
**Acceptance:** unresolved choices are recorded with owners; the team explicitly agrees that Skill 3 converges and Explore diverges; excluded MVP features remain excluded.

### AUDIT-01 — Map reusable and incompatible implementation

**Outcome:** retain proven provenance, revision, snapshot, and Explore mechanisms without preserving incompatible semantics.  
**Acceptance:** a short code map identifies reusable references/history/snapshot code; identifies the three-position requirement and unreviewed-confirmation path; names the smallest files and types that need change.

### MODEL-01 — Introduce parameter decisions and direction versions

**Outcome:** project state can store proposed/included/excluded/deferred parameters, fixed/adjustable mode, free-text/undecided orientation, evidence lanes, and immutable confirmed versions.  
**Acceptance:** stable IDs and revisions resolve; designer and DAVE origins remain distinct; confirmed versions reject mutation; legacy records remain readable.

### UI-01 — Add explicit designer review controls

**Outcome:** a designer can inspect evidence and include, edit, exclude, defer, or add a parameter.  
**Acceptance:** all actions persist; relevant evidence, orientation evidence, limitations, and challenges are progressively disclosed; controls remain keyboard accessible.

### UI-02 — Replace mandatory three-position tuning

**Outcome:** an included parameter can be fixed or adjustable and may have free-text orientation or remain undecided.  
**Acceptance:** no low/middle/high or midpoint is required; migration never silently chooses an orientation; older exploration snapshots remain readable.

### FLOW-01 — Confirm an immutable direction

**Outcome:** an explicit designer action creates a versioned snapshot.  
**Acceptance:** confirmation validates reviewed parameter decisions and evidence references; edits create a child draft; version 1 remains byte-for-byte unchanged after version 2 work begins.

### FLOW-02 — Guard the Explore handoff

**Outcome:** Explore uses only an explicitly confirmed direction.  
**Acceptance:** absent and draft inputs fail with understandable guidance; the handoff carries version ID, decisions, evidence, limitations, and unknowns; it contains no generated approach.

### AI-01 — Update the direction generation contract

**Outcome:** model input/output follows the behavior contract.  
**Acceptance:** proposals are project-specific; relevance and orientation support are separate; exact references validate; zero proposals is valid; model output cannot set designer-owned fields.

### TEST-01 — Land the minimum fixture tests

**Outcome:** the first vertical slice is protected by automated and semantic checks.  
**Acceptance:** direction fixtures `DIR-01`, `DIR-04`, `DIR-06`, `DIR-09`, and `DIR-11` pass; relationship fixtures for context, no-tension, and VSD rejection pass; existing typecheck/build/tests remain green.

### PR-01 — Prepare the draft review

**Outcome:** teammates can safely review the work before choosing whether to merge.  
**Acceptance:** feature branch is pushed; draft PR explains scope, migration, tests, gaps, and rollback; no merge is performed without team approval.

## P1 — next implementation increment

- Complete every remaining fixture and add repeat-run reliability checks.
- Align relationship storage and display labels while preserving legacy compatibility.
- Add a citation-locator validator and source-opening test.
- Add full version-history and exclusion/defer audit views.
- Test keyboard, screen-reader, empty, loading, stale-response, and failure states.
- Add concurrent-edit handling appropriate to the existing local-first store.
- Evaluate proposal quality against independently authored human parameters and relationships.

## P2 — after MVP evidence

- Side-by-side version comparison.
- Team decision conflict resolution and attribution.
- Evaluation-run capture and reporting.
- Richer views for intentionally adjustable ranges when a project genuinely needs them.

## Explicitly outside the MVP

- Rams-style principles;
- AI-suggested approaches or concepts;
- complex or numeric sliders;
- mandatory three-position dimensions;
- parameter ranking or optimization;
- autonomous design decisions; and
- automatic merging of team work.

## Vertical-slice definition of done

From a located source passage and reviewed claim, DAVE proposes one project-specific parameter. The UI separates relevance support from orientation support and exposes limitations. A designer edits and includes it, chooses fixed or adjustable, optionally writes an orientation, and explicitly confirms. Confirmation creates immutable version 1. Explore accepts version 1, rejects its child draft, and can trace the decision to the exact source passage. Automated tests and a semantic review verify the path.
