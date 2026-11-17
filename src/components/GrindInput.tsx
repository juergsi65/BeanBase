// Mahlgrad-Eingabe passend zur Skala der Mühle (Klicks, Makro/Mikro, Umdrehung.Zahl.Klick, Innenring …)
import { Minus, Plus } from 'lucide-react'
import { NumberInput } from './ui'
import { formatGrind, parseGrind, type GrindScale } from '../lib/grind'

const cBtn = 'btn btn-square size-11 min-h-0 shrink-0 rounded-[11px] border-(--line-strong) bg-base-100 px-0'
const sub = 'text-[0.72rem] uppercase tracking-wider text-muted'

export default function GrindInput({ scale, value, onChange }: { scale: GrindScale; value: string | number | null | undefined; onChange: (v: string) => void }) {
  const raw = value == null ? '' : String(value)
  const parsed = parseGrind(scale, raw)
  const unparsable = raw.trim() !== '' && !parsed

  // Freitext: stufenlose Mühlen ohne Skala oder Werte, die nicht zur Skala passen
  if (scale.kind === 'free' || (unparsable && scale.kind !== 'rotation'))
    return (
      <div className="flex flex-col gap-1">
        <input value={raw} onChange={(e) => onChange(e.target.value)} placeholder="z. B. 2.4 oder ‚zwischen 2 und 3‘" className="input w-full big-input" />
        {unparsable && scale.kind !== 'free' && (
          <button type="button" className="btn btn-ghost btn-xs self-start" onClick={() => onChange('')}>
            Wert passt nicht zur Skala – neu eingeben
          </button>
        )}
      </div>
    )

  const set = (pos: number | null, ring = parsed?.ring) => onChange(pos == null ? '' : formatGrind(scale, { pos, ring }))

  switch (scale.kind) {
    case 'number': {
      const decimals = (String(scale.step).split('.')[1] ?? '').length
      const main = parsed ? Number(parsed.pos.toFixed(decimals)) : ''
      const ring = scale.ring ? (parsed?.ring ?? scale.ring.default) : null
      return (
        <div className={scale.ring ? 'grid grid-cols-[1fr_auto] items-end gap-2' : ''}>
          <div className="flex flex-col gap-1">
            {scale.ring && <span className={sub}>Skala {scale.min}–{scale.max}</span>}
            <NumberInput compact label="Mahlgrad" value={main} onChange={(v) => set(v === '' ? null : v)} step={scale.step} decimals={decimals} min={scale.min} max={scale.max} placeholder="–" />
          </div>
          {scale.ring && ring != null && (
            <div className="flex flex-col gap-1">
              <span className={sub}>Innenring</span>
              <select aria-label="Innenring" className="select h-11 w-22 rounded-[11px] border-(--line-strong) bg-base-100 text-center font-semibold" value={ring} onChange={(e) => set(parsed?.pos ?? scale.min, Number(e.target.value))}>
                {Array.from({ length: scale.ring.max - scale.ring.min + 1 }, (_, i) => scale.ring!.min + i).map((r) => (
                  <option key={r} value={r}>
                    {r}
                    {r === scale.ring!.default ? ' ★' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )
    }
    case 'clicks':
      return <NumberInput compact label="Klicks" value={parsed ? Math.round(parsed.pos) : ''} onChange={(v) => set(v === '' ? null : v)} step={1} min={0} max={scale.max} unit="Klicks" placeholder="–" />
    case 'compound': {
      const k = scale.subs.length
      const ticks = parsed ? Math.round(parsed.pos * k) : null
      const main = ticks == null ? null : Math.floor(ticks / k)
      const idx = ticks == null || main == null ? 0 : ticks - main * k
      const letters = /^[a-z]$/i.test(scale.subs[1] ?? '')
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className={sub}>{letters ? `Makro ${scale.min}–${scale.max}` : `Zahl ${scale.min}–${scale.max}`}</span>
            <NumberInput compact label={letters ? 'Makro' : 'Zahl'} value={main ?? ''} onChange={(v) => set(v === '' ? null : v + idx / k)} step={1} min={scale.min} max={scale.max} placeholder="–" />
          </div>
          <div className="flex flex-col gap-1">
            <span className={sub}>{letters ? 'Mikro (A = feiner)' : 'Zwischenstufe'}</span>
            <div className="flex flex-wrap gap-1">
              {scale.subs.map((l, i) => (
                <button
                  type="button"
                  key={l || 'none'}
                  className={`btn btn-sm min-w-10 rounded-[10px] ${i === idx && main != null ? 'btn-primary' : 'border-(--line-strong) bg-base-100'}`}
                  onClick={() => set((main ?? scale.min) + i / k)}
                >
                  {letters ? l : `${main ?? scale.min}${l}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    }
    case 'rotation': {
      const per = scale.numbers * scale.clicks
      const bump = (dir: number) => {
        const t = Math.round((parsed?.pos ?? 0) * per) + dir
        set(Math.min(scale.maxRot * per, Math.max(0, t)) / per)
      }
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-1">
            <button type="button" className={cBtn} onClick={() => bump(-1)} aria-label="1 Klick feiner">
              <Minus size={18} aria-hidden />
            </button>
            <input
              className="num min-w-0 grow bg-transparent text-center text-2xl font-semibold outline-none"
              inputMode="decimal"
              value={raw}
              placeholder="1.5.2"
              onChange={(e) => onChange(e.target.value)}
              aria-label="Umdrehung.Zahl.Klick"
            />
            <button type="button" className={cBtn} onClick={() => bump(1)} aria-label="1 Klick gröber">
              <Plus size={18} aria-hidden />
            </button>
          </div>
          <span className="text-muted text-sm">
            {parsed ? `= ${Math.round(parsed.pos * per)} Klicks ab Nullpunkt · ` : ''}± = 1 Klick
          </span>
        </div>
      )
    }
  }
}
