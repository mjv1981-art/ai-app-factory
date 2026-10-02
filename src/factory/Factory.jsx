import { useCallback, useEffect, useState } from 'react'
import './factory.css'

const label = value => (value || '').replaceAll('_', ' ')
const format = value => value == null ? 'Unknown' : Number(value).toLocaleString()
const activeStates = ['queued', 'running', 'awaiting_approval', 'awaiting_repository_access', 'awaiting_ci']

export default function Factory() {
  const [session, setSession] = useState(null)
  const [data, setData] = useState({ projects: [], runs: [], usage: [], totals: {} })
  const [projectId, setProjectId] = useState(null)
  const [tab, setTab] = useState('Work')
  const [modal, setModal] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [knowledge, setKnowledge] = useState([])
  const [messages, setMessages] = useState([])
  const [request, setRequest] = useState('')
  const api = useCallback(async (path, input) => {
    const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...(input ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session?.csrf || '' }, body: JSON.stringify(input) } : {}) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Request failed')
    return result
  }, [session?.csrf])
  const refresh = useCallback(async () => setData(await api('/dashboard')), [api])
  useEffect(() => { let alive = true; api('/session').then(s => { if (alive) setSession(s) }).catch(e => { if (alive) setError(e.message) }); return () => { alive = false } }, [api])
  useEffect(() => {
    if (!session?.owner) return
    const update = () => refresh().catch(e => setError(e.message))
    update(); const timer = setInterval(update, 4000); return () => clearInterval(timer)
  }, [refresh, session?.owner])
  useEffect(() => {
    if (!projectId) return
    let alive = true
    Promise.all([api(`/projects/${projectId}/knowledge`), api(`/projects/${projectId}/messages`)]).then(([k, m]) => { if (alive) { setKnowledge(k); setMessages(m) } }).catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [projectId, data.runs, api])
  async function act(fn) {
    setBusy(true); setError('')
    try { await fn(); await refresh() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const project = data.projects.find(p => p.id === projectId)
  const runs = data.runs.filter(r => !projectId || r.projectId === projectId)
  const usage = data.usage.filter(u => !projectId || u.projectId === projectId)
  const reported = usage.reduce((n, u) => n + (u.totalTokens || 0), 0)
  const unknown = usage.filter(u => u.totalTokens == null).length

  if (!session?.owner) return <main className="factory-shell factory-welcome">
    <div className="factory-brand"><span className="factory-mark">F</span> AI Factory <small>WORKSPACE</small></div>
    <section className="factory-hero"><p className="factory-eyebrow">FROM IDEA TO EVIDENCE</p><h1>Your product.<br />A clear path to shipping.</h1>
      <p>Describe the outcome. Review the plan. Follow the build, tests, and every token in one workspace.</p>
      <a className="factory-primary" href="/api/auth/login">Continue with GitHub <span>↗</span></a>
      <p className="factory-note">Private projects · Human release approval · Free models first</p>
    </section>
    {error && <p role="alert" className="factory-error">{error}</p>}
    <section className="factory-card factory-setup"><h2>Service setup</h2><p>These connections are needed before real runs can start.</p>
      {session && Object.entries(session.setup || {}).filter(([, value]) => typeof value === 'boolean').map(([key, value]) => <div className="factory-row" key={key}><span>{label(key)}</span><span className={`factory-badge ${value ? 'good' : ''}`}>{key === 'paidModels' ? 'Disabled' : value ? 'Connected' : 'Not configured'}</span></div>)}
      <small>Deployment status: live hosted acceptance pending.</small>
    </section>
  </main>

  return <div className="factory-shell factory-layout">
    <aside className="factory-sidebar"><button className="factory-brand" onClick={() => setProjectId(null)}><span className="factory-mark">F</span> AI Factory</button>
      <p className="factory-eyebrow">WORKSPACE</p><button className={`factory-nav ${!projectId ? 'selected' : ''}`} onClick={() => { setProjectId(null); setTab('Work') }}>◫ &nbsp; Overview</button>
      <div className="factory-row factory-project-heading"><span>YOUR PROJECTS</span><button aria-label="Connect a project" onClick={() => setModal('connect')}>+</button></div>
      {data.projects.map(p => <button key={p.id} className={`factory-nav ${projectId === p.id ? 'selected' : ''}`} onClick={() => { setProjectId(p.id); setTab('Work') }}><span className="factory-project-icon">{p.name[0].toUpperCase()}</span><span>{p.name}<small>{label(p.status)}</small></span></button>)}
      <div className="factory-sidebar-bottom"><span className="factory-dot" /> Free models only<p>Paid fallback is disabled.</p><hr /><strong>{session.owner}</strong><button className="factory-link" onClick={() => act(async () => { await api('/logout', {}); setSession(null) })}>Sign out</button></div>
    </aside>
    <main className="factory-main">
      <header className="factory-topbar"><span>Workspace <span className="factory-muted">/ {project?.name || 'Overview'}</span></span><span className="factory-badge">HUMAN MERGE REQUIRED</span></header>
      <section className="factory-title"><div><p className="factory-eyebrow">{project ? 'PROJECT WORKSPACE' : 'PRODUCT DELIVERY, IN VIEW'}</p><h1>{project?.name || 'What will you build next?'}</h1><p>{project ? project.repository : 'Bring an existing project, or start with an idea. Keep the decisions and evidence together.'}</p></div><div className="factory-actions"><button onClick={() => setModal('connect')}>Connect repository</button><button className="factory-primary" onClick={() => setModal('create')}>+ New project</button></div></section>
      {error && <div role="alert" className="factory-error">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      <section className="factory-metrics" aria-label="Usage overview">
        <Metric title="Active runs" value={runs.filter(r => activeStates.includes(r.status)).length} note="Across the selected scope" />
        <Metric title="Reported tokens" value={format(reported)} note={unknown ? `${unknown} attempt(s) have unknown usage` : 'Provider-reported input + output'} />
        <Metric title="Known model cost" value={`$${usage.reduce((n, u) => n + (u.costUsd || 0), 0).toFixed(4)}`} note={`${usage.filter(u => u.costUsd == null).length} unknown · Hosting tracked separately`} />
        <Metric title="Release policy" value="You decide" note="Factory never auto-merges" />
      </section>
      <nav className="factory-tabs" aria-label="Workspace sections">{['Work', 'Usage', 'Knowledge'].map(t => <button key={t} aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>{t}</button>)}</nav>
      {tab === 'Work' && <>
        {project?.baseline && <section className="factory-card"><div className="factory-row"><h2>Project baseline</h2><span className="factory-badge">{project.baseline.passed ? 'Tests passed' : 'Incomplete / failing'}</span></div><p>{project.baseline.stack} · {project.baseline.tests.length} test files · Commit <code>{project.baseline.sha.slice(0, 8)}</code></p>{project.baseline.unknowns.map((u, i) => <p className="factory-note" key={i}>{u}</p>)}<div className="factory-actions"><button disabled={busy || !project.baseline.passed || project.baseline.approved} onClick={() => act(() => api(`/projects/${project.id}/baseline`, { sha: project.baseline.sha }))}>{project.baseline.approved ? 'Baseline approved' : 'Approve baseline'}</button><button disabled={busy} onClick={() => act(() => api(`/projects/${project.id}/refresh`, {}))}>Refresh baseline</button></div></section>}
        {project && !project.baseline && <button disabled={busy} onClick={() => act(() => api(`/projects/${project.id}/refresh`, {}))}>Discover baseline after repository access / merge</button>}
        {project && <section className="factory-card"><h2>Product conversation</h2>{messages.slice().reverse().map(m => <p className="factory-message" key={m.id}><small>You</small>{m.content}</p>)}<form onSubmit={e => { e.preventDefault(); act(async () => { await api(`/projects/${project.id}/request`, { request }); setRequest('') }) }}><label htmlFor="factory-request">What outcome do you want?</label><textarea id="factory-request" value={request} onChange={e => setRequest(e.target.value)} placeholder="Describe the user problem, expected behavior, and what should stay unchanged…" required maxLength={12000} /><div className="factory-row"><small>Scope and estimated limits are reviewed before implementation.</small><button className="factory-primary" disabled={busy || project.status !== 'ready'}>Plan enhancement →</button></div></form></section>}
        <section className="factory-run-section"><div className="factory-row"><h2>{project ? 'Project runs' : 'Recent activity'}</h2><span className="factory-muted">{runs.length} runs</span></div>
          {!runs.length && <div className="factory-empty"><span>◇</span><h2>A clean slate. A deliberate start.</h2><p>Connect a repository to understand its baseline, or describe a new app.</p><button className="factory-primary" onClick={() => setModal('create')}>Start a project</button></div>}
          {runs.map(run => <Run key={run.id} run={run} busy={busy} act={act} api={api} />)}
        </section>
      </>}
      {tab === 'Usage' && <section className="factory-card"><h2>Every attempt, accounted for</h2><p>Unknown usage retains its budget reservation. Cached and reasoning tokens are subsets, not additional totals.</p><div className="factory-table-wrap"><table><thead><tr><th>Stage / model</th><th>Input</th><th>Output</th><th>Cached</th><th>Reasoning</th><th>Total</th><th>Cost</th><th>Time</th></tr></thead><tbody>{usage.map(u => <tr key={u.id}><td>{label(u.stage)}<small>{u.actualModel || u.requestedModel} · {u.status}</small></td><td>{format(u.inputTokens)}</td><td>{format(u.outputTokens)}</td><td>{format(u.cachedTokens)}</td><td>{format(u.reasoningTokens)}</td><td>{format(u.totalTokens)}{u.totalTokens == null && <small>{format(u.reservedTokens)} reserved</small>}</td><td>{u.costUsd == null ? 'Unknown' : `$${u.costUsd.toFixed(4)}`}</td><td>{u.elapsedMs == null ? '—' : `${(u.elapsedMs / 1000).toFixed(1)}s`}</td></tr>)}</tbody></table>{!usage.length && <p>No model calls yet. Deterministic work uses no LLM tokens.</p>}</div></section>}
      {tab === 'Knowledge' && <section className="factory-card"><h2>Decisions that stay with the project</h2><p>Product, architecture, and regression context is versioned against repository commits.</p>{!project && <p>Select a project to read its knowledge.</p>}{knowledge.map(k => <div key={k.id}><p>Commit <code>{k.sha}</code> · {k.status || 'baseline'} · {k.inferred ? 'Inferences need review' : 'Confirmed'}</p>{k.documents.map(d => <details key={d.path}><summary>{d.path}{d.truncated ? ' (excerpt)' : ''}</summary><pre>{d.content}</pre></details>)}</div>)}{project && !knowledge.length && <p>Context will appear after baseline discovery.</p>}</section>}
      <footer className="factory-footer">AI Factory <span>Plan clearly. Build deliberately. Ship with evidence.</span></footer>
    </main>
    {modal && <div className="factory-modal-backdrop"><section className="factory-modal" role="dialog" aria-modal="true" aria-labelledby="factory-modal-title"><div className="factory-row"><h2 id="factory-modal-title">{modal === 'create' ? 'Start a new project' : 'Connect a repository'}</h2><button onClick={() => setModal(null)} aria-label="Close dialog">×</button></div>
      <form onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); act(async () => { const p = modal === 'create' ? await api('/projects/create', { name: form.get('name'), request: form.get('description'), visibility: 'private' }) : await api('/projects/connect', { repository: form.get('repository'), requiredChecks: String(form.get('checks')).split(',').map(v => v.trim()).filter(Boolean) }); setProjectId(p.id); setModal(null) }) }}>
        {modal === 'create' ? <><label htmlFor="new-name">Repository name</label><input id="new-name" name="name" required pattern="[A-Za-z0-9][A-Za-z0-9_.-]{0,79}" /><label htmlFor="new-description">Describe the app</label><textarea id="new-description" name="description" required maxLength={12000} /><p className="factory-note">A private React/Vite project. You approve its plan before repository creation.</p></> : <><label htmlFor="repo-name">GitHub repository</label><input id="repo-name" name="repository" placeholder="owner/repository" required /><label htmlFor="repo-checks">Required CI check names (comma-separated)</label><input id="repo-checks" name="checks" placeholder="playwright" /><p className="factory-note">Install the GitHub App on this repository first. Missing required checks will block release readiness.</p></>}
        <button className="factory-primary" disabled={busy}>{busy ? 'Working…' : modal === 'create' ? 'Create a plan' : 'Discover baseline'}</button>
      </form></section></div>}
  </div>
}
function Metric({ title, value, note }) { return <article className="factory-metric"><span>{title}</span><strong>{value}</strong><small>{note}</small></article> }
function Run({ run, busy, act, api }) {
  const [preview, setPreview] = useState(null)
  return <article className="factory-card factory-run"><div className="factory-row"><div><small className="factory-eyebrow">{run.kind} · {run.id.slice(0, 8)}</small><h3>{run.plan?.title || run.request || 'Discover project baseline'}</h3></div><span className={`factory-badge ${run.status === 'ready_for_review' ? 'good' : ''}`}>{label(run.status)}</span></div>
    <p className="factory-muted">{label(run.stage || 'queued')} {run.plan && `· ${run.plan.profile}`}</p>
    {run.staleHeartbeat && <p className="factory-error">Worker heartbeat is stale. Inspect the cloud job; this attempt is not automatically replayed.</p>}
    {run.error && <p className="factory-error">{run.error}</p>}{run.dispatchError && <p className="factory-error">Dispatch unavailable: {run.dispatchError}</p>}
    {run.status === 'awaiting_repository_access' && <p>Repository created privately. Add it to the GitHub App's selected repositories, then continue this approved run.</p>}
    {run.plan && <details open={run.status === 'awaiting_approval'}><summary>Change contract and limits</summary><p>{run.plan.reasons?.join(' ')}</p><ul>{run.plan.criteria.map((c, i) => <li key={i}>{c}</li>)}</ul><p>Files: {run.plan.files.join(', ')}</p><p>Milestones: {run.plan.milestones.join(' → ')}</p>{run.plan.risks.map((r, i) => <p key={i}>{r}</p>)}<p>Run allowance: {format(run.limits.tokens)} tokens · {run.limits.calls} calls · {run.limits.seconds / 60} minutes · Paid models disabled</p><small>Revision {run.planHash?.slice(0, 12)} · Base {run.plan.baseSha.slice(0, 12)}</small></details>}
    {run.verification && <p>Verification: {run.verification.passed ? 'Passed' : 'Failed / insufficient evidence'} · {run.verification.stats?.expected || 0} expected passes · {run.verification.stats?.skipped || 0} skipped</p>}
    <div className="factory-actions">{run.status === 'awaiting_approval' && <button className="factory-primary" disabled={busy} onClick={() => act(() => api(`/runs/${run.id}/approve`, { revision: run.planHash }))}>Approve this plan</button>}
      {run.status === 'queued' && <button disabled={busy} onClick={() => act(() => api(`/runs/${run.id}/dispatch`, {}))}>Retry dispatch</button>}
      {run.status === 'awaiting_repository_access' && <button className="factory-primary" disabled={busy} onClick={() => act(() => api(`/runs/${run.id}/resume`, {}))}>Continue after granting access</button>}
      {run.status === 'failed' && run.kind === 'create' && run.stage === 'release_review' && run.verification?.passed && run.qa?.verdict === 'PASS' && <button className="factory-primary" disabled={busy} onClick={() => act(() => api(`/runs/${run.id}/retry`, {}))}>Retry approved run</button>}
      {activeStates.includes(run.status) && <button disabled={busy} onClick={() => act(() => api(`/runs/${run.id}/cancel`, {}))}>Cancel run</button>}
      {run.pr && <><a className="factory-primary" href={run.pr.url} target="_blank" rel="noreferrer">Review pull request ↗</a><button disabled={busy} onClick={() => act(() => api(`/runs/${run.id}/checks`, {}))}>Check required CI</button></>}
      {run.artifacts?.map(a => a.name === 'preview.json' ? <button key={a.id} disabled={busy} onClick={() => setPreview(`/api/preview/${a.id}`)}>Open preview</button> : <a className="factory-evidence" key={a.id} href={`/api/artifacts/${a.id}`}>{a.name} ↓</a>)}
    </div>{run.ci && <p>{run.ci.passed ? 'Required checks passed on the PR commit.' : 'Required checks are missing, pending or failing.'}</p>}
    {preview && <section><div className="factory-row"><p>Isolated static preview · Network and backend access disabled</p><button onClick={() => setPreview(null)}>Close preview</button></div><iframe title={`Preview: ${run.plan?.title || run.id}`} sandbox="allow-scripts" src={preview} style={{ width: '100%', height: 500, border: '1px solid #d7e1df', borderRadius: 8 }} /></section>}
  </article>
}
