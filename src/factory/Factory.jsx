import { useCallback, useEffect, useRef, useState } from 'react'
import { activeStates, humanLabel, usageSummary, baselineSelection, historicalBaseline } from '../../factory/run-view.mjs'
import RunWorkspace from './RunWorkspace'
import UsageMeter from './UsageMeter'
import './factory.css'

const format = value => value == null ? 'Unknown' : Number(value).toLocaleString()
const priority = r => ({ awaiting_approval: 0, awaiting_repository_access: 0, failed: 1, running: 2, queued: 3, baseline_review: 4, awaiting_ci: 5, ready_for_review: 6 }[r.status] ?? 7)

export default function Factory() {
  const [session, setSession] = useState(null)
  const [data, setData] = useState({ projects: [], runs: [], usage: [] })
  const [projectId, setProjectId] = useState(null), [tab, setTab] = useState('Work'), [modal, setModal] = useState(null)
  const [error, setError] = useState(''), [connectionError, setConnectionError] = useState(''), [updatedAt, setUpdatedAt] = useState(null)
  const [signInRequired, setSignInRequired] = useState(false)
  const [busy, setBusy] = useState({}), actionLocks = useRef(new Set()), refreshLock = useRef(false)
  const [knowledge, setKnowledge] = useState([]), [messages, setMessages] = useState([]), [request, setRequest] = useState('')
  const [paused, setPaused] = useState(() => localStorage.getItem('factory-motion-paused') === 'true')
  const [hidden, setHidden] = useState(() => document.hidden)
  const [observedAt, setObservedAt] = useState(() => Date.now())
  const baselineSection = useRef(null), focusBaseline = useRef(false)
  useEffect(() => { if (focusBaseline.current && baselineSection.current) { baselineSection.current.focus(); focusBaseline.current = false } }, [projectId, tab])
  const api = useCallback(async (path, input) => {
    const response = await fetch('/api' + path, { credentials: 'same-origin', ...(input ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session?.csrf || '' }, body: JSON.stringify(input) } : {}) })
    const result = await response.json()
    if (!response.ok) throw Object.assign(new Error(result.error || 'Request failed'), { status: response.status })
    return result
  }, [session?.csrf])
  const refresh = useCallback(async () => {
    if (refreshLock.current) return
    refreshLock.current = true
    try { const result = await api('/dashboard'); setData(result); setUpdatedAt(result.serverAt || new Date().toISOString()); setConnectionError(''); setSignInRequired(false) }
    catch (e) { setConnectionError(e.message); if (e.status === 401) setSignInRequired(true); throw e }
    finally { refreshLock.current = false }
  }, [api])
  useEffect(() => { let alive = true; api('/session').then(s => { if (alive) setSession(s) }).catch(e => { if (alive) setError(e.message) }); return () => { alive = false } }, [api])
  useEffect(() => {
    if (!session?.owner) return
    const update = () => { setObservedAt(Date.now()); refresh().catch(() => {}) }
    update(); const timer = setInterval(update, 4000); return () => clearInterval(timer)
  }, [refresh, session?.owner])
  useEffect(() => { const update = () => setHidden(document.hidden); document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update) }, [])
  useEffect(() => {
    if (!projectId) return
    let alive = true
    Promise.all([api('/projects/' + projectId + '/knowledge'), api('/projects/' + projectId + '/messages')]).then(([k, m]) => { if (alive) { setKnowledge(k); setMessages(m) } }).catch(e => { if (alive) { setError(e.message); if (e.status === 401) setSignInRequired(true) } })
    return () => { alive = false }
  }, [projectId, data.runs, api])
  async function act(key, fn) {
    if (actionLocks.current.has(key)) return
    actionLocks.current.add(key); setBusy(b => ({ ...b, [key]: true })); setError('')
    try { await fn(); await refresh() } catch (e) { setError(e.message); if (e.status === 401) setSignInRequired(true) } finally { actionLocks.current.delete(key); setBusy(b => ({ ...b, [key]: false })) }
  }
  const project = data.projects.find(p => p.id === projectId)
  const runs = data.runs.filter(r => !projectId || r.projectId === projectId).sort((a, b) => priority(a) - priority(b) || new Date(b.createdAt) - new Date(a.createdAt))
  const usage = data.usage.filter(u => !projectId || u.projectId === projectId), summary = usageSummary(usage)
  const followedUp = new Set(runs.map(r => r.recoveryOf || r.retryOf).filter(Boolean))
  const selections = new Map(data.projects.map(p => [p.id, baselineSelection(p, runs)]))
  const isHistorical = r => historicalBaseline(r, selections.get(r.projectId) || {})
  const current = runs.filter(r => !isHistorical(r) && !r.recoveryRunId && !r.retryRunId && !followedUp.has(r.id) && (activeStates.includes(r.status) || r.status === 'failed' || r.status === 'baseline_review' && !data.projects.find(p => p.id === r.projectId)?.baseline?.approved))
  const fallback = runs.find(r => !isHistorical(r))
  if (project && !current.length && fallback) current.push(fallback)
  const history = runs.filter(r => !current.includes(r))
  const unconfirmed = signInRequired || !!connectionError || !updatedAt || observedAt - new Date(updatedAt).getTime() > 12000
  const openBaseline = id => { if (projectId === id && tab === 'Work') baselineSection.current?.focus(); else { focusBaseline.current = true; setProjectId(id); setTab('Work') } }
  const workspace = run => <RunWorkspace key={run.id} run={run} project={data.projects.find(p => p.id === run.projectId)} usage={usage} busy={busy} act={act} api={api} motionPaused={paused || hidden} connectionUnconfirmed={unconfirmed} now={observedAt} historicalBaseline={isHistorical(run)} openBaseline={openBaseline} />
  const baselineBusy = selections.get(projectId)?.busy
  if (!session?.owner) return <main className="factory-shell factory-welcome">
    <div className="factory-brand"><span className="factory-mark">F</span> AI Factory</div>
    <section className="factory-hero"><p className="factory-eyebrow">FROM IDEA TO REVIEWABLE WORK</p><h1>Your product.<br />A clear path forward.</h1><p>Start with an idea or connect a repository. Follow the plan, build and evidence, with a clear next step at every stage.</p><a className="factory-primary" href="/api/auth/login">Continue with GitHub ↗</a><p className="factory-note">Private projects · Human merge · Free models only</p></section>
    {error && <p role="alert" className="factory-error">{error}</p>}
    <section className="factory-card factory-setup"><h2>Service connections</h2><p>Sign in to check your projects and live runs.</p>{session && Object.entries(session.setup || {}).filter(([key, value]) => typeof value === 'boolean' && key !== 'paidModels').map(([key, value]) => <div className="factory-row" key={key}><span>{humanLabel(key)}</span><span className={'factory-status ' + (value ? 'complete' : 'waiting')}>{value ? 'Configured' : 'Needs setup'}</span></div>)}<p className="factory-note">Paid fallback is disabled. A configured connection is not proof that a run completed.</p></section>
  </main>
  return <div className={'factory-shell factory-layout ' + (paused || hidden || unconfirmed ? 'factory-motion-paused' : '')}>
    <a className="factory-skip" href="#factory-main">Skip to workspace</a>
    <aside className="factory-sidebar"><button className="factory-brand" onClick={() => { setProjectId(null); setTab('Work') }}><span className="factory-mark">F</span> AI Factory</button>
      <p className="factory-eyebrow">WORKSPACE</p><button className={'factory-nav ' + (!projectId ? 'selected' : '')} onClick={() => { setProjectId(null); setTab('Work') }}>◫ Overview</button>
      <div className="factory-project-heading"><span>YOUR PROJECTS</span><button aria-label="Connect a project" onClick={() => setModal('connect')}>+</button></div>
      <nav className="factory-projects" aria-label="Your projects">{data.projects.map(p => <button key={p.id} className={'factory-nav ' + (projectId === p.id ? 'selected' : '')} onClick={() => { setProjectId(p.id); setTab('Work') }}><span className="factory-project-icon" aria-hidden="true">{p.name[0].toUpperCase()}</span><span>{p.name}<small>{p.status === 'ready' ? 'Ready for an enhancement' : p.status === 'baseline_needed' ? 'Review new baseline' : humanLabel(p.status)}</small></span></button>)}</nav>
      <div className="factory-sidebar-bottom"><strong>● Free models only</strong><p>Paid fallback is disabled.</p><hr /><span>{session.owner}</span><button className="factory-link" onClick={() => act('logout', async () => { await api('/logout', {}); setSession(null) })}>Sign out</button></div>
    </aside>
    <main id="factory-main" className="factory-main" tabIndex={-1}>
      <header className="factory-topbar"><span>Workspace / {project?.name || 'Overview'}</span><span className="factory-policy">You own the merge</span></header>
      <section className="factory-title"><div><p className="factory-eyebrow">{project ? 'GUIDED PROJECT WORKSPACE' : 'YOUR NEXT STEP, IN VIEW'}</p><h1>{project?.name || 'What will you build next?'}</h1><p>{project ? project.repository : 'Start with an idea, or bring a project. Follow what happens and see when it is your turn.'}</p></div><div className="factory-actions"><button onClick={() => setModal('connect')}>Connect repository</button><button className="factory-primary" onClick={() => setModal('create')}>+ New project</button></div></section>
      <div className="factory-connection"><span>{signInRequired ? 'Sign-in expired · Last known state retained' : connectionError ? 'Connection interrupted · Last known state retained' : updatedAt ? 'Updated ' + new Date(updatedAt).toLocaleTimeString() + ' · Refreshes every 4 seconds' : 'Connecting to your workspace…'}</span><button className="factory-link" aria-pressed={paused} onClick={() => { const next = !paused; setPaused(next); localStorage.setItem('factory-motion-paused', String(next)) }}>{paused ? 'Resume motion' : 'Pause motion'}</button></div>
      {signInRequired && <div role="alert" className="factory-notice"><p>Your sign-in has expired. Sign in again to continue. Background work continues; no action is automatically retried.</p><a className="factory-primary" href="/api/auth/login">Sign in with GitHub ↗</a></div>}
      {connectionError && !signInRequired && <div role="alert" className="factory-notice">{connectionError} · Activity cannot currently be confirmed. Background work continues; refreshing does not replay it.</div>}
      {error && <div role="alert" className="factory-error">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      <section className="factory-metrics" aria-label="Workspace overview"><Metric title="Needs your attention" value={current.filter(r => ['awaiting_approval', 'awaiting_repository_access', 'failed', 'baseline_review'].includes(r.status)).length} note="Decisions and stopped work" /><Metric title="Worker runs" value={runs.filter(r => ['running', 'queued'].includes(r.status)).length} note="Queued and running · Check freshness below" /><Metric title="Reported tokens" value={format(summary.reported)} note={summary.unknown + ' attempt(s) with pending / unknown usage'} /><Metric title="Known model cost" value={'$' + summary.knownCost.toFixed(4)} note={summary.unknownCost + ' unknown · Hosting tracked separately'} /></section>
      <nav className="factory-tabs" aria-label="Workspace sections">{['Work', 'Usage', 'Knowledge'].map(t => <button key={t} aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>{t}</button>)}</nav>
      {tab === 'Work' && <>
        {project && <section ref={baselineSection} tabIndex={-1} className="factory-card factory-baseline"><div className="factory-row"><h2>Project baseline</h2><span className={'factory-status ' + (project.baseline?.approved ? 'complete' : 'waiting')}>{project.baseline?.approved ? 'Accepted baseline' : 'Your review comes first'}</span></div>
          {selections.get(project.id)?.current && <p className="factory-note">{project.baseline?.runId ? 'Current discovery' : 'Latest recorded discovery'} <code>{selections.get(project.id).current.id.slice(0, 8)}</code> · {new Date(project.baseline?.discoveredAt || selections.get(project.id).current.workerFinishedAt || selections.get(project.id).current.createdAt).toLocaleString()} · Earlier discoveries are in run history.</p>}
          {project.baseline ? <><p>{project.baseline.stack} · {project.baseline.tests?.length || 0} test files · Commit <code>{project.baseline.sha.slice(0, 8)}</code> · {project.baseline.passed ? 'Tests passed' : 'Incomplete / failing'}</p>{project.baseline.unknowns?.map((u, i) => <p key={i}>{u}</p>)}{!project.baseline.approved && <p>{project.baseline.passed && project.baseline.supported ? 'Read the discovered context and approve this commit before enhancements.' : 'Missing tests or unsupported platform prevent approval. Resolve the baseline prerequisite first.'}</p>}</> : <p>{project.type === 'new' ? 'The new-app run appears below. After its PR is merged, discover and approve the accepted baseline.' : 'Discover the repository, verify its tests and review the findings before planning enhancements.'}</p>}
          {project.status === 'baseline_needed' && <p className="factory-notice">The prior baseline is outdated after a merge. Discover and verify the current commit before approving it.</p>}
          <div className="factory-actions">{project.baseline && !project.baseline.approved && project.status === 'baseline_review' && <button className="factory-primary" disabled={!!busy[project.id + ':baseline'] || !project.baseline.passed || !project.baseline.supported || baselineBusy} onClick={() => act(project.id + ':baseline', () => api('/projects/' + project.id + '/baseline', { sha: project.baseline.sha }))}>Approve baseline</button>}<button className={project.status === 'baseline_needed' ? 'factory-primary' : ''} disabled={!!busy[project.id + ':refresh'] || baselineBusy} onClick={() => act(project.id + ':refresh', () => api('/projects/' + project.id + '/refresh', {}))}>{baselineBusy ? 'Baseline discovery in progress' : project.status === 'baseline_needed' ? 'Discover merged baseline' : project.baseline ? 'Refresh baseline' : 'Discover baseline after repository access / merge'}</button></div>
        </section>}
        <section className="factory-run-section" aria-label="Current work"><div className="factory-row"><h2>{project ? 'Current project work' : 'Needs attention & in progress'}</h2><span className="factory-muted">{current.length} current · {history.length} in history</span></div>{!current.length && <div className="factory-empty"><span aria-hidden="true">◇</span><h2>{runs.length ? 'No work needs attention right now.' : 'A clear place to start.'}</h2><p>{runs.length ? 'Past plans, results and usage remain in history.' : 'Connect an existing repository to discover its baseline, or describe a new private app.'}</p><button className="factory-primary" onClick={() => setModal('create')}>Start a project</button></div>}{current.map(workspace)}</section>
        {!!history.length && <details className="factory-history"><summary>Run history · {history.length} runs</summary>{history.map(workspace)}</details>}
        {project && <section className="factory-card"><h2>Product conversation</h2>{messages.slice().reverse().map(m => <p className="factory-message" key={m.id}><small>You{m.recoveryOf ? ' · Plan clarification' : ''}</small>{m.content}</p>)}<form onSubmit={e => { e.preventDefault(); act(project.id + ':request', async () => { await api('/projects/' + project.id + '/request', { request }); setRequest('') }) }}><label htmlFor="factory-request">What outcome do you want?</label><textarea id="factory-request" value={request} onChange={e => setRequest(e.target.value)} placeholder="Describe the user problem, expected behavior, and what should stay unchanged…" required maxLength={12000} /><p className="factory-note">{project.status !== 'ready' || !project.baseline?.approved ? 'Enhancement planning requires a passing, explicitly approved current baseline. Complete the baseline step above first.' : 'Planning proposes scope and limits. You will approve the plan before implementation.'}</p><button className="factory-primary" disabled={!!busy[project.id + ':request'] || project.status !== 'ready' || !project.baseline?.approved}>{busy[project.id + ':request'] ? 'Planning request…' : 'Plan enhancement →'}</button></form></section>}
      </>}
      {tab === 'Usage' && <section className="factory-card"><h2>Every attempt, accounted for</h2><UsageMeter entries={usage} /><p>Cached and reasoning tokens are subsets, not additional totals. Unknown usage retains its budget reservation.</p><div className="factory-table-wrap" role="region" aria-label="Usage attempts" tabIndex={0}><table><thead><tr><th>Run / stage / model</th><th>Input</th><th>Output</th><th>Cached</th><th>Reasoning</th><th>Total</th><th>Cost</th><th>Time</th></tr></thead><tbody>{usage.map(u => <tr key={u.id}><td><a href={'#run-' + u.runId} onClick={() => setTab('Work')}>{u.runId.slice(0, 8)}</a> · {humanLabel(u.stage)}<small>{u.actualModel || u.requestedModel} · {u.status}</small></td><td>{format(u.inputTokens)}</td><td>{format(u.outputTokens)}</td><td>{format(u.cachedTokens)}</td><td>{format(u.reasoningTokens)}</td><td>{format(u.totalTokens)}{u.totalTokens == null && <small>{format(u.reservedTokens)} reserved</small>}</td><td>{u.costUsd == null ? 'Unknown' : '$' + u.costUsd.toFixed(4)}</td><td>{u.elapsedMs == null ? '—' : (u.elapsedMs / 1000).toFixed(1) + 's'}</td></tr>)}</tbody></table>{!usage.length && <p>No model calls yet. Deterministic work uses no LLM tokens.</p>}</div></section>}
      {tab === 'Knowledge' && <section className="factory-card"><h2>Decisions that stay with the project</h2><p>Product, architecture, and regression context is versioned against repository commits.</p>{!project && <p>Select a project to read its knowledge.</p>}{project && knowledge.filter(k => k.projectId === project.id).map(k => <div key={k.id}><p>Commit <code>{k.sha}</code> · {k.status === 'proposed_in_pr' ? 'Proposed in a PR — not the accepted baseline' : k.status === 'historical_baseline' ? 'Historical baseline context' : project.baseline?.approved && project.baseline.sha === k.sha ? 'Accepted baseline context' : 'Discovered context — awaiting baseline approval'} · {k.inferred ? 'Inferences need review' : 'Confirmed'}</p>{k.documents.map(d => <details key={d.path}><summary>{d.path}{d.truncated ? ' (excerpt)' : ''}</summary><pre>{d.content}</pre></details>)}</div>)}{project && !knowledge.length && <p>Context will appear after baseline discovery.</p>}</section>}
      <footer className="factory-footer">AI Factory · Plans, evidence and decisions stay together.</footer>
    </main>
    {modal && <ProjectDialog modal={modal} close={() => setModal(null)} error={error} busy={busy['modal:' + modal]} submit={form => act('modal:' + modal, async () => { const p = modal === 'create' ? await api('/projects/create', { name: form.get('name'), request: form.get('description'), visibility: 'private' }) : await api('/projects/connect', { repository: form.get('repository'), requiredChecks: String(form.get('checks')).split(',').map(v => v.trim()).filter(Boolean) }); setProjectId(p.id); setTab('Work'); setModal(null) })} />}
  </div>
}
function Metric({ title, value, note }) { return <article className="factory-metric"><span>{title}</span><strong>{value}</strong><small>{note}</small></article> }
function ProjectDialog({ modal, close, submit, busy, error }) {
  const dialog = useRef(null)
  useEffect(() => { const prior = document.activeElement; dialog.current.querySelector('input')?.focus(); return () => prior?.focus() }, [])
  const keys = e => {
    if (e.key === 'Escape') close()
    if (e.key !== 'Tab') return
    const items = [...dialog.current.querySelectorAll('button:not(:disabled), input, textarea')], first = items[0], last = items.at(-1)
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
  return <div className="factory-modal-backdrop"><section ref={dialog} onKeyDown={keys} className="factory-modal" role="dialog" aria-modal="true" aria-labelledby="factory-modal-title"><div className="factory-row"><h2 id="factory-modal-title">{modal === 'create' ? 'Start a new project' : 'Connect a repository'}</h2><button onClick={close} aria-label="Close dialog">×</button></div>{error && <p role="alert" className="factory-error">{error}</p>}<form onSubmit={e => { e.preventDefault(); submit(new FormData(e.currentTarget)) }}>
    {modal === 'create' ? <><label htmlFor="new-name">Repository name</label><input id="new-name" name="name" required pattern="[A-Za-z0-9][A-Za-z0-9_.-]{0,79}" /><label htmlFor="new-description">Describe the app</label><textarea id="new-description" name="description" required maxLength={12000} /><p className="factory-note">A private React/Vite project. Review and approve the plan before repository creation. You may need to grant the GitHub App access after creation.</p></> : <><label htmlFor="repo-name">GitHub repository</label><input id="repo-name" name="repository" placeholder="owner/repository" required /><label htmlFor="repo-checks">Required CI check names (comma-separated)</label><input id="repo-checks" name="checks" placeholder="playwright" /><p className="factory-note">Install the GitHub App on this repository first. Missing required checks block release readiness.</p></>}
    <button className="factory-primary" disabled={busy}>{busy ? 'Submitting…' : modal === 'create' ? 'Create a plan' : 'Discover baseline'}</button></form></section></div>
}
