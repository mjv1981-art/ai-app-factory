# Guided Factory workspace

CHANGE-005 changes the Factory interface and recovery controls. It retains the hosted
architecture, free-only model policy and human-owned approval/merge gates.

## Starting and following work

Overview separates **Connect repository** from **New project**, and brings work needing
attention ahead of history. Select a project to read its baseline, conversation, current
runs, usage and knowledge. After a human merge, discover and approve the new baseline
before planning another enhancement.

Baseline approval appears once, in the selected project's **Project baseline** section.
**Review current baseline** takes you there and focuses the section. Each discovery shows
its short run ID and timestamp. New discoveries record their source run and commit;
older records without a source run say **Latest recorded discovery**, selected by completion
time rather than claiming proof of provenance. Earlier completed discoveries and superseded
failures stay in read-only run history with their original evidence. Active discoveries
remain visible and prevent approval until they finish. A recorded project approval does
not certify a different, active or unattributed discovery's review stage; historical and
unattributed approval stages remain **Not recorded / unconfirmed**.

Each run shows the objective, current activity, who acts next, the delivery path and one
primary next action. Status labels are text with icons; action buttons perform operations.
The guide uses recorded facts and typed diagnostics. It makes no model calls and cannot
override a gate.

| Recorded state | Presentation / responsibility | Next action |
| --- | --- | --- |
| Queued | Gray; waiting for a worker / Factory | Wait, inspect dispatch or cancel |
| Dispatch error | Red; dispatch needs attention / owner | Retry the same persisted dispatch |
| Running, fresh heartbeat | Blue; named stage / Factory | Follow evidence or cancel |
| Running, missing/stale heartbeat | Gray; activity unconfirmed / owner | Inspect the cloud job; no automatic replay |
| Failed refresh | Gray active indicators; last known data retained | Restore the connection; no work is replayed |
| Awaiting approval | Amber; exact plan ready / owner | Inspect scope/revision/limits and approve, or clarify |
| Awaiting repository access | Amber; selected-repository access required / owner | Add the private repository to the App, then Continue |
| Baseline review | Amber if compatible/passing, red otherwise / owner | Approve the discovered current commit or resolve prerequisites |
| Failed | Red named stop, or neutral unknown diagnosis / owner | Read original findings and revise when safe |
| Cancelled | Gray; later stages stopped / owner | Wait for the current worker's acknowledgement before recovery |
| Awaiting CI | Gray; required checks incomplete / GitHub | Read/check CI on the actual PR head |
| Ready for review | Green; required exact-commit evidence passed / owner | Preview and review the PR; merge manually |
| Changed PR head | Red; prior candidate evidence does not certify this head | Establish fresh evidence before release |
| Recovered PR without trusted candidate SHA | Gray; candidate unconfirmed | Inspect the recovered link; CI alone cannot inherit prior review |
| Merged | Green; authenticated GitHub merge evidence / owner | Discover, review and approve the new baseline |
| Closed without merge | Gray; candidate not accepted / owner | Review the closed PR and unchanged baseline |
| Superseded plan | Gray; linked follow-up exists / owner | Open the follow-up; old approval cannot execute |

Baseline runs have discovery/tests/baseline-review stages. FAST_EXACT shows an exact edit
and explicitly skips model QA/review. FAST skips release review according to the unchanged
profile policy. Historical gaps say **Not recorded / unconfirmed**, rather than inventing
stage completion. Repairs clear current candidate gates and keep prior attempt evidence.

## Honest progress, usage and motion

Refresh remains every four seconds. The last successful server update and worker heartbeat
are shown separately. The heartbeat freshness window is two minutes. There is no duration
estimate or token stream: provider-reported totals arrive after each model call.

The allowance meter separates reported tokens, pending reservations and uncertain usage.
Cached/reasoning token subsets are not added to totals. Known cost and unknown cost remain
separate; hosting billing is outside this view. Per-attempt usage stays on the Usage tab.

Only confirmed active work animates: a gentle spinner and a sweep on the current stage.
Blue means active, green a passed gate, amber an owner wait, red a stop, gray pending or
unconfirmed. Text/icons convey the same information. **Pause motion** changes animation
only; jobs and polling continue. Reduced-motion preferences disable animation. Hidden
history, hidden tabs/documents and unconfirmed activity do not animate.

## Revising a stopped plan

Read the original QA/reviewer/provider finding, then enter a clarified objective. A revision
creates a new linked planning run using the current authorized repository and accepted base.
The old candidate is not reused. Its findings, artifacts and spent usage remain in history.
Review and approve the fresh plan hash before Builder, tests, QA and review execute again.
An unchanged-plan create retry remains an explicit secondary control for eligible cases.

The service validates owner, status, revision, authorization, current base and unresolved
usage. Concurrent duplicate clarification is idempotent; a retry and revision cannot both
supersede the same run. Access confirmation is atomic and duplicates cannot reset a claimed
worker. Heartbeats and finish acknowledgements belong to the matching worker claim.

Active/stale jobs, unacknowledged cancellation, unresolved provider usage, ambiguous
repository provisioning and unresolved publication cannot be replayed. A read-only
publication lookup may recover a PR link but cannot certify an observed commit. An existing
run PR is trusted only when its tree and single parent match the reviewed candidate.
No recovery operation changes an allowance or bypasses the free-only policy.

## Evidence and retained context

Expandable detail retains contracts, original diagnostics with provenance, bounded stage
events, verification attempts, QA/review findings and owner-scoped artifact links.
Events are capped at 160 per run and do not grow on heartbeat ticks. Verification retains
both bounded deterministic attempts. Knowledge keeps current context plus seven historical
or proposed versions per project. Proposed PR context, historical baseline context and
explicitly accepted current context are labelled separately.

Preview authentication, network sandbox, CSRF, encrypted sessions, existing test protection,
artifact caps and database schema remain unchanged. The mobile project list scrolls within
a bounded area; all navigation and sign-out remain reachable. Dialogs support native
keyboard navigation, Escape, visible focus and focus restoration.

## Validation boundary

Local browser fixtures exercise state transitions, motion, recovery and responsive layout
against the actual HTTP service and database, with external GitHub/model/worker boundaries
stubbed. They do not prove hosted execution. See VALIDATION.md for local results,
independent reviews, exact-commit CI and the separate hosted acceptance record.
