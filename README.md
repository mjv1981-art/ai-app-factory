# AI App Factory

A Product Manager workspace for describing apps and enhancements, approving scope,
following implementation and tests, and reviewing usage and results.

**Status: implementation in progress under approved CHANGE-004. No live hosted URL yet.**
The dashboard route is `/factory`; it becomes usable after the hosted API, database,
GitHub App, private execution jobs and model provider are configured and live acceptance passes.
The original counter example remains at `/` with its existing regression tests and screenshot.

## Workflow

Connect an existing repository → discover and approve its baseline → describe an enhancement →
review a plan → approve its revision → cloud build and Playwright → independent QA and bounded
repair → release review → draft PR and required CI → human merge.

New projects start with an app brief and a private React/Vite repository plan. The same
enhancement workflow applies after the initial PR is merged and its baseline approved.

## Implemented components

- Dedicated React dashboard: projects, request conversation, plan approval, runs, usage,
  project knowledge, artifacts and isolated static previews.
- Generic FAST_EXACT/FAST/STANDARD controls adapted from the Galaxy Capital Factory.
- PostgreSQL run state and approval hashes; transactional token reservations, unknown usage,
  call/time limits, free-only OpenRouter requests and bounded repair.
- GitHub App login with PKCE and encrypted sessions; selected-repository authorization;
  a separate private repository for hosted execution.
- Disposable target-code containers separated from provider, database and publishing secrets.
- Existing/new-project orchestration, immutable existing tests and snapshots, scoped patches,
  exact-file review, and human-owned release.

## Setup and evidence

- [Hosting and access](docs/HOSTING.md) — free-tier pilot options, one-time connections and limitations.
- [Source migration manifest](docs/MIGRATION.md) — what was transferred, adapted and excluded.
- [Validation and remaining release work](docs/VALIDATION.md) — actual tests versus live acceptance.
- [Approved contract](changes/CHANGE-004-hosted-factory-migration.md).

## Maintainer checks

Use Node 24. `npm ci`, `npm run build`, `npm run lint`, `npm run test:factory`, and
`npm run test:factory-ui` validate the new components. `npx playwright test` retains the
original functional and Windows visual regression. Install the matching Chromium first.

The new browser suite uses a real API and PostgreSQL-compatible fixture with stubbed
external services. It does not make paid calls, modify real target repositories, or prove
the hosted worker is deployed. `.github/workflows/qa.yml` and the original golden image
remain unchanged; the added Factory workflow supplements those checks.
