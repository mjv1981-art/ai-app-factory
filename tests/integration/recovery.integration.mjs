import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from './support.mjs';
import { FactoryService } from '../../server/service.mjs';
import { Engine } from '../../worker/engine.mjs';
import { Artifacts } from '../../server/artifacts.mjs';
import { id, hash } from '../../factory/policy.mjs';
import { defaultLimits } from '../../factory/usage.mjs';

async function setup() {
  const store = await database(), owner = 'owner';
  let sha = 'base', authorized = true, state = { state: 'open', merged: false, headSha: 'head' };
  const github = { dispatch: async () => {}, currentSha: async () => sha, authorized: async () => { if (!authorized) throw Object.assign(new Error('Access denied.'), { status: 403 }); },
    pullRequest: async () => ({ ...state }), checks: async (_repo, checkedSha, required) => ({ sha: checkedSha, required, passed: true }) };
  const project = { id: id(), repository: 'owner/app', name: 'app', type: 'existing', branch: 'main', status: 'ready', requiredChecks: ['playwright'], baseline: { approved: true, supported: true, passed: true, sha: 'base' } };
  const plan = { title: 'Add a label', profile: 'STANDARD', baseSha: 'base', files: ['src/App.jsx'], infrastructure: [], criteria: ['A label renders'], milestones: ['Build it'], risks: [], reasons: ['UI change'] };
  const previous = { id: id(), projectId: project.id, kind: 'enhancement', action: 'execute', plan, planHash: hash(plan), approvedHash: hash(plan), status: 'failed', stage: 'release_review', error: 'Stopped', failure: { code: 'REVIEW_STOP', at: new Date().toISOString() }, review: { verdict: 'STOP', risks: ['Needs clarification'] }, createdAt: new Date().toISOString(), limits: defaultLimits };
  await store.put('projects', project, owner); await store.put('runs', previous, owner);
  const service = new FactoryService({ store, github, owner });
  return { store, service, github, project, previous, setSha: value => { sha = value }, setAccess: value => { authorized = value }, setState: value => { state = value } };
}
test('concurrent clarification creates one linked unapproved plan and preserves evidence and usage', async () => {
  const f = await setup();
  try {
    const usage = { id: id(), runId: f.previous.id, totalTokens: 100, costUsd: 0, status: 'completed' }; await f.store.put('usage', usage, 'owner');
    const input = { clarification: 'Keep data local and clarify the label.', revision: f.previous.planHash };
    const [a, b] = await Promise.all([f.service.replan(f.previous.id, input, 'token'), f.service.replan(f.previous.id, input, 'token')]);
    assert.equal(a.id, b.id); assert.equal(a.action, 'plan'); assert.equal(a.approvedHash, undefined); assert.equal(a.recoveryOf, f.previous.id);
    const old = await f.store.get('runs', f.previous.id, 'owner'); assert.equal(old.status, 'failed'); assert.deepEqual(old.review, f.previous.review);
    assert.equal((await f.store.list('messages', 'owner')).length, 1); assert.equal((await f.store.list('usage', 'owner')).length, 1);
    await assert.rejects(f.service.replan(f.previous.id, { ...input, clarification: 'Different request' }, 'token'));
    await assert.rejects(f.service.approve(a.id, f.previous.planHash));
    assert.equal((await f.store.list('runs', 'owner')).length, 2);
  } finally { await f.store.pool.end(); }
});
test('recovery validates owner, exact revision, authorization, accepted base and unresolved accounting', async () => {
  const f = await setup(), input = { clarification: 'Clarify the change', revision: f.previous.planHash };
  try {
    await assert.rejects(new FactoryService({ store: f.store, github: f.github, owner: 'other' }).replan(f.previous.id, input, 'token'));
    await assert.rejects(f.service.replan(f.previous.id, { ...input, revision: 'wrong' }, 'token'));
    f.setAccess(false); await assert.rejects(f.service.replan(f.previous.id, input, 'token')); f.setAccess(true);
    f.setSha('advanced'); await assert.rejects(f.service.replan(f.previous.id, input, 'token'), /Repository changed/); f.setSha('base');
    await f.store.put('usage', { id: id(), runId: f.previous.id, status: 'uncertain', totalTokens: null, reservedTokens: 900 }, 'owner');
    await assert.rejects(f.service.replan(f.previous.id, input, 'token'), /unresolved usage/);
    assert.equal((await f.store.list('runs', 'owner')).length, 1);
  } finally { await f.store.pool.end(); }
});
test('active and cancelled-but-unacknowledged workers cannot be replanned', async () => {
  const f = await setup(), input = { clarification: 'Clarify the change', revision: f.previous.planHash };
  try {
    await f.store.updateRun('owner', f.previous.id, { status: 'running', claimedAt: new Date().toISOString() });
    await assert.rejects(f.service.replan(f.previous.id, input, 'token'));
    await f.service.cancel(f.previous.id); await assert.rejects(f.service.replan(f.previous.id, input, 'token'));
    await f.store.updateRun('owner', f.previous.id, { workerFinishedAt: new Date().toISOString() });
    assert.equal((await f.service.replan(f.previous.id, input, 'token')).approvedHash, undefined);
  } finally { await f.store.pool.end(); }
});
test('new-project revision keeps its identity and enforces provisioned repository access and base', async () => {
  const f = await setup(), input = { clarification: 'Use three local checklist labels.', revision: f.previous.planHash };
  try {
    await f.store.put('projects', { ...f.project, type: 'new', status: 'planning' }, 'owner');
    await f.store.updateRun('owner', f.previous.id, { kind: 'create', provisionedBaseSha: 'base', branch: 'main' });
    f.setAccess(false); await assert.rejects(f.service.replan(f.previous.id, input, 'token')); f.setAccess(true);
    f.setSha('changed'); await assert.rejects(f.service.replan(f.previous.id, input, 'token')); f.setSha('base');
    const revised = await f.service.replan(f.previous.id, input, 'token');
    assert.equal(revised.kind, 'create'); assert.equal(revised.projectId, f.project.id); assert.equal(revised.provisionedBaseSha, 'base');
    assert.equal((await f.store.list('projects', 'owner')).length, 1);
  } finally { await f.store.pool.end(); }
});
test('read-only lifecycle checks distinguish merged and closed and reject CI on a changed PR head', async () => {
  const f = await setup();
  try {
    await f.store.updateRun('owner', f.previous.id, { pr: { sha: 'head', number: 1 }, status: 'awaiting_ci' });
    f.setState({ state: 'open', headSha: 'changed' }); await f.service.check(f.previous.id);
    let run = await f.store.get('runs', f.previous.id, 'owner'); assert.equal(run.status, 'awaiting_ci'); assert.equal(run.ci.sha, 'changed'); assert.equal(run.ci.passed, false);
    f.setState({ state: 'closed', merged: false, headSha: 'head' }); await f.service.check(run.id);
    assert.equal((await f.store.get('runs', run.id, 'owner')).status, 'closed_unmerged'); assert.equal((await f.store.get('projects', f.project.id, 'owner')).baseline.approved, true);
    f.setSha('merged-sha'); f.setState({ state: 'closed', merged: true, headSha: 'head' }); await f.service.check(run.id);
    assert.equal((await f.store.get('runs', run.id, 'owner')).status, 'merged'); assert.equal((await f.store.get('projects', f.project.id, 'owner')).baseline.approved, false);
    await assert.rejects(f.service.request(f.project.id, 'Another change'));
  } finally { await f.store.pool.end(); }
});

test('merged polling preserves concurrent current baseline discovery and requires its explicit approval', async () => {
  const f = await setup();
  try {
    await f.store.updateRun('owner', f.previous.id, { pr: { sha: 'head', number: 1 }, status: 'awaiting_ci' });
    f.setSha('merged-sha'); f.setState({ state: 'closed', merged: true, headSha: 'head' });
    const checks = f.github.checks;
    f.github.checks = async (...args) => {
      await f.store.put('projects', { ...f.project, status: 'baseline_review', baseline: { ...f.project.baseline, sha: 'merged-sha', approved: false } }, 'owner');
      return checks(...args);
    };
    await f.service.check(f.previous.id);
    let project = await f.store.get('projects', f.project.id, 'owner');
    assert.equal(project.status, 'baseline_review'); assert.equal(project.baseline.sha, 'merged-sha'); assert.equal(project.baseline.approved, false);
    await assert.rejects(f.service.request(project.id, 'Another change'));
    f.github.checks = checks;
    // Complete another real discovery immediately before the invalidation write,
    // beyond the earlier GitHub-read interleaving. Preserve its latest fields.
    await f.store.put('projects', f.project, 'owner');
    const query = f.store.pool.query;
    let completedAtWrite = false;
    f.store.pool.query = async (sql, args) => {
      if (sql.startsWith('UPDATE factory_records SET') && sql.includes("collection='projects'")) {
        f.store.pool.query = query; completedAtWrite = true;
        await f.store.put('projects', { ...project, name: 'Freshly discovered project' }, 'owner');
      }
      return query(sql, args);
    };
    await f.service.check(f.previous.id);
    project = await f.store.get('projects', project.id, 'owner');
    assert.equal(completedAtWrite, true); assert.equal(project.name, 'Freshly discovered project');
    assert.equal(project.status, 'baseline_review'); assert.equal(project.baseline.sha, 'merged-sha'); assert.equal(project.baseline.approved, false);
    await f.service.check(f.previous.id);
    assert.equal((await f.store.get('projects', project.id, 'owner')).status, 'baseline_review');
    await f.service.approveBaseline(project.id, 'merged-sha'); await f.service.check(f.previous.id);
    project = await f.store.get('projects', project.id, 'owner'); assert.equal(project.status, 'ready'); assert.equal(project.baseline.approved, true);
    f.setSha('later-commit'); await f.service.check(f.previous.id);
    project = await f.store.get('projects', project.id, 'owner'); assert.equal(project.status, 'baseline_needed'); assert.equal(project.baseline.approved, false);
  } finally { await f.store.pool.end(); }
});
test('stage history is durable, bounded and does not grow on heartbeats or duplicate updates', async () => {
  const f = await setup();
  try {
    const before = await f.store.get('runs', f.previous.id, 'owner');
    for (let i = 0; i < 4; i++) await f.store.updateRun('owner', before.id, { heartbeatAt: new Date().toISOString() });
    assert.equal((await f.store.get('runs', before.id, 'owner')).events.length, before.events.length);
    await f.store.updateRun('owner', before.id, { stage: 'repair' }); await f.store.updateRun('owner', before.id, { stage: 'repair' });
    assert.equal((await f.store.get('runs', before.id, 'owner')).events.length, before.events.length + 1);
    for (let i = 0; i < 164; i++) await f.store.updateRun('owner', before.id, { stage: 'stage-' + i });
    const saved = await f.store.get('runs', before.id, 'owner');
    assert.equal(saved.events.length, 160); assert.ok(saved.omittedEvents >= 6); assert.equal(saved.events.at(-1).stage, 'stage-163');
    await assert.rejects(f.store.get('runs', before.id, 'other'));
  } finally { await f.store.pool.end(); }
});
test('revision planning uses current context and execution still requires fresh approval', async () => {
  const f = await setup();
  try {
    f.github.snapshot = async () => ({ sha: 'base', branch: 'main', files: { 'src/App.jsx': { content: '<h1>Before</h1>', encoding: 'utf-8' } } });
    const revised = await f.service.replan(f.previous.id, { clarification: 'Clarify the label.', revision: f.previous.planHash }, 'token');
    let providerCalls = 0;
    const engine = new Engine({ store: f.store, github: f.github, owner: 'owner', artifacts: new Artifacts(f.store, {}), provider: { json: async (_r, stage, _i, input) => { providerCalls++; assert.equal(stage, 'planner'); assert.equal(input.baseSha, 'base'); assert.equal(input.recovery.review.verdict, 'STOP'); return { ...f.previous.plan, title: 'Clarified label' }; } } });
    await engine.execute(revised.id);
    const ready = await f.store.get('runs', revised.id, 'owner'); assert.equal(ready.status, 'awaiting_approval'); assert.notEqual(ready.planHash, f.previous.planHash);
    await assert.rejects(f.service.approve(ready.id, f.previous.planHash)); assert.equal(providerCalls, 1);
    await f.service.approve(ready.id, ready.planHash); assert.equal((await f.store.get('runs', ready.id, 'owner')).approvedHash, ready.planHash);
  } finally { await f.store.pool.end(); }
});
test('a superseded awaiting-approval plan cannot execute using its original approval', async () => {
  const f = await setup();
  try {
    await f.store.updateRun('owner', f.previous.id, { status: 'awaiting_approval', action: 'plan' });
    await f.service.replan(f.previous.id, { clarification: 'Change the plan.', revision: f.previous.planHash }, 'token');
    await assert.rejects(f.service.approve(f.previous.id, f.previous.planHash), /unsuperseded/);
    assert.equal((await f.store.get('runs', f.previous.id, 'owner')).status, 'awaiting_approval');
  } finally { await f.store.pool.end(); }
});
test('retry and revision races are mutually exclusive and retry deliveries are idempotent', async () => {
  const f = await setup();
  try {
    await f.store.put('projects', { ...f.project, type: 'new', status: 'planning' }, 'owner');
    await f.store.updateRun('owner', f.previous.id, { kind: 'create', provisionedBaseSha: 'base', branch: 'main', verification: { passed: true }, qa: { verdict: 'PASS' } });
    await f.store.put('snapshots', { id: f.previous.id, sha: 'new', branch: 'main', files: {} }, 'owner');
    const results = await Promise.allSettled([f.service.replan(f.previous.id, { clarification: 'Clarify it.', revision: f.previous.planHash }, 'token'), f.service.retryFailedCreate(f.previous.id)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await f.store.list('runs', 'owner')).length, 2);
    const failed = { ...f.previous, id: id(), kind: 'create', branch: 'main', provisionedBaseSha: 'base', verification: { passed: true }, qa: { verdict: 'PASS' } };
    await f.store.put('runs', failed, 'owner'); await f.store.put('snapshots', { id: failed.id, sha: 'new', branch: 'main', files: {} }, 'owner');
    const [a, b] = await Promise.all([f.service.retryFailedCreate(failed.id), f.service.retryFailedCreate(failed.id)]); assert.equal(a.id, b.id);
    await assert.rejects(f.service.replan(failed.id, { clarification: 'Another revision', revision: failed.planHash }, 'token'));
  } finally { await f.store.pool.end(); }
});
test('cancelled publication retains read-only merge evidence even when CI cannot be read', async () => {
  const f = await setup();
  try {
    await f.store.updateRun('owner', f.previous.id, { status: 'awaiting_ci', pr: { sha: 'head', number: 1 } }); await f.service.cancel(f.previous.id);
    f.setState({ state: 'closed', merged: true, headSha: 'head' }); f.setSha('merged');
    f.github.checks = async () => { throw new Error('CI unavailable'); }; await f.service.check(f.previous.id);
    const record = await f.store.get('runs', f.previous.id, 'owner'); assert.equal(record.status, 'cancelled'); assert.equal(record.prState.merged, true); assert.equal(record.ci.passed, false); assert.match(record.prReadError, /CI could not/);
  } finally { await f.store.pool.end(); }
});
test('knowledge retains bounded current, historical and proposed provenance across refresh', async () => {
  const f = await setup();
  try {
    const base = { id: f.project.id, projectId: f.project.id, sha: 'base', documents: [{ path: 'docs/DECISIONS.md', content: 'Accepted decision' }] };
    await f.store.saveKnowledge('owner', base);
    await f.store.saveKnowledge('owner', { ...base, id: f.project.id + ':proposal:head', sha: 'head', status: 'proposed_in_pr', documents: [{ path: 'docs/DECISIONS.md', content: 'Proposed decision' }] });
    let records = (await f.store.list('knowledge', 'owner')).filter(k => k.projectId === f.project.id);
    assert.equal(records.length, 2); assert.equal(records.find(k => k.id === f.project.id).documents[0].content, 'Accepted decision');
    await f.store.saveKnowledge('owner', { ...base, sha: 'next' });
    assert.equal((await f.store.get('knowledge', f.project.id + ':baseline:base', 'owner')).status, 'historical_baseline');
    for (let i = 0; i < 10; i++) await f.store.saveKnowledge('owner', { ...base, id: f.project.id + ':proposal:' + i, sha: 'proposal-' + i, status: 'proposed_in_pr' });
    records = (await f.store.list('knowledge', 'owner')).filter(k => k.projectId === f.project.id); assert.equal(records.length, 8); assert.equal(records.find(k => k.id === f.project.id).sha, 'next');
    const legacy = { ...base, id: id(), projectId: 'legacy', status: 'proposed_in_pr' }; legacy.id = legacy.projectId;
    await f.store.saveKnowledge('owner', legacy); await f.store.saveKnowledge('owner', { ...legacy, sha: 'new-base', status: undefined });
    assert.equal((await f.store.get('knowledge', 'legacy:proposal:base', 'owner')).status, 'proposed_in_pr');
  } finally { await f.store.pool.end(); }
});
test('maximum-length clarification remains valid without losing the original request', async () => {
  const f = await setup();
  try {
    await f.store.updateRun('owner', f.previous.id, { request: 'a'.repeat(12000) });
    const clarified = 'b'.repeat(12000);
    const revised = await f.service.replan(f.previous.id, { clarification: clarified, revision: f.previous.planHash }, 'token');
    assert.equal(revised.request, clarified); assert.equal(revised.recoveryContext.priorRequest.length, 12000);
  } finally { await f.store.pool.end(); }
});
test('late publication after cancellation is retained, never revives execution and prevents recovery', async () => {
  const f = await setup();
  try {
    await f.store.updateRun('owner', f.previous.id, { status: 'queued', stage: 'plan_ready', request: 'Add a label' });
    const snapshot = { id: f.previous.id, sha: 'base', branch: 'main', files: { 'src/App.jsx': { encoding: 'utf-8', content: '<h1>Before</h1>' } } };
    await f.store.put('snapshots', snapshot, 'owner');
    let started, finish;
    const publishing = new Promise(resolve => { started = resolve }), wait = new Promise(resolve => { finish = resolve });
    f.github.publish = async () => { started(); await wait; return { sha: 'head', number: 1, url: 'https://github.com/owner/app/pull/1' }; };
    const provider = { json: async (_r, stage, _instruction, input) => stage === 'builder' ? { files: { 'src/App.jsx': '<h1>Candidate</h1>' } } : stage === 'qa' ? { verdict: 'PASS', findings: [], criteria: ['A label renders'] } : { verdict: 'SAFE_TO_REVIEW', files_to_commit: input.expectedFilesToCommit, risks: [] } };
    const sandbox = { verify: async () => ({ passed: true, stats: { expected: 2, skipped: 0 }, results: [], evidence: {}, preview: {} }) };
    const engine = new Engine({ store: f.store, github: f.github, owner: 'owner', provider, sandbox, artifacts: new Artifacts(f.store, {}) });
    const work = engine.execute(f.previous.id);
    await Promise.race([publishing, work.then(async () => { throw new Error('Publication was not reached: ' + (await f.store.get('runs', f.previous.id, 'owner')).error); })]);
    await f.service.cancel(f.previous.id); finish(); await work;
    const final = await f.store.get('runs', f.previous.id, 'owner'); assert.equal(final.status, 'cancelled'); assert.equal(final.pr.number, 1); assert.ok(final.workerFinishedAt);
    await assert.rejects(f.service.replan(final.id, { clarification: 'Try again', revision: final.planHash }, 'token'), /pull request/);
  } finally { await f.store.pool.end(); }
});
test('an unresolved publishing stop cannot be replayed and reconciliation only reads existing publication', async () => {
  const f = await setup();
  try {
    await f.store.updateRun('owner', f.previous.id, { stage: 'publishing' });
    await assert.rejects(f.service.replan(f.previous.id, { clarification: 'Try again', revision: f.previous.planHash }, 'token'), /publication may have completed/);
    f.github.publicationForRun = async () => null;
    assert.equal((await f.service.reconcilePublication(f.previous.id, 'token')).found, false);
    await assert.rejects(f.service.replan(f.previous.id, { clarification: 'Try again', revision: f.previous.planHash }, 'token'));
    f.github.publicationForRun = async () => ({ number: 1, sha: 'head', url: 'https://github.com/owner/app/pull/1' });
    await f.service.reconcilePublication(f.previous.id, 'token');
    const recovered = await f.store.get('runs', f.previous.id, 'owner');
    assert.equal(recovered.pr.number, 1); assert.equal(recovered.pr.sha, null);
    assert.equal(recovered.prState.candidateUnconfirmed, true); assert.equal(recovered.ci.passed, false); assert.equal(recovered.status, 'awaiting_ci');
    assert.equal((await f.store.list('runs', 'owner')).length, 1);
  } finally { await f.store.pool.end(); }
});
test('a recovered PR cannot adopt externally changed content as the reviewed candidate', async () => {
  const f = await setup();
  try {
    await f.store.updateRun('owner', f.previous.id, { stage: 'publishing', qa: { verdict: 'PASS' }, review: { verdict: 'SAFE_TO_REVIEW' }, reviewPassed: true });
    f.github.publicationForRun = async () => ({ number: 1, sha: 'externally-changed', url: 'https://github.com/owner/app/pull/1' });
    f.setState({ state: 'open', headSha: 'externally-changed' });
    await f.service.reconcilePublication(f.previous.id, 'token');
    let recovered = await f.store.get('runs', f.previous.id, 'owner');
    assert.equal(recovered.pr.observedSha, 'externally-changed'); assert.equal(recovered.pr.sha, null);
    assert.equal(recovered.status, 'awaiting_ci'); assert.equal(recovered.ci.passed, false);
    await f.service.check(recovered.id);
    recovered = await f.store.get('runs', recovered.id, 'owner');
    assert.equal(recovered.prState.candidateUnconfirmed, true); assert.equal(recovered.ci.passed, false);
  } finally { await f.store.pool.end(); }
});
test('concurrent access confirmations cannot reset a claimed worker or dispatch twice', async () => {
  const f = await setup();
  try {
    await f.store.updateRun('owner', f.previous.id, { kind: 'create', status: 'awaiting_repository_access', stage: 'repository_access_required' });
    const gates = [], entered = [];
    f.github.authorized = async () => { await new Promise(resolve => { gates.push(resolve); entered.splice(0).forEach(done => done()); }); };
    const untilEntered = count => gates.length >= count ? Promise.resolve() : new Promise(resolve => entered.push(resolve)).then(() => untilEntered(count));
    const a = f.service.resumeRepositoryAccess(f.previous.id, 'token'); await untilEntered(1);
    const b = f.service.resumeRepositoryAccess(f.previous.id, 'token'); await untilEntered(2);
    gates[0](); assert.equal((await a).dispatch, true);
    await f.store.claim('owner', f.previous.id);
    gates[1](); assert.equal((await b).dispatch, false);
    const run = await f.store.get('runs', f.previous.id, 'owner');
    assert.equal(run.status, 'running'); await assert.rejects(f.store.claim('owner', run.id));
    assert.equal((await f.store.list('audit', 'owner')).filter(e => e.event === 'repository.access_confirmed').length, 1);
  } finally { await f.store.pool.end(); }
});
test('a prior-phase worker cannot acknowledge or refresh a newer execution claim', async () => {
  const f = await setup();
  try {
    await f.store.updateRun('owner', f.previous.id, { status: 'queued' });
    const first = await f.store.claim('owner', f.previous.id);
    await f.store.updateRun('owner', first.id, { status: 'queued' });
    const second = await f.store.claim('owner', first.id);
    assert.notEqual(first.workerClaimId, second.workerClaimId);
    await f.service.cancel(second.id);
    await f.store.updateRun('owner', first.id, { workerFinishedAt: 'old-finish', heartbeatAt: 'old-heartbeat' }, first.workerClaimId);
    const current = await f.store.get('runs', second.id, 'owner'); assert.equal(current.workerFinishedAt, null); assert.equal(current.heartbeatAt, second.heartbeatAt);
    await assert.rejects(f.service.replan(current.id, { clarification: 'Try again', revision: current.planHash }, 'token'), /acknowledge/);
    await f.store.updateRun('owner', second.id, { workerFinishedAt: new Date().toISOString() }, second.workerClaimId);
    assert.equal((await f.service.replan(second.id, { clarification: 'Try again', revision: current.planHash }, 'token')).approvedHash, undefined);
  } finally { await f.store.pool.end(); }
});
test('a renewed repository-access pause can resume while an older Continue request stays idempotent', async () => {
  const f = await setup();
  try {
    await f.store.put('projects', { ...f.project, type: 'new', status: 'awaiting_repository_access' }, 'owner');
    const plan = { ...f.previous.plan, baseSha: 'new' };
    await f.store.updateRun('owner', f.previous.id, { kind: 'create', status: 'awaiting_repository_access', stage: 'repository_access_required', request: 'Add a label', plan, planHash: hash(plan), approvedHash: hash(plan) });
    await f.store.put('snapshots', { id: f.previous.id, sha: 'new', branch: 'main', files: {} }, 'owner');
    let releaseOld, oldEntered; const entered = new Promise(resolve => { oldEntered = resolve });
    f.github.authorized = async (_repo, token) => { if (token === 'old-click') { oldEntered(); await new Promise(resolve => { releaseOld = resolve; }); } };
    const oldClick = f.service.resumeRepositoryAccess(f.previous.id, 'old-click'); await entered;
    assert.equal((await f.service.resumeRepositoryAccess(f.previous.id, 'token')).dispatch, true);
    f.github.createRepository = async () => {};
    f.github.snapshot = async () => { throw Object.assign(new Error('Access is still propagating'), { githubStatus: 404 }); };
    await new Engine({ store: f.store, github: f.github, owner: 'owner' }).execute(f.previous.id);
    const paused = await f.store.get('runs', f.previous.id, 'owner'); assert.equal(paused.status, 'awaiting_repository_access'); assert.equal(paused.repositoryAccessConfirmedAt, null);
    releaseOld(); assert.equal((await oldClick).dispatch, false); assert.equal((await f.store.get('runs', f.previous.id, 'owner')).status, 'awaiting_repository_access');
    assert.equal((await f.service.resumeRepositoryAccess(f.previous.id, 'token')).dispatch, true);
    assert.equal((await f.store.get('runs', f.previous.id, 'owner')).status, 'queued');
  } finally { await f.store.pool.end(); }
});
