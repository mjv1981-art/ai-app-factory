export default function FactoryGuide({ view, run }) {
  return <aside className={`factory-guide ${view.tone}`} aria-label="Factory guide">
    <p className="factory-eyebrow">FACTORY GUIDE</p><h4>{view.responsibility === 'You' ? 'Your next step' : 'What happens next'}</h4><p>{view.explanation}</p>
    <div className="factory-guide-responsibility"><small>Who acts next</small><strong>{view.responsibility}</strong></div>
    {run.failure && <p className="factory-note">Source: worker stop at {run.failure.stage} · {run.failure.code}</p>}
    {(run.qa || run.review) && <p className="factory-note">Original QA and release-review findings are preserved in Evidence and activity below.</p>}
    <small>Explained from recorded facts. The guide makes no model calls.</small>
  </aside>
}
