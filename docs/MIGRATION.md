# Galaxy Capital Factory migration

Source: Galaxy Capital commit `3b1993f1deab6d31471b591b0651465d43913801`.
Destination baseline: `c61a76100d48318ae6b8da8dff75e1f18e97b25b`.
Approval: CHANGE-004 at `d6350287c4ac927801d8e4957fc712d8c0118b7c`, approved by the owner in conversation.

This is an adaptation into a hosted controller, not a byte-for-byte copy of the local CLI.
The source's local process supervision, desktop credentials and stale remote workflow do not
satisfy hosted operation. Their reusable rules and controls are mapped below.

| Source | Destination | Treatment |
| --- | --- | --- |
| `agents/planner.md`, `builder.md`, `qa.md`, `reviewer.md` | Same paths | Generalized product references; controller JSON format added; runtime provider loads roles |
| `changes/CHANGE-TEMPLATE.md` | Same path | Generic product/regression language; profile, exact edits and infrastructure/visual authorization retained |
| QA/reviewer schemas | Same paths | Imported source schemas for role interoperability; hosted controller additionally checks its own output contract |
| `factory-request.ps1` exact planning | `factory/policy.mjs` | Deterministic FAST_EXACT with stricter JSX visibility checks, whole occurrence-set validation and conservative STANDARD fallback |
| `factory.ps1` profile and protection guards | `factory/policy.mjs`, `worker/engine.mjs` | Exact paths, immutable tests/baselines, current-base checks, contract-inclusive file-set review |
| Local Builder/OpenRouter fallback | `factory/provider.mjs`, `worker/engine.mjs` | Hosted provider-first JSON patch Builder; bounded repair; no local login/process dependency |
| OpenRouter Planner/QA/Reviewer | `factory/provider.mjs`, `agents/` | Separate role calls, free-only policy, capability lookup, bounded retries and accountable failures |
| `scripts/factory-telemetry.ps1` | Same path plus `factory/usage.mjs`, `server/store.mjs` | Original optional telemetry helpers retained; hosted usage gains durable reservations and unknown accounting |
| Local warning-only token threshold | `server/store.mjs`, `factory/usage.mjs` | Transactional pre-dispatch run/stage allowance checks |
| Build/Playwright stages | `worker/sandbox.mjs` | Credential-free disposable container, logs/traces, explicit failed/missing/skipped evidence |
| Stub PowerShell orchestration self-test | `tests/integration/`, `scripts/factory-selftest.ps1` | Database-backed deterministic tests for both project paths, approvals and release guards; stubs labeled as such |
| Local PowerShell entry points | `factory.ps1`, `factory-request.ps1` | Optional authenticated HTTPS clients for hosted requests and approval; no local build requirement |
| Hosted planning experiment | `.github/workflows/factory-worker.yml` | New private execution workflow using a pinned controller revision; old missing-runner references excluded |

Source SHA-256 records for directly imported/adapted assets:

| Path | Source SHA-256 |
| --- | --- |
| `agents/planner.md` | `391020DD9BFDA1FE27AF79CAF2B593B16094A09A2EA24C351D04D74146201180` |
| `agents/builder.md` | `D62D27F59824CCBFA3650F8F985AEC2D7DE7EFC035EE25D04244C42978B434FF` |
| `agents/qa.md` | `67FD797B2836EBAECFA8AD4C3666147CDBE21FB7D3953D978CB7D04D3783B4CD` |
| `agents/reviewer.md` | `90B50B6B85C8E06218D7669A8D52E58AAB113EC1DDAC0B80E1FEB5EEAF90F126` |
| `schemas/factory-qa.schema.json` | `DA12ADB6F539260BD68E843B76D235F4783C0358E636094988D790A01EC272F8` |
| `schemas/factory-reviewer.schema.json` | `34E469F103C76556EEB2AACF46CB287ADE6250E48D1E030D39C3B406C01C5C3A` |
| `changes/CHANGE-TEMPLATE.md` | `16A34A832CEB856FAA94DC0DB6BB06A48F9EF15DBFF919B9E4C30964B473A196` |
| `scripts/factory-telemetry.ps1` | `7482D3E571F49D5D93837AFE5EB63DD621B7A66DE72CF85314D28AE375C28D2D` |

Excluded: Galaxy Capital source/assets, game rules, Scenario Lab, product contracts, run
artifacts, secrets, dependencies and visual baselines. Its repository remains unchanged.

## Architecture decision

Keep React/Vite and add `/factory`; preserve the original example at `/`.
Use PostgreSQL records and transaction locks for the single-owner MVP, avoiding an extra queue service.
Private Actions jobs host the long-running controller. Models and publication run in the trusted
controller; only target install/build/test executes in restricted containers.
Persist decisions and context with commit provenance; prioritize explicit documents and bounded
matching code rather than introducing an unneeded vector database.
