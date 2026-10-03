import { usageSummary } from '../../factory/run-view.mjs'

const format = n => Number(n || 0).toLocaleString()
export default function UsageMeter({ entries, limits, compact = false }) {
  const u = usageSummary(entries), ceiling = limits?.tokens
  return <section className={`factory-usage-meter ${compact ? 'compact' : ''}`} aria-label="Model usage">
    <div className="factory-row"><h4>Usage you can account for</h4><small>{ceiling ? `${format(ceiling)} token ceiling` : 'Across this scope'}</small></div>
    <div className="factory-usage-values"><div><strong>{format(u.reported)}</strong><span>Reported tokens</span></div><div><strong>{format(u.pending)}</strong><span>Pending reservation</span></div><div><strong>{format(u.uncertain)}</strong><span>Uncertain reservation</span></div><div><strong>${u.knownCost.toFixed(4)}</strong><span>Known model cost · {u.unknownCost} unknown</span></div></div>
    {ceiling && <><div className="factory-allowance" aria-label={`Token allowance: ${format(u.reported)} reported, ${format(u.pending)} pending, ${format(u.uncertain)} uncertain; ceiling ${format(ceiling)}`}><span className="reported" style={{ width: `${Math.min(100, u.reported / ceiling * 100)}%` }} /><span className="reserved" style={{ width: `${Math.min(100, u.pending / ceiling * 100)}%` }} /><span className="uncertain" style={{ width: `${Math.min(100, u.uncertain / ceiling * 100)}%` }} /></div><p className="factory-note">{u.calls} of {limits.calls} calls · {limits.seconds / 60} minute run ceiling · $0 paid allowance</p></>}
    <p className="factory-note">{u.pending ? 'Actual usage is pending for an unfinished model call. ' : ''}{u.unknown ? `${u.unknown} attempt(s) have unknown usage; reservations remain held. ` : ''}Totals update after accounting, without a live token stream. Hosting is tracked separately.</p>
  </section>
}
