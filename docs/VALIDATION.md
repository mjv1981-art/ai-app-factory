# CHANGE-004 implementation evidence

Release state: **DRAFT — NOT DEPLOYED — LIVE ACCEPTANCE PENDING**.
The owner approved the contract revision at `d6350287c4ac927801d8e4957fc712d8c0118b7c`.
Implementation approval is not evidence that all acceptance criteria have passed.

## Completed checks

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Production Vite build | PASS | Actual compiled application |
| ESLint | PASS | Existing configuration extended to the new server/tests |
| Node unit/integration suite | 17 PASS | Actual PGlite PostgreSQL-compatible SQL, mocked GitHub/model/sandbox boundaries |
| Factory Chromium browser suite | 6 PASS | Real HTTP API, database and browser; test-only authentication and external-service fixtures |
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

## Acceptance status

| Criteria | Current status |
| --- | --- |
| AC-01, routing/usage/scope portions of AC-04–06, AC-11 | Implemented and deterministic tests pass |
| AC-02–03 existing/new-project flows | Implemented; stubbed end-to-end orchestration and real UI tests pass; real repositories pending |
| AC-07 persistence and duplicate delivery | SQL-backed state and claims tested; live service restart/worker recovery acceptance pending |
| AC-08 build/Playwright worker | Container adapter and result gates implemented; actual cloud container execution pending |
| AC-09 QA, repair and release review | Separate provider stages implemented; live role quality and repair acceptance pending |
| AC-10 context | Versioned document retrieval implemented and UI tested; live follow-up request validation pending |
| AC-12 PR and CI | Publishing, exact-commit check lookup and signed CI-event handling implemented; live publishing pending |
| AC-13 security | Unit/integration/browser controls tested; deployed isolation/network and independent security review pending |
| AC-14 regressions | Existing functional/visual regression passes; new tests pass with fixture boundaries stated above |
| AC-15 hosted acceptance | NOT RUN; no deployed URL, configured cloud accounts or test repository authorizations |

## Required before release

- Select/configure free-tier host and durable PostgreSQL; set external spend limits to prevent charges.
- Register/install GitHub App, configure OAuth/webhook secrets, private execution repository,
  reviewed controller SHA, model key and optional repository-creation credentials.
- Verify the actual matching Playwright container image and restricted dependency network.
- Confirm durable database backups and private artifact retention/access policy.
- Complete real onboarding plus a follow-up enhancement for an existing test repository.
- Complete real new-app creation plus a follow-up enhancement for a new private test repository.
- Demonstrate live failure → bounded repair → regression and truthful usage accounting.
- Demonstrate closing the browser/service restart, cancellation and quota exhaustion.
- Confirm draft PR creation and required CI on the exact proposed commit, then human review.
- Run independent QA/release review; this implementation's self-checks are not an independent verdict.
- Record the operational URL only after live evidence passes.

## Known limits

The adapter currently supports Linux npm/Playwright static web apps. Existing Windows-only
baselines in imported projects require a compatible adapter, not automatic regeneration.
Existing test edits, golden promotion, baseline remediation, arbitrary command adapters,
paid-model activation and automatic retention cleanup are not enabled in this MVP.
Static previews disable backend/network access and can reject cyclic/resource-heavy builds.
OpenRouter support/capacity is checked at call time; free-only use can stop when unavailable.
Interrupted ambiguous calls retain reservations and require review, rather than silent replay.
GitHub selected-repository installations may need explicit installation expansion after a
new private repository is created. No live end-to-end success is claimed for that path yet.

The owner approved a broader hosted outcome. These remaining deployment and validation
items mean CHANGE-004 must remain open/draft, not marked complete or merged automatically.
