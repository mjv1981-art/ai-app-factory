# CHANGE-004 — Hosted AI Factory and Galaxy Capital migration

## Change ID

CHANGE-004

## Title

Migrate reusable Galaxy Capital Factory capabilities and deliver a hosted web SDLC

## Status

DRAFT — awaiting human approval. This pull request changes this contract only.
It does not implement, deploy, or claim to operate the hosted Factory.
Approval must identify this contract revision before a Builder changes product or infrastructure files.
The proposed permissions below become active only upon that approval.

## Request

Update `mjv1981-art/ai-app-factory` with the reusable Factory capabilities developed in Galaxy Capital, and make it the owner's main software delivery lifecycle.
The owner uses a dedicated web chat and dashboard, without local terminals, a local coding agent, or a personally managed persistent runner.
Support connecting an existing GitHub project and creating a new project, then implementing enhancements.
Priorities: visible token usage and cost; complexity-based execution and model routing; performance; automated Playwright regression; durable product and architecture context.

Confirmed by the owner on 2026-09-29: the primary interface is a dedicated web chat and dashboard.

## Business intent

Let the owner work as Product Manager: describe outcomes, resolve product questions, approve plans, review working results, and authorize release.
Factory performs implementation, testing, bounded repair, evidence collection, and pull-request preparation in hosted workers.
One-time account authorization and secret configuration are allowed; normal use must require no local execution.

## Inspected baseline and provenance

Inspection date: 2026-09-29.

- Destination: `mjv1981-art/ai-app-factory`, main commit `c61a76100d48318ae6b8da8dff75e1f18e97b25b`.
- Source: Galaxy Capital local clean checkout, commit `3b1993f1deab6d31471b591b0651465d43913801`.
- Source use is limited to reusable Factory code, role instructions, schemas, contract structure, and orchestration tests. Do not transfer Galaxy Capital application source, assets, secrets, run artifacts, or product-specific regression rules.
- Destination is public; connected project source, prompts, conversations, credentials, and private artifacts must never be committed into it.
- Destination contains a React/Vite counter example, PowerShell Factory scripts, Builder/QA/Reviewer roles, and Playwright functional plus Windows screenshot regression.
- The existing example increments by two, resets with Shift-click, and has a separate Reset button.
- Destination has no open PRs and no repository-level Actions secrets or variables returned by the inspection. This does not establish availability of other account-level credentials.
- No build, Playwright suite, hosted execution, or provider call was run during this planning inspection.

### Capability comparison

| Capability | Galaxy Capital source | Required standalone outcome |
| --- | --- | --- |
| Request routing | FAST_EXACT, FAST, STANDARD | Preserve exact deterministic path; expose profile and classification reasons in dashboard |
| Models | OpenRouter Planner/QA/Reviewer/Supervisor; local Builder with OpenRouter fallback | Configurable hosted Builder; free-model policy; no dependency on desktop login |
| Usage | Stage token counters and elapsed time | Durable per-attempt ledger, actual vs estimated usage, model/provider, cost, project/run totals |
| Limits | Global token threshold explicitly warns and continues | Enforce request reservations, run limits, retry limits, cancellation, and paid-model policy |
| Verification | Production build, Playwright, QA and reviewer gates, exact commit file set | Retain these controls in isolated cloud workers with browsable evidence |
| Context | Repository instructions, regression pack, contract, file listing and bounded evidence | Versioned project baseline, product brief, architecture, decisions, regression map, selective retrieval |
| Remote operation | Hosted planning only; execution intentionally local | Hosted end-to-end execution through web chat |
| Project onboarding | Repository-specific assumptions | Existing-project baseline and new-project creation flows |

The source `docs/REMOTE_FACTORY.md` states execution is local, while `.github/workflows/factory-remote.yml` still mentions a removed execution workflow and a self-hosted runner. Do not copy those stale instructions as a working hosted solution.
Source `Assert-LlmBudget` describes a warning threshold, not an enforced spending cap.
The current Factory self-test uses stub tools for orchestration; retain its value without representing it as real browser or live-model coverage.

## Execution profile

STANDARD

## Exact old text

NONE.

## Exact new text

NONE.

## Exact replacement files

NONE.

## Objective

Deliver a hosted, single-owner MVP for GitHub-backed JavaScript/TypeScript web projects, using the existing React/Vite stack for the Factory UI.
Provide an extensible project adapter boundary; unsupported stacks receive an explicit compatibility report rather than a false successful onboarding.
The initial new-project template is React/Vite with Playwright.
Source migration alone is an intermediate milestone, not completion of this contract.

## Execution milestones

1. M1 — Extract and generalize reusable source capabilities with a source-to-destination manifest, generic role prompts, validated contracts, provider abstraction, profile routing, telemetry, and orchestration tests.
2. M2 — Implement durable project/run state, an asynchronous queue with restart-safe claims, GitHub authorization, isolated hosted-worker protocol, cancellation, approval binding, and enforceable budgets.
3. M3 — Implement existing-project discovery and baseline review plus new-project planning, repository provisioning, template creation, context records, and regression discovery.
4. M4 — Implement the dedicated authenticated web chat/dashboard, plan approval, progress, usage, context, results, and preview/evidence views.
5. M5 — Connect hosted planning, building, deterministic testing, independent QA, bounded repair, release review, branch/PR creation, and exact-commit CI verification.
6. M6 — Run contract regression, failure-path and security tests; complete live hosted acceptance on designated test repositories; produce deployment and operator documentation plus a human release review.

Each milestone must have its own measurable evidence. Failed or incomplete milestones remain visible and may not be summarized as a successful full delivery.

## In scope

- Reuse and adapt Galaxy Capital's Factory concepts and relevant implementation instead of starting the orchestration design over.
- Add generic project configuration for default branch, commands, test locations, protected files, context paths, runner platform, and model policy.
- Keep the existing counter example at its current route. Add the Factory application under `/factory` so the existing example and screenshot stay protected.
- GitHub sign-in and an installed GitHub App scoped to the owner's selected repositories; enforce owner and repository authorization on every API operation.
- Durable server-side conversations, plans, baseline versions, decision records, budgets, usage, run transitions, results, and audit events.
- An asynchronous worker that continues after browser close; no long-running builds inside a browser or request handler.
- Repository code executes in disposable workers without control-service secrets or privileged GitHub publishing credentials.
- A privileged publishing step accepts only validated patches and verified artifacts for the approved repository, base SHA, plan revision, and run.
- Cost-conscious deterministic routing first, bounded model calls next, full role sequence for STANDARD changes.
- Automatic repair only within the approved scope and configured limits.
- Authenticated preview and artifact access for private projects.
- Deployment-ready service and worker containers, documented persistent database/storage/queue requirements, health checks, and operational limits.
- Human-owned merge and production release decisions.

## Proposed architecture and operating defaults

These choices are part of the proposal, not claims about existing functionality.

- Browser: retain React/Vite; add authenticated chat, projects, plans, run details, usage, and project knowledge views.
- API: Node.js service with server-side sessions, authorization, streamed or polled run events, and provider/GitHub integrations.
- State: PostgreSQL for project records, conversations, approval revisions, job claims and usage reservations; private object storage for large evidence.
- Workers: disposable cloud jobs. GitHub-hosted runners are suitable for build/Playwright jobs when compatible with the target's platform; managed container jobs are an alternative adapter.
- Preserve the existing Windows QA workflow and golden image. Never compare a Linux rendering against a Windows golden by silently regenerating it.
- Secrets stay in the hosting secret manager or appropriate GitHub secrets; never in frontend bundles, prompts, source commits, or screenshots.
- Free OpenRouter models are enabled by policy. Paid models are disabled by default; activation requires an owner-selected allowance and allowed models.
- Model capability checks include context size, tool calling, and structured output requirements. Free-model availability is not an SLA.
- Every request reserves estimated input plus bounded maximum output against remaining allowance before dispatch. Usage is reconciled afterwards.
- Provider usage absent or uncertain is displayed as unknown, not zero; retain conservative reservations until reconciled. Distinguish token estimates, reported tokens, inference costs, and cloud compute/storage costs.
- Start with bounded retrieval of explicit project documents and relevant code/tests keyed to commit SHA. A vector database is not required for the MVP.
- Durable context is versioned with source paths/commit references. Inferred architecture and uncertain product behavior are marked for confirmation.
- New repositories default to private, with owner-confirmed name and visibility. Provisioning uses a separately authorized credential that can create repositories; do not assume an installation token alone grants account repository creation.
- Existing-project onboarding never upgrades dependencies, repairs unrelated defects, or modifies product behavior as a hidden baseline step.
- Hosting vendor, region, domain, spend ceiling, and credential provisioning must be recorded before paid provisioning or deployment. Contract approval authorizes implementation, not unlimited cloud expenditure.
- Until hosted live acceptance passes, describe the system as implementation-in-progress or deployment-ready, never operational.

## Acceptance criteria

- [ ] AC-01: The source manifest identifies transferred/adapted Factory files and exclusions. Runtime prompts and configuration have no mandatory Galaxy Capital names, repository URLs, smoke-test paths, gameplay rules, Windows user environment secrets, or local desktop requirements.
- [ ] AC-02: A signed-in owner can connect an authorized existing repository. Factory records the exact commit, stack, commands, existing tests, product journeys, architecture, decisions and unknowns, and actual baseline test results. The owner approves the baseline before enhancements. Existing failures and missing coverage remain explicit.
- [ ] AC-03: A signed-in owner can describe a new app, review/approve a plan and repository details, receive a privately created React/Vite project with tests/context and a working preview, then request and complete a second enhancement against it.
- [ ] AC-04: Request classification records profile, risk/complexity factors and reasons. FAST_EXACT requires a verifiable one-line literal replacement with exact authorized occurrence files and zero behavior/layout/config changes. Ineligible edits escalate to FAST or STANDARD. Exact edits need no planning/build/review model calls; full required deterministic regression still runs.
- [ ] AC-05: Dashboard reports input, cached-input where supplied, output, reasoning where supplied, total tokens, requested/actual model where available, provider, retries, latency and cost per stage/run/project. Failure and cancellation preserve spent usage. Cached/reasoning counters are not double-counted.
- [ ] AC-06: Per-run/stage token, call, time and paid-cost allowances are checked before each attempt, including retries and fallback. Concurrent requests cannot exceed shared reservations. Rate limits produce bounded backoff or an explicit paused/failed state, never an unbounded retry loop. No paid fallback occurs under free-only policy.
- [ ] AC-07: Approved runs execute with the user's computer off. Closing/reopening the dashboard retains history. Duplicate dispatches and worker retries do not create duplicate charges, branches, repositories or PRs where operations can be deduplicated; uncertain provider completion is recorded explicitly rather than blindly replayed.
- [ ] AC-08: Build plus applicable existing/new Playwright tests run automatically in cloud workers. Dashboard exposes test counts, failures, skipped/missing coverage, trace/screenshots and logs. Failed checks and unavailable required evidence block release readiness. No model verdict substitutes for a test execution.
- [ ] AC-09: Independent QA evaluates the contract/diff/evidence, bounded repair reruns affected checks and required regression, and release review validates the complete commit file set including the system-generated contract. STANDARD uses distinct QA/reviewer invocations; FAST paths preserve deterministic review guards.
- [ ] AC-10: Product/architecture/regression/decision records remain accessible across later requests. Retrieval is scoped to the project and commit, includes provenance, and refreshes changed documents. A follow-up request demonstrates use of an earlier accepted decision without requiring the owner to repeat it.
- [ ] AC-11: Plans are approved against a specific revision and base SHA. A changed plan or incompatible branch advance invalidates approval. Only authorized repository paths and infrastructure changes may be published.
- [ ] AC-12: Factory creates a reviewable PR and waits for required CI on the actual proposed commit. Failed/missing checks do not appear as passed. Human merge approval is required; no auto-merge or branch-protection bypass.
- [ ] AC-13: Authorization tests deny cross-project data/artifact access, unauthorized worker callbacks, forged webhook events, path traversal and symlink escape. Chat/repository text cannot become executable workflow or shell interpolation. Target-repo test code cannot read model, database, or publishing credentials.
- [ ] AC-14: Existing counter behavior and approved screenshot remain unchanged. All pre-existing destination regression passes on its existing platform; new Factory journey tests run without paid model calls in deterministic CI.
- [ ] AC-15: Real hosted acceptance demonstrates both entry paths, one follow-up enhancement per path, a bounded failure/repair, dashboard usage and an accessible result. Mocked provider tests and orchestration stubs are reported separately from live evidence.

## Expected functional changes

A new Factory interface and hosted execution service are added.
Generic Factory routing, telemetry and governance replace repository-specific assumptions in the standalone scripts.
The existing example remains functional.
For each request the owner sees: understood objective, proposed scope, profile and estimated range; approval; live progress; result/preview; testing and actual usage; release decision.

## Expected visual changes

New UI under `/factory`: login, project list, import/create, project chat, plan approval, run details, usage and knowledge views.
No redesign of the existing example home page.

## Must remain unchanged

- Galaxy Capital repository, game source, test suite, product rules and local setup.
- Destination counter example and existing functional/visual assertions.
- Existing approved golden screenshot bytes.
- Human authority over product scope, baseline acceptance, visual baseline promotion, merge and production release.
- Existing protected tests and required QA expectations.

## Out of scope

- A guarantee of zero defects or complete test coverage of every imported project.
- Guaranteed free inference or unlimited cloud execution.
- Organization-wide multi-tenancy, billing subscriptions, marketplace, native mobile/desktop project support.
- Autonomous main-branch merges, production deployment without human approval, or silent baseline updates.
- Publishing private project context in the public Factory repository.
- Copying Galaxy Capital dependencies or application assets into the standalone Factory.
- Requiring GitHub Issues or this conversation as the primary product interface.
- Purchasing hosting or enabling paid models without an agreed allowance.

## Regression scenarios

- REG-001: Existing home loads; counter is 0, increments to 2 and 4; Shift-click and Reset restore 0.
- REG-002: Existing home screenshot passes on the configured Windows/Chromium environment without baseline changes.
- REG-003: Deterministic exact change updates only contracted occurrences, performs build/regression, and includes the contract in the authorized file set.
- REG-004: Non-exact behavioral changes cannot take the deterministic exact path.
- REG-005: Unauthorized config, governance, test weakening or snapshot changes stop publication.
- REG-006: Malformed provider output, missing usage, missing API key, 429, timeout and exhausted budget produce truthful resumable/terminal states.
- REG-007: Concurrent requests, duplicate webhook/job delivery, stale approvals, cancellation and worker restart preserve run/accounting consistency.
- REG-008: Existing-project onboarding detects pre-existing failures and missing test coverage without silently changing the target.
- REG-009: New-project creation followed by enhancement retains accepted product/architecture decisions.
- REG-010: Private repository data and artifacts remain unavailable to unauthorized users.
- REG-011: Failed independent QA or required CI prevents ready-for-release status.
- REG-012: Browser close does not cancel hosted work; explicit cancel stops future stage dispatch.

## Files/areas likely affected

Product additions may be under `src/factory/`, `server/`, `worker/`, `factory/`, `tests/factory/`, `tests/unit/`, and `tests/integration/`.
Only `src/main.jsx` may change outside the new frontend area to select the new route; existing example source/style files are otherwise preserved.
Documentation may be under `docs/` and `README.md`; contracts under `changes/`.
Reusable roles/providers/control/schema changes are limited to the exact infrastructure paths below.
If implementation requires additional protected/configuration files, amend this contract before modifying them.

## Infrastructure changes authorized?

YES

## Authorized infrastructure files

- `AGENTS.md`
- `agents/planner.md`
- `agents/builder.md`
- `agents/qa.md`
- `agents/reviewer.md`
- `changes/CHANGE-TEMPLATE.md`
- `factory.ps1`
- `factory-request.ps1`
- `scripts/factory-selftest.ps1`
- `scripts/factory-openrouter.ps1`
- `scripts/factory-telemetry.ps1`
- `scripts/remote-free-agent.mjs`
- `scripts/openrouter-builder-fallback.mjs`
- `scripts/remote-factory-control.ps1`
- `scripts/set-openrouter-key.ps1`
- `schemas/factory-qa.schema.json`
- `schemas/factory-reviewer.schema.json`
- `schemas/factory-project.schema.json`
- `schemas/factory-run.schema.json`
- `factory.config.example.json`
- `package.json`
- `package-lock.json`
- `.gitignore`
- `.dockerignore`
- `.env.example`
- `Dockerfile`
- `worker/Dockerfile`
- `compose.yaml`
- `server/migrations/001-factory.sql`
- `vite.config.js`
- `eslint.config.js`
- `playwright.factory.config.js`
- `.github/workflows/factory-checks.yml`
- `.github/workflows/factory-worker.yml`

Existing `.github/workflows/qa.yml` and `playwright.config.js` are preserved.
New checks supplement existing QA rather than replace or weaken it.
Dependency changes are only for the contracted service/UI/validation needs; no unrelated upgrades.
Deployment-provider-specific files require a recorded contract amendment once the host is selected.

## Visual changes authorized?

YES

New Factory routes only.

## Baseline changes authorized?

NO

## Authorized baseline files

NONE.

## Visual regression scope

The existing home-page Windows baseline remains byte-for-byte unchanged.
New Factory functional tests may collect screenshots for human review, but do not auto-promote golden screenshots.
Any future baseline promotion needs explicit human approval and exact paths in a contract amendment.

## Test evidence required

- [ ] Source/adaptation manifest and no-private-source/secret review.
- [ ] PowerShell parsing and migrated orchestration self-tests with clearly labeled stubs.
- [ ] Unit/integration tests for routing, approval validation, budgets, usage, provider failures, job transitions and authorization.
- [ ] Existing production build and full existing Playwright suite on Windows.
- [ ] Dedicated Factory Playwright journeys for both project entry paths, chat, approval, progress, costs, evidence, context and error states.
- [ ] Failure-path evidence for stale approval, budget exhaustion, cancellation, failed tests and unauthorized access.
- [ ] Hosted live acceptance report with exact Factory/target commits, run IDs, PR links and test/provider evidence.
- [ ] Working authenticated preview, setup prerequisites, deployment status and known limitations.
- [ ] Independent QA and release review against the acceptance criteria.

## Evidence expectations

The Test evidence required checklist must be completed against the approved revision; links and results must distinguish deterministic mocks, real regression, and live hosted acceptance.

## Risks

- Source scripts are coupled to local process control and repository layout; direct copying can preserve local-only assumptions.
- Free-model availability, limits and supported capabilities vary; reduced cost does not establish adequate output quality.
- Usage reservations bound planned requests, but provider billing reconciliation must remain authoritative; do not label uncertain costs as exact.
- Imported projects can have incomplete requirements, unavailable external services, fragile tests or unsupported stacks.
- Private project execution in public repository Actions could leak logs/artifacts; use a private execution boundary, with verified access controls.
- GitHub integration needs appropriate cross-repository permissions and an authenticated creation path for new repositories.
- Long-running workers require durable status/heartbeat/recovery; a frontend-only deployment cannot satisfy the contract.
- Cloud infrastructure setup and credentials are not currently configured in the inspected destination repository.
- Cloud-host selection and operating allowance remain to be decided before provisioning.

## Human visual approval

NOT_APPLICABLE. No golden baseline promotion is authorized.

## Human notes and approval record

Requested by the repository owner in conversation on 2026-09-29.
Dedicated web chat/dashboard selected explicitly in that conversation.
Contract approval: PENDING.
Hosting provider/region/domain and spend allowance: PENDING; not prerequisites for reviewing this contract or implementing provider-neutral code.
Deployment/account credentials: not supplied in this contract; configure through private account/secret settings, never by pasting secrets into a PR.
Implementation must not be described as complete until AC-15 is evidenced.
