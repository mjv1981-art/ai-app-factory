# Hosted Factory setup and access

Status: implementation under CHANGE-004; no hosted production URL has been provisioned.
The website path is `/factory`. It requires the API, durable database, GitHub App and
private worker connections. A static frontend deployment alone is not an operational Factory.

## Free-tier pilot

The owner requested free hosting. Keep paid inference disabled and configure provider-side
spending blocks before enabling execution. Account authorization is a one-time setup;
normal product work takes place in the dashboard, not a local terminal.

Suggested provider-independent mapping:

| Component | Pilot option | Limit to verify before provisioning |
| --- | --- | --- |
| Web + API | Render free Node web service | Sleeps after inactivity; ephemeral disk; bandwidth/build quotas |
| PostgreSQL | A non-expiring free PostgreSQL provider, such as a suitable Neon free plan | Verify current account storage/compute allowance and suspension policy |
| Execution | Separate PRIVATE GitHub repository with standard hosted Actions jobs | Account minutes, artifact and cache quotas; configure stop-at-budget |
| Model | OpenRouter free router or a verified free model | Request/day/minute limits; capability and availability vary |
| Evidence | Bounded PostgreSQL pilot storage, then a private S3-compatible bucket | Pilot cap 25 MB; individual artifact 15 MB; provider storage/egress quotas |

Do not use Render's expiring free PostgreSQL as the durable project record.
No subscription, cloud resource, repository creation, or paid model was provisioned by this change.
No guarantee of free capacity or always-on service is made. Hosting charges are separate
from model token accounting; the dashboard does not claim to read cloud billing.

Official sources checked during implementation:

- [Render free service limitations](https://render.com/docs/free)
- [GitHub Actions allowances and billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [OpenRouter limits](https://openrouter.ai/docs/api_reference/limits)
- [GitHub App login and user access](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)

## One-time operator setup

1. Select the hosting account, region and a free plan. Record the agreed allowance as $0
   and configure provider spending controls. Do not add automatic upgrades.
2. Provision durable PostgreSQL, enable TLS, and store the connection string privately.
   Review the SQL migration at `server/migrations/001-factory.sql`; startup applies it idempotently.
3. Register a GitHub App. Callback: `https://<host>/api/auth/callback`.
   Webhook: `https://<host>/api/github/webhook` with a random secret. Subscribe to check-run,
   check-suite and commit-status events so exact-commit CI readiness updates automatically.
   Repository permissions: metadata read; contents read/write; pull requests write;
   checks/statuses read; Actions write for the private execution repository. If generated
   projects include workflow files, the publishing integration must also have workflow permissions.
   Install only on approved target repositories and the private execution repository.
4. Set the owner, App credentials, session encryption key, database URL, OpenRouter key
   and runner repository using `.env.example` as a field list. Never commit real values.
   Web authentication uses GitHub OAuth state + PKCE; session tokens are encrypted at rest.
   Sessions expire within eight hours and the owner signs in again; background jobs use installation tokens.
5. Deploy the web service from the reviewed Factory revision. Build command:
   `npm ci && npm run build`. Start command: `npm start`. Alternatively use `Dockerfile`.
   Set `NODE_ENV=production` and `FACTORY_ORIGIN` to its HTTPS origin. `/health` is a liveness endpoint.
6. In the PRIVATE execution repository, install `.github/workflows/factory-worker.yml`.
   Set `FACTORY_RELEASE_SHA` to an exact reviewed 40-character Factory commit, not a branch.
   Set the matching secrets/variables referenced by the workflow. The public repository's
   copy intentionally refuses to execute private project work.
7. Choose a build image matching the target's installed Playwright version. The bundled
   template uses 1.63.0. Configure a digest-pinned trusted image before release. The worker
   restricts dependency-download network access and uses no network for build/test steps.
8. Optional new-project creation needs a separately scoped owner credential with permission
   to create private repositories. The GitHub App must receive installation access to the
   resulting repository before Factory can populate it. Selected-repository installations
   can require a one-time browser approval after creation; do not work around this with broad credentials.
9. Configure private object storage if needed; otherwise the 25 MB pilot cap stops uploads.
   No private project artifact is uploaded to the public Factory repository.
10. Complete the live acceptance checklist in `docs/VALIDATION.md` before advertising a usable URL.

## Product Manager access after deployment

Open `https://<configured-host>/factory` and choose **Continue with GitHub**.

- **Connect repository** starts baseline discovery and verification. Read the discovered
  tests, architecture/documents and unknowns. Approve a passing baseline before enhancements.
- **New project** collects a name and app brief. Review the generated plan before approving
  creation of the private repository and implementation.
- Describe an enhancement in the project conversation. Review the exact file scope, plan
  revision and limits. Approval queues a cloud job; closing the browser does not cancel it.
- Review usage, artifacts and the isolated static preview. Preview scripts cannot reach the
  authenticated parent page or network/backends; this is not a live backend deployment.
- Open the draft PR, wait for configured required checks on its exact commit, and merge manually.
  After merge, refresh/approve the new project baseline before the next enhancement.

## Supported adapter and current limits

The bundled adapter supports npm-lockfile JS/TS static web apps, a build script, and Playwright
on Linux. Importing Windows-specific golden images requires a matching adapter; the existing
Factory counter regression continues to use its original Windows workflow unchanged.
Repository scripts requiring external backend services, install lifecycle hooks or special
OS dependencies may fail and need an approved project adapter. They are not silently skipped.

Maximum import: 3000 files / 30 MB, maximum individual imported file 2 MB. Symlinks and submodules
are rejected; secret/runtime paths are excluded. Plans list exact write paths. Existing tests
and golden images cannot be rewritten by the hosted Builder; coverage is added in new files.
Baseline defects currently block enhancements and require a separate remediation contract.

## Recovery and operations

- A run is persisted before dispatch. A dispatch error remains visible and can be retried.
  Duplicate worker deliveries cannot reclaim a running/finished run.
- Stale running jobs are shown after two minutes without heartbeat. Inspect the Actions job;
  do not blindly replay an uncertain provider attempt. Usage reservations remain charged to
  the allowance until reconciled. Cancel and create a new approved run after review.
- Approval expires logically when the plan hash or base commit changes. Replan rather than
  publish against an unapproved new base.
- Cancellation stops later stages and is polled during sandbox execution. Already dispatched
  provider requests may still finish and are retained in usage accounting.
- Configure backups and artifact retention through the chosen providers. Database pilot
  artifacts consume the database allowance. No automated retention deletion is implemented.
- The web service does not run a background queue loop; approved work dispatches a private
  GitHub job. Sleeping web hosting does not terminate a job already dispatched.
