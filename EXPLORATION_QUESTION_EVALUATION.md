# Exploration question evaluation

Tested 20 October 2026 with the existing configured model and API backend.
These are synthetic workshop projects, not claims about real user research.
No saved DAVE project was changed. Fixtures:
[explorationWorkshop.mjs](tests/fixtures/explorationWorkshop.mjs).

Nine live questions were generated for each of three prompt iterations. The first
run exposed a seed-library opening that assumed a visual solution and a challenge
that simply removed part of the proposed idea. The prompt was revised to keep
initial approaches open and test developed ideas in plausible use situations.
A final grounding check also caught hypothetical scenarios labelled as research
findings; the server now requires assumption challenges to be marked inferred.
The questions below are the final run, reproduced without editing.

## Generated examples

| Project | Purpose | Generated question |
| --- | --- | --- |
| Citrus press | Open possibilities | What different ways could you sketch for getting pulp out of the citrus press with minimal hand effort? |
| Citrus press | Explore alternatives | What could you try instead of a removable pulp tray to collect pulp with minimal hand effort, considering the small gaps where pulp tends to stick? |
| Citrus press | Challenge assumptions | Would this removable pulp tray still work smoothly if a user had only one hand free to slide it out by the broad tab? |
| Cycling bag | Open possibilities | What could you sketch for the bag to look normal in daylight but show details that catch drivers' attention at night? |
| Cycling bag | Explore alternatives | What could you try instead of putting reflective material on the outside of the bag? |
| Cycling bag | Challenge assumptions | Would the reflective strips still be visible if the cyclist wore a jacket with a backpack over the shoulder straps? |
| Community seed library | Open possibilities | What could you sketch to help first-time borrowers decide which seeds to plant in small pots? |
| Community seed library | Explore alternatives | What could you try instead of showing the plant only in a pot picture on each seed packet? |
| Community seed library | Challenge assumptions | Would this still work if a visitor with no gardening experience had to pick seeds while in a hurry? |

## Review against the six criteria

- **Immediate understanding:** All use ordinary project terms. The citrus-press
  alternative is 26 words and could still be shorter.
- **Project relevance:** Press questions address pulp and hand effort; bag questions
  address night visibility and daytime appearance; seed-library questions address
  independent seed selection for pots.
- **Concrete activity:** The press prompts invite tray sketches and a one-handed
  handling trial. The bag prompts invite alternate placement sketches and a clothing/carrying
  walkthrough. The seed-library prompts invite service sketches, other ways to
  explain seed choice, and a walkthrough under time pressure.
- **Multiple answers:** None supplies a mechanism or final solution. The tray, bag and seed questions
  open alternatives to the chosen approach. Conditional challenges invite changes
  after a walkthrough, rather than asking for unsupported outcome predictions.
- **Designer control:** Initial questions do not assume reflective strips, a tray
  or packet pictures. Those appear only after the synthetic designer supplied them.
  Sketching is a thinking activity, not a chosen product feature.
- **Stage fit:** All three initial questions open possibilities, all first-idea
  follow-ups explore alternatives, and all developed-idea follow-ups challenge a
  concrete use situation. Hypothetical challenges were marked inferred.

Each result retained a confirmed dimension-position reference and valid supplied
research references. Inferred scenarios retained their limitations. Automated
tests also cover cross-branch isolation, replacement-question parent context,
snapshot immutability, provenance, failed-check revision and honest failure.

This small sample supports the workshop approach but does not establish reliable
quality for every project or future generation. The six model-reported checks are
self-review, not an independent quality measurement. The conditional challenges
are useful only when designers actually enact or investigate the situation.


## Verification

- 65 unit/server tests passed.
- All nine final live generation cases passed purpose, project-context, confirmed
  position and grounding checks, followed by the qualitative review above.
- Five targeted Exploration browser tests passed, including branch isolation,
  cards, connections, metadata and persistence. The full browser suite passed 32
  of 33 tests. Its Research Demo test still requests the removed “Reject category”
  button; that pre-existing Research interface change was outside this task.
- TypeScript checking, production build and Git whitespace checking passed.
- No branch switch, commit or push was performed.

The cycling-bag challenge introduces an additional backpack as an explicit
hypothetical. That may be less relevant for some bag types than testing a coat
covering the straps. This remains a designer-reviewed prompt, not a verified
problem with the concept. The live fixtures help expose this kind of limitation.
