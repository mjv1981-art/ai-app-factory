# CHANGE-005 — Guided Factory workspace, progress and recovery

## Change ID

CHANGE-005

## Title

Make Factory work understandable, visible and recoverable from the product interface

## Status

DRAFT — Guided workspace design endorsed; awaiting approval of the complete implementation contract.

The owner's request on 2026-10-02 authorizes redesign planning. The owner confirmed:

- A reviewer objection should lead to a revised plan and another review.
- The first Factory guide should provide explanations and suggested actions, rather
  than a model-backed chat panel.
- The owner endorsed the Guided workspace concept and requested animation plus color
  coding for in-progress stages: "cool, I like that" and "please add some animations
  as well as color coding". This records design feedback; the complete implementation
  contract remains draft.

These decisions do not approve the complete implementation contract. CHANGE-004 and
deployment PR #15 remain separate. No merge is authorized by this proposal.

## Execution profile

STANDARD

## Exact old text

NONE.

## Exact new text

NONE.

## Exact replacement files

NONE.

## Objective

Replace the current collection of raw statuses, similarly styled badges/buttons and
unexplained disabled controls with a guided workspace. At every stage the owner can
answer: What did I start? What is happening? Who acts next? What can I do?

Provide truthful progress and token accounting throughout a run, a readable explanation
of stops, and an explicit revision/review recovery path. Retain the existing hosted
architecture, owner isolation, free-only operation and human-owned release gates.

## Inspected baseline

- Planning source: `plan/hosted-factory-migration` at
  `29c87e1f4dd66167bae02e019d3d439b774013bd`; implementation branch must remain non-protected.
- Current dashboard polls every four seconds. It renders run `status` and `stage`
  primarily by replacing underscores. A single busy flag affects unrelated controls.
- The dashboard already has project/run/usage records, worker heartbeats, verification,
  QA/reviewer verdicts, artifacts, approval hashes, CI results and selected-repository recovery.
- Run stages are overwritten; the dashboard does not expose a complete durable stage timeline.
- Provider calls reserve tokens before dispatch and report actual tokens after completion.
  No token-by-token provider stream exists. Unknown usage retains its reservation.
- Failed-create retry is restricted to certain pre-publication create failures; there is
  no general failed-run clarification/replanning journey in the UI.
- Pull-request readiness checks do not currently track the merged/closed PR state.
- The existing counter example, original tests and Windows visual baseline are protected.
- `docs/PRODUCT_REGRESSION_PACK.md` is the regression source of truth.

## Proposed design

Recommended direction: **Guided workspace**. A delivery board is a layout alternative
for the owner's design feedback; it is not an additional product mode in this contract.

1. Overview prioritizes items needing the owner and work currently running. Start actions
   clearly distinguish an existing repository from a new project. History remains accessible.
2. Project work centers on the selected request, with its objective and one primary next
   action. A graphical stage trail shows planning, approval, building, tests/QA, release
   review and PR/CI. Baseline and repository-access flows have their own applicable trails.
3. A Factory guide beside or below the work explains the current state, its cause and
   valid recovery choices. It is deterministic and derived from recorded evidence.
4. Reported, reserved and unknown token usage are visibly distinct. A usage meter shows
   the allowance as a ceiling. Stage/attempt details and original evidence are expandable.
5. Failed runs open a recovery panel with the original finding and a suggested next action.
   Revision creates a new linked plan and requires fresh approval before execution.
6. Results lead to preview, PR review and exact-commit CI. A confirmed merged PR leads to
   discovering and approving the new baseline before another enhancement.
7. Use a stable semantic palette: blue for work in progress, green for completed gates,
   amber for waiting on the owner, red for a failed/stopped gate, and neutral gray for
   pending, cancelled or unconfirmed activity. Pair every color with explicit text/icons.
   Animate only confirmed in-progress work with a gentle activity spinner and a small
   sweep on the current stage segment. Waiting/error/completed states remain still.
   Motion never increments progress or tokens, respects reduced-motion preferences,
   and can be paused independently of the run.

The interactive planning concept uses labeled demonstration data and performs no real
provider, cloud, approval, cancellation, repository or merge operations.

## Execution milestones

1. M1 — Define and test the presentation model for every existing run/project state,
   typed failure categories, valid next actions and freshness. Produce a reviewed state map.
2. M2 — Add bounded durable stage/recovery events and owner-scoped read APIs. Record
   transitions and timing without recording every heartbeat as a timeline event.
3. M3 — Implement the guided overview, project workspace, progress trail, usage meter,
   scoped action feedback and deterministic Factory guide. Preserve existing journeys.
4. M4 — Implement owner-entered clarification and linked replanning/recovery with explicit
   approval, current repository authorization, idempotency and conservative usage handling.
5. M5 — Track PR open/closed/merged state using authenticated GitHub reads, expose the
   accepted-baseline handoff, and keep required CI tied to the actual proposed commit.
6. M6 — Validate desktop/mobile/keyboard journeys, original regressions, failure/recovery
   isolation and usage integrity. Record reviewable evidence before any deployment.
7. M7 — After required checks and release review pass, deploy within the existing $0 setup and
   exercise the running, waiting, recovery and result journeys on designated test projects.
   Record hosted evidence separately from deterministic fixtures; leave PRs unmerged.

## In scope

- Redesign `/factory` login/setup, overview, project work, plan approval, run detail,
  recovery, usage and knowledge navigation using the existing React/CSS stack.
- Clearly separate noninteractive status text/icons from actions; statuses are not buttons.
- Friendly project names, request titles, stage names and responsibilities, with technical
  identifiers, raw diagnostics, provenance and complete contracts in secondary detail views.
- Stage-based progress, server-recorded elapsed time and heartbeats, last successful
  update, connection/stale indicators and durable event history.
- Consistent color-coded stages and restrained in-progress activity animation, with
  reduced-motion behavior and a pause-motion control independent of job cancellation.
- Token/call/time allowance displays and per-stage usage that preserve reported,
  reserved, uncertain and zero-cost distinctions.
- Deterministic explanations and supported recovery actions for review stops, verification
  failures, malformed provider output, rate/capacity limits, exhausted allowances,
  repository access, stale approval/base commit, dispatch failure and uncertain workers.
- Owner-authored plan clarification and linked recovery for both create and enhancement
  runs. Builder, QA and reviewer run again as required by the approved revision.
- Read-only PR lifecycle reconciliation and explicit post-merge baseline discovery/approval.
- Accessible responsive design and corresponding regression coverage/documentation.
- Deployment on the already authorized Render Free, Neon Free and private GitHub Actions
  services after review; no new hosted service, subscription or paid model.

## Out of scope

- A new model-backed mediator/chat agent. The initial guide makes no provider calls.
- Approving a rejected implementation by overriding QA, reviewer, scope or required-CI gates.
- Changes to routing profiles, model selection, paid fallback, spending ceilings,
  foundational tests, screenshots, sandbox or authentication policy.
- Literal live token counts during an unfinished provider call, unsupported percentages,
  invented time estimates or a claim of continuous streaming.
- Editing the target checklist application as part of the Factory redesign.
- Automatic merge, production release of target applications or branch-protection changes.
- Dependencies, CI workflow, Docker/build-image, environment secret or database schema changes.
- Galaxy Capital changes; original counter-example changes; organizational multi-tenancy.

## Acceptance criteria

- AC-01: An idle owner sees distinct new-project and connect-repository start actions.
  A project without an approved baseline has an explicit explanation and the valid
  discover/review/approve action instead of an unexplained disabled enhancement button.
- AC-02: Each run shows its requested objective, current activity, who acts next, and
  the valid next action. Waiting for approval/access/CI, working, failed, cancelled,
  completed, unsupported and uncertain states remain distinguishable without color alone.
- AC-03: Active runs show an applicable graphical stage trail with completed, current,
  pending and skipped/not-applicable stages. Repair loops are visible. A completed-stage
  count is not represented as percentage of remaining time. Baseline and FAST_EXACT
  runs do not falsely claim model stages were executed.
- AC-04: The UI refreshes at the existing four-second interval, shows last successful
  update and worker freshness separately, and retains the last known state on a failed
  refresh. It visibly labels unconfirmed/stale activity rather than inferring success.
  Background jobs continue after the owner leaves the browser.
- AC-05: Progress history persists across browser reload and service restart. Events
  record stage entry/exit or stop, server timestamps, attempt/recovery relationships
  and relevant evidence references. Duplicate delivery does not duplicate transitions
  or recovery runs. Event payloads are bounded; heartbeats do not grow history.
- AC-06: Run/project usage shows provider-reported totals, pending reservations, uncertain
  usage, known cost and unknown cost separately. During a model call the UI states that
  actual usage is pending; totals update when accounting completes. No fabricated per-second
  counter, double-counted cached/reasoning tokens or hosting-billing claim is introduced.
- AC-07: The Factory guide explains what happened, why the process is waiting/stopped,
  and available actions from recorded run/project facts and typed codes. Reviewer/QA
  findings remain available with provenance. Unknown causes have a neutral explanation
  and evidence link, not a guessed diagnosis or hidden provider call.
- AC-08: A failed run permits clarification when safe to replan. The owner can inspect
  the finding and submit a clarified objective. The service creates a linked new plan
  using the current authorized repository/base and project context, preserves the old
  run/evidence/spent usage, and requires approval of the new plan hash before execution.
  A revised file scope cannot reuse old approval.
- AC-09: New-project recovery retains idempotent provisioning and explicit selected-repo
  access checks; it cannot create duplicate repositories or convert the private repository
  to public. Enhancement recovery respects the approved baseline and current base SHA.
- AC-10: An ambiguous provider completion or active/stale worker cannot be replayed
  merely by pressing a recovery button. The owner sees the uncertainty and reservation.
  Reconciliation/cancellation and fresh authorization precede safe new work. A stopped run
  never becomes ready by a UI-only override. Model/QA/reviewer/test gates remain enforced.
- AC-11: A recovery action is validated on the server against current run status, owner,
  project, revision and repository authorization. Duplicate submissions are idempotent.
  Proposed allowance changes remain subject to approval and the unchanged $0/free-only policy.
- AC-12: Busy feedback applies to the action/run in progress. Other navigation remains
  usable. Unavailable actions show the prerequisite in visible text. Approval identifies
  its scope/revision and consequences; cancellation explains already-sent calls may finish.
- AC-13: Preview and raw artifacts remain owner-scoped and sandboxed. Ready-for-review
  requires passing required checks on the actual PR head. Merged/closed status comes from
  authenticated GitHub evidence; dashboard refresh does not merge or approve anything.
  A merged result exposes discover/review/approve-baseline steps. A closed unmerged PR
  is not represented as accepted work.
- AC-14: Knowledge, conversations, prior runs, verification and detailed per-attempt
  usage stay reachable; proposed PR documents are distinguished from the accepted baseline.
- AC-15: The redesigned Factory is usable at 320, 390, 736 and 1024 CSS pixels without
  horizontal overflow. Native keyboard access, visible focus, readable contrast, labelled
  fields/statuses and reduced-motion preferences are respected. Screen-reader announcements
  report stage/action changes without announcing every polling tick.
- AC-16: Existing Factory and original counter regression expectations pass. Selector/copy
  updates to Factory tests preserve each original assertion's behavioral intent; no tests
  are removed/weakened and no original golden baseline is promoted.
- AC-17: Hosted acceptance demonstrates an owner understanding and completing start,
  approval, running, stopped/revised/reapproved and ready-for-review steps, plus the
  post-merge baseline handoff on a designated test app. Evidence distinguishes real
  provider/worker runs from simulated UI fixtures. All generated PRs remain human-owned.
- AC-18: Confirmed active stages use blue activity indicators and gentle motion;
  completed gates are green, owner waits amber, failed/stopped gates red, and pending,
  cancelled/unconfirmed states gray. Text/icons carry the same meaning. Animation
  stops when work pauses, finishes, fails, is cancelled or becomes unconfirmed; hidden
  panels do not animate. Reduced-motion preferences disable nonessential motion, and
  a pause-motion control leaves processing and progress updates untouched. Activity
  motion never simulates a completion percentage, token count or elapsed-time estimate.

## Regression scenarios

- REG-001: All baseline journeys in `docs/PRODUCT_REGRESSION_PACK.md` remain functional.
- REG-002: Baseline discovery/review, new-app plan/access handoff and enhancement approval
  each expose the correct next action; no action falsely claims a baseline was approved.
- REG-003: Queued, building, verification, QA, repair and review progress survive reload;
  failed polling or stale heartbeat shows uncertainty and does not trigger another job.
- REG-004: Deterministic exact edits show no model usage and skip irrelevant agent stages.
- REG-005: Reported, reserved, uncertain, rate-limited, cancelled and free-model usages
  retain their original accounting semantics through recovery and UI refresh.
- REG-006: A QA/reviewer stop displays findings and linked revision/approval; current
  code changes invalidate stale approval; unauthorized paths still block publication.
- REG-007: Concurrent recovery clicks, worker retries and repeated webhook notifications
  create no duplicate run/provisioning/publication. Cross-owner access/forged requests fail.
- REG-008: Missing/failing exact-commit CI cannot become ready; merged and closed-unmerged
  PRs take distinct paths; post-merge baseline is checked and explicitly approved.
- REG-009: Preview isolation, CSRF, session/secret boundaries and protected tests remain intact.
- REG-010: Desktop/mobile/keyboard coverage exercises guidance, progress, recovery and
  a complete result handoff. The original home and approved Windows screenshot are unchanged.
- REG-011: In-progress motion/color matches the server stage. Waiting/failure/stale and
  terminal states stay still. Pausing animation does not cancel/submit jobs or alter
  accounting; reduced-motion mode keeps all status information visible.

## Files/areas likely affected

Product files authorized on approval:

- `src/factory/Factory.jsx`
- `src/factory/factory.css`
- `src/factory/RunWorkspace.jsx`
- `src/factory/ProgressTrail.jsx`
- `src/factory/RecoveryPanel.jsx`
- `src/factory/FactoryGuide.jsx`
- `src/factory/UsageMeter.jsx`

Tests/documentation authorized on approval:

- `tests/unit/run-view.unit.mjs`
- `tests/integration/recovery.integration.mjs`
- `tests/integration/engine.integration.mjs`
- `tests/integration/store.integration.mjs`
- `tests/integration/support.mjs`
- `tests/factory/dashboard.pw.mjs` (preserve behavioral assertions; adapt selectors/copy)
- `tests/factory/guided-workspace.pw.mjs`
- `tests/factory/fixture-server.mjs`
- `docs/FACTORY_UX.md`
- `docs/PRODUCT_REGRESSION_PACK.md`
- `docs/HOSTING.md`
- `docs/VALIDATION.md`
- `changes/CHANGE-005-guided-factory-workspace.md` (approval/evidence record only)

Protected controller changes are limited to the exact infrastructure list below.
Any additional path requires a contract amendment before modification.

## Infrastructure changes authorized?

YES — upon approval of this contract, limited to the following existing-architecture changes.

## Authorized infrastructure files

- `factory/run-view.mjs` — shared deterministic state/failure/action presentation model.
- `factory/recovery.mjs` — validation of recovery eligibility and revision relationships.
- `factory/provider.mjs` — typed provider failure metadata; preserve bounded free-only accounting.
- `server/service.mjs` — scoped progress reads, linked replanning, PR lifecycle reconciliation.
- `server/store.mjs` — bounded durable event/recovery records in existing JSON collections.
- `server/http.mjs` — authenticated owner-scoped event/replan/read-only PR-state endpoints.
- `server/github.mjs` — authenticated read of PR lifecycle and exact head; no merge API.
- `worker/engine.mjs` — stage events, typed stop metadata and recovery context.

No CI/config/dependency/schema, hosted plan, secret, sandbox or paid-resource changes authorized.

## Visual changes authorized?

YES — `/factory` only, as requested. Guided-workspace layout is proposed for approval.

## Baseline changes authorized?

NO.

## Authorized baseline files

NONE.

## Evidence expectations

- `npm run lint`, `npm run build`, `npm run test:factory`, `npm run test:factory-ui`.
- Original functional/visual regression on its existing Windows platform with unchanged baseline.
- UI screenshots of start, approval, active progress, blocked/revision, usage uncertainty,
  ready and merged/baseline states; screenshots are review evidence, not promoted goldens.
- Browser evidence verifies animation in an active state, stillness after a stage change,
  pause/resume motion behavior, and reduced-motion rendering in both theme appearances.
- Deterministic recovery integration tests demonstrating stale/duplicate/cross-owner rejection
  and unchanged publication/accounting gates; no paid model calls in CI.
- A readable state map and staged test evidence in the documentation.
- Hosted smoke/live walkthrough with release/worker commit references and $0 records after review.
- Owner feedback on whether next actions and failures are understandable, plus independent
  QA/release assessment required by the repository's governance before release readiness.

## Risks

- Free-model responses can still fail or be unavailable. Recovery improves explanation
  and control; it does not promise success or unlimited inference.
- A stage count is not a duration estimate. Reserved usage is not confirmed consumption.
- Polling can show delayed data. Freshness and uncertainty must be visible.
- Replanning may discard an unpublished candidate and rebuild from the accepted/current base;
  the UI must explain this before approval and preserve original evidence/usage.
- PR-state reads consume GitHub requests; bound refresh/reconciliation and tolerate failures.
- History must remain bounded under Neon Free and the existing private artifact cap.
- A deterministic guide can explain only recorded facts. Unknown findings must remain unknown.
- CHANGE-004 has remaining live acceptance tasks; this change does not certify their completion.

## Human visual approval

Guided workspace concept endorsed by the owner on 2026-10-02, with the requested
color/motion refinement incorporated. Approval of the complete implementation contract
is still pending. No visual-baseline files are authorized for promotion.
