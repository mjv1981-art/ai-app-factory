# CHANGE-004 implementation evidence

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
- Draft pull request `mjv1981-art/factory-live-new-20261002#1` is open and unmerged at
  exact commit `7d242a3fa218150817d1decc49190155ff4055f1`. Required `playwright` CI passed for
  both push and pull-request events on that commit. The authenticated preview artifact
  `cdc81d7f-ace1-49a8-90f1-e1f1a695349e` contains the working launch checklist.

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
