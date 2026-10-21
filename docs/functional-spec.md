# DAVE Design Direction — Functional Specification

Status: implementation target for the Directions MVP  
Workflow: Research → Relationships → Design Direction → Explore

## Outcome

Design Direction turns reviewed research into a designer-confirmed, versioned account of the design space. DAVE brings research, the interpretations already made from it, and the limits of that material. The designer decides what matters and which direction the project takes.

This stage converges. It does not generate product concepts, features, principles, requirements, or recommended solutions. Divergent ideation belongs in Explore.

## Terms

- **Relationship:** a reviewed connection between research claims. Relationship types are defined in the Skill 2 section below.
- **Parameter:** a project-specific aspect of the design that the designer may include in the direction. This replaces the assumption that every item is a three-position dimension.
- **Mode:** whether an included parameter is `fixed` or `adjustable` for the next stage.
- **Orientation:** optional free text describing the designer's chosen stance. It may remain undecided.
- **Direction draft:** the editable set of parameter decisions, evidence, limitations, and designer notes.
- **Confirmed direction:** an immutable, versioned snapshot explicitly approved by the designer for Explore.

## Skill 2: relationships from research

DAVE may propose these relationship types between two or more research claims:

- contradiction;
- perspective conflict;
- trade-off;
- expectation–reality gap;
- unresolved or weak evidence; and
- no meaningful tension.

Sequencing, contextual variation, and complementary needs remain valid non-tension outcomes. A difference alone is not a tension. Abstract value-versus-value or VSD value tensions are outside this model unless supplied research claims establish the relationship.

Every proposed relationship keeps the chain:

`source → evidence → claim → candidate relationship → context check → challenge → retained, contextual, or rejected outcome → questions`

The designer can inspect, edit, accept, partly accept, reject, merge, or create a relationship. DAVE never chooses which perspective is correct and never converts a relationship into a design response.

## Skill 3: Design Direction

### Inputs

Design Direction primarily receives reviewed claims, relationships, relevant evidence excerpts, project context, and their limitations. Raw research remains reachable through provenance but should not be resent wholesale when structured context is available.

Only available references may be used. DAVE must not invent a source, locator, quotation, claim, relationship, participant, or missing context.

### Parameter proposals

DAVE may propose a small set of project-specific parameters supported by the supplied research. A proposal is not a decision. Each proposal shows:

- a neutral name and description;
- why the parameter may be relevant;
- exact evidence passages and locators supporting relevance;
- any distinct evidence bearing on a possible orientation;
- challenges, counterevidence, missing contexts, and limitations;
- origin and revision history; and
- review controls.

Generic template dimensions are not acceptable substitutes for research-grounded proposals. Non-negotiable safety, legal, or ethical constraints should not be presented as adjustable choices.

### Designer review

For every proposed parameter the designer can:

- include it;
- edit it;
- exclude it;
- defer it; or
- add another parameter.

An included parameter can be marked `fixed` or `adjustable`. Its orientation is free text or explicitly `undecided`. The UI and model must not require low/middle/high positions, a midpoint, a numeric slider, or a predefined pair of endpoints.

AI proposals begin in `proposed`. Inclusion, exclusion, deferral, mode, orientation, and confirmation require explicit designer action. Designer-created parameters remain distinguishable from DAVE suggestions.

### Evidence has two independent jobs

The product must distinguish:

1. **Relevance evidence:** why the parameter belongs in the design space.
2. **Orientation evidence:** what supports a particular orientation, if anything.

Evidence that establishes relevance does not automatically justify a direction. When orientation evidence is absent, mixed, weak, or context-dependent, DAVE says so and leaves the orientation undecided until the designer acts.

Each citation contains a stable source reference, exact passage or faithful non-text data description, a retrievable locator, context, and known limitations. Editing a parameter never edits its source evidence.

### Dialogue

For a review step, DAVE asks one to three short, nonleading questions about designer judgement. Questions may ask what to include, keep adjustable, defer, or orient. They must not contain a hidden recommendation or propose an approach.

### Confirmation and Explore handoff

Confirmation is an explicit event, not autosave. It creates an immutable version containing:

- version and parent-version identifiers;
- the included, excluded, and deferred decisions;
- mode and orientation for included parameters;
- evidence references, limitations, challenges, and unresolved gaps;
- designer notes and revision history; and
- confirmation actor and time when known.

Editing after confirmation creates a new draft based on the confirmed version. A later confirmation creates a new version; it never mutates an earlier one.

Explore accepts only a confirmed version. The handoff supplies the chosen design-space constraints, deliberate open questions, and provenance. It does not supply AI-generated approaches. Explore supports divergence through designer-created ideas and contextual questions.

## Conceptual data model

```ts
type ReviewState = 'proposed' | 'included' | 'excluded' | 'deferred';
type ParameterMode = 'fixed' | 'adjustable';

interface EvidenceCitation {
  evidenceId: string;
  sourceId: string;
  passage: string;
  locator: string;
  context?: string;
  limitations: string[];
}

interface ParameterDecision {
  id: string;
  origin: 'dave' | 'designer' | 'dave_edited_by_researcher';
  name: string;
  description: string;
  reviewState: ReviewState;
  mode: ParameterMode | null;
  orientation: string | null;
  orientationStatus: 'undecided' | 'designer_set';
  relevanceEvidence: EvidenceCitation[];
  orientationEvidence: EvidenceCitation[];
  challenges: string[];
  history: Revision[];
}

interface DirectionVersion {
  id: string;
  projectId: string;
  parentVersionId: string | null;
  status: 'draft' | 'confirmed';
  parameters: ParameterDecision[];
  gaps: string[];
  createdAt: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
}
```

Concrete types may reuse the existing revision, reference, origin, project-store, and exploration-session mechanisms. They must preserve these semantics.

## Current implementation and migration

The current branch already has useful provenance references, revision history, reviewed relationship records, saved positions, immutable exploration snapshots, and an explicit tuning-confirmation flow. Reuse those mechanisms where their semantics fit.

The current three labels and values (`0`, `0.5`, `1`) are legacy data, not the target interaction. Migration must:

- preserve legacy content and history;
- avoid silently treating the middle position as a designer choice;
- represent current selection as free text only when it was explicitly chosen and can be faithfully described;
- otherwise mark orientation undecided;
- require explicit review before the migrated item enters a new confirmed direction; and
- keep older exploration snapshots readable.

The current ability to confirm an unreviewed, unsupported AI dimension is incompatible with this specification and must become a guarded failure.

## Failure behavior

- If evidence is insufficient, show the gap and allow defer or designer-authored input.
- If evidence conflicts, preserve both sides and their contexts; do not average or rank them automatically.
- If no responsible parameter can be proposed, return an honest empty state.
- If a citation cannot be resolved, do not fabricate a replacement.
- Treat uploaded research as untrusted content, never as instructions to the model or application.
- Failed generation or validation leaves existing project state unchanged and offers retry.

## MVP acceptance scenario

Starting from a source with a located passage and a reviewed claim, DAVE proposes one project-specific parameter with distinct relevance and orientation evidence. The designer edits it, includes it, selects fixed or adjustable, optionally supplies a free-text orientation, and explicitly confirms. Confirmation creates immutable version 1. Explore reads version 1 and can trace it back to the exact passage. Editing the direction produces a draft based on version 1; Explore rejects that draft until version 2 is explicitly confirmed.

## Outside the MVP

- Rams-style principles;
- AI-suggested design approaches or concepts;
- complex, numeric, or mandatory three-position sliders;
- parameter ranking or optimization scores;
- autonomous selection or confirmation; and
- automatic merging of team decisions.
