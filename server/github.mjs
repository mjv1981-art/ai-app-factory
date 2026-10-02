import { createSign } from 'node:crypto';
import { invariant, repoName, safePath, validateBundle } from '../factory/policy.mjs';

export class GitHub {
  constructor(config, fetcher = fetch) { this.config = config; this.fetcher = fetcher; }
  async request(path, token, method = 'GET', body) {
    invariant(path.startsWith('/') && !path.startsWith('//'), 'Invalid API path.');
    const response = await this.fetcher(`https://api.github.com${path}`, { method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Object.assign(new Error(`GitHub ${method} ${path.split('?')[0]} returned ${response.status}.`), { status: response.status === 404 ? 404 : 502, githubStatus: response.status });
    return response.status === 204 ? null : response.json();
  }
  jwt() {
    const now = Math.floor(Date.now() / 1000);
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const body = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: now - 60, exp: now + 540, iss: this.config.appId })}`;
    const sig = createSign('RSA-SHA256').update(body).sign(this.config.privateKey.replaceAll('\\n', '\n'), 'base64url');
    return `${body}.${sig}`;
  }
  async installation(repo) {
    repoName(repo);
    invariant(repo.split('/')[0].toLowerCase() === this.config.owner.toLowerCase(), 'Repository owner is not allowed.', 403);
    return this.request(`/repos/${repo}/installation`, this.jwt());
  }
  async token(repo, permissions = { contents: 'read', metadata: 'read' }) {
    const installation = await this.installation(repo);
    const data = await this.request(`/app/installations/${installation.id}/access_tokens`, this.jwt(), 'POST', { repositories: [repo.split('/')[1]], permissions });
    return data.token;
  }
  async authorized(repo, userToken) {
    const installation = await this.installation(repo);
    const result = await this.request(`/user/installations/${installation.id}/repositories?per_page=100`, userToken);
    // Single-owner MVP: fail closed for unlisted pages rather than infer user access.
    invariant(result.repositories.some(r => r.full_name.toLowerCase() === repo.toLowerCase() && r.permissions?.push), 'Repository not authorized for this user and installation.', 403);
    return true;
  }
  async snapshot(repo) {
    const token = await this.token(repo);
    const meta = await this.request(`/repos/${repo}`, token);
    const commit = await this.request(`/repos/${repo}/commits/${encodeURIComponent(meta.default_branch)}`, token);
    const tree = await this.request(`/repos/${repo}/git/trees/${commit.commit.tree.sha}?recursive=1`, token);
    invariant(!tree.truncated && tree.tree.length <= 4000, 'Repository tree exceeds supported baseline size.');
    const files = {}, omitted = [];
    for (const entry of tree.tree) {
      if (entry.type === 'tree') continue;
      invariant(entry.type === 'blob' && ['100644', '100755'].includes(entry.mode), `Symlink/submodule unsupported: ${entry.path}`);
      try { safePath(entry.path); } catch { omitted.push(entry.path); continue; }
      invariant(entry.size <= 2_000_000, `File exceeds import limit: ${entry.path}`);
      const blob = await this.request(`/repos/${repo}/git/blobs/${entry.sha}`, token);
      const bytes = Buffer.from(blob.content.replace(/\s/g, ''), 'base64');
      const text = bytes.toString('utf8');
      const isText = !bytes.includes(0) && Buffer.from(text).equals(bytes);
      files[entry.path] = { encoding: isText ? 'utf-8' : 'base64', content: isText ? text : bytes.toString('base64'), mode: entry.mode };
    }
    validateBundle(files);
    return { files, omitted, sha: commit.sha, tree: commit.commit.tree.sha, branch: meta.default_branch, private: meta.private };
  }
  async currentSha(repo, branch) {
    const token = await this.token(repo);
    return (await this.request(`/repos/${repo}/commits/${encodeURIComponent(branch)}`, token)).sha;
  }
  async createRepository(name, marker) {
    invariant(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/.test(name), 'Invalid new repository name.');
    invariant(this.config.creationToken, 'Private repository creation credential is not configured.', 503);
    const identity = await this.request('/user', this.config.creationToken);
    invariant(identity.login.toLowerCase() === this.config.owner.toLowerCase(), 'Repository creation credential owner mismatch.', 403);
    // Explicit marker makes a response lost after creation recoverable without taking over another repo.
    const description = `Created by AI App Factory (${marker})`;
    try {
      const existing = await this.request(`/repos/${this.config.owner}/${name}`, this.config.creationToken);
      invariant(existing.private && existing.description === description, 'Repository name already exists; choose another.');
      return existing;
    } catch (error) { if (error.githubStatus !== 404) throw error; }
    return this.request('/user/repos', this.config.creationToken, 'POST', { name, private: true, auto_init: true, description });
  }
  async publish(repo, run, snapshot, files, changes) {
    const token = await this.token(repo, { contents: 'write', pull_requests: 'write', metadata: 'read', ...(changes.some(p => p.startsWith('.github/workflows/')) ? { workflows: 'write' } : {}) });
    invariant(await this.currentSha(repo, snapshot.branch) === snapshot.sha, 'Base branch advanced; replan and approve again.', 409);
    const branch = `factory/${run.id}`;
    const existing = await this.request(`/repos/${repo}/pulls?head=${encodeURIComponent(repo.split('/')[0] + ':' + branch)}&state=all`, token);
    if (existing.length) return { url: existing[0].html_url, sha: existing[0].head.sha, number: existing[0].number };
    const entries = [];
    for (const path of changes) {
      const entry = files[path];
      const blob = await this.request(`/repos/${repo}/git/blobs`, token, 'POST', { content: entry.content, encoding: entry.encoding === 'base64' ? 'base64' : 'utf-8' });
      entries.push({ path, mode: snapshot.files[path]?.mode || '100644', type: 'blob', sha: blob.sha });
    }
    const tree = await this.request(`/repos/${repo}/git/trees`, token, 'POST', { base_tree: snapshot.tree, tree: entries });
    const commit = await this.request(`/repos/${repo}/git/commits`, token, 'POST', { message: run.plan.title, tree: tree.sha, parents: [snapshot.sha] });
    try { await this.request(`/repos/${repo}/git/refs`, token, 'POST', { ref: `refs/heads/${branch}`, sha: commit.sha }); }
    catch (error) {
      if (error.githubStatus !== 422) throw error;
      const ref = await this.request(`/repos/${repo}/git/ref/heads/${branch}`, token);
      const prior = await this.request(`/repos/${repo}/git/commits/${ref.object.sha}`, token);
      invariant(prior.tree.sha === tree.sha && prior.parents[0]?.sha === snapshot.sha, 'Run branch exists with different content.', 409);
      commit.sha = ref.object.sha;
    }
    const pr = await this.request(`/repos/${repo}/pulls`, token, 'POST', { title: run.plan.title, head: branch, base: snapshot.branch,
      body: `Factory run: ${run.id}\n\nApproved scope: ${run.plan.criteria.join('; ')}\n\nBuild and Playwright results are available in the private Factory dashboard. Human merge required.`, draft: true });
    return { url: pr.html_url, sha: commit.sha, number: pr.number };
  }
  async checks(repo, sha, required) {
    const token = await this.token(repo, { contents: 'read', checks: 'read', statuses: 'read', metadata: 'read' });
    const [checks, statuses] = await Promise.all([
      this.request(`/repos/${repo}/commits/${sha}/check-runs?per_page=100`, token),
      this.request(`/repos/${repo}/commits/${sha}/status`, token),
    ]);
    const results = new Map();
    for (const c of checks.check_runs) if (!results.has(c.name)) results.set(c.name, c.status === 'completed' && c.conclusion === 'success');
    for (const s of statuses.statuses) if (!results.has(s.context)) results.set(s.context, s.state === 'success');
    return { sha, required, checks: [...results].map(([name, passed]) => ({ name, passed })), passed: required.length > 0 && required.every(name => results.get(name) === true) };
  }
  async dispatch(runId) {
    const repo = repoName(this.config.runnerRepository || '');
    const token = await this.token(repo, { actions: 'write', contents: 'read', metadata: 'read' });
    const meta = await this.request(`/repos/${repo}`, token);
    invariant(meta.private, 'Execution repository must be private.', 403);
    return this.request(`/repos/${repo}/actions/workflows/factory-worker.yml/dispatches`, token, 'POST', { ref: meta.default_branch, inputs: { run_id: runId } });
  }
}
