import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from './support.mjs';
import { Engine } from '../../worker/engine.mjs';
import { FactoryService } from '../../server/service.mjs';
import { Artifacts } from '../../server/artifacts.mjs';
import { id } from '../../factory/policy.mjs';

export function fixtureFiles() {
  const raw = {
    'src/App.jsx': 'export default () => <h1>Hello world</h1>',
    'package.json': JSON.stringify({ scripts: { build: 'vite build' }, dependencies: { react: '19.2.8' }, devDependencies: { '@playwright/test': '1.63.0' } }),
    'package-lock.json': '{}', 'tests/smoke.spec.js': 'existing test', 'docs/DECISIONS.md': 'Use a green heading.' };
  return Object.fromEntries(Object.entries(raw).map(([p, content]) => [p, { encoding: 'utf-8', content }]));
}
export function verification(passed = true) { return { passed, stats: { expected: passed ? 2 : 0, unexpected: passed ? 0 : 1, skipped: 0 }, results: [{ stage: 'build', code: 0, output: 'build passed' }, { stage: 'playwright', code: passed ? 0 : 1, output: 'browser evidence' }], evidence: {}, preview: { 'dist/index.html': Buffer.from('<h1>Preview</h1>').toString('base64') } }; }

test('baseline → approval → exact enhancement → evidence → PR → CI has no model calls', async () => {
  const store = await database();
  try {
    let published = 0, testCalls = 0, checksPassed = false;
    const github = { authorized: async () => true, dispatch: async () => {}, currentSha: async () => 'base', snapshot: async () => ({ files: fixtureFiles(), sha: 'base', branch: 'main', tree: 'tree', omitted: [] }),
      publish: async () => { published++; return { url: 'https://github.com/owner/app/pull/1', sha: 'head', number: 1 } }, checks: async (_r, sha, required) => ({ passed: checksPassed, sha, required }) };
    const artifacts = new Artifacts(store, {});
    const service = new FactoryService({ store, github, artifacts, owner: 'owner' });
    const engine = new Engine({ store, github, artifacts, owner: 'owner', provider: { json: () => { throw new Error('Exact path must not call a model') } }, sandbox: { verify: async () => { testCalls++; return verification() } } });
    const project = await service.connect({ repository: 'owner/app', requiredChecks: ['playwright'] }, 'session-token');
    let run = (await store.list('runs', 'owner'))[0]; await engine.execute(run.id);
    await service.approveBaseline(project.id, 'base');
    run = await service.request(project.id, 'Replace text "Hello world" with "Welcome aboard"');
    await engine.execute(run.id);
    run = await store.get('runs', run.id, 'owner'); assert.equal(run.status, 'awaiting_approval');
    await service.approve(run.id, run.planHash); await engine.execute(run.id);
    run = await store.get('runs', run.id, 'owner'); assert.equal(run.status, 'awaiting_ci'); assert.equal(published, 1); assert.equal(testCalls, 2);
    assert.equal((await store.list('usage', 'owner')).length, 0);
    assert.equal((await store.list('artifacts', 'owner')).length, 4);
    checksPassed = true; await service.check(run.id); assert.equal((await store.get('runs', run.id, 'owner')).status, 'ready_for_review');
  } finally { await store.pool.end(); }
});
test('failing baseline remains visible and cannot be approved', async () => {
  const store = await database();
  try {
    const github = { authorized: async () => true, dispatch: async () => {}, snapshot: async () => ({ files: fixtureFiles(), sha: 'base', branch: 'main', omitted: [] }) };
    const artifacts = new Artifacts(store, {}), service = new FactoryService({ store, github, artifacts, owner: 'owner' });
    const project = await service.connect({ repository: 'owner/app' }, 'token');
    const engine = new Engine({ store, github, artifacts, owner: 'owner', sandbox: { verify: async () => verification(false) } });
    await engine.execute((await store.list('runs', 'owner'))[0].id);
    await assert.rejects(service.approveBaseline(project.id, 'base'));
    assert.equal((await store.get('projects', project.id, 'owner')).baseline.passed, false);
  } finally { await store.pool.end(); }
});
test('new-project plan requires explicit approval and provisions only a private scoped repository', async () => {
  const store = await database();
  try {
    let provisions = 0, publishes = 0;
    const github = { dispatch: async () => {}, createRepository: async () => { provisions++ }, snapshot: async () => ({ files: {}, sha: 'initial', branch: 'main', omitted: [] }), publish: async () => { publishes++; return { sha: 'head', url: 'https://github.com/owner/app/pull/1' } } };
    const artifacts = new Artifacts(store, {}), service = new FactoryService({ store, github, artifacts, owner: 'owner' });
    const provider = { json: async (_run, stage, _instruction, input) => {
      if (stage === 'planner') return { title: 'Build a notes app', profile: 'STANDARD', baseSha: 'new', files: ['src/App.jsx'], infrastructure: [], criteria: ['A notes heading is visible'], milestones: ['Implement notes UI'], risks: [], reasons: ['New application'] };
      if (stage === 'builder') return { files: { 'src/App.jsx': "import React from 'react'; export default () => <main><h1>Notes</h1></main>" } };
      if (stage === 'qa') return { verdict: 'PASS', criteria: ['A notes heading is visible'], findings: [] };
      if (stage === 'reviewer') return { verdict: 'SAFE_TO_REVIEW', files_to_commit: input.changes.map(c => c.path), risks: [] };
      throw new Error(`Unexpected stage ${stage}`);
    } };
    const engine = new Engine({ store, github, artifacts, provider, owner: 'owner', sandbox: { verify: async () => ({ ...verification(), lockfile: '{}' }) } });
    await service.create({ name: 'notes', request: 'Build a notes app', visibility: 'private' });
    let run = (await store.list('runs', 'owner'))[0]; await engine.execute(run.id); assert.equal(provisions, 0);
    run = await store.get('runs', run.id, 'owner'); assert.equal(run.status, 'awaiting_approval');
    await service.approve(run.id, run.planHash); await engine.execute(run.id);
    const final = await store.get('runs', run.id, 'owner'); assert.equal(final.status, 'awaiting_ci', final.error); assert.equal(provisions, 1); assert.equal(publishes, 1);
  } finally { await store.pool.end(); }
});
test('new-project execution pauses until selected-repository access is granted', async () => {
  const store = await database();
  try {
    let provisions = 0, accessGranted = false;
    const github = {
      dispatch: async () => {},
      createRepository: async () => { provisions++ },
      authorized: async () => { if (!accessGranted) throw Object.assign(new Error('Not installed.'), { status: 404 }); return true },
      snapshot: async () => {
        if (!accessGranted) throw Object.assign(new Error('Not installed.'), { githubStatus: 404 });
        return { files: {}, sha: 'initial', branch: 'main', omitted: [] };
      },
      publish: async () => ({ sha: 'head', url: 'https://github.com/owner/app/pull/1' })
    };
    const artifacts = new Artifacts(store, {}), service = new FactoryService({ store, github, artifacts, owner: 'owner' });
    const provider = { json: async (_run, stage, _instruction, input) => {
      if (stage === 'planner') return { title: 'Build an app', profile: 'STANDARD', baseSha: 'new', files: ['src/App.jsx'], infrastructure: [], criteria: ['The app renders'], milestones: ['Build the app'], risks: [], reasons: ['New application'] };
      if (stage === 'builder') return { files: { 'src/App.jsx': "import React from 'react'; export default () => <main>App</main>" } };
      if (stage === 'qa') return { verdict: 'PASS', criteria: ['The app renders'], findings: [] };
      if (stage === 'reviewer') return { verdict: 'SAFE_TO_REVIEW', files_to_commit: input.changes.map(c => c.path), risks: [] };
      throw new Error(`Unexpected stage ${stage}`);
    } };
    const engine = new Engine({ store, github, artifacts, provider, owner: 'owner', sandbox: { verify: async () => ({ ...verification(), lockfile: '{}' }) } });
    const project = await service.create({ name: 'app', request: 'Build an app', visibility: 'private' });
    let run = (await store.list('runs', 'owner'))[0]; await engine.execute(run.id);
    run = await store.get('runs', run.id, 'owner'); await service.approve(run.id, run.planHash); await engine.execute(run.id);
    run = await store.get('runs', run.id, 'owner');
    assert.equal(run.status, 'awaiting_repository_access');
    assert.equal((await store.get('projects', project.id, 'owner')).status, 'awaiting_repository_access');
    await assert.rejects(service.resumeRepositoryAccess(run.id, 'user-token'));
    accessGranted = true;
    await service.resumeRepositoryAccess(run.id, 'user-token'); await engine.execute(run.id);
    const final = await store.get('runs', run.id, 'owner');
    assert.equal(final.status, 'awaiting_ci', final.error);
    assert.equal(provisions, 2, 'idempotent repository creation is retried after access confirmation');
  } finally { await store.pool.end(); }
});
test('new-project release review retries exact files and a verified failed run can be replayed safely', async () => {
  const store = await database();
  try {
    let provisions = 0, publishes = 0, reviewCalls = 0, currentSha = 'initial';
    const github = { dispatch: async () => {}, createRepository: async () => { provisions++ }, currentSha: async () => currentSha,
      snapshot: async () => ({ files: {}, sha: 'initial', branch: 'main', omitted: [] }),
      publish: async (_repository, _run, _snapshot, _files, changed) => { publishes++; return { sha: 'head', url: 'https://github.com/owner/app/pull/1', changed } } };
    const artifacts = new Artifacts(store, {}), service = new FactoryService({ store, github, artifacts, owner: 'owner' });
    const provider = { json: async (_run, stage, _instruction, input) => {
      if (stage === 'planner') return { title: 'Build an app', profile: 'STANDARD', baseSha: 'new', files: ['src/App.jsx'], infrastructure: [], criteria: ['The app renders'], milestones: ['Build the app'], risks: [], reasons: ['New application'] };
      if (stage === 'builder') return { files: { 'src/App.jsx': "import React from 'react'; export default () => <main>App</main>" } };
      if (stage === 'qa') return { verdict: 'PASS', criteria: ['The app renders'], findings: [] };
      if (stage === 'reviewer') {
        reviewCalls++;
        return { verdict: 'SAFE_TO_REVIEW', files_to_commit: reviewCalls <= 2 ? input.expectedFilesToCommit.slice(1) : input.expectedFilesToCommit, risks: [] };
      }
      throw new Error(`Unexpected stage ${stage}`);
    } };
    const engine = new Engine({ store, github, artifacts, provider, owner: 'owner', sandbox: { verify: async () => ({ ...verification(), lockfile: '{}' }) } });
    await service.create({ name: 'app', request: 'Build an app', visibility: 'private' });
    let failed = (await store.list('runs', 'owner'))[0]; await engine.execute(failed.id);
    failed = await store.get('runs', failed.id, 'owner'); await service.approve(failed.id, failed.planHash); await engine.execute(failed.id);
    failed = await store.get('runs', failed.id, 'owner');
    assert.equal(failed.status, 'failed'); assert.equal(failed.error, 'Release review did not approve the exact file set.');
    assert.equal(failed.reviewAttempts.length, 2); assert.equal(publishes, 0);
    currentSha = 'changed'; await assert.rejects(service.retryFailedCreate(failed.id), /Repository changed/); currentSha = 'initial';
    const builderFailure = { ...failed, id: id(), stage: 'builder', error: 'Provider returned invalid JSON twice; usage retained.', verification: undefined, qa: undefined, review: undefined, reviewAttempts: undefined };
    await store.put('runs', builderFailure, 'owner'); await store.put('snapshots', { ...(await store.get('snapshots', failed.id, 'owner')), id: builderFailure.id }, 'owner');
    const builderRetry = await service.retryFailedCreate(builderFailure.id); assert.equal(builderRetry.status, 'queued'); assert.equal(builderRetry.retryOf, builderFailure.id);
    const retry = await service.retryFailedCreate(failed.id); await engine.execute(retry.id);
    const final = await store.get('runs', retry.id, 'owner');
    assert.equal(final.status, 'awaiting_ci', final.error); assert.equal(final.retryOf, failed.id);
    assert.equal(final.reviewAttempts.length, 1); assert.equal(publishes, 1); assert.equal(provisions, 2);
    assert.deepEqual(final.review.files_to_commit.slice().sort(), final.pr.changed.slice().sort());
  } finally { await store.pool.end(); }
});
test('cross-project artifact requests are denied', async () => {
  const store = await database();
  try { const artifacts = new Artifacts(store, {}); const a = await artifacts.put('owner', { id: id(), projectId: 'private' }, 'report', Buffer.from('private')); await assert.rejects(artifacts.get('other', a.id)); }
  finally { await store.pool.end(); }
});
