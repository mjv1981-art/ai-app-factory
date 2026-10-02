import { useState } from 'react'

export default function RecoveryPanel({ run, view, act, api, busy }) {
  const [clarification, setClarification] = useState('')
  if (!['failed', 'cancelled', 'awaiting_approval'].includes(run.status)) return null
  return <section className="factory-recovery" aria-label="Plan revision">
    <h4>{run.status === 'awaiting_approval' ? 'Need to adjust the plan?' : 'A clear route forward'}</h4>
    {run.recoveryRunId || run.retryRunId ? <p>A linked run already exists. <a href={`#run-${run.recoveryRunId || run.retryRunId}`}>Open the follow-up run ↓</a></p> : <>
      <p>{view.recovery.reason}</p>
      {view.recovery.allowed && <form onSubmit={e => { e.preventDefault(); act(`${run.id}:replan`, async () => { await api(`/runs/${run.id}/replan`, { clarification, revision: run.planHash || run.failure?.at || run.createdAt }); setClarification('') }) }}>
        <label htmlFor={`clarify-${run.id}`}>Clarify the outcome or explain how to address the finding</label><textarea id={`clarify-${run.id}`} required maxLength={12000} value={clarification} onChange={e => setClarification(e.target.value)} placeholder="Keep the intended outcome, but revise…" />
        <button className="factory-primary" disabled={busy[`${run.id}:replan`]}>{busy[`${run.id}:replan`] ? 'Requesting revised plan…' : 'Create a revised plan'}</button><small>Fresh approval required. Original evidence and usage stay in history.</small>
      </form>}
    </>}
  </section>
}
