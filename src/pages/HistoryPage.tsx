import { useMemo, useState } from 'react'
import { Stat, Empty, useLookup, ConfirmButton, pressable } from '../components/ui'
import { fmtDate, fmtRatio, ratio, extractionLabel, ROAST_LEVELS } from '../lib/coffee'
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

export default function HistoryPage({ data, go }: PageProps) {
  const lookup = useLookup(data)
  const [q, setQ] = useState('')
  const [bean, setBean] = useState('')
  const [roast, setRoast] = useState('')
  const [minRating, setMinRating] = useState(0)
  const [open, setOpen] = useState<string | null>(null)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.brews.filter((b) => {
      const bn = lookup.beans(b.bean_id)
      if (bean && b.bean_id !== bean) return false
      if (roast && bn?.roast_level !== roast) return false
      if (minRating && (b.rating ?? 0) < minRating) return false
      if (needle) {
        const hay = [bn?.name, bn?.roaster, bn?.origin, b.notes, lookup.machines(b.machine_id)?.name, ...(bn?.flavor_notes ?? [])]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [data.brews, lookup, q, bean, roast, minRating])

  const del = async (id: string) => {
    const b = data.brews.find((x) => x.id === id)
    await data.remove('brews', id)
    if (b?.media_url) deleteMedia(b.media_url).catch(() => {})
    toast('Bezug gelöscht', { tone: 'info' })
  }

  return (
    <div className="flex flex-col gap-4">
      <h2>Brew-Log</h2>
      <div className="flex flex-col gap-2">
        <input className="input w-full" type="search" aria-label="Bezüge durchsuchen" placeholder="Suchen (Bohne, Rösterei, Notiz …)" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="grid grid-cols-2 min-[421px]:grid-cols-3 gap-2">
          <select className="select w-full" value={bean} onChange={(e) => setBean(e.target.value)}>
            <option value="">Alle Bohnen</option>
            {data.beans.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select className="select w-full" value={roast} onChange={(e) => setRoast(e.target.value)}>
            <option value="">Jeder Röstgrad</option>
            {Object.entries(ROAST_LEVELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className="select w-full" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
            <option value={0}>Jede Bewertung</option>
            {[5, 4, 3, 2].map((n) => (
              <option key={n} value={n}>
                ab {n} ★
              </option>
            ))}
          </select>
        </div>
      </div>

      <TimeChart brews={rows} />

      {!rows.length ? (
        <Empty action={<button className="btn btn-primary" onClick={() => go('brew', { key: Date.now() })}>Bezug loggen</button>}>
          {data.brews.length ? 'Keine Treffer für diese Filter.' : 'Noch keine Bezüge geloggt.'}
        </Empty>
      ) : (
        <ul className="items">
          {rows.map((b) => {
            const bn = lookup.beans(b.bean_id)
            const isOpen = open === b.id
            const cost = brewCost(b, data.bean_stock)
            return (
              <li key={b.id} className={`item col ${isOpen ? 'open' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2.5 cursor-pointer" {...pressable(() => setOpen(isOpen ? null : b.id), isOpen)}>
                  <div>
                    <strong className="font-semibold">{bn?.name ?? 'Unbekannte Bohne'}</strong>
                    <span className="num text-muted text-xs">
                      {fmtDate(b.created_at)} · {b.dose ?? '–'}→{b.yield ?? '–'} g · {b.brew_time ?? '–'} s · {b.grind_setting || '–'}
                      {cost && ` · ${fmtMoney(cost.value, cost.currency)}`}
                      {b.media_url && (b.media_type === 'video' ? ' · Video' : ' · Foto')}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="num text-sm font-semibold text-accent-strong" aria-label={b.rating ? `${b.rating} von 5 Sternen` : 'nicht bewertet'}>
                      {b.rating ? b.rating.toFixed(1) : '–'}
                    </span>
                    <span className={`size-2 rounded-full ${tasteDot(b.extraction)}`} title={extractionLabel(b.extraction)} />
                  </div>
                </div>
                {isOpen && (
                  <div className="details">
                    <div className="grid grid-cols-3 gap-2">
                      <Stat className="bg-base-200" label="Ratio" value={fmtRatio(ratio(b.dose, b.yield))} />
                      <Stat className="bg-base-200" label="Temp" value={b.temperature} unit="°C" />
                      <Stat className="bg-base-200" label="Pre-Inf." value={b.preinfusion} unit="s" />
                    </div>
                    <p className="text-sm">
                      {lookup.machines(b.machine_id)?.name ?? '–'} · {lookup.grinders(b.grinder_id)?.name ?? '–'} · {extractionLabel(b.extraction)}
                    </p>
                    {b.notes && <p className="italic [overflow-wrap:anywhere]">„{b.notes}“</p>}
                    <MediaView url={b.media_url} type={b.media_type} />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button className="btn btn-primary btn-sm" onClick={() => go('brew', { key: Date.now(), brew: b })}>
                        Wiederholen
                      </button>
                      <button className="btn btn-ghost border-base-300 btn-sm" onClick={() => go('brew', { key: Date.now(), brew: b, editId: b.id })}>
                        Bearbeiten
                      </button>
                      <ConfirmButton
                        question={`Bezug vom ${fmtDate(b.created_at)} (${bn?.name ?? 'Unbekannte Bohne'}) löschen? Das lässt sich nicht rückgängig machen.`}
                        confirmLabel="Bezug löschen"
                        onConfirm={() => del(b.id)}
                      >
                        Löschen
                      </ConfirmButton>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
