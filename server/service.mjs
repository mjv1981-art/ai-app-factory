import { id, hash, invariant, repoName } from '../factory/policy.mjs';
import { defaultLimits, totals } from '../factory/usage.mjs';

export class FactoryService {
  constructor({ store, github, owner, artifacts }) { Object.assign(this, { store, github, owner, artifacts }); }
  async dashboard() {
    const [projects, runs, usage] = await Promise.all(['projects', 'runs', 'usage'].map(c => this.store.list(c, this.owner)));
    return { projects, runs: runs.map(r => ({ ...r, snapshot: undefined, staleHeartbeat: r.status === 'running' && r.heartbeatAt && Date.now() - new Date(r.heartbeatAt).getTime() > 120000 })), usage, totals: totals(usage) };
  }
  async queue(project, kind, request = '', extras = {}) {
    const run = { id: id(), projectId: project.id, kind, action: kind === 'baseline' ? 'baseline' : 'plan', request,
      status: 'queued', createdAt: new Date().toISOString(), limits: { ...defaultLimits }, ...extras };
    await this.store.put('runs', run, this.owner);
    await this.store.audit(this.owner, 'run.created', { runId: run.id, projectId: project.id, kind });
    await this.dispatch(run.id); return this.store.get('runs', run.id, this.owner);
  }
  async dispatch(runId) {
    const run = await this.store.get('runs', runId, this.owner);
    invariant(run.status === 'queued', 'Only queued work can be dispatched.', 409);
    try { await this.github.dispatch(runId); await this.store.updateRun(this.owner, runId, { dispatchError: null }); }
    catch (error) { await this.store.updateRun(this.owner, runId, { dispatchError: error.message }); }
  }
  async connect({ repository, requiredChecks = [], runnerPlatform = 'linux' }, userToken) {
    repoName(repository);
    invariant(Array.isArray(requiredChecks) && requiredChecks.every(v => typeof v === 'string' && v.length < 160), 'Required checks must be a list of names.');
    invariant(runnerPlatform === 'linux', 'This adapter currently supports Linux projects; existing Windows-only baselines need a Windows adapter.');
    await this.github.authorized(repository, userToken);
    const project = { id: id(), name: repository.split('/')[1], repository, type: 'existing', status: 'discovering', requiredChecks, runnerPlatform };
    await this.store.put('projects', project, this.owner); await this.queue(project, 'baseline'); return project;
  }
  async create({ name, request, visibility }) {
    invariant(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/.test(name || '') && visibility === 'private', 'New projects require a valid name and private visibility.');
    invariant(typeof request === 'string' && request.trim() && request.length <= 12000, 'Describe the app in 1–12000 characters.');
    const project = { id: id(), name, repository: `${this.owner}/${name}`, type: 'new', status: 'planning', requiredChecks: ['playwright'], runnerPlatform: 'linux' };
    await this.store.put('projects', project, this.owner); await this.queue(project, 'create', request); return project;
  }
  async request(projectId, request) {
    const project = await this.store.get('projects', projectId, this.owner);
    invariant(project.status === 'ready' && project.baseline?.approved, 'Approve the project baseline before enhancements.', 409);
    invariant(typeof request === 'string' && request.trim() && request.length <= 12000, 'Request must contain 1–12000 characters.');
    await this.store.put('messages', { id: id(), projectId, role: 'user', content: request, at: new Date().toISOString() }, this.owner);
    return this.queue(project, 'enhancement', request);
  }
  async approve(runId, revision) {
    return this.store.transaction(async tx => {
      const run = await tx.get('runs', runId, this.owner);
      invariant(run.status === 'awaiting_approval' && run.planHash === revision && hash(run.plan) === revision, 'Approval does not match the current plan.', 409);
      const project = await tx.get('projects', run.projectId, this.owner);
      if (run.kind !== 'create') invariant(await this.github.currentSha(project.repository, run.branch) === run.plan.baseSha, 'Repository changed since planning; request a new plan.', 409);
      await tx.put('runs', { ...run, status: 'queued', action: 'execute', approvedHash: revision, approvedAt: new Date().toISOString(), createdAt: new Date().toISOString() }, this.owner);
      await tx.audit(this.owner, 'plan.approved', { runId, revision });
      return { runId };
    });
  }
  async approveBaseline(projectId, sha) {
    const project = await this.store.get('projects', projectId, this.owner);
    invariant(project.baseline?.sha === sha && project.baseline?.supported, 'Compatible baseline revision required.', 409);
    invariant(project.baseline.passed, 'Failing/missing baseline tests require a separate remediation contract; enhancements are blocked.', 409);
    invariant(await this.github.currentSha(project.repository, project.branch) === sha, 'Baseline is stale.', 409);
    project.baseline.approved = true; project.status = 'ready';
    await this.store.put('projects', project, this.owner); await this.store.audit(this.owner, 'baseline.approved', { projectId, sha });
    return project;
  }
  async cancel(runId) {
    const run = await this.store.get('runs', runId, this.owner);
    invariant(!['ready_for_review', 'failed', 'cancelled'].includes(run.status), 'Run is already finished.', 409);
    await this.store.updateRun(this.owner, runId, { status: 'cancelled' }); await this.store.audit(this.owner, 'run.cancelled', { runId });
  }
  async resumeRepositoryAccess(runId, userToken) {
    const run = await this.store.get('runs', runId, this.owner);
    invariant(run.kind === 'create' && run.status === 'awaiting_repository_access', 'Run is not waiting for repository access.', 409);
    const project = await this.store.get('projects', run.projectId, this.owner);
    await this.github.authorized(project.repository, userToken);
    await this.store.put('projects', { ...project, status: 'planning' }, this.owner);
    await this.store.updateRun(this.owner, runId, { status: 'queued', stage: 'repository_access_confirmed', createdAt: new Date().toISOString(), error: null });
    await this.store.audit(this.owner, 'repository.access_confirmed', { runId, repository: project.repository });
    return { runId };
  }
  async check(runId) {
    const run = await this.store.get('runs', runId, this.owner);
    invariant(run.pr, 'No pull request exists.', 409);
    const project = await this.store.get('projects', run.projectId, this.owner);
    const ci = await this.github.checks(project.repository, run.pr.sha, project.requiredChecks);
    await this.store.updateRun(this.owner, runId, { ci, status: ci.passed ? 'ready_for_review' : 'awaiting_ci' }); return ci;
  }
}
