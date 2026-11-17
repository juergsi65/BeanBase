import { useMemo, useState } from 'react'
import { Pencil, Search, Trash2 } from 'lucide-react'
import { Empty, useLookup, ConfirmButton, pressable } from '../components/ui'
import { fmtDate, fmtRatio, ratio, extractionLabel } from '../lib/coffee'
import { brewCost, fmtMoney } from '../lib/cost'
import { MediaView } from '../components/MediaPicker'
import { deleteMedia } from '../lib/media'
import { toast } from '../lib/toast'
import type { Brew, PageProps } from '../types'

/** Punktfarbe nach Geschmack: sauer gelb, ausgewogen grün, bitter braun */
const tasteDot = (x: number | null | undefined) => (x == null ? 'bg-base-300' : x < 0 ? 'bg-warning' : x > 0 ? 'bg-(--bitter)' : 'bg-success')

/** Brühzeit der letzten 12 Espresso-Bezüge (≤ 60 s) mit Zielfenster 25–30 s */
function TimeChart({ brews }: { brews: Brew[] }) {
  const pts = brews.filter((b) => b.brew_time != null && b.brew_time > 0 && b.brew_time <= 60).slice(0, 12).reverse()
  if (pts.length < 3) return null
  const [lo, hi, top, bottom] = [25, 30, 40, 15]
  const y = (t: number) => ((top - Math.min(top, Math.max(bottom, t))) / (top - bottom)) * 100
  const hits = pts.filter((b) => b.brew_time! >= lo && b.brew_time! <= hi).length
  return (
    <section className="card bg-base-100 border border-base-300 p-4 gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="lbl">Brühzeit · letzte {pts.length}</span>
        <span className="num text-xs text-success">
          {hits} / {pts.length} im Ziel
        </span>
      </div>
      <p className="sr-only">{`Brühzeit der letzten ${pts.length} Bezüge, ${hits} davon im Zielfenster ${lo} bis ${hi} Sekunden`}</p>
      <div className="relative ml-7 mr-1.5 h-28" aria-hidden>
        {[40, 30, 20].map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-base-300" style={{ top: `${y(t)}%` }}>
            <span className="num absolute -left-7 -translate-y-1/2 text-[11px] text-muted">{t}</span>
          </div>
        ))}
        <div className="absolute inset-x-0 border-y border-dashed border-success/45 bg-success/10" style={{ top: `${y(hi)}%`, height: `${y(lo) - y(hi)}%` }} />
        {pts.map((b, i) => {
          const t = b.brew_time!
          const tone = t < lo ? 'bg-warning' : t > hi ? 'bg-(--bitter)' : 'bg-success'
          return (
            <span
              key={b.id}
              className={`absolute size-2.5 -translate-1/2 rounded-full ring-3 ring-base-100 ${tone}`}
              style={{ left: `${(i / (pts.length - 1)) * 100}%`, top: `${y(t)}%` }}
              title={`${fmtDate(b.created_at)} · ${t} s`}
            />
          )
        })}
      </div>
    </section>
  )
}

const DAY = 864e5
const startOfDay = (iso: string) => new Date(iso).setHours(0, 0, 0, 0)
/** „Heute“ / „Gestern“ / „So., 15.11.“ */
function dayLabel(iso: string) {
  const ago = Math.round((new Date().setHours(0, 0, 0, 0) - startOfDay(iso)) / DAY)
  if (ago === 0) return 'Heute'
  if (ago === 1) return 'Gestern'
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
const sinceLabel = (iso: string | undefined) => (iso ? `seit ${new Date(iso).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}` : '')
const freshKey = () => Date.now()

const [LO, HI] = [25, 30]
const timeTone = (t: number | null) => (t == null ? '' : t < LO ? 'text-warning' : t > HI ? 'text-(--bitter)' : 'text-success')
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
const fmt1 = (v: number | null) => (v == null ? '–' : v.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 }))
const recipe = (b: Brew) => `${b.dose ?? '–'}→${b.yield ?? '–'} g · ${fmtRatio(ratio(b.dose, b.yield))} · ${b.brew_time ?? '–'} s · ${b.grind_setting || '–'}`

const chip = (on: boolean) =>
  `btn h-9 min-h-0 shrink-0 rounded-full px-3.5 text-[13px] ${on ? 'border-primary bg-primary/15 font-semibold text-accent-strong' : 'border-(--line-strong) bg-transparent font-normal text-base-content/80'}`

export default function HistoryPage({ data, go }: PageProps) {
  const lookup = useLookup(data)
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [bean, setBean] = useState('')
  const [topRated, setTopRated] = useState(false)
  const [withMedia, setWithMedia] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.brews.filter((b) => {
      const bn = lookup.beans(b.bean_id)
      if (bean && b.bean_id !== bean) return false
      if (topRated && (b.rating ?? 0) < 4) return false
      if (withMedia && !b.media_url) return false
      if (needle) {
        const hay = [bn?.name, bn?.roaster, bn?.origin, b.notes, b.grind_setting, lookup.machines(b.machine_id)?.name, ...(bn?.flavor_notes ?? [])]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [data.brews, lookup, q, bean, topRated, withMedia])

  // Gruppen je Kalendertag (Liste ist neueste zuerst sortiert)
  const days = useMemo(() => {
    const out: { label: string; brews: Brew[] }[] = []
    for (const b of rows) {
      const label = dayLabel(b.created_at)
      if (out.at(-1)?.label === label) out.at(-1)!.brews.push(b)
      else out.push({ label, brews: [b] })
    }
    return out
  }, [rows])

  // Kennzahlen der gefilterten Bezüge (Desktop)
  const times = rows.map((b) => b.brew_time).filter((t): t is number => t != null && t > 0)
  const stats = [
    { k: 'Ø Brühzeit', v: times.length ? `${fmt1(avg(times))} s` : '–', c: '' },
    { k: 'Im Zielfenster', v: times.length ? `${Math.round((times.filter((t) => t >= LO && t <= HI).length / times.length) * 100)} %` : '–', c: 'text-success' },
    { k: 'Ø Ratio', v: fmtRatio(avg(rows.map((b) => ratio(b.dose, b.yield)).filter((r): r is number => r != null))), c: 'text-accent-strong' },
    { k: 'Ø Wertung', v: fmt1(avg(rows.map((b) => b.rating).filter((r): r is number => r != null))), c: '' },
  ]
  // Bohnen mit Bezügen als Filter-Chips (aktive zuerst)
  const used = data.beans.filter((b) => data.brews.some((x) => x.bean_id === b.id))
  const beanChips = [...used.filter((b) => b.active), ...used.filter((b) => !b.active)]

  const reuse = (b: Brew) => go('brew', { key: freshKey(), brew: b })
  const edit = (b: Brew) => go('brew', { key: freshKey(), brew: b, editId: b.id })
  const del = async (id: string) => {
    const b = data.brews.find((x) => x.id === id)
    await data.remove('brews', id)
    if (b?.media_url) deleteMedia(b.media_url).catch(() => {})
    toast('Bezug gelöscht', { tone: 'info' })
  }
  const delQuestion = (b: Brew) => `Bezug vom ${fmtDate(b.created_at)} (${lookup.beans(b.bean_id)?.name ?? 'Unbekannte Bohne'}) löschen? Das lässt sich nicht rückgängig machen.`

  const search = (
    <label className="input h-11 w-full rounded-[12px] desk:w-72">
      <Search size={18} strokeWidth={1.75} className="text-muted" aria-hidden />
      <input type="search" aria-label="Log durchsuchen" placeholder="Bohne, Notiz, Mahlgrad …" value={q} onChange={(e) => setQ(e.target.value)} />
    </label>
  )

  return (
    <div className="flex flex-col gap-4.5">
      <header className="flex flex-wrap items-center gap-2 desk:items-end desk:gap-4">
        <div className="flex grow items-baseline gap-2 desk:block">
          <span className="lbl hidden desk:inline">
            {data.brews.length} Bezüge {sinceLabel(data.brews.at(-1)?.created_at) && `· ${sinceLabel(data.brews.at(-1)?.created_at)}`}
          </span>
          <h2 className="text-[26px] desk:mt-1.5 desk:text-[34px] desk:tracking-[-0.025em]">Log</h2>
          <span className="num text-xs text-muted desk:hidden">{data.brews.length} Bezüge</span>
        </div>
        <button className={`btn size-11 rounded-[12px] border-base-300 bg-base-100 px-0 desk:hidden ${searching || q ? 'border-primary text-accent-strong' : ''}`} onClick={() => setSearching((s) => !s)} aria-label="Suchen" aria-expanded={searching}>
          <Search size={20} strokeWidth={1.75} aria-hidden />
        </button>
        <div className="hidden desk:block">{search}</div>
      </header>
      {(searching || q) && <div className="desk:hidden">{search}</div>}

      <fieldset className="-mx-4 flex min-w-0 gap-1.5 overflow-x-auto px-4 desk:mx-0 desk:flex-wrap desk:px-0">
        <legend className="sr-only">Filter</legend>
        <button className={chip(!bean)} onClick={() => setBean('')} aria-pressed={!bean}>Alle</button>
        {beanChips.map((b) => (
          <button key={b.id} className={chip(bean === b.id)} onClick={() => setBean(bean === b.id ? '' : b.id)} aria-pressed={bean === b.id}>
            {b.name}
          </button>
        ))}
        <button className={chip(topRated)} onClick={() => setTopRated((v) => !v)} aria-pressed={topRated}>4+ Sterne</button>
        <button className={chip(withMedia)} onClick={() => setWithMedia((v) => !v)} aria-pressed={withMedia}>Mit Foto</button>
      </fieldset>

      <div className="desk:hidden"><TimeChart brews={rows} /></div>

      {!rows.length ? (
        <Empty action={<button className="btn btn-primary" onClick={() => go('brew', { key: freshKey() })}>Bezug loggen</button>}>
          {data.brews.length ? 'Keine Treffer für diese Filter.' : 'Noch keine Bezüge geloggt.'}
        </Empty>
      ) : (
        <>
          {/* Handy: nach Tagen gruppierte Karten, antippen klappt Details auf */}
          <div className="flex flex-col gap-4.5 desk:hidden">
            {days.map((d) => (
              <section key={d.label} className="flex flex-col gap-2">
                <h3 className="lbl">{d.label}</h3>
                {d.brews.map((b) => {
                  const isOpen = open === b.id
                  const cost = brewCost(b, data.bean_stock)
                  return (
                    <article key={b.id} className={`flex flex-col gap-2.5 rounded-[14px] border bg-base-100 px-3.5 py-3 ${isOpen ? 'border-primary/50' : 'border-base-300'}`}>
                      <div className="flex cursor-pointer items-center gap-3" {...pressable(() => setOpen(isOpen ? null : b.id), isOpen)}>
                        <span className="num w-10 shrink-0 text-xs text-muted">{clock(b.created_at)}</span>
                        <div className="min-w-0 grow">
                          <div className="font-semibold">{lookup.beans(b.bean_id)?.name ?? 'Unbekannte Bohne'}</div>
                          <div className="num mt-0.5 text-xs text-muted">{recipe(b)}</div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="num text-sm font-semibold text-accent-strong" aria-label={b.rating ? `${b.rating} von 5 Sternen` : 'nicht bewertet'}>
                            {b.rating ? b.rating.toFixed(1) : '–'}
                          </span>
                          <span className={`size-2 rounded-full ${tasteDot(b.extraction)}`} title={extractionLabel(b.extraction)} />
                        </div>
                      </div>
                      {isOpen && (
                        <div className="flex flex-col gap-2.5 border-t border-base-300 pt-2.5">
                          <p className="num text-xs text-muted [overflow-wrap:anywhere]">
                            {[lookup.machines(b.machine_id)?.name, lookup.grinders(b.grinder_id)?.name, b.temperature != null && `${b.temperature} °C`, b.preinfusion != null && `Pre-Inf. ${b.preinfusion} s`, extractionLabel(b.extraction), cost && fmtMoney(cost.value, cost.currency)]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {b.notes && <p className="text-[13px] text-base-content/80 [overflow-wrap:anywhere]">„{b.notes}“</p>}
                          <MediaView url={b.media_url} type={b.media_type} />
                          <div className="flex gap-1.5">
                            <button className="btn btn-primary h-11 grow rounded-[11px]" onClick={() => reuse(b)}>Wiederverwenden</button>
                            <button className="btn h-11 rounded-[11px] border-(--line-strong) bg-transparent font-normal" onClick={() => edit(b)}>Bearbeiten</button>
                            <ConfirmButton className="btn h-11 rounded-[11px] border-(--line-strong) bg-transparent px-3 text-muted" ariaLabel="Bezug löschen" question={delQuestion(b)} confirmLabel="Bezug löschen" onConfirm={() => del(b.id)}>
                              <Trash2 size={18} strokeWidth={1.75} aria-hidden />
                            </ConfirmButton>
                          </div>
                        </div>
                      )}
                    </article>
                  )
                })}
              </section>
            ))}
          </div>

          {/* Desktop: Kennzahlen und Tabelle */}
          <section className="hidden flex-wrap gap-px overflow-hidden rounded-[16px] border border-base-300 bg-base-300 desk:flex">
            {stats.map((s) => (
              <div key={s.k} className="min-w-35 flex-1 bg-base-100 px-4 py-3.5">
                <div className="lbl">{s.k}</div>
                <div className={`num text-2xl font-semibold ${s.c}`}>{s.v}</div>
              </div>
            ))}
          </section>
          <div className="hidden overflow-x-auto rounded-[16px] border border-base-300 bg-base-100 desk:block">
            <table className="table text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
              <thead className="lbl [&_th]:font-medium">
                <tr>
                  <th>Datum</th>
                  <th>Bohne</th>
                  <th className="text-right">Dosis</th>
                  <th className="text-right">Output</th>
                  <th className="text-right">Ratio</th>
                  <th className="text-right">Zeit</th>
                  <th className="text-right">Mahlgrad</th>
                  <th className="text-right">Temp.</th>
                  <th>Geschmack</th>
                  <th className="text-right">Wertung</th>
                  <th><span className="sr-only">Aktionen</span></th>
                </tr>
              </thead>
              <tbody className="num">
                {rows.map((b) => (
                  <tr key={b.id} className="border-base-300 hover:bg-base-200">
                    <td className="text-[13px] text-muted">{dayLabel(b.created_at)} {clock(b.created_at)}</td>
                    <td className="font-sans font-semibold">{lookup.beans(b.bean_id)?.name ?? 'Unbekannte Bohne'}</td>
                    <td className="text-right">{b.dose != null ? `${b.dose} g` : '–'}</td>
                    <td className="text-right">{b.yield != null ? `${b.yield} g` : '–'}</td>
                    <td className="text-right text-accent-strong">{fmtRatio(ratio(b.dose, b.yield))}</td>
                    <td className={`text-right ${timeTone(b.brew_time)}`}>{b.brew_time != null ? `${b.brew_time} s` : '–'}</td>
                    <td className="text-right">{b.grind_setting || '–'}</td>
                    <td className="text-right text-muted">{b.temperature != null ? `${b.temperature} °C` : '–'}</td>
                    <td className="font-sans">
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-base-content/80">
                        <span className={`size-2 rounded-full ${tasteDot(b.extraction)}`} aria-hidden />
                        {b.extraction == null ? '–' : extractionLabel(b.extraction)}
                      </span>
                    </td>
                    <td className="text-right font-semibold text-accent-strong">{b.rating ? b.rating.toFixed(1) : '–'}</td>
                    <td className="font-sans">
                      <div className="flex items-center justify-end gap-1">
                        <button className="btn btn-ghost btn-sm text-accent-strong" onClick={() => reuse(b)}>Nutzen</button>
                        <button className="btn btn-ghost btn-sm btn-square" onClick={() => edit(b)} aria-label="Bezug bearbeiten" title="Bearbeiten">
                          <Pencil size={16} strokeWidth={1.75} aria-hidden />
                        </button>
                        <ConfirmButton className="btn btn-ghost btn-sm btn-square text-muted" ariaLabel="Bezug löschen" question={delQuestion(b)} confirmLabel="Bezug löschen" onConfirm={() => del(b.id)}>
                          <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                        </ConfirmButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
