import { useMemo, useState } from 'react'
import { RecipeCard, Empty, Chip, Stars, Stat, useLookup } from '../components/ui'
import { daysSince, freshness, recipesForBean, ROAST_LEVELS, fmtRatio, ratio, fmtDate, plural } from '../lib/coffee'
import { beanUsage, spending, fmtMoney } from '../lib/cost'
import StockBar from '../components/StockBar'
import type { Brew, PageProps } from '../types'

export default function Dashboard({ data, go }: PageProps) {
  const lookup = useLookup(data)
  const active = data.beans.filter((b) => b.active)
  // Standard: Bohne des letzten Bezugs, sonst erste aktive
  const lastBrew = data.brews[0]
  const defaultBean = (lastBrew && lookup.beans(lastBrew.bean_id)?.active && lastBrew.bean_id) || active[0]?.id
  const [beanId, setBeanId] = useState<string | null>(null)
  const selected = lookup.beans(beanId ?? defaultBean)
  const { last, best, count } = useMemo(
    () => (selected ? recipesForBean(data.brews, selected.id) : { last: null, best: null, count: 0 }),
    [data.brews, selected],
  )

  const reuse = (brew: Brew) => go('brew', { key: Date.now(), brew })

  if (data.loading) return <p className="text-muted">Lade Daten …</p>

  if (!data.beans.length)
    return (
      <div className="flex flex-col gap-4">
        <h2>Willkommen bei BeanBase ☕</h2>
        <Empty action={<button className="btn btn-primary btn-lg" onClick={() => go('beans')}>Erste Bohne anlegen</button>}>
          Leg zuerst eine Bohne an. Danach (optional) Maschine und Mühle unter „Setup“, und schon kannst du deinen ersten Bezug loggen.
        </Empty>
      </div>
    )

  const days = daysSince(selected?.roast_date)
  const fresh = freshness(days)

  return (
    <div className="flex flex-col gap-4 desk:grid desk:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)] desk:items-start desk:gap-7">
     <div className="flex flex-col gap-4">
      <section>
        <h3 className="text-xs uppercase tracking-widest text-muted">Aktive Bohnen</h3>
        {active.length ? (
          <div className="bean-picker">
            {active.map((b) => (
              <button key={b.id} className={`btn h-auto flex-none flex-col items-start gap-0.5 rounded-[14px] bg-base-100 px-3.5 py-3 text-left font-normal ${selected?.id === b.id ? 'border-primary ring-1 ring-inset ring-primary' : 'border-base-300'}`} onClick={() => setBeanId(b.id)}>
                <strong>{b.name}</strong>
                {b.roaster && <span className="text-xs text-muted">{b.roaster}</span>}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-muted">Keine aktive Bohne. Aktiviere eine unter „Bohnen“.</p>
        )}
      </section>

      {selected && (
        <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
          <div className="flex items-start justify-between gap-3">
            {selected.image_url && <img className="thumb lg" src={selected.image_url} alt="" />}
            <div className="grow">
              <h2>{selected.name}</h2>
              <p className="text-muted">{[selected.roaster, selected.origin].filter(Boolean).join(' · ')}</p>
            </div>
            {days != null && (
              <div className={`age ${fresh?.tone}`}>
                <strong>{days}</strong>
                <span>Tage</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selected.roast_level && <Chip>{ROAST_LEVELS[selected.roast_level]}</Chip>}
            {fresh && <Chip tone={fresh.tone}>{fresh.label}</Chip>}
            {selected.flavor_notes?.map((t) => (
              <Chip key={t} tone="flavor">
                {t}
              </Chip>
            ))}
          </div>
          {(() => {
            const u = beanUsage(selected.id, data.bean_stock, data.brews)
            return u ? <StockBar usage={u} /> : (
              <button className="link link-primary self-start p-0 no-underline text-sm text-left" onClick={() => go('beans')}>
                + Packungsgröße & Preis eintragen → Kosten pro Tasse & Restmenge
              </button>
            )
          })()}
          {count ? (
            <>
              <RecipeCard title="Letzter Bezug" brew={last} lookup={lookup} onReuse={reuse} />
              {best && best.id !== last?.id && (
                <RecipeCard title="Bestbewertet" brew={best} lookup={lookup} onReuse={reuse} />
              )}
              <p className="text-muted text-sm">{plural(count, 'Bezug', 'Bezüge')} mit dieser Bohne</p>
            </>
          ) : (
            <Empty
              action={
                <button className="btn btn-primary btn-lg" onClick={() => go('brew', { key: Date.now(), brew: { bean_id: selected.id } })}>
                  Ersten Bezug loggen
                </button>
              }
            >
              Noch kein Bezug mit dieser Bohne.
            </Empty>
          )}
        </section>
      )}
     </div>

     <aside className="dash-side flex flex-col gap-4">
      <button className="btn btn-primary btn-lg btn-block desk:hidden" onClick={() => go('brew', { key: Date.now(), brew: last ?? { bean_id: selected?.id } })}>
        + Neuer Bezug
      </button>

      {(() => {
        const sp = spending(data.brews, data.bean_stock, 30)
        if (!sp.count) return null
        return (
          <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
            <h3 className="text-xs uppercase tracking-widest text-muted">Letzte 30 Tage</h3>
            <div className="grid grid-cols-3 gap-2">
              <Stat className="bg-base-200" label="Bezüge" value={sp.count} />
              <Stat className="bg-base-200" label="Kaffee-Kosten" value={sp.priced ? fmtMoney(sp.total, sp.currency) : '–'} />
              <Stat className="bg-base-200" label="Ø pro Tasse" value={sp.perCup != null ? fmtMoney(sp.perCup, sp.currency) : '–'} />
            </div>
            {sp.priced < sp.count && (
              <p className="text-muted text-sm">
                {plural(sp.count - sp.priced, 'Bezug', 'Bezüge')} ohne Preis – trag bei der Bohne Packungsgröße und Kaufpreis ein.
              </p>
            )}
          </section>
        )
      })()}

      {data.brews.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-widest text-muted">Zuletzt</h3>
          <ul className="items">
            {data.brews.slice(0, 5).map((b) => (
              <li key={b.id} className="item" onClick={() => go('history')}>
                <div>
                  <strong>{lookup.beans(b.bean_id)?.name ?? 'Unbekannte Bohne'}</strong>
                  <span className="text-muted text-sm">
                    {fmtDate(b.created_at)} · {b.dose ?? '–'}g → {b.yield ?? '–'}g ({fmtRatio(ratio(b.dose, b.yield))}) · {b.brew_time ?? '–'}s
                  </span>
                </div>
                <Stars value={b.rating} size="sm" />
              </li>
            ))}
          </ul>
        </section>
      )}
     </aside>
    </div>
  )
}
