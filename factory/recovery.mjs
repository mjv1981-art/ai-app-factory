// Shared eligibility is explanatory in the browser and enforced again by the service.
export function recoveryEligibility(run, usage = []) {
  if (run.recoveryRunId) return { allowed: false, reason: 'A revised plan already exists. Open the linked run.' };
  if (run.pr) return { allowed: false, reason: 'This run has a pull request. Review its recorded state before starting new work.' };
  if (run.stage === 'publishing' && ['failed', 'cancelled'].includes(run.status)) return { allowed: false, reason: 'GitHub publication may have completed. Check the existing run branch and PR before any new work; an unresolved publication cannot be replayed.' };
  if (run.stage === 'create_private_repository' && ['failed', 'cancelled'].includes(run.status) && !run.provisionedBaseSha) return { allowed: false, reason: 'Repository provisioning is unresolved. Confirm the private repository and selected App access before starting more work.' };
  if (run.kind === 'baseline') return { allowed: false, reason: 'Discover the baseline again after resolving the recorded prerequisite.' };
  if (!['failed', 'cancelled', 'awaiting_approval'].includes(run.status)) return { allowed: false, reason: 'Active or unconfirmed work cannot be replayed. Wait for it to stop or cancel it first.' };
  if (usage.some(u => u.runId === run.id && (['reserved', 'uncertain'].includes(u.status) || u.totalTokens == null))) {
    return { allowed: false, reason: 'An attempt has unresolved usage. Its reservation is retained; reconcile the cloud job/provider evidence before authorizing more work.' };
  }
  if (run.status === 'cancelled' && run.claimedAt && !run.workerFinishedAt) return { allowed: false, reason: 'Cancellation was requested. Wait for the worker to acknowledge it before creating a revised plan.' };
  return { allowed: true, reason: 'A new plan starts from the current authorized base. The unpublished candidate is not reused. You must approve the new revision; tests, QA and review run again.' };
}

export function failure(code, message, status = 409) {
  return Object.assign(new Error(message), { code, status });
}

export function failureRecord(error, stage) {
  return { code: error.code || 'UNKNOWN', stage: stage || 'unknown', message: String(error.message || 'No reason was recorded.').slice(0, 2000), at: new Date().toISOString() };
}
