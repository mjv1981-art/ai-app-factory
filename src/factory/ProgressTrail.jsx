export default function ProgressTrail({ view, animate }) {
  const completed = view.trail.filter(s => s.state === 'complete').length
  const applicable = view.trail.filter(s => s.state !== 'skipped').length
  return <section className="factory-progress" aria-label="Run stages">
    <div className="factory-row"><h4>Your delivery path</h4><small>{completed} of {applicable} stages completed · Stage count, not a time estimate</small></div>
    <ol className="factory-trail">{view.trail.map((s, i) => <li key={s.key} className={`factory-step ${s.state}`} aria-current={s.state === view.tone && !['complete', 'pending', 'skipped', 'unrecorded'].includes(s.state) ? 'step' : undefined}>
      <span className={`factory-step-icon ${s.state === 'working' && animate ? 'factory-motion factory-spin' : ''}`} aria-hidden="true">{s.state === 'complete' ? '✓' : s.state === 'skipped' ? '−' : s.state === 'stopped' ? '!' : i + 1}</span><span>{s.name}<small>{s.state === 'skipped' ? 'Not required by this profile' : { complete: 'Completed', working: 'In progress', waiting: 'Your turn', stopped: 'Stopped', neutral: 'Unconfirmed / waiting', pending: 'Not started', unrecorded: 'Not recorded / unconfirmed' }[s.state]}</small></span>
      {s.state === 'working' && animate && <span aria-hidden="true" className="factory-sweep factory-motion" />}
    </li>)}</ol>
    {view.repairCount > 0 && <p className="factory-note">{view.repairCount} repair attempt(s) recorded. Tests and QA run again after repair.</p>}
  </section>
}
