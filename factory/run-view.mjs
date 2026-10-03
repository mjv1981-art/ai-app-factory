import { recoveryEligibility } from './recovery.mjs';

export const humanLabel = value => String(value || '').replaceAll('_', ' ');
export function diagnosticText(value) {
  if (typeof value === 'string') return value.slice(0, 4000);
  if (value == null) return '';
  return 'Unstructured recorded diagnostic (unknown provenance): ' + JSON.stringify(value).slice(0, 4000);
}
export const activeStates = ['queued', 'running', 'awaiting_approval', 'awaiting_repository_access', 'awaiting_ci'];
const baselineFinished = run => run.workerFinishedAt || run.events?.findLast(e => e.stage === 'baseline_ready')?.at || run.createdAt;
export function baselineSelection(project = {}, runs = []) {
  const attempts = runs.filter(r => r.projectId === project.id && r.kind === 'baseline');
  const completed = attempts.filter(r => r.status === 'baseline_review');
  const current = project.baseline?.runId ? completed.find(r => r.id === project.baseline.runId) : completed.sort((a, b) => new Date(baselineFinished(b)) - new Date(baselineFinished(a)) || a.id.localeCompare(b.id))[0];
  const latest = attempts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || a.id.localeCompare(b.id))[0];
  return { current, latest, busy: attempts.some(r => ['queued', 'running'].includes(r.status)) };
}
export function historicalBaseline(run, selection) {
  if (run.kind !== 'baseline' || ['queued', 'running'].includes(run.status)) return false;
  if (run.status === 'baseline_review') return run.id !== selection.current?.id;
  return run.id !== selection.latest?.id || !!(selection.current && new Date(baselineFinished(selection.current)) > new Date(baselineFinished(run)));
}
export function usageSummary(entries = []) {
  return {
    reported: entries.reduce((n, u) => n + (u.totalTokens ?? 0), 0),
    pending: entries.filter(u => u.status === 'reserved').reduce((n, u) => n + (u.reservedTokens || 0), 0),
    uncertain: entries.filter(u => u.status !== 'reserved' && u.totalTokens == null).reduce((n, u) => n + (u.reservedTokens || 0), 0),
    unknown: entries.filter(u => u.totalTokens == null).length,
    knownCost: entries.reduce((n, u) => n + (u.costUsd ?? 0), 0),
    unknownCost: entries.filter(u => u.costUsd == null).length,
    calls: entries.length,
  };
}
const reasons = {
  REVIEW_STOP: ['Release review stopped publication', 'The reviewer did not approve this candidate. Read the original findings, clarify the outcome and request another plan.'],
  REVIEW_SCOPE: ['The file set was not approved', 'The reviewer did not approve every file the controller would publish. A revised plan must pass review again.'],
  QA_FAILED: ['Tests or independent QA stopped publication', 'The required evidence did not pass. Inspect the test report and QA findings before revising the request.'],
  PROVIDER_FORMAT: ['The model response could not be used', 'Two accounted free-model responses were not complete structured output. Narrow or clarify the request and create a fresh plan.'],
  PROVIDER_RATE_LIMIT: ['Free model capacity is unavailable', 'The bounded free retry reached a rate limit. You can request a fresh plan later. Paid fallback remains disabled.'],
  PROVIDER_UNCERTAIN: ['A provider attempt is unresolved', 'A request may have reached the provider. Its reservation stays in place until usage and the worker are reconciled.'],
  PROVIDER_CAPABILITY: ['The configured free model is unavailable', 'Capability or free-price verification did not succeed. No paid alternative will be used.'],
  CONTEXT_LIMIT: ['The request is too large for the model', 'Narrow the objective or authorized context before planning again.'],
  ALLOWANCE_EXHAUSTED: ['The run reached its allowance', 'This run stopped at its existing token, call or time ceiling. Review spent usage before approving a fresh plan.'],
  STALE_BASE: ['The repository changed', 'The accepted base no longer matches this plan. Discover and approve the current baseline, then plan again.'],
  APPROVAL_MISMATCH: ['The approval revision no longer matches', 'Execution requires approval of the exact current plan hash. An older approval cannot authorize this scope.'],
  SCOPE_BLOCKED: ['The proposed change exceeded approved scope', 'The controller blocked publication. Clarify the permitted change and have the new plan reviewed.'],
  PUBLISH_UNCERTAIN: ['GitHub publication needs reconciliation', 'Publication may have completed even though its response was lost. Check the existing run branch and PR; no new work is authorized by that check.'],
};
const stages = [
  ['plan', 'Plan', ['planning', 'plan_ready']], ['approval', 'Your approval', []],
  ['access', 'Repository access', ['create_private_repository', 'repository_access_required', 'repository_access_confirmed']],
  ['build', 'Build', ['builder', 'repair']], ['tests', 'Tests', ['build_and_playwright']],
  ['qa', 'Independent QA', ['independent_qa']], ['review', 'Release review', ['release_review']],
  ['publish', 'Pull request', ['publishing']], ['ci', 'Required CI', ['human_review']],
];
export function runView(run, project = {}, usage = [], now = Date.now(), connectionUnconfirmed = false, historical = false) {
  const entries = usage.filter(u => u.runId === run.id);
  const stale = run.status === 'running' && (!run.heartbeatAt || now - new Date(run.heartbeatAt).getTime() > 120000);
  const uncertain = entries.some(u => u.status === 'uncertain');
  let tone = 'neutral', title = 'Waiting for a worker', responsibility = 'Factory', explanation = 'The run is queued. GitHub Actions will claim it; no worker activity is confirmed yet.', action = null;
  if (run.status === 'running') {
    tone = stale ? 'neutral' : 'working'; title = stale ? 'Worker activity is unconfirmed' : ({ planning: 'Preparing your plan', baseline_discovery: 'Discovering the baseline', builder: 'Building the approved change', repair: 'Repairing the candidate', build_and_playwright: 'Running build and browser tests', independent_qa: 'Checking the evidence independently', release_review: 'Reviewing the exact file set', publishing: 'Opening the pull request', create_private_repository: 'Preparing the private repository' }[run.stage] || 'Factory is working');
    explanation = stale ? 'The last heartbeat is missing or older than two minutes. Inspect the cloud job; this attempt is not automatically replayed.' : 'The worker is reporting activity. This stage has no promised duration; reported usage updates after each model call.';
  }
  if (run.dispatchError && run.status === 'queued') { tone = 'stopped'; title = 'Worker dispatch needs attention'; explanation = 'GitHub Actions did not confirm dispatch. Retrying dispatch is safe because a run can only be claimed once.'; action = 'dispatch'; responsibility = 'You'; }
  if (run.status === 'awaiting_approval') { tone = 'waiting'; title = 'Your plan is ready'; responsibility = 'You'; explanation = 'Review the exact scope, criteria and allowance. Approval authorizes this revision only; implementation has not started.'; action = 'approve'; }
  if (run.status === 'awaiting_repository_access') { tone = 'waiting'; title = 'Grant access to the new repository'; responsibility = 'You'; explanation = 'Repository created privately. Add it to the GitHub App’s selected repositories, then continue this approved run.'; action = 'resume'; }
  if (run.status === 'awaiting_ci') { tone = 'neutral'; title = 'Waiting for required GitHub checks'; responsibility = 'GitHub CI'; explanation = 'Required checks are missing, pending or failing. Readiness is tied to the proposed PR commit.'; action = 'checks'; }
  if (run.status === 'ready_for_review') { tone = 'complete'; title = 'Ready for your review'; responsibility = 'You'; explanation = 'Required checks passed on the PR commit. Open the preview and review the pull request. Merge remains your decision.'; action = 'pr'; }
  if (run.status === 'baseline_review') { tone = project.baseline?.passed && project.baseline?.supported ? 'waiting' : 'stopped'; title = project.baseline?.approved ? 'Baseline approved' : project.baseline?.supported === false ? 'This project needs another adapter' : project.baseline?.passed ? 'Review the discovered baseline' : 'Baseline evidence is incomplete'; responsibility = 'You'; explanation = project.baseline?.approved ? 'Enhancements can now be planned against the accepted project context.' : project.baseline?.passed ? 'Inspect the discovered tests and commit, then approve the baseline.' : 'Resolve the recorded test or platform prerequisite before approving enhancements.'; action = project.baseline?.passed && !project.baseline?.approved ? 'baseline' : null; if (project.baseline?.approved) tone = 'complete'; }
  if (run.kind === 'baseline' && run.status === 'baseline_review' && project.status === 'baseline_needed') { tone = 'waiting'; title = 'Discover the accepted repository again'; responsibility = 'You'; explanation = 'The previous baseline is outdated after a merge. Discover and verify the current repository before approving a new baseline.'; action = 'discover'; }
  if (run.status === 'failed') { tone = 'stopped'; const reason = reasons[run.failure?.code]; title = reason?.[0] || 'This run stopped'; explanation = reason?.[1] || 'The worker recorded a stop, but no typed cause is available. Inspect the original diagnostic and evidence; the guide will not guess.'; responsibility = 'You'; }
  if (run.status === 'cancelled') { title = 'Run cancelled'; explanation = 'No further stages are authorized. Already-sent provider calls may finish; their usage remains accounted for.'; responsibility = 'You'; }
  if (run.prState?.headMismatch) { tone = 'stopped'; title = 'The pull request head changed'; explanation = 'Checks on a different commit cannot certify the Factory candidate. Review the changed PR and re-establish its evidence before release.'; action = 'checks'; responsibility = 'You'; }
  if (run.prState?.candidateUnconfirmed) { tone = 'neutral'; title = 'The recovered candidate is unconfirmed'; explanation = 'GitHub confirmed the pull request, but the lost publication response did not record a trusted candidate commit. Passing CI cannot inherit the earlier QA or review. Inspect the PR and establish fresh evidence before release.'; action = 'pr'; responsibility = 'You'; }
  if (run.prState?.merged) { tone = 'complete'; title = 'Pull request merged by a human'; explanation = 'GitHub confirms the merge. Discover, review and approve the new baseline before requesting another enhancement.'; action = 'discover'; responsibility = 'You'; }
  else if (run.prState?.state === 'closed') { tone = 'neutral'; title = 'Pull request closed without merge'; explanation = 'GitHub confirms this candidate was not accepted. The repository baseline is unchanged; review it before planning another request.'; action = 'pr'; responsibility = 'You'; }
  if (uncertain && !run.pr) { tone = 'neutral'; title = 'Provider usage needs reconciliation'; explanation = 'An attempt has uncertain usage. Its reservation is retained. Inspect the recorded provider and cloud-job evidence before new work.'; action = null; }
  if (run.stage === 'publishing' && ['failed', 'cancelled'].includes(run.status) && !run.pr) { tone = 'neutral'; title = 'GitHub publication needs reconciliation'; explanation = reasons.PUBLISH_UNCERTAIN[1]; action = 'publication'; responsibility = 'You'; }
  if (connectionUnconfirmed && run.status === 'running') { tone = 'neutral'; title = 'Activity unconfirmed — connection interrupted'; explanation = 'The last known worker state is retained, but current activity cannot be confirmed. Background work continues; this page does not replay it.'; action = null; }
  if (run.recoveryRunId || run.retryRunId) { tone = 'neutral'; title = 'A follow-up run replaces this plan'; responsibility = 'You'; explanation = 'Open the linked run. The original evidence and usage remain here; this approval can no longer start work.'; action = null; }
  if (historical && run.kind === 'baseline') { tone = 'neutral'; title = 'Earlier baseline discovery'; responsibility = 'No action required'; explanation = 'This earlier discovery is kept as evidence. Review the current project baseline; this record cannot approve or replace it.'; action = null; }
  const baseline = run.kind === 'baseline';
  const definitions = baseline ? [['inspect', 'Discover baseline', ['baseline_discovery']], ['tests', 'Baseline tests', ['build_and_playwright']], ['baseline', 'Your baseline review', ['baseline_ready']]] : stages.filter(([key]) => key !== 'access' || run.kind === 'create');
  const currentKey = baseline ? run.status === 'baseline_review' ? 'baseline' : definitions.find(([, , names]) => names.includes(run.stage))?.[0] || 'inspect' : run.status === 'awaiting_approval' ? 'approval' : run.status === 'awaiting_repository_access' ? 'access' : run.pr ? 'ci' : run.status === 'queued' && run.action === 'execute' ? run.kind === 'create' ? 'access' : 'build' : definitions.find(([, , names]) => names.includes(run.stage))?.[0] || 'plan';
  const events = run.events || [];
  const trail = definitions.map(([key, name, names], index) => {
    const skipped = run.plan?.profile === 'FAST_EXACT' && ['qa', 'review'].includes(key) || run.plan?.profile === 'FAST' && key === 'review';
    const completed = key === 'plan' ? !!run.plan : key === 'approval' ? !!run.approvedHash : key === 'tests' ? !!run.verification?.passed : key === 'qa' ? run.qa?.verdict === 'PASS' : key === 'review' ? run.review?.verdict === 'SAFE_TO_REVIEW' && (!!run.reviewPassed || !!run.pr) : key === 'publish' ? !!run.pr : key === 'ci' ? !!run.ci?.passed && !run.prState?.headMismatch : key === 'baseline' ? run.status === 'baseline_review' && !historical && project.baseline?.runId === run.id && !!project.baseline?.approved : events.some(e => names.includes(e.fromStage) && e.stage !== e.fromStage && e.status !== 'failed' && e.status !== 'cancelled');
    const unrecorded = index < definitions.findIndex(([k]) => k === currentKey) && !events.some(e => names.includes(e.stage) || names.includes(e.fromStage));
    return { key, name: run.plan?.profile === 'FAST_EXACT' && key === 'build' ? 'Exact edit' : name, state: key === 'baseline' && (historical || run.status === 'baseline_review' && project.baseline?.approved && !completed) ? 'unrecorded' : skipped ? 'skipped' : key === currentKey && run.status === 'running' ? tone : completed ? 'complete' : key === currentKey ? tone : unrecorded ? 'unrecorded' : 'pending' };
  });
  return { tone, title, responsibility, explanation, action, stale, confirmedActive: run.status === 'running' && !stale && !uncertain && !connectionUnconfirmed, trail, recovery: recoveryEligibility(run, entries), summary: usageSummary(entries), repairCount: events.filter(e => e.stage === 'repair' && e.fromStage !== 'repair').length };
}
