import { fmtGrams, fmtMoney, type beanUsage } from '../lib/cost'

export type Usage = NonNullable<ReturnType<typeof beanUsage>>

/** Füllstand der aktuellen Packung */
export default function StockBar({ usage, compact, onArchive }: { usage: Usage; compact?: boolean; onArchive?: () => void }) {
  const low = usage.remaining > 0 && usage.shotsLeft <= 3
  const empty = usage.remaining <= 0
  const tone = empty ? 'progress-error' : low ? 'progress-warning' : 'progress-primary'
  return (
    <div className="flex flex-col gap-1.5">
      <progress className={`progress h-2.5 ${tone}`} value={Math.max(2, usage.pct * 100)} max={100} />
      <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-[0.82rem] text-muted">
        <span className={empty ? 'font-semibold text-error' : low ? 'font-semibold text-warning' : ''}>
          {empty ? 'Packung leer' : `noch ${fmtGrams(usage.remaining)} ≈ ${usage.shotsLeft} Tassen`}
          {low && ' · fast leer'}
        </span>
        {usage.perCup != null && !compact && <span>{fmtMoney(usage.perCup, usage.currency)} / Tasse</span>}
        {usage.perCup != null && compact && <span>{fmtMoney(usage.perCup, usage.currency)}/Tasse</span>}
      </div>
      {onArchive && (
        <button type="button" className="link link-primary self-start p-2 pl-0 no-underline text-sm" onClick={onArchive}>
          Als aufgebraucht markieren
        </button>
      )}
    </div>
  )
}
