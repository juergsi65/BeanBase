import { fmtGrams, fmtMoney, type beanUsage } from '../lib/cost'

export type Usage = NonNullable<ReturnType<typeof beanUsage>>

/** Füllstand der aktuellen Packung */
export default function StockBar({ usage, compact, onArchive }: { usage: Usage; compact?: boolean; onArchive?: () => void }) {
  const low = usage.remaining > 0 && usage.shotsLeft <= 3
  const empty = usage.remaining <= 0
  return (
    <div className={`stock ${low ? 'low' : ''} ${empty ? 'empty' : ''}`}>
      <div className="stock-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usage.pct * 100)}>
        <span style={{ width: `${Math.max(2, usage.pct * 100)}%` }} />
      </div>
      <div className="stock-text">
        <span>
          {empty ? 'Packung leer' : `noch ${fmtGrams(usage.remaining)} ≈ ${usage.shotsLeft} Tassen`}
          {low && ' · fast leer'}
        </span>
        {usage.perCup != null && !compact && <span>{fmtMoney(usage.perCup, usage.currency)} / Tasse</span>}
        {usage.perCup != null && compact && <span>{fmtMoney(usage.perCup, usage.currency)}/Tasse</span>}
      </div>
      {onArchive && (
        <button type="button" className="link small" onClick={onArchive}>
          Als aufgebraucht markieren
        </button>
      )}
    </div>
  )
}
