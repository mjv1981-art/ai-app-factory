import { useState } from 'react'
import { runView, humanLabel, activeStates, diagnosticText } from '../../factory/run-view.mjs'
import ProgressTrail from './ProgressTrail'
import FactoryGuide from './FactoryGuide'
import RecoveryPanel from './RecoveryPanel'
import UsageMeter from './UsageMeter'

const time = value => value ? new Date(value).toLocaleString() : 'Not recorded'
export default function RunWorkspace({ run, project, usage, busy, act, api, motionPaused, connectionUnconfirmed, now }) {
  const [preview, setPreview] = useState(null)
  const view = runView(run, project, usage, now, connectionUnconfirmed)
  const animate = view.confirmedActive && !connectionUnconfirmed
  const entries = usage.filter(u => u.runId === run.id)
  const action = (name, title, primary = false, input = {}) => <button className={primary ? 'factory-primary' : ''} disabled={!!busy[`${run.id}:${name}`]} onClick={() => act(`${run.id}:${name}`, () => api(`/runs/${run.id}/${name}`, input))}>{busy[`${run.id}:${name}`] ? `${title}…` : title}</button>
  return <article id={`run-${run.id}`} className={`factory-card factory-run ${connectionUnconfirmed && view.confirmedActive ? 'neutral' : view.tone} ${motionPaused ? 'factory-motion-paused' : ''}`}>
    <header className="factory-run-header"><div><p className="factory-eyebrow">{project?.name || 'Project'} · {run.kind === 'baseline' ? 'Baseline discovery' : run.kind === 'create' ? 'New project' : 'Enhancement'}</p><h3>{run.plan?.title || run.request || 'Discover project baseline'}</h3></div><span className={`factory-status ${connectionUnconfirmed && view.confirmedActive ? 'neutral' : view.tone}`}><span className={animate ? 'factory-spin factory-motion' : 'factory-status-icon'} aria-hidden="true">{animate ? '' : view.tone === 'complete' ? '✓' : view.tone === 'stopped' ? '!' : view.tone === 'waiting' ? '◷' : '○'}</span>{connectionUnconfirmed && view.confirmedActive ? 'Activity unconfirmed' : view.title}</span></header>
    <div className="factory-run-grid"><div>
      <p role="status" className="factory-current">{view.title} · {view.responsibility === 'You' ? 'Your turn' : `${view.responsibility} acts next`}</p>
      <p className="factory-freshness">Worker: {run.status === 'running' ? connectionUnconfirmed ? 'activity unconfirmed; last known heartbeat ' + time(run.heartbeatAt) : view.stale ? 'heartbeat stale / missing' : `last heartbeat ${time(run.heartbeatAt)}` : 'not currently running'}{run.prState?.checkedAt && ` · GitHub checked ${time(run.prState.checkedAt)}`}</p>
      {run.error && <div className="factory-error"><strong>Original diagnostic</strong><p>{run.error}</p></div>}
      {run.dispatchError && <p className="factory-error">Dispatch unavailable: {run.dispatchError}</p>}
      {run.prReadError && <p className="factory-notice">{run.prReadError}</p>}
      <ProgressTrail view={view} animate={animate} />
      <div className="factory-actions factory-next-action">
        {view.action === 'approve' && action('approve', 'Approve this plan', true, { revision: run.planHash })}
        {view.action === 'resume' && action('resume', 'Continue after granting access', true)}
        {view.action === 'dispatch' && action('dispatch', 'Retry dispatch', true)}
        {view.action === 'checks' && action('checks', 'Check required CI', true)}
        {view.action === 'publication' && action('publication', 'Check GitHub publication', true)}
        {view.action === 'pr' && <a className="factory-primary" href={run.pr.url} target="_blank" rel="noreferrer">Review pull request ↗</a>}
        {view.action === 'baseline' && <button className="factory-primary" disabled={!!busy[`${project.id}:baseline`]} onClick={() => act(`${project.id}:baseline`, () => api(`/projects/${project.id}/baseline`, { sha: project.baseline.sha }))}>Approve baseline</button>}
        {view.action === 'discover' && <button className="factory-primary" disabled={!!busy[`${project.id}:refresh`]} onClick={() => act(`${project.id}:refresh`, () => api(`/projects/${project.id}/refresh`, {}))}>Discover merged baseline</button>}
        {run.status === 'queued' && view.action !== 'dispatch' && action('dispatch', 'Retry dispatch')}
        {activeStates.includes(run.status) && action('cancel', 'Cancel run')}
      </div>
      {run.status === 'awaiting_approval' && <p className="factory-note">Approving revision {run.planHash?.slice(0, 12)} authorizes its exact files and limits. A revision requires new approval.</p>}
      {activeStates.includes(run.status) && <p className="factory-note">Closing this page leaves background work running. Cancellation stops later stages; already-sent calls may finish.</p>}
    </div><FactoryGuide view={view} run={run} /></div>
    <UsageMeter entries={entries} limits={run.limits} compact />
    <RecoveryPanel run={run} view={view} act={act} api={api} busy={busy} />
    {run.plan && <details open={run.status === 'awaiting_approval'}><summary>Change contract and limits</summary><p>{run.plan.reasons?.join(' ')}</p><ul>{run.plan.criteria.map((c, i) => <li key={i}>{c}</li>)}</ul><p>Files: {run.plan.files.join(', ')}</p><p>Milestones: {run.plan.milestones.join(' → ')}</p>{run.plan.risks.map((r, i) => <p key={i}>{r}</p>)}<p>Profile: {run.plan.profile} · {run.limits.tokens.toLocaleString()} tokens · {run.limits.calls} calls · {run.limits.seconds / 60} minutes · Paid models disabled</p><small>Revision {run.planHash} · Base {run.plan.baseSha}</small></details>}
    {run.verification && <p>Verification: {run.verification.passed ? 'Passed' : 'Failed / insufficient evidence'} · {run.verification.stats?.expected || 0} expected passes · {run.verification.stats?.skipped || 0} skipped</p>}
    <div className="factory-actions">
      {run.pr && view.action !== 'pr' && <a href={run.pr.url} className="factory-evidence" target="_blank" rel="noreferrer">Review pull request ↗</a>}
      {run.pr && view.action !== 'checks' && action('checks', 'Check required CI')}
      {run.artifacts?.map(a => a.name === 'preview.json' ? <button key={a.id} onClick={() => setPreview(`/api/preview/${a.id}`)}>Open preview</button> : <a className="factory-evidence" key={a.id} href={`/api/artifacts/${a.id}`}>{a.name} ↓</a>)}
    </div>
    <details><summary>Evidence and activity</summary><p>Run <code>{run.id}</code> · {humanLabel(run.stage)} · {run.plan?.profile || 'No model profile yet'} · {humanLabel(run.status)}</p>
      {(run.recoveryOf || run.retryOf) && <p>Linked from <a href={`#run-${run.recoveryOf || run.retryOf}`}>{run.recoveryOf || run.retryOf}</a>. Original spent usage is retained.</p>}
      {run.qaAttempts?.map((q, i) => <div key={i}><strong>Independent QA attempt {i + 1}: {q.verdict}</strong><ul>{q.findings?.map((f, n) => <li key={n}>{diagnosticText(f)}</li>)}</ul><p>{q.criteria?.map(diagnosticText).join(' · ')}</p></div>)}
      {!run.qaAttempts?.length && run.qa && <p>Independent QA: {run.qa.verdict} · {run.qa.findings?.map(diagnosticText).join(' · ')}</p>}
      {(run.reviewAttempts || (run.review ? [run.review] : [])).map((r, i) => <div key={i}><strong>Release-review attempt {i + 1}: {r.verdict}</strong><p>{diagnosticText(r.summary)}</p><ul>{r.risks?.map((risk, n) => <li key={n}>{diagnosticText(risk)}</li>)}</ul><p>Approved file set: {r.files_to_commit?.map(diagnosticText).join(', ') || 'None'}</p></div>)}
      {run.publicationRead && <p>Publication checked {time(run.publicationRead.at)} · {run.publicationRead.found ? 'Existing PR confirmed' : 'No PR confirmed; publication remains unresolved'}</p>}
      {run.verificationAttempts?.map((v, i) => <div key={i}><strong>Verification attempt {i + 1}: {v.passed ? 'Passed' : 'Failed'}</strong><div className="factory-actions">{v.artifacts?.map(a => <a className="factory-evidence" key={a.id} href={`/api/artifacts/${a.id}`}>{a.name} ↓</a>)}</div></div>)}
      {run.ci && <p>{run.ci.passed ? 'Required checks passed on the PR commit.' : 'Required checks are missing, pending or failing.'} Commit <code>{run.ci.sha || run.pr?.sha}</code></p>}
      {run.prState && <p>GitHub: {run.prState.merged ? 'Merged' : run.prState.state} · Actual head <code>{run.prState.headSha}</code></p>}
      {!run.events?.length && <p>This older run has no stage history. Only its recorded evidence is shown.</p>}
      {!!run.omittedEvents && <p>{run.omittedEvents} earlier events omitted by the 160-event cap.</p>}
      <ol className="factory-event-list">{run.events?.map((e, i) => <li key={e.id}><time dateTime={e.at}>{time(e.at)}</time><span>{humanLabel(e.fromStage || 'start')} → {humanLabel(e.stage)} · {humanLabel(e.status)}{e.reviewAttempt ? ` · Review attempt ${e.reviewAttempt}` : ''}{e.qa ? ` · QA ${e.qa}` : ''}{e.failureCode ? ` · ${e.failureCode}` : ''}{run.events[i + 1] && ` · ${Math.max(0, Math.round((new Date(run.events[i + 1].at) - new Date(e.at)) / 1000))}s until next recorded event`}</span></li>)}</ol>
    </details>
    {run.status === 'failed' && run.kind === 'create' && run.action === 'execute' && ['builder', 'build_and_playwright', 'independent_qa', 'repair', 'release_review'].includes(run.stage) && !run.pr && !run.recoveryRunId && !run.retryRunId && view.recovery.allowed && <details><summary>Retry the unchanged approved plan</summary><p>This reruns the same approved scope, build, tests, QA and release review. Use a revised plan when the scope or outcome needs to change.</p>{action('retry', 'Retry approved run')}</details>}
    {preview && <section><div className="factory-row"><p>Isolated static preview · Network and backend access disabled</p><button onClick={() => setPreview(null)}>Close preview</button></div><iframe title={`Preview: ${run.plan?.title || run.id}`} sandbox="allow-scripts" src={preview} className="factory-preview" /></section>}
  </article>
}
