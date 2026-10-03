# CHANGE-005 guided workspace evidence (2026-10-03)

Release state: **M1–M6 REVIEW PASSED — INITIAL DEPLOYMENT VERIFIED; HOSTED ACCEPTANCE IN PROGRESS**.
The owner approved the complete contract at
`e49d84e61a80662298ffd8972067c48db2d742ac` and authorized independent read-only QA and
release review. Redesign PR #16 is stacked on the unmerged migration PR #15.
Neither PR may be merged by the Factory. Galaxy Capital was not changed.

## Deterministic checks

| Check | Result | Evidence boundary |
| --- | --- | --- |
| ESLint | PASS | Existing configuration unchanged |
| Production Vite build | PASS | Compiled guided Factory assets |
| Node unit/integration suite | 49 PASS; 0 skipped | Actual PGlite SQL; mocked GitHub, model and sandbox boundaries |
| Factory Chromium suite | 18 PASS; 0 skipped | Actual HTTP service/database/browser, fixture authentication and external services |
| Original counter functional / visual | 2 PASS | Unchanged assertions and Windows golden image; isolated temporary port configuration |
| Whitespace/scope check | PASS at local checkpoint | All changed paths are explicitly permitted by CHANGE-005 |

Browser coverage preserves all seven original Factory journeys and adds eleven for fresh
animation, motion pause, reduced motion, failed polling, review-stop clarification and
fresh reapproval, uncertain usage/stale worker refusal, exact-profile stages, merged/closed
handoffs, legacy diagnostic rendering, scoped feedback and keyboard controls. Both themes
pass at 320, 390, 736 and 1024 CSS pixels. Screenshots are review evidence, not golden promotions.

Recovery coverage includes concurrent idempotency, owner/revision/access/current-base
guards, superseded approval refusal, retry/replan exclusivity, unchanged accounting,
bounded stage/knowledge history, current-claim cancellation acknowledgement, late PR
publication after cancellation, actual PR-head CI, lifecycle retention when CI cannot be
read, and refusal to certify a changed or unknown recovered candidate. Structured QA/review
diagnostics with object-valued fields are rejected after bounded accounted format attempts.

The presentation state map and operational limitations are in docs/FACTORY_UX.md.
No dependency, authentication, sandbox, schema, paid-model, CI configuration, protected
counter test or visual-baseline change is included. No local validation made paid model calls.

## Acceptance and review boundary

Independent read-only QA returned **PASS** for M1–M6 / AC-01–16 and AC-18 and independently
reran all 47 Node tests with no failures/skips. Independent release review returned
**SAFE_TO_REVIEW**, approving the exact 27-file set. Neither found remaining blocking
issues after correction of the publication/access/worker races. Passing fixtures does not establish AC-17.
M7 / AC-17 requires the reviewed exact commit on the existing hosted service and private
worker, followed by owner-assisted start, approval, active, stopped/revised/reapproved,
ready-result and post-merge baseline journeys on designated test projects.

The initial reviewed redesign at `8e4277606ff9461f20b3db47b3da5232ef404dc6` passed
[Factory CI](https://github.com/mjv1981-art/ai-app-factory/actions/runs/37070035007) and
[original Windows QA](https://github.com/mjv1981-art/ai-app-factory/actions/runs/37070092805).
On 2026-10-03, existing Render Free service deployment `dep-db0b5t6gekts738uhcfg`
became live from `codex/factory-guided-workspace`; the private worker was pinned to
that same commit. Auto-deploy remains off. Both Render and Neon connections work.
The signed-in owner dashboard is genuinely accessible at `/factory`.

Real baseline run `ea423fa5-88d6-4fb0-8179-91b9abdf7e83` on the designated new-app
test repository passed its build/browser checks and reached `baseline_review`.
Live testing exposed a post-merge defect: recurring merge reconciliation invalidated
an unapproved but current discovery, and the prerequisite masked a running worker.
The follow-up keeps queued/running/stale guidance truthful and atomically invalidates
only a mismatched baseline in the latest owner-scoped row. It cannot overwrite a
concurrent worker discovery or approve it. Two additional regression cases cover
the activity states, both concurrent-write boundaries, repeat polling, explicit
approval and later repository advancement. Independent QA reran all 49 Node tests;
the 18 browser tests passed. Exact-commit CI, deployment and hosted confirmation of
this follow-up remain pending at this source checkpoint. No new resource, paid
fallback, payment method, secret or schema change was made.

Neon confirms the new-app test project's post-merge discovery reached `baseline_review`
at `f3b5221936721dfd3c5df5c9cbeb273fc618805b` with approval false. The redesign must show
that explicit owner decision instead of implying baseline acceptance.

## CHANGE-004 historical implementation evidence

Release state: **DRAFT — DEPLOYED — LIVE ACCEPTANCE PARTIAL; HUMAN MERGE REQUIRED**.
The owner approved the contract revision at `d6350287c4ac927801d8e4957fc712d8c0118b7c`.
Implementation approval is not evidence that all acceptance criteria have passed.

## Completed checks

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Production Vite build | PASS | Actual compiled application |
| ESLint | PASS | Existing configuration extended to the new server/tests |
| Node unit/integration suite | 21 PASS | Actual PGlite PostgreSQL-compatible SQL, mocked GitHub/model/sandbox boundaries |
| Factory Chromium browser suite | 7 PASS | Real HTTP API, database and browser; test-only authentication and external-service fixtures |
| Original counter functional test | PASS | Original unchanged assertion file, Windows Chromium |
| Original visual regression | PASS | Existing unchanged Windows baseline; no snapshot promotion |
| PowerShell parsing | PASS | Hosted API clients, telemetry helper and self-test script |
| Scope/whitespace review | PASS at implementation checkpoint | No original tests, golden image, existing QA workflow or Playwright config changed |

The original Playwright config reuses port 5173 outside CI. An unrelated app was already
running there, causing an initial wrong-application failure. The suite was rerun using an
ignored temporary config which imported the original configuration and changed only the
server URL/port and output locations. Both original tests passed on isolated port 4311.
No assertion, screenshot threshold, viewport, baseline, or committed original config changed.

The Factory UI suite initially found that inherited CSP blocked preview scripts. The fix
serves the authenticated preview as a separately sandboxed HTTP document with no network
access. The browser now verifies that the preview script executes but cannot access the
parent control application. An initial test-server port conflict was resolved by selecting
a different test port; the unrelated app was left running.

Coverage includes deterministic exact-edit eligibility, behavior/markup rejection, path
traversal and secret-path rejection, infrastructure authorization, immutable existing tests
and baselines, unknown usage reservations, concurrent accounting, duplicate job claims,
cancellation preservation, stale approval rejection, provider interruption, free-only policy,
both project entry paths, baseline failure, artifact owner isolation, encrypted sessions,
webhook-signature rejection, preview isolation, CSRF, mobile layout and project decisions.

## Live hosted acceptance (2026-10-02)

The authenticated Factory is reachable at
`https://ai-app-factory-mjv1981.onrender.com/factory`. Render service
`srv-dau0vd1srm7s73acu9cg` ran on the Free instance type with no payment method attached,
auto-deploy disabled and the reviewed release SHA pinned in the private worker repository.
The validated runtime code was commit `f48e5804e694d2e0320a3e1b911750af98b52317`
on Render deploy `dep-davr5vegekts73f5bbtg`. `/health` and `/factory` returned HTTP 200.

Durable state used the Neon Free project `gentle-cloud-92920568`, branch
`br-soft-tree-b4d7udsi`, database `neondb`. Private execution used
`mjv1981-art/private-factory-runs`. GitHub Actions budgets were set to USD 0 with
"Stop usage" enabled, and the Factory rejected paid model fallback. Every live model
usage record below reported `costUsd: 0`.

The existing-project path was exercised against the private repository
`mjv1981-art/factory-live-existing`:

- Baseline discovery run `d8d08bf5-a345-4b4e-bc5c-dec07d06cece` passed.
- FAST_EXACT enhancement run `b37d01ed-a222-421f-9819-ced0d0766608` produced draft
  pull request `mjv1981-art/factory-live-existing#1` at exact commit
  `6724d3cb1698c3d160da9772c2322380fa663811`.
- The proposed file set was limited to `src/App.jsx` plus the generated Change Contract.
  Required `playwright` CI passed on the exact commit. The pull request remains unmerged.

The new-project path was exercised against the private repository
`mjv1981-art/factory-live-new-20261002`:

- Approved create run `f7a43c4f-096d-46d9-8acf-9b08ea2e7a39` created the repository,
  paused for selected-repository GitHub App access and resumed without creating a duplicate.
- The first release review correctly rejected an inexact file set. Retry
  `0a695efe` then exposed malformed Builder JSON; retry `738d7f4a` exposed a second
  length-truncated response. These were terminal and cost USD 0 rather than silently
  replaying ambiguous provider calls.
- Successful bounded retry `4f42d721-c71f-41cd-8a81-fc8ba7ee85c1` ran in private
  GitHub Actions run `37016361203`. Build and Playwright verification passed with three
  expected passes, no unexpected results, no skipped tests and no flaky tests. Independent
  QA passed every criterion. Release review returned `SAFE_TO_REVIEW` and approved the exact
  18-file initial commit.
- At the initial acceptance checkpoint, draft pull request `mjv1981-art/factory-live-new-20261002#1` was open and unmerged at
  exact commit `7d242a3fa218150817d1decc49190155ff4055f1`. Required `playwright` CI passed for
  both push and pull-request events on that commit. The authenticated preview artifact
  `cdc81d7f-ace1-49a8-90f1-e1f1a695349e` contains the working launch checklist.

The owner subsequently merged that generated app PR on 2026-10-02. The merged baseline
was discovered again and is waiting for explicit approval as recorded above. The following
CHANGE-004 table is the historical initial acceptance boundary; it is not a current claim
that this generated app PR remains open or that the redesign has passed hosted acceptance.

The live failures led to three controller fixes on the hosted branch: selected-repository
pause/resume and idempotent creation (`f9f2e7de`), bounded release-review retry plus manual
retry of an approved failed create (`ba3560e6`), and compact Builder output with
role-specific structured-output validation and one verified-free correction attempt
(`f48e5804`). These fixes were covered by the local suites and by PR #15 GitHub CI before
the final live run.

## Acceptance status

| Criteria | Current status |
| --- | --- |
| AC-01, routing/usage/scope portions of AC-04–06, AC-11 | Implemented and deterministic tests pass |
| AC-02 existing-project flow | Live baseline, approved enhancement, draft PR and exact-commit CI passed |
| AC-03 new-project flow | Live private repository creation, access handoff, implementation, QA, release review, preview and draft PR passed; post-merge enhancement remains pending human merge |
| AC-07 persistence and duplicate delivery | SQL state survived browser closure and Render deployments; selected-repository resume created no duplicate repository or PR; explicit live cancellation and quota exhaustion remain pending |
| AC-08 build/Playwright worker | Actual private GitHub Actions container execution passed for both live paths |
| AC-09 QA, repair and release review | Live independent QA and release review passed; bounded reviewer/provider-format retries were exercised; a live deterministic implementation repair remains pending |
| AC-10 context | Versioned retrieval is implemented and UI tested; new-project follow-up remains blocked on human merge of the initial draft PR |
| AC-12 PR and CI | Live draft PR publication and required CI passed on both exact proposed commits |
| AC-13 security | Unit/integration/browser controls tested; deployed isolation/network and independent security review pending |
| AC-14 regressions | Existing functional/visual regression passes; new tests pass with fixture boundaries stated above |
| AC-15 hosted acceptance | PARTIAL; deployed existing/new-project acceptance passed through unmerged draft PRs, with the remaining scenarios listed below |

## Required before release

- Confirm durable database backups and private artifact retention/access policy.
- After human merge of the generated new-app pull request, complete its follow-up
  enhancement and re-run exact-commit CI. The Factory must not perform that merge.
- Demonstrate an implementation failure followed by deterministic repair and regression.
- Demonstrate live cancellation and quota exhaustion.
- Complete an independent final security/release review of the hosted system and its
  artifact-retention operation.

## Known limits

The adapter currently supports Linux npm/Playwright static web apps. Existing Windows-only
baselines in imported projects require a compatible adapter, not automatic regeneration.
Existing test edits, golden promotion, baseline remediation, arbitrary command adapters,
paid-model activation and automatic retention cleanup are not enabled in this MVP.
Static previews disable backend/network access and can reject cyclic/resource-heavy builds.
OpenRouter support/capacity is checked at call time; free-only use can stop when unavailable.
Interrupted ambiguous calls retain reservations and require review, rather than silent replay.
GitHub selected-repository installations may need explicit installation expansion after a
new private repository is created. The live handoff succeeded, but remains a manual owner
step because GitHub cannot pre-authorize a repository that does not yet exist.

The owner approved a broader hosted outcome. These remaining deployment and validation
items mean CHANGE-004 must remain open/draft, not marked complete or merged automatically.
