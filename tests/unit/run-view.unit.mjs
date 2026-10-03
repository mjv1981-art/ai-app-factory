import test from 'node:test';
import assert from 'node:assert/strict';
import { runView, usageSummary, diagnosticText, baselineSelection, historicalBaseline } from '../../factory/run-view.mjs';
import { recoveryEligibility } from '../../factory/recovery.mjs';

const now = Date.parse('2026-10-03T10:00:00Z');
const run = { id: 'r', kind: 'enhancement', action: 'execute', status: 'running', stage: 'builder', heartbeatAt: new Date(now).toISOString(), createdAt: new Date(now).toISOString() };
test('only fresh worker activity animates; waits, stale activity and stops remain distinct', () => {
  assert.equal(runView(run, {}, [], now).confirmedActive, true);
  const stale = runView(run, {}, [], now + 120001); assert.equal(stale.tone, 'neutral'); assert.equal(stale.confirmedActive, false);
  for (const [status, tone] of [['queued', 'neutral'], ['awaiting_approval', 'waiting'], ['awaiting_repository_access', 'waiting'], ['awaiting_ci', 'neutral'], ['ready_for_review', 'complete'], ['failed', 'stopped'], ['cancelled', 'neutral']]) {
    const view = runView({ ...run, status }, {}, [], now); assert.equal(view.tone, tone, status); assert.equal(view.confirmedActive, false);
  }
  assert.match(runView({ ...run, status: 'failed', error: 'untyped' }, {}, [], now).explanation, /will not guess/);
  assert.match(runView({ ...run, status: 'failed', failure: { code: 'REVIEW_SCOPE' } }, {}, [], now).title, /file set/);
});
test('baseline, exact work and repairs show their applicable stages without inventing gate passes', () => {
  const baseline = runView({ ...run, kind: 'baseline', stage: 'baseline_discovery' }, {}, [], now);
  assert.deepEqual(baseline.trail.map(s => s.key), ['inspect', 'tests', 'baseline']);
  const exact = runView({ ...run, plan: { profile: 'FAST_EXACT' }, events: [{ stage: 'repair', fromStage: 'independent_qa' }] }, {}, [], now);
  assert.equal(exact.trail.find(s => s.key === 'build').name, 'Exact edit');
  assert.deepEqual(exact.trail.filter(s => s.state === 'skipped').map(s => s.key), ['qa', 'review']);
  assert.equal(exact.repairCount, 1);
  const stopped = runView({ ...run, status: 'failed', stage: 'release_review', review: { verdict: 'STOP' } }, {}, [], now);
  assert.equal(stopped.trail.find(s => s.key === 'review').state, 'stopped');
});
test('reported, pending and uncertain usage stay separate and subsets are not added twice', () => {
  assert.deepEqual(usageSummary([
    { totalTokens: 20, cachedTokens: 8, reasoningTokens: 5, costUsd: 0, status: 'completed' },
    { totalTokens: null, reservedTokens: 100, status: 'reserved' },
    { totalTokens: null, reservedTokens: 200, status: 'uncertain' },
  ]), { reported: 20, pending: 100, uncertain: 200, unknown: 2, knownCost: 0, unknownCost: 2, calls: 3 });
});
test('recovery never replays an active, unresolved, published or unacknowledged cancelled attempt', () => {
  const stopped = { ...run, status: 'failed' };
  assert.equal(recoveryEligibility(stopped).allowed, true);
  for (const candidate of [run, { ...stopped, pr: {} }, { ...run, status: 'cancelled', claimedAt: 'date' }, { ...stopped, recoveryRunId: 'new' }]) assert.equal(recoveryEligibility(candidate).allowed, false);
  for (const status of ['reserved', 'uncertain', 'completed']) assert.equal(recoveryEligibility(stopped, [{ runId: 'r', status, totalTokens: null }]).allowed, false);
  assert.equal(recoveryEligibility({ ...run, status: 'cancelled', claimedAt: 'date', workerFinishedAt: 'date' }).allowed, true);
});
test('merged, closed and changed PR heads use different handoffs', () => {
  const base = { ...run, status: 'ready_for_review', pr: { sha: 'head' }, ci: { passed: true } };
  assert.equal(runView({ ...base, prState: { merged: true } }, {}, [], now).action, 'discover');
  assert.match(runView({ ...base, prState: { state: 'closed' } }, {}, [], now).title, /without merge/);
  const changed = runView({ ...base, prState: { headMismatch: true } }, {}, [], now);
  assert.equal(changed.tone, 'stopped'); assert.notEqual(changed.trail.find(s => s.key === 'ci').state, 'complete');
  const recovered = runView({ ...base, status: 'awaiting_ci', ci: { passed: false }, prState: { candidateUnconfirmed: true } }, {}, [], now);
  assert.match(recovered.title, /candidate is unconfirmed/); assert.equal(recovered.tone, 'neutral'); assert.equal(recovered.action, 'pr');
});
test('active repair overrides older completed-stage evidence and unsafe diagnostics stay readable', () => {
  const view = runView({ ...run, stage: 'repair', events: [{ fromStage: 'builder', stage: 'build_and_playwright', status: 'running' }] }, {}, [], now);
  assert.equal(view.trail.find(s => s.key === 'build').state, 'working');
  assert.match(diagnosticText({ reason: 'Legacy malformed response' }), /unknown provenance/);
  assert.equal(runView({ ...run, status: 'ready_for_review', pr: { sha: 'head' }, ci: { passed: true } }, {}, [], now).trail.find(s => s.key === 'build').state, 'unrecorded');
  assert.equal(runView({ ...run, kind: 'baseline', status: 'baseline_review' }, { status: 'baseline_needed', baseline: { passed: true, supported: true } }, [], now).action, 'discover');
});

test('post-merge prerequisites never mask a queued, active or stale baseline worker', () => {
  const project = { status: 'baseline_needed', baseline: { passed: true, supported: true, approved: false } };
  const active = runView({ ...run, kind: 'baseline', stage: 'build_and_playwright' }, project, [], now);
  assert.equal(active.tone, 'working'); assert.equal(active.responsibility, 'Factory'); assert.equal(active.action, null);
  assert.equal(active.trail.find(s => s.key === 'tests').state, 'working');
  assert.equal(runView({ ...run, kind: 'baseline', status: 'queued' }, project, [], now).action, null);
  const stale = runView({ ...run, kind: 'baseline', stage: 'build_and_playwright' }, project, [], now + 120001);
  assert.equal(stale.tone, 'neutral'); assert.match(stale.title, /unconfirmed/); assert.equal(stale.action, null);
});

test('one baseline source is relevant, while superseded discovery evidence stays historical', () => {
  const project = { id: 'p', status: 'baseline_review', baseline: { runId: 'source', sha: 'base', passed: true, supported: true, approved: false } };
  const old = { ...run, id: 'old', projectId: 'p', kind: 'baseline', status: 'baseline_review', createdAt: '2026-10-03T08:00:00Z', workerFinishedAt: '2026-10-03T08:01:00Z' };
  const source = { ...old, id: 'source', createdAt: '2026-10-03T07:59:00Z', workerFinishedAt: '2026-10-03T08:02:00Z' };
  const previousFailure = { ...old, id: 'failed', status: 'failed', createdAt: '2026-10-03T07:00:00Z', workerFinishedAt: '2026-10-03T07:01:00Z' };
  const selection = baselineSelection(project, [old, source, previousFailure]);
  assert.equal(selection.current.id, source.id); assert.equal(historicalBaseline(source, selection), false);
  assert.equal(historicalBaseline(old, selection), true); assert.equal(historicalBaseline(previousFailure, selection), true);
  const view = runView(old, { ...project, baseline: { ...project.baseline, approved: true } }, [], now, false, true);
  assert.equal(view.action, null); assert.equal(view.trail.find(s => s.key === 'baseline').state, 'unrecorded'); assert.match(view.title, /Earlier/);
  const legacy = baselineSelection({ ...project, baseline: { ...project.baseline, runId: undefined } }, [old, source]);
  assert.equal(legacy.current.id, source.id);
  assert.equal(baselineSelection({ ...project, baseline: { ...project.baseline, runId: 'unavailable' } }, [old, source]).current, undefined);
  const pending = { ...old, id: 'active', status: 'running', createdAt: '2026-10-03T09:00:00Z' };
  const refreshed = baselineSelection(project, [old, source, pending]); assert.equal(refreshed.busy, true); assert.equal(historicalBaseline(pending, refreshed), false);
  const approved = { ...project, baseline: { ...project.baseline, approved: true } };
  for (const status of ['running', 'queued', 'failed']) {
    const refresh = runView({ ...pending, status, stage: 'build_and_playwright' }, approved, [], now);
    assert.equal(refresh.trail.find(s => s.key === 'baseline').state, 'pending', status);
  }
  assert.equal(runView(source, approved, [], now).trail.find(s => s.key === 'baseline').state, 'complete');
  assert.equal(runView(old, approved, [], now).trail.find(s => s.key === 'baseline').state, 'unrecorded');
});
