import { useMemo, useState } from 'react'
import { Stars, Stat, Empty, useLookup } from '../components/ui'
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
    if (!confirm('Diesen Bezug wirklich löschen?')) return
    const b = data.brews.find((x) => x.id === id)
    await data.remove('brews', id)
    if (b?.media_url) deleteMedia(b.media_url).catch(() => {})
    toast('Bezug gelöscht', { tone: 'info' })
  }

  return (
    <div className="stack">
      <h2>Brew-Log</h2>
      <div className="filters">
        <input type="search" placeholder="Suchen (Bohne, Rösterei, Notiz …)" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="grid3">
          <select value={bean} onChange={(e) => setBean(e.target.value)}>
            <option value="">Alle Bohnen</option>
            {data.beans.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select value={roast} onChange={(e) => setRoast(e.target.value)}>
            <option value="">Jeder Röstgrad</option>
            {Object.entries(ROAST_LEVELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
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
        <Empty action={<button className="btn primary" onClick={() => go('brew', { key: Date.now() })}>Bezug loggen</button>}>
          {data.brews.length ? 'Keine Treffer für diese Filter.' : 'Noch keine Bezüge geloggt.'}
        </Empty>
      ) : (
        <ul className="list">
          {rows.map((b) => {
            const bn = lookup.beans(b.bean_id)
            const isOpen = open === b.id
            const cost = brewCost(b, data.bean_stock)
            return (
              <li key={b.id} className={`list-item col ${isOpen ? 'open' : ''}`}>
                <div className="row" onClick={() => setOpen(isOpen ? null : b.id)}>
                  <div>
                    <strong>{bn?.name ?? 'Unbekannte Bohne'}</strong>
                    <span className="muted small">
                      {fmtDate(b.created_at)} · Mahlgrad {b.grind_setting || '–'} · {b.dose ?? '–'}g → {b.yield ?? '–'}g ·{' '}
                      {b.brew_time ?? '–'}s{cost && ` · ${fmtMoney(cost.value, cost.currency)}`}
                      {b.media_url && (b.media_type === 'video' ? ' · 🎬' : ' · 📷')}
                    </span>
                  </div>
                  <Stars value={b.rating} size="sm" />
                </div>
                {isOpen && (
                  <div className="details">
                    <div className="stats">
                      <Stat label="Ratio" value={fmtRatio(ratio(b.dose, b.yield))} />
                      <Stat label="Temp" value={b.temperature} unit="°C" />
                      <Stat label="Pre-Inf." value={b.preinfusion} unit="s" />
                    </div>
                    <p className="small">
                      {lookup.machines(b.machine_id)?.name ?? '–'} · {lookup.grinders(b.grinder_id)?.name ?? '–'} · {extractionLabel(b.extraction)}
                    </p>
                    {b.notes && <p className="recipe-note">„{b.notes}“</p>}
                    <MediaView url={b.media_url} type={b.media_type} />
                    <div className="row-actions">
                      <button className="btn primary sm" onClick={() => go('brew', { key: Date.now(), brew: b })}>
                        Wiederholen
                      </button>
                      <button className="btn ghost sm" onClick={() => go('brew', { key: Date.now(), brew: b, editId: b.id })}>
                        Bearbeiten
                      </button>
                      <button className="btn danger-ghost sm" onClick={() => del(b.id)}>
                        Löschen
                      </button>
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
