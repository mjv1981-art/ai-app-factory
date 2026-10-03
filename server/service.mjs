import { id, hash, invariant, repoName } from '../factory/policy.mjs';
import { defaultLimits, totals } from '../factory/usage.mjs';
import { recoveryEligibility, failure } from '../factory/recovery.mjs';

export class FactoryService {
  constructor({ store, github, owner, artifacts }) { Object.assign(this, { store, github, owner, artifacts }); this.prRefreshes = new Map(); }
  async dashboard() {
    // Bounded, read-only reconciliation. In-flight keys prevent overlapping polls.
    if (this.github.pullRequest) {
      const candidates = (await this.store.list('runs', this.owner)).filter(r => r.pr && Date.now() - (this.prRefreshes.get(r.id) || 0) > 60000).slice(0, 3);
      await Promise.all(candidates.map(async r => {
        this.prRefreshes.set(r.id, Date.now());
        try { await this.check(r.id); }
        catch { await this.store.updateRun(this.owner, r.id, { prReadError: 'GitHub state could not be refreshed. Last known evidence is retained.' }); }
      }));
    }
    const [projects, runs, usage] = await Promise.all(['projects', 'runs', 'usage'].map(c => this.store.list(c, this.owner)));
    return { projects, runs: runs.map(r => ({ ...r, snapshot: undefined, staleHeartbeat: r.status === 'running' && (!r.heartbeatAt || Date.now() - new Date(r.heartbeatAt).getTime() > 120000) })), usage, totals: totals(usage), serverAt: new Date().toISOString() };
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
    if (await this.github.currentSha(project.repository, project.branch) !== project.baseline.sha) throw failure('STALE_BASE', 'Repository changed; discover and approve its current baseline first.');
    invariant(typeof request === 'string' && request.trim() && request.length <= 12000, 'Request must contain 1–12000 characters.');
    await this.store.put('messages', { id: id(), projectId, role: 'user', content: request, at: new Date().toISOString() }, this.owner);
    return this.queue(project, 'enhancement', request);
  }
  async approve(runId, revision) {
    return this.store.transaction(async tx => {
      const run = await tx.get('runs', runId, this.owner);
      if (!(run.status === 'awaiting_approval' && !run.recoveryRunId && !run.retryRunId && run.planHash === revision && hash(run.plan) === revision)) throw failure('APPROVAL_MISMATCH', 'Approval does not match the current unsuperseded plan.');
      const project = await tx.get('projects', run.projectId, this.owner);
      if (run.kind !== 'create' && await this.github.currentSha(project.repository, run.branch) !== run.plan.baseSha) throw failure('STALE_BASE', 'Repository changed since planning; discover its baseline and request a new plan.');
      await tx.put('runs', { ...run, status: 'queued', action: 'execute', approvedHash: revision, approvedAt: new Date().toISOString(), createdAt: new Date().toISOString() }, this.owner);
      await tx.audit(this.owner, 'plan.approved', { runId, revision });
      return { runId };
    });
  }
  async approveBaseline(projectId, sha) {
    const project = await this.store.get('projects', projectId, this.owner);
    invariant(project.status === 'baseline_review', 'Discover and review the current baseline before approval.', 409);
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
    invariant(run.kind === 'create' && (run.status === 'awaiting_repository_access' || run.repositoryAccessConfirmedAt), 'Run is not waiting for repository access.', 409);
    const project = await this.store.get('projects', run.projectId, this.owner);
    await this.github.authorized(project.repository, userToken);
    return this.store.transaction(async tx => {
      const current = await tx.get('runs', runId, this.owner);
      if (current.repositoryAccessConfirmedAt) return { runId, dispatch: false };
      if (current.workerClaimId !== run.workerClaimId) return { runId, dispatch: false };
      invariant(current.kind === 'create' && current.status === 'awaiting_repository_access', 'Run is no longer waiting for repository access.', 409);
      const latestProject = await tx.get('projects', current.projectId, this.owner), now = new Date().toISOString();
      await tx.put('projects', { ...latestProject, status: 'planning' }, this.owner);
      await tx.put('runs', { ...current, status: 'queued', stage: 'repository_access_confirmed', repositoryAccessConfirmedAt: now, createdAt: now, error: null }, this.owner);
      await tx.audit(this.owner, 'repository.access_confirmed', { runId, repository: project.repository });
      return { runId, dispatch: true };
    });
  }
  async retryFailedCreate(runId) {
    return this.store.transaction(async tx => {
      const previous = await tx.get('runs', runId, this.owner);
      if (previous.retryRunId) return tx.get('runs', previous.retryRunId, this.owner);
      const eligibility = recoveryEligibility(previous, await tx.list('usage', this.owner));
      invariant(eligibility.allowed, eligibility.reason, 409);
      const retryableStages = ['builder', 'build_and_playwright', 'independent_qa', 'repair', 'release_review'];
      invariant(previous.kind === 'create' && previous.action === 'execute' && previous.status === 'failed' && retryableStages.includes(previous.stage), 'Only a failed pre-publication new-project run can be retried.', 409);
      invariant(previous.plan && previous.planHash === previous.approvedHash && hash(previous.plan) === previous.approvedHash, 'The approved plan revision is no longer valid.', 409);
      if (previous.stage === 'release_review') invariant(previous.verification?.passed && previous.qa?.verdict === 'PASS', 'The release-review failure lacks required verification or QA evidence.', 409);
      const project = await tx.get('projects', previous.projectId, this.owner);
      invariant(project.type === 'new', 'Only new projects can use this retry path.', 409);
      invariant(previous.provisionedBaseSha && await this.github.currentSha(project.repository, previous.branch) === previous.provisionedBaseSha, 'Repository changed after the failed run; create a new plan.', 409);
      const snapshot = await tx.get('snapshots', previous.id, this.owner);
      const run = { id: id(), projectId: previous.projectId, kind: previous.kind, action: 'execute', request: previous.request,
        status: 'queued', stage: 'retry_queued', branch: previous.branch, plan: previous.plan, planHash: previous.planHash,
        approvedHash: previous.approvedHash, approvedAt: previous.approvedAt, limits: { ...previous.limits }, retryOf: previous.id,
        provisionedBaseSha: previous.provisionedBaseSha, createdAt: new Date().toISOString() };
      await tx.put('snapshots', { ...snapshot, id: run.id }, this.owner);
      await tx.put('runs', run, this.owner);
      await tx.put('runs', { ...previous, retryRunId: run.id }, this.owner);
      await tx.audit(this.owner, 'run.retried', { runId: run.id, retryOf: previous.id, reason: previous.stage });
      return run;
    });
  }
  async replan(runId, { clarification, revision }, userToken) {
    invariant(typeof clarification === 'string' && clarification.trim() && clarification.length <= 12000, 'Clarification must contain 1–12000 characters.');
    return this.store.transaction(async tx => {
      const previous = await tx.get('runs', runId, this.owner);
      invariant(revision === (previous.planHash || previous.failure?.at || previous.createdAt), 'Recovery revision is stale.', 409);
      const fingerprint = hash({ clarification: clarification.trim(), revision });
      if (previous.recoveryRunId) {
        invariant(previous.recoveryFingerprint === fingerprint, 'A different revised plan already exists for this run.', 409);
        return tx.get('runs', previous.recoveryRunId, this.owner);
      }
      invariant(!previous.retryRunId, 'A retry already exists. Review that run before revising.', 409);
      const eligibility = recoveryEligibility(previous, await tx.list('usage', this.owner));
      invariant(eligibility.allowed, eligibility.reason, 409);
      const project = await tx.get('projects', previous.projectId, this.owner);
      if (previous.kind !== 'create') {
        await this.github.authorized(project.repository, userToken);
        invariant(project.baseline?.approved && project.status === 'ready', 'Discover and approve the baseline before revising an enhancement.', 409);
        if (await this.github.currentSha(project.repository, project.branch) !== project.baseline.sha) throw failure('STALE_BASE', 'Repository changed; discover and approve the current baseline first.');
      } else if (previous.provisionedBaseSha) {
        await this.github.authorized(project.repository, userToken);
        if (await this.github.currentSha(project.repository, previous.branch) !== previous.provisionedBaseSha) throw failure('STALE_BASE', 'The new repository changed. Connect and approve its current baseline before further work.');
      }
      const now = new Date().toISOString();
      const run = { id: id(), projectId: project.id, kind: previous.kind, action: 'plan', status: 'queued', stage: 'revision_queued',
        request: clarification.trim(),
        clarification: clarification.trim(), recoveryOf: previous.id, provisionedBaseSha: previous.provisionedBaseSha,
        recoveryContext: { priorRequest: previous.request, failure: previous.failure, qa: previous.qa, review: previous.review, priorPlan: previous.plan },
        limits: { ...previous.limits || defaultLimits }, createdAt: now };
      await tx.put('runs', run, this.owner);
      await tx.put('runs', { ...previous, recoveryRunId: run.id, recoveryFingerprint: fingerprint }, this.owner);
      await tx.put('messages', { id: id(), projectId: project.id, role: 'user', content: clarification.trim(), recoveryOf: previous.id, at: now }, this.owner);
      await tx.audit(this.owner, 'plan.revision_requested', { runId: run.id, recoveryOf: previous.id, revision });
      return run;
    });
  }
  async check(runId) {
    const run = await this.store.get('runs', runId, this.owner);
    invariant(run.pr, 'No pull request exists.', 409);
    const project = await this.store.get('projects', run.projectId, this.owner);
    const prState = this.github.pullRequest ? await this.github.pullRequest(project.repository, run.pr.number) : { state: 'open', headSha: run.pr.sha };
    prState.candidateUnconfirmed = !run.pr.sha;
    prState.headMismatch = !!run.pr.sha && prState.headSha !== run.pr.sha;
    prState.checkedAt = new Date().toISOString();
    let ci, ciReadError = null;
    try { ci = await this.github.checks(project.repository, prState.headSha, project.requiredChecks); }
    catch { ci = { sha: prState.headSha, required: project.requiredChecks, checks: [], passed: false }; ciReadError = 'GitHub CI could not be read. Readiness is unconfirmed; the recorded PR lifecycle is retained.'; }
    ci.passed = ci.passed && !prState.headMismatch && !prState.candidateUnconfirmed;
    const status = prState.merged ? 'merged' : prState.state === 'closed' ? 'closed_unmerged' : ci.passed ? 'ready_for_review' : 'awaiting_ci';
    await this.store.updateRun(this.owner, runId, { ci, prState, status, prReadError: ciReadError });
    if (prState.merged) {
      const currentSha = await this.github.currentSha(project.repository, project.branch || 'main');
      // Atomically invalidate only a mismatched baseline in the current row.
      // Ordinary worker upserts can complete during GitHub reads or afterward;
      // never write the older project snapshot over that fresh discovery.
      await this.store.pool.query(`UPDATE factory_records SET
        data=jsonb_set(CASE WHEN jsonb_typeof(data->'baseline')='object' THEN jsonb_set(data, '{baseline,approved}', 'false'::jsonb) ELSE data END, '{status}', '"baseline_needed"'::jsonb),
        updated_at=now()
        WHERE collection='projects' AND id=$1 AND owner=$2
        AND data#>>'{baseline,sha}' IS DISTINCT FROM $3`, [project.id, this.owner, currentSha]);
    }
    return { ...ci, prState };
  }
  async reconcilePublication(runId, userToken) {
    const run = await this.store.get('runs', runId, this.owner);
    invariant(run.stage === 'publishing' && ['failed', 'cancelled'].includes(run.status), 'No unresolved publication exists for this run.', 409);
    const project = await this.store.get('projects', run.projectId, this.owner);
    await this.github.authorized(project.repository, userToken);
    const pr = await this.github.publicationForRun(project.repository, run.id);
    if (!pr) {
      await this.store.updateRun(this.owner, runId, { publicationRead: { at: new Date().toISOString(), found: false } });
      return { found: false, explanation: 'No pull request was confirmed. Publication remains unresolved; no new run was authorized.' };
    }
    // A branch lookup proves that a PR exists, not that its current head is the
    // candidate covered by this run's QA/review. A lost publication response has
    // no trusted commit identity; retain the link without certifying its content.
    await this.store.updateRun(this.owner, runId, { pr: { ...pr, observedSha: pr.sha, sha: run.pr?.sha || null }, status: 'awaiting_ci', publicationRead: { at: new Date().toISOString(), found: true } });
    return this.check(runId);
  }
}
