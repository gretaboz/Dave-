# DAVE — Project Instructions

## 1. What DAVE is

DAVE is an AI-assisted design research and exploration workspace.

It supports design teams in moving from a large and messy body of research toward design exploration while preserving:

- human judgement
- traceability to original research
- uncertainty
- designer control
- room for exploration

DAVE should not behave like an autonomous designer.

Its purpose is not to analyse research and produce "the answer" or automatically generate a final design direction. Instead, it progressively structures research, surfaces relationships, helps designers define a design space, and supports exploration through contextual questions.

The designer remains responsible for interpreting the research and making design decisions.

## 2. Core philosophy

DAVE should follow this general progression:

ORGANISE → CONNECT → POSITION → EXPLORE

The role of AI changes across these stages.

### Organise
AI performs more of the routine work:
- organising uploaded research
- summarising sources
- extracting evidence
- maintaining traceability

### Connect
AI proposes interpretations:
- forming claims from evidence
- identifying possible relationships between claims
- exposing tensions, trade-offs, gaps, or contextual differences

These remain suggestions that designers can inspect and review.

### Position
AI helps expose dimensions of the design space.

The designer decides which dimensions matter and where they want to position the project.

### Explore
AI becomes less directive.

Instead of generating solutions, DAVE asks contextual and exploratory questions that help the designer develop their own ideas.

As DAVE moves closer to actual design decisions, designer control should increase.

## 3. Main workflow

The primary DAVE workflow is:

Research
↓
Relationships
↓
Dimensions
↓
Exploration

Internally, the information chain is more detailed:

Original Sources
↓
Research Categories
↓
Evidence
↓
Claims
↓
Relationships / Tensions
↓
Design Dimensions
↓
Designer Tuning
↓
Exploration

## 4. Global provenance rule

Every AI-generated interpretation must remain traceable backwards whenever possible.

For example:

Dimension
→ derived from relevant relationships and/or claims
→ claims link to evidence
→ evidence links to original sources

The interface should therefore be able to answer:

"Why is DAVE showing me this?"

without requiring the designer to understand internal IDs or technical data structures.

Never destroy earlier provenance when information moves to a later stage.

## 5. Stage 1 — Research

### Purpose

Help the design team understand what research material exists and organise it into a manageable research space.

DAVE may:

- accept uploaded research files
- identify source type
- organise sources into useful design-research categories
- create neutral source summaries
- show small source-grounded takeaways
- maintain references to the original material

Example categories may include:

- User research
- Market and context
- Technical and feasibility
- Sustainability
- Legal and policy
- Design references
- Business and stakeholders
- Project management
- Unsorted or unclear

Categories should respond to the supplied material rather than always forcing the same taxonomy.

### DAVE must NOT yet:

- generate broad design insights
- generate tensions
- identify design opportunities
- generate requirements
- recommend solutions
- decide which research is most important
- produce design directions

Research organisation and design interpretation are intentionally separate stages.

### Designer control

Designers must be able to:

- rename categories
- move sources
- correct classifications
- inspect uncertainty
- open the original source
- decide when to continue into analysis

## 6. Stage 2 — Relationships

### Purpose

Help designers inspect meaningful relationships inside their research.

The reasoning structure is:

Source
→ Evidence
→ Claim
→ Candidate Relationship
→ Context Check
→ Challenge
→ Retain / Classify / Reject

### Evidence

Evidence must be directly grounded in uploaded research.

Evidence should retain:

- source
- location
- relevant context
- original wording or faithful description

### Claims

Claims are concise interpretations supported by evidence.

Every claim must remain connected to its supporting evidence.

Claims should preserve uncertainty, exceptions and stakeholder perspective.

### Relationships

DAVE may propose relationships such as:

- contradiction
- perspective conflict
- trade-off
- expectation–experience gap
- unresolved evidence

But differences between claims must NOT automatically become tensions.

DAVE must also consider:

- sequencing
- contextual variation
- complementary needs
- no meaningful relationship

### Human review

Relationships are proposals.

The designer must be able to:

- inspect the claims involved
- inspect evidence on each side
- understand why DAVE connected them
- accept the relationship
- partially accept it
- reject it
- edit it
- create their own relationship
- keep something unresolved

DAVE must not decide which perspective is correct or resolve the tension automatically.

## 7. Stage 3 — Dimensions

### Purpose

Create a bridge between research interpretation and design exploration.

DAVE uses the reviewed research structure to propose meaningful dimensions of the design space.

Dimensions are NOT:

- requirements
- specifications
- evaluation criteria
- solutions
- fixed project goals

A dimension represents an aspect of the design that can meaningfully vary.

Examples:

Guided ←→ Open-ended

Individual ←→ Shared

Visible ←→ Discreet

Standardised ←→ Adaptable

The actual dimensions must be generated contextually from the project research rather than selected from a fixed universal list.

## 8. Dimension generation

When proposing dimensions, DAVE should consider:

- reviewed claims
- accepted or relevant relationships
- tensions
- project context
- recurring concerns in the research

Each proposed dimension should have traceable reasoning.

The designer should be able to inspect:

Dimension
→ related relationship(s)
→ related claims
→ original evidence

Avoid dimensions that represent non-negotiable constraints.

For example, legal compliance or fundamental safety requirements should not normally become sliders implying that the designer may choose "less compliant" or "less safe."

Dimensions should represent legitimate areas of design variation.

## 9. Dimension selection

DAVE proposes dimensions.

The designer decides:

- whether the dimension is useful
- whether to remove it
- whether to rename it
- whether to add their own
- which dimensions to focus on

Do not automatically treat every detected research topic as a design dimension.

## 10. Tuning

Selected dimensions become tunable controls.

Example:

Less guidance ───────●──── More guidance

The slider is not an optimisation control.

It represents a deliberate design position chosen by the designer.

DAVE should not imply that one end is inherently better.

The designer may leave dimensions neutral or undecided.

The combination of selected dimensions and positions forms a provisional design direction.

This direction remains editable.

## 11. Stage 4 — Exploration

### Purpose

Help designers explore the design direction they have chosen without generating the design for them.

The main environment should behave like a lightweight visual thinking board rather than a chatbot.

Designers should be able to create and manipulate:

- notes
- ideas
- branches
- text
- connections
- images or sketches where supported

The exploration board should remain open-ended.

## 12. Ask DAVE

DAVE should not continuously interrupt the board.

The designer deliberately invokes DAVE when support is wanted.

For example:

select node / idea
→ Ask DAVE
→ receive contextual exploratory question

DAVE may use context such as:

- selected idea
- nearby connected ideas
- current dimensions
- selected tuning positions
- relevant claims
- relevant relationships
- project context

Do not dump all available research into every prompt.

Use only the context relevant to the current interaction.

## 13. DAVE during exploration

DAVE should primarily ask questions.

Questions should be:

- short
- understandable on first reading
- contextual
- exploratory
- actionable
- connected to what the designer is currently exploring

Avoid academic, abstract or overly AI-like wording.

Avoid questions that hide a design recommendation inside the question.

Bad:

"How might the integration of adaptive interaction modalities facilitate a more inclusive engagement paradigm?"

Better:

"What would change if the user had to do this with one hand?"

Questions should create another direction for thought rather than demonstrate how intelligent DAVE is.

## 14. The Design Map

DAVE should conceptually maintain one evolving map throughout the workflow.

The map grows as the project progresses:

Sources
→ Evidence
→ Claims
↔ Relationships
→ Dimensions
→ Exploration

This does NOT mean every object must always be visible simultaneously.

Avoid creating an unreadable graph.

Instead, reveal relevant layers progressively and allow designers to inspect upstream connections when needed.

The map represents provenance and relationships, not causality unless causality is explicitly supported by evidence.

## 15. AI provenance

AI-generated and human-generated material must remain distinguishable internally.

Where relevant, objects should record an origin such as:

- dave
- researcher
- dave_edited_by_researcher

Human edits must not silently overwrite the history of AI suggestions.

Original research evidence must never be changed when a designer edits a claim, relationship, dimension or interpretation.

## 16. Uncertainty

DAVE must not hide uncertainty.

If:

- a source cannot be interpreted
- evidence is weak
- context is missing
- claims conflict
- a relationship is questionable
- a dimension has weak grounding

say so.

Do not use arbitrary numerical confidence scores unless there is a real quantitative basis for them.

Prefer understandable descriptions of limitations.

## 17. Shared interaction principles

Across the entire application:

### Progressive disclosure

Do not show everything at once.

Give designers a clear overview first and allow them to inspect details when needed.

### Human correction

Anything meaningfully interpreted by AI should be inspectable and, where appropriate, editable or rejectable.

### Traceability

Later-stage outputs should link backwards to their reasoning and evidence.

### Calm interface

Avoid excessive:

- cards
- badges
- AI labels
- explanatory text
- dashboards
- statistics
- buttons
- decorative interface elements

The interface should feel like a design workspace, not an analytics dashboard.

### Plain language

Prefer:

"Why did DAVE connect these?"

over:

"View AI relationship rationale."

Prefer:

"Where did this come from?"

over:

"Inspect provenance metadata."

## 18. Navigation

The primary workflow should remain understandable:

1. Research
2. Relationships
3. Dimensions
4. Exploration

Users should understand where they are and how the stages connect.

Do not create unrelated AI tools or feature pages outside this workflow without a clear reason.

## 19. Shared data model

Do not build each stage as an isolated prototype.

The application should use a shared project state.

Core conceptual entities include:

Project
Source
ResearchCategory
Evidence
Claim
Relationship
Dimension
DimensionPosition
ExplorationNode
ExplorationConnection

Objects should use stable IDs so relationships remain intact when objects are edited.

Later implementation may extend these types, but avoid creating duplicate representations of the same conceptual object for different pages.

## 20. AI architecture

Treat the different DAVE capabilities as separate AI tasks.

Do NOT create one giant prompt responsible for the whole design process.

Keep separate instructions/prompts for:

- research intake
- evidence and claim generation
- relationship/tension mapping
- dimension generation
- exploration questioning

These tasks may use the same underlying model/API while having different instructions and supplied context.

The root application coordinates these capabilities.

## 21. AI context

Send the model only the information required for the current task.

Do not repeatedly send the complete project history when structured relevant context is available.

Prefer structured inputs.

For example, dimension generation should primarily receive relevant reviewed claims and relationships rather than raw files when the previous stages have already processed those files.

However, references back to original evidence must remain available for verification.

## 22. Failure behaviour

DAVE must not fabricate successful analysis.

If an AI request fails:

- preserve the existing project state
- show an understandable error
- allow retry
- do not display placeholder AI output as real output

If information cannot be derived from the supplied material, say that there is insufficient evidence.

Never invent research to make the interface appear complete.

## 23. Development approach

Build DAVE incrementally.

Do not attempt to implement the complete application in one pass.

Preferred implementation sequence:

1. application shell
2. shared navigation
3. shared project data model
4. Research interface
5. Research AI integration
6. Relationships interface
7. relationship AI integration
8. Dimensions interface
9. dimension generation
10. tuning interaction
11. Exploration workspace
12. contextual Ask DAVE interaction
13. provenance navigation between stages
14. refinement and testing

Each stage should work before major complexity is added to the next.

## 24. Existing work

Some DAVE functionality may already exist in the repository, particularly Dimensions, dimension tuning, and exploration questioning.

Before replacing existing code:

1. inspect the repository
2. identify reusable components and logic
3. preserve working behaviour where it fits this architecture
4. refactor only when necessary

Do not rewrite functioning features simply to create a cleaner implementation.

## 25. Scope control

Before adding a feature, ask whether it directly helps the core activity:

Helping a design team move from research toward an intentionally chosen and explored design direction while preserving human judgement and research traceability.

If not, do not add it by default.

DAVE is not intended to become:

- a generic chatbot
- a general project-management platform
- an automatic requirements generator
- an autonomous design agent
- a generic image generator
- an AI dashboard
- a collection of unrelated AI features

## 26. Current priority

The immediate goal is to build the unified DAVE application systematically.

Do not begin by implementing every AI capability.

First inspect the current repository and understand:

- existing structure
- existing Dimensions functionality
- existing dimension logic
- existing OpenAI integration
- existing exploration board
- reusable UI components
- current data/state architecture

Then propose the smallest architectural changes needed to support the complete DAVE workflow.

Do not modify files until the current implementation has been inspected and the next implementation step is clear.

Persistent Design Map

DAVE maintains an evolving Design Map across the workflow.
The Design Map is not a separate workflow stage. It is a persistent, optional view of the project's existing entities and their traceable relationships.
A compact Map control should eventually remain accessible from the main workspace. When opened, the map should expand into a large interactive view while preserving the user's current workflow context. Closing it returns the designer to the same stage and work state.
The map must be derived from the shared project data rather than maintaining a duplicate map-specific representation of the project.
As the project progresses, the map may progressively expose:
Sources → Evidence → Claims → Relationships → Dimensions → Exploration
Not every layer must always be visible. The interface should use progressive disclosure to prevent the map from becoming visually overwhelming.
Map connections represent provenance or explicit relationships in project data. They must not imply causality, importance, certainty, or chronology unless the underlying evidence supports that interpretation.
Do not implement the Design Map until the shared data model and enough workflow entities exist to make it meaningful.
