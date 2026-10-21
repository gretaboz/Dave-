# DAVE Pre-Class Implementation Meeting

Duration: 60 minutes  
Goal: leave with verified repository access, agreed target semantics, owned implementation tasks, and a safe draft-PR path. No merge occurs in this meeting without explicit team approval.

## Before the meeting

- Open the feature branch and draft documentation.
- Have the repository owner available to confirm collaborator and branch-protection settings.
- Bring one concrete research example for the relevance-versus-orientation review.
- Keep `main` and `greta/dimensions` untouched.

## Agenda

### 0–5 minutes — Goal and safety

- Restate the pre-class outcome.
- Confirm feature-branch-only work, no force pushes, and no merge without team approval.

### 5–10 minutes — Access check

- Confirm Greta's repository ownership and `luzpralta` collaborator status.
- Verify authenticated read, feature-branch push, draft-PR creation, and branch protection.
- If any check fails, assign the exact settings change and owner; continue using the local patch.

### 10–18 minutes — Stage boundaries

- Skill 2 maps relationships between research claims; it does not create abstract VSD value tensions.
- Skill 3 converges on a designer-confirmed direction; it does not propose solutions.
- Explore owns divergent ideation.
- Agree that research informs and challenges while the designer decides.

### 18–28 minutes — Direction object and review flow

- Walk through proposed → included/excluded/deferred and designer-added parameters.
- Confirm fixed/adjustable and free-text orientation/undecided.
- Confirm separate relevance and orientation evidence.
- Resolve the display label “expectation–reality gap” versus any legacy storage name.
- Agree what explicit confirmation means and who can perform it in the MVP.

### 28–38 minutes — Evidence examples

- Review `DIR-01`: relevance evidence with no orientation evidence.
- Review `DIR-03`: conflicting orientation evidence.
- Check citation precision, limitation visibility, and one-to-three neutral questions.

### 38–45 minutes — Architecture decision

- Identify reusable provenance, revision-history, snapshot, and Explore code.
- Identify the legacy three-position schema/UI and unsupported confirmation path.
- Agree the smallest vertical slice and migration boundary.

### 45–52 minutes — Assign implementation

- Pair owners with MODEL-01, UI-01/UI-02, FLOW-01/FLOW-02, AI-01, and TEST-01.
- Record dependencies and the order in which work lands on the feature branch.

### 52–57 minutes — Review protocol

- Agree required automated tests and semantic fixture review.
- Confirm draft-PR owner and reviewers.
- Confirm no-merge rule and how approval will be recorded.

### 57–60 minutes — Read-back

- Read back decisions, owners, blockers, and next check-in.
- Confirm the next safe action for every blocked item.

## Decision log template

| Decision | Options considered | Chosen outcome | Rationale | Owner | Due | Fixture or acceptance criterion |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

## Required exit conditions

- Repository access is verified or the exact blocker and owner are recorded.
- Stage boundaries and the AI behavior contract are accepted.
- Direction data and confirmation semantics are agreed.
- Vertical-slice, test, and draft-PR owners are named.
- Protected branches remain untouched.
