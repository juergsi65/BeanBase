import { useMemo, useState } from 'react'
import { Stars, Stat, Empty, useLookup, ConfirmButton, pressable } from '../components/ui'
import { fmtDate, fmtRatio, ratio, extractionLabel, ROAST_LEVELS } from '../lib/coffee'
import { brewCost, fmtMoney } from '../lib/cost'
import { MediaView } from '../components/MediaPicker'
import { deleteMedia } from '../lib/media'
import { toast } from '../lib/toast'
import type { PageProps } from '../types'

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
                    <strong>{bn?.name ?? 'Unbekannte Bohne'}</strong>
                    <span className="text-muted text-sm">
                      {fmtDate(b.created_at)} · Mahlgrad {b.grind_setting || '–'} · {b.dose ?? '–'}g → {b.yield ?? '–'}g ·{' '}
                      {b.brew_time ?? '–'}s{cost && ` · ${fmtMoney(cost.value, cost.currency)}`}
                      {b.media_url && (b.media_type === 'video' ? ' · 🎬' : ' · 📷')}
                    </span>
                  </div>
                  <Stars value={b.rating} size="sm" />
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
