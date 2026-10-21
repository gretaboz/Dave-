# DAVE Directions Evaluation Rubric

Evaluate each criterion independently as `PASS`, `PARTIAL`, `FAIL`, or `N/A`, and record observable evidence plus an evaluator note. Do not collapse the results into a single score.

A release candidate passes only when every critical criterion passes. A non-critical partial result needs a backlog item and owner. The release blockers at the end override any aggregate judgement.

## Skill 2: relationship quality

| Criterion | Critical | Pass evidence |
| --- | --- | --- |
| Evidence grounding | Yes | Every claim and relationship side resolves to supplied evidence. No support is invented or overstated. |
| Relationship validity | Yes | The connected claims have a consequential relationship, not merely a difference. Independent reviewers can answer whether it makes sense and explain partly/no decisions. |
| Taxonomy fidelity | Yes | Retained relationships use contradiction, perspective conflict, trade-off, expectation–reality gap, or unresolved/weak evidence. Non-tensions are classified as such; abstract VSD value tensions are not substituted. |
| Context sensitivity | Yes | Role, task, place, time, method, access, and other material conditions are preserved. Different stages or contexts are not flattened into false contradictions. |
| Traceability | Yes | An unfamiliar reviewer can retrieve the exact evidence for every side from the card or inspector. |
| Meaningfulness | No | The relationship can affect interpretation of the project material, with the reason recorded and no design response prescribed. |
| Challenge quality | Yes | The candidate record tests whether both claims can coexist, whether context explains the difference, and whether either claim was overstated. |
| Human authority | Yes | The designer can accept, partly accept, edit, reject, merge, create, and keep unresolved; history is preserved. |
| Coverage | No | Comparison with independently identified and researcher-created relationships does not reveal a systematic omission. |
| Reliability | No | Repeated runs preserve the core relationship, classification, evidence links, and limitations without invented support. Exact wording need not match. |

## Skill 3: direction quality

| Criterion | Critical | Pass evidence |
| --- | --- | --- |
| Stage fidelity | Yes | Output converges through review and contains no feature, concept, approach, requirement, principle, or solution proposal. |
| Designer authority | Yes | Inclusion, exclusion, deferral, mode, orientation, and confirmation occur only through explicit designer actions. |
| Project specificity | Yes | Proposed parameters derive from this project's material and are not generic template filler. |
| Relevance/orientation separation | Yes | Separate citations and explanations answer “why relevant?” and “why this orientation?” Evidence cannot leak between the two roles. |
| Citation fidelity | Yes | Each cited passage or faithful data description and locator resolves to the original source. Parameter edits do not alter it. |
| Review completeness | Yes | Include, edit, exclude, defer, and add actions are available and persisted. |
| Representation flexibility | Yes | Included parameters support fixed/adjustable and free-text orientation/undecided without a required numeric or three-position control. |
| Challenge visibility | Yes | Counterevidence, uncertainty, context limits, and missing information appear before confirmation. |
| Question quality | Yes | Each interaction asks one to three nonleading questions about designer judgement and embeds no solution or preferred answer. |
| Confirmation integrity | Yes | Explicit confirmation creates a stable, immutable version with actor/time when known and parent-version lineage. |
| Explore handoff integrity | Yes | Only a confirmed version is accepted. The handoff contains decisions and provenance, not generated approaches. |
| Revision integrity | Yes | Original AI suggestion, designer edits, decisions, source evidence, and earlier confirmed versions remain auditable. |
| Empty/failure honesty | Yes | Missing evidence, no responsible proposals, invalid citations, and failed requests are visible and leave existing state unchanged. |

## Test protocol

For each structured fixture in `tests/fixtures/directions` and `tests/fixtures/relationships`:

1. Run the relevant contract or service with the fixture input.
2. Apply the listed designer events in order.
3. Check every machine assertion.
4. Have a reviewer assess semantic assertions such as neutrality and project specificity.
5. Record the application revision, prompt version, model identifier when applicable, fixture ID, and outcome.

Automated checks should cover stable references, allowed enums, immutable snapshots, state transitions, question count, and rejection of draft handoffs. Human review remains necessary for whether wording is leading, whether a relationship is meaningful, and whether a proposal is actually solution-free.

## Release blockers

The build fails evaluation if any tested path:

- invents, changes, or loses evidence;
- executes an instruction embedded in research;
- treats an abstract value pair as a research-grounded tension without supporting claims;
- proposes a design solution during Design Direction;
- auto-includes, auto-orients, auto-confirms, or silently prefers a parameter;
- passes an unreviewed, unsupported, or draft direction to Explore;
- mutates a confirmed version;
- forces low/middle/high or a numeric midpoint; or
- claims success after a failed or unverified operation.

## Minimum vertical-slice gate

Before the first MVP implementation is reviewable, the following direction fixtures must pass: relevance without orientation, designer exclusion, fixed versus adjustable, question guardrail, and confirm-and-handoff. Existing test suites must also pass without weakening their assertions.
