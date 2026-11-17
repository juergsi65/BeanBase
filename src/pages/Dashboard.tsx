import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { RecipeCard, Empty, Chip, Stat, FreshnessScale, useLookup, pressable } from '../components/ui'
import { daysSince, freshness, recipesForBean, ROAST_LEVELS, fmtRatio, ratio, fmtDate, plural } from '../lib/coffee'
import { beanUsage, spending, fmtMoney } from '../lib/cost'
import StockBar from '../components/StockBar'
import type { Brew, PageProps } from '../types'

/** Desktop-Überschrift aus dem Frische-Status (siehe freshness() in lib/coffee) */
const HEADLINE: Partial<Record<string, string>> = { good: 'ist im Optimum.', info: 'ruht noch.', warn: 'lässt nach.', bad: 'ist über dem Zenit.' }
const headline = (name: string, tone?: string) => (tone && HEADLINE[tone] ? `${name} ${HEADLINE[tone]}` : name)
const todayLabel = () => new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

/** Bezüge pro Kalendertag der letzten `days` Tage, ältester zuerst, heute zuletzt */
function brewsPerDay(brews: Brew[], days: number) {
  const today = new Date().setHours(0, 0, 0, 0)
  const counts: number[] = Array(days).fill(0)
  for (const b of brews) {
    const ago = Math.round((today - new Date(b.created_at).setHours(0, 0, 0, 0)) / 864e5)
    if (ago >= 0 && ago < days) counts[days - 1 - ago]++
  }
  return counts
}

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

  if (data.loading) return <p className="flex items-center gap-2 text-muted"><span className="loading loading-dots loading-sm" /> Lade Daten …</p>

  if (!data.beans.length)
    return (
      <div className="flex flex-col gap-4">
        <h2>Willkommen bei BeanBase</h2>
        <Empty action={<button className="btn btn-primary btn-lg" onClick={() => go('beans')}>Erste Bohne anlegen</button>}>
          Leg zuerst eine Bohne an. Danach (optional) Maschine und Mühle unter „Setup“, und schon kannst du deinen ersten Bezug loggen.
        </Empty>
      </div>
    )

  const days = daysSince(selected?.roast_date)
  const fresh = freshness(days)

  return (
    <div className="flex flex-col gap-4 desk:grid desk:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)] desk:items-start desk:gap-7">
     {/* Desktop: Seitenkopf mit Datum und Frische-Status der gewählten Bohne */}
     <header className="hidden desk:col-span-2 desk:flex flex-wrap items-end gap-4">
       <div className="min-w-65 flex-1">
         <span className="lbl">{todayLabel()}</span>
         <h2 className="mt-1.5 text-[34px] tracking-[-0.025em]">{selected ? headline(selected.name, fresh?.tone) : 'Willkommen zurück'}</h2>
       </div>
       <button className="btn btn-primary h-11 rounded-[12px] px-4.5" onClick={() => go('brew')}>Bezug starten</button>
     </header>
     <div className="flex flex-col gap-4">
      <section>
        <h3 className="lbl">Aktive Bohnen</h3>
        {active.length ? (
          <div className="bean-picker">
            {active.map((b) => (
              <button key={b.id} className={`btn h-auto flex-none flex-col items-stretch gap-1 rounded-[14px] bg-base-100 px-3.5 py-3 text-left font-normal ${selected?.id === b.id ? 'border-primary ring-1 ring-inset ring-primary' : 'border-base-300'}`} onClick={() => setBeanId(b.id)} aria-pressed={selected?.id === b.id}>
                <strong className="font-semibold">{b.name}</strong>
                <span className="flex justify-between gap-2 text-xs text-muted">
                  <span className="truncate">{b.roaster}</span>
                  {(() => {
                    const d = daysSince(b.roast_date)
                    return d != null && <span className={`num ${freshness(d)?.tone === 'good' ? 'text-success' : ''}`}>{d} T</span>
                  })()}
                </span>
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
              <h2 className="text-2xl desk:text-[1.7rem]">{selected.name}</h2>
              <p className="text-muted text-sm">{[selected.roaster, selected.origin].filter(Boolean).join(' · ')}</p>
            </div>
            {days != null && (
              <div className={`age ${fresh?.tone}`}>
                <strong>{days}</strong>
                <span>Tage</span>
              </div>
            )}
          </div>
          {days != null && days >= 0 && <FreshnessScale days={days} />}
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
            <div className="flex flex-col gap-3 border-t border-base-300 pt-3.5">
              <RecipeCard title="Letzter Bezug" brew={last} lookup={lookup} />
              <div className="flex flex-wrap items-center gap-2">
                {last && (
                  <button className="btn btn-primary h-12.5 grow gap-2 rounded-[13px] desk:grow-0" onClick={() => reuse(last)}>
                    <RefreshCw size={18} strokeWidth={2} aria-hidden /> Rezept übernehmen
                  </button>
                )}
                {best && best.id !== last?.id && (
                  <button className="btn h-12.5 rounded-[13px] border-(--line-strong) bg-transparent font-medium" onClick={() => reuse(best)}>
                    Bestes{best.rating ? ` (${best.rating})` : ''}
                  </button>
                )}
                <span className="basis-full text-sm text-muted desk:ml-auto desk:basis-auto">{plural(count, 'Bezug', 'Bezüge')} mit dieser Bohne</span>
              </div>
            </div>
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
      {(() => {
        const sp = spending(data.brews, data.bean_stock, 30)
        if (!sp.count) return null
        const perDay = brewsPerDay(data.brews, 30)
        const max = Math.max(...perDay)
        return (
          <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
            <h3 className="lbl">Letzte 30 Tage</h3>
            <div className="grid grid-cols-3 gap-2">
              <Stat className="bg-base-200" label="Bezüge" value={sp.count} />
              <Stat className="bg-base-200" label="Kaffee-Kosten" value={sp.priced ? fmtMoney(sp.total, sp.currency) : '–'} />
              <Stat className="bg-base-200" label="Ø pro Tasse" value={sp.perCup != null ? fmtMoney(sp.perCup, sp.currency) : '–'} />
            </div>
            <div className="flex h-11 items-end gap-[3px]" aria-hidden>
              {perDay.map((c, i) => (
                <span
                  key={i}
                  className={`flex-1 rounded-[2px] ${i === 29 ? 'bg-primary' : c ? 'bg-base-content/25' : 'bg-base-300'}`}
                  style={{ height: c ? `${Math.max(20, (c / max) * 100)}%` : 3 }}
                />
              ))}
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
          <h3 className="lbl">Zuletzt</h3>
          <ul className="items">
            {data.brews.slice(0, 5).map((b) => (
              <li key={b.id} className="item cursor-pointer" {...pressable(() => go('history'))}>
                <div>
                  <strong>{lookup.beans(b.bean_id)?.name ?? 'Unbekannte Bohne'}</strong>
                  <span className="num text-muted text-xs">
                    {fmtDate(b.created_at)} · {b.dose ?? '–'}→{b.yield ?? '–'} g · {fmtRatio(ratio(b.dose, b.yield))} · {b.brew_time ?? '–'} s
                  </span>
                </div>
                {b.rating != null && <span className="num shrink-0 font-semibold text-accent-strong">{b.rating.toFixed(1)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
     </aside>
    </div>
  )
}
