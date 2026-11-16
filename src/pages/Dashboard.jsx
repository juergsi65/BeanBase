import { useMemo, useState } from 'react'
import { RecipeCard, Empty, Chip, Stars, useLookup } from '../components/ui'
import { daysSince, freshness, recipesForBean, ROAST_LEVELS, fmtRatio, ratio, fmtDate, plural } from '../lib/coffee'
import { beanUsage, spending, fmtMoney } from '../lib/cost'
import StockBar from '../components/StockBar'

export default function Dashboard({ data, go }) {
  const lookup = useLookup(data)
  const active = data.beans.filter((b) => b.active)
  // Standard: Bohne des letzten Bezugs, sonst erste aktive
  const lastBrew = data.brews[0]
  const defaultBean = (lastBrew && lookup.beans[lastBrew.bean_id]?.active && lastBrew.bean_id) || active[0]?.id
  const [beanId, setBeanId] = useState(null)
  const selected = lookup.beans[beanId ?? defaultBean]
  const { last, best, count } = useMemo(
    () => (selected ? recipesForBean(data.brews, selected.id) : {}),
    [data.brews, selected],
  )

  const reuse = (brew) => go('brew', { key: Date.now(), brew })

  if (data.loading) return <p className="muted">Lade Daten …</p>

  if (!data.beans.length)
    return (
      <div className="stack">
        <h2>Willkommen bei BeanBase ☕</h2>
        <Empty action={<button className="btn primary big" onClick={() => go('beans')}>Erste Bohne anlegen</button>}>
          Leg zuerst eine Bohne an. Danach (optional) Maschine und Mühle unter „Setup“, und schon kannst du deinen ersten Bezug loggen.
        </Empty>
      </div>
    )

  const days = daysSince(selected?.roast_date)
  const fresh = freshness(days)

  return (
    <div className="dash">
     <div className="dash-main stack">
      <section>
        <h3 className="section-title">Aktive Bohnen</h3>
        {active.length ? (
          <div className="bean-picker">
            {active.map((b) => (
              <button key={b.id} className={selected?.id === b.id ? 'on' : ''} onClick={() => setBeanId(b.id)}>
                <strong>{b.name}</strong>
                {b.roaster && <span>{b.roaster}</span>}
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">Keine aktive Bohne. Aktiviere eine unter „Bohnen“.</p>
        )}
      </section>

      {selected && (
        <section className="card">
          <div className="bean-head">
            {selected.image_url && <img className="thumb lg" src={selected.image_url} alt="" />}
            <div className="grow">
              <h2>{selected.name}</h2>
              <p className="muted">{[selected.roaster, selected.origin].filter(Boolean).join(' · ')}</p>
            </div>
            {days != null && (
              <div className={`age ${fresh?.tone}`}>
                <strong>{days}</strong>
                <span>Tage</span>
              </div>
            )}
          </div>
          <div className="chips">
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
              <button className="link small" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => go('beans')}>
                + Packungsgröße & Preis eintragen → Kosten pro Tasse & Restmenge
              </button>
            )
          })()}
          {count ? (
            <>
              <RecipeCard title="Letzter Bezug" brew={last} lookup={lookup} onReuse={reuse} />
              {best && best.id !== last.id && (
                <RecipeCard title="Bestbewertet" brew={best} lookup={lookup} onReuse={reuse} />
              )}
              <p className="muted small">{plural(count, 'Bezug', 'Bezüge')} mit dieser Bohne</p>
            </>
          ) : (
            <Empty
              action={
                <button className="btn primary big" onClick={() => go('brew', { key: Date.now(), brew: { bean_id: selected.id } })}>
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

     <aside className="dash-side stack">
      <button className="btn primary big block" onClick={() => go('brew', { key: Date.now(), brew: last ?? { bean_id: selected?.id } })}>
        + Neuer Bezug
      </button>

      {(() => {
        const sp = spending(data.brews, data.bean_stock, 30)
        if (!sp.count) return null
        return (
          <section className="card stats-card">
            <h3 className="section-title">Letzte 30 Tage</h3>
            <div className="stats">
              <div className="stat">
                <span className="stat-value">{sp.count}</span>
                <span className="stat-label">Bezüge</span>
              </div>
              <div className="stat">
                <span className="stat-value">{sp.priced ? fmtMoney(sp.total, sp.currency) : '–'}</span>
                <span className="stat-label">Kaffee-Kosten</span>
              </div>
              <div className="stat">
                <span className="stat-value">{sp.perCup != null ? fmtMoney(sp.perCup, sp.currency) : '–'}</span>
                <span className="stat-label">Ø pro Tasse</span>
              </div>
            </div>
            {sp.priced < sp.count && (
              <p className="muted small">
                {plural(sp.count - sp.priced, 'Bezug', 'Bezüge')} ohne Preis – trag bei der Bohne Packungsgröße und Kaufpreis ein.
              </p>
            )}
          </section>
        )
      })()}

      {data.brews.length > 0 && (
        <section>
          <h3 className="section-title">Zuletzt</h3>
          <ul className="list">
            {data.brews.slice(0, 5).map((b) => (
              <li key={b.id} className="list-item" onClick={() => go('history')}>
                <div>
                  <strong>{lookup.beans[b.bean_id]?.name ?? 'Unbekannte Bohne'}</strong>
                  <span className="muted small">
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
