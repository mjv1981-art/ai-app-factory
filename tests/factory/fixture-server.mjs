import http from 'node:http';
import { database } from '../integration/support.mjs';
import { createHandler } from '../../server/http.mjs';
import { FactoryService } from '../../server/service.mjs';
import { Artifacts } from '../../server/artifacts.mjs';
import { id, hash } from '../../factory/policy.mjs';
import { defaultLimits } from '../../factory/usage.mjs';

// Test-only executable. Production imports neither this file nor test auth.
const store = await database(), owner = 'factory-test-owner';
const config = { owner, origin: 'http://127.0.0.1:4312', clientId: 'test', clientSecret: 'test', sessionKey: 'a'.repeat(64), databaseUrl: 'test', appId: 'test', privateKey: 'test', runnerRepository: 'owner/private-runner' };
const artifacts = new Artifacts(store, {});
const github = { authorized: async () => true, dispatch: async () => {}, currentSha: async () => 'base', checks: async () => ({ passed: false, required: ['playwright'], checks: [] }) };
const service = new FactoryService({ store, github, artifacts, owner });
const project = { id: id(), name: 'Orbital Notes', repository: 'factory-test-owner/orbital-notes', status: 'ready', type: 'existing', branch: 'main', baseline: { sha: 'base', passed: true, approved: true, supported: true, stack: 'React / Vite', tests: ['tests/home.spec.js'], unknowns: [] } };
await store.put('projects', project, owner);
const plan = { title: 'Add a quick note action', profile: 'STANDARD', baseSha: 'base', files: ['src/Notes.jsx', 'tests/notes.spec.js'], infrastructure: [], criteria: ['A note can be created from the project workspace.'], milestones: ['Implement note creation', 'Verify the existing journeys'], risks: [], reasons: ['New user interaction requires implementation and tests.'] };
const run = { id: id(), projectId: project.id, kind: 'enhancement', status: 'awaiting_approval', plan, planHash: hash(plan), limits: defaultLimits, createdAt: new Date().toISOString(), branch: 'main' };
const preview = await artifacts.put(owner, run, 'preview.json', Buffer.from(JSON.stringify({ 'dist/index.html': Buffer.from('<h1>Working preview</h1><script>try { parent.document.body.textContent="ESCAPED" } catch { document.body.dataset.isolated="true" }</script>').toString('base64') })), 'application/json');
run.artifacts = [preview]; await store.put('runs', run, owner);
const createProject = { id: id(), name: 'Launch App', repository: 'factory-test-owner/launch-app', status: 'planning', type: 'new', branch: 'main', requiredChecks: ['playwright'] };
await store.put('projects', createProject, owner);
const createPlan = { title: 'Build a launch checklist', profile: 'STANDARD', baseSha: 'new', files: ['src/App.jsx'], infrastructure: [], criteria: ['The checklist renders.'], milestones: ['Build and test the checklist'], risks: [], reasons: ['New application'] };
const failedCreate = { id: id(), projectId: createProject.id, kind: 'create', action: 'execute', status: 'failed', stage: 'release_review', request: 'Build a launch checklist', branch: 'main', plan: createPlan, planHash: hash(createPlan), approvedHash: hash(createPlan), approvedAt: new Date().toISOString(), provisionedBaseSha: 'base', verification: { passed: true, stats: { expected: 2, skipped: 0 } }, qa: { verdict: 'PASS' }, limits: defaultLimits, createdAt: new Date().toISOString(), error: 'Release review did not approve the exact file set.' };
await store.put('runs', failedCreate, owner);
await store.put('snapshots', { id: failedCreate.id, sha: 'new', branch: 'main', files: {} }, owner);
await store.put('usage', { id: id(), runId: run.id, projectId: project.id, stage: 'planner', requestedModel: 'openrouter/free', totalTokens: 1800, inputTokens: 1400, outputTokens: 400, cachedTokens: 0, reasoningTokens: null, costUsd: 0, elapsedMs: 1600, status: 'completed' }, owner);
await store.put('knowledge', { id: project.id, projectId: project.id, sha: 'base', documents: [{ path: 'docs/DECISIONS.md', content: 'Keep notes local until sync is approved.' }], inferred: false }, owner);
const auth = { session: async req => {
  if (req.headers['x-test-deny'] === 'true') throw Object.assign(new Error('Sign in required.'), { status: 401 });
  if (req.method === 'POST' && (req.headers.origin !== config.origin || req.headers['x-csrf-token'] !== 'test-csrf')) throw Object.assign(new Error('CSRF rejected.'), { status: 403 });
  return { owner, csrf: 'test-csrf', token: 'test', id: 'test-session' };
} };
http.createServer(createHandler({ service, auth, config, store, artifacts })).listen(4312, '127.0.0.1');
