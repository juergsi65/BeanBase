import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Brew, Data, Grinder, Machine, Bean } from '../types'
import { extractionLabel, fmtRatio, ratio, dialInHint, fmtDate } from '../lib/coffee'
import { haptic } from '../lib/haptics'

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">
        {label} {hint && <em>{hint}</em>}
      </span>
      {children}
    </label>
  )
}

/** Große Zahleneingabe mit −/+ Buttons (Smartphone-tauglich) */
/** '' = leer (Eingabefeld gelöscht) */
export type NumValue = number | '' | null | undefined

export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  unit,
  decimals = 0,
  placeholder,
}: {
  value: NumValue
  onChange: (v: number | '') => void
  step?: number
  min?: number
  max?: number
  unit?: string
  decimals?: number
  placeholder?: string
}) {
  const num = value === '' || value == null ? null : Number(value)
  const bump = (dir: number) => {
    let next = (num ?? 0) + dir * step
    if (min != null) next = Math.max(min, next)
    if (max != null) next = Math.min(max, next)
    onChange(Number(next.toFixed(decimals)))
  }
  return (
    <div className="num">
      <button type="button" className="num-btn" onClick={() => bump(-1)} aria-label="weniger">
        −
      </button>
      <div className="num-input">
        <input
          type="number"
          inputMode={decimals ? 'decimal' : 'numeric'}
          step={step}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value.replace(',', '.')))}
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
      <button type="button" className="num-btn" onClick={() => bump(1)} aria-label="mehr">
        +
      </button>
    </div>
  )
}

export function Stars({
  value,
  onChange,
  size = 'lg',
}: {
  value: number | null | undefined
  onChange?: (v: number | null) => void
  size?: 'lg' | 'sm'
}) {
  return (
    <div className={`stars ${size}`} role={onChange ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            type="button"
            key={n}
            className={n <= (value ?? 0) ? 'on' : ''}
            onClick={() => onChange(n === value ? null : n)}
            aria-label={`${n} Sterne`}
          >
            ★
          </button>
        ) : (
          <span key={n} className={n <= (value ?? 0) ? 'on' : ''}>
            ★
          </span>
        ),
      )}
    </div>
  )
}

export function ExtractionSlider({ value, onChange }: { value: number | null | undefined; onChange: (v: number) => void }) {
  const v = value ?? 0
  return (
    <div className="extraction">
      <input
        type="range"
        min={-5}
        max={5}
        step={1}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Extraktion"
      />
      <div className="extraction-scale">
        <span>Sauer</span>
        <span>Ausgewogen</span>
        <span>Bitter</span>
      </div>
      <div className={`extraction-label ${v < 0 ? 'sour' : v > 0 ? 'bitter' : 'good'}`}>{extractionLabel(v)}</div>
    </div>
  )
}

/** Stoppuhr – übernimmt die gemessenen Sekunden ins Formular */
export function Stopwatch({ onStop }: { onStop: (secs: number) => void }) {
  const [running, setRunning] = useState(false)
  const [ms, setMs] = useState(0)
  const start = useRef(0)
  const raf = useRef(0)

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const tick = () => {
    setMs(performance.now() - start.current)
    raf.current = requestAnimationFrame(tick)
  }
  const toggle = () => {
    if (running) {
      cancelAnimationFrame(raf.current)
      setRunning(false)
      const secs = Math.round((performance.now() - start.current) / 1000)
      onStop(secs)
      haptic('success')
    } else {
      start.current = performance.now() - ms
      setRunning(true)
      haptic('heavy')
      raf.current = requestAnimationFrame(tick)
    }
  }
  const reset = () => {
    cancelAnimationFrame(raf.current)
    setRunning(false)
    setMs(0)
  }
  const s = ms / 1000
  return (
    <div className={`stopwatch ${running ? 'running' : ''}`}>
      <div className="sw-time">
        {Math.floor(s)}
        <small>.{Math.floor((s % 1) * 10)} s</small>
      </div>
      <div className="sw-buttons">
        <button type="button" className={`btn big ${running ? 'danger' : 'primary'}`} onClick={toggle} data-no-haptic="1">
          {running ? '■ Stopp' : ms ? '▶ Weiter' : '▶ Start'}
        </button>
        <button type="button" className="btn big ghost" onClick={reset} disabled={running || !ms}>
          ↺
        </button>
      </div>
    </div>
  )
}

export function Chip({ children, tone, onRemove }: { children: ReactNode; tone?: string; onRemove?: () => void }) {
  return (
    <span className={`chip ${tone ?? ''}`}>
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="entfernen">
          ×
        </button>
      )}
    </span>
  )
}

export function TagInput({
  value = [],
  onChange,
  placeholder,
}: {
  value?: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const parts = draft.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) onChange([...new Set([...value, ...parts])])
    setDraft('')
  }
  return (
    <div className="tags-input">
      {value.map((t) => (
        <Chip key={t} onRemove={() => onChange(value.filter((x) => x !== t))}>
          {t}
        </Chip>
      ))}
      <input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit()
          }
        }}
        onBlur={commit}
      />
    </div>
  )
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: Record<K, ReactNode>
  value: K | null | undefined
  onChange: (v: K | null) => void
}) {
  return (
    <div className="segmented">
      {(Object.entries(options) as [K, ReactNode][]).map(([k, label]) => (
        <button type="button" key={k} className={value === k ? 'on' : ''} onClick={() => onChange(value === k ? null : k)}>
          {label}
        </button>
      ))}
    </div>
  )
}

/** Kompakte Rezept-Anzeige: alles, was man zum Einstellen der Mühle braucht */
export type RecipeBrew = Pick<
  Brew,
  | 'dose' | 'yield' | 'grinder_id' | 'machine_id' | 'rating' | 'grind_setting' | 'brew_time'
  | 'temperature' | 'preinfusion' | 'created_at' | 'extraction' | 'notes'
>

export function RecipeCard<B extends RecipeBrew>({
  title,
  brew,
  lookup,
  onReuse,
}: {
  title: ReactNode
  brew: B | null | undefined
  lookup: Lookup
  onReuse?: (brew: B) => void
}) {
  if (!brew) return null
  const r = ratio(brew.dose, brew.yield)
  const grinder = lookup.grinders(brew.grinder_id)
  const machine = lookup.machines(brew.machine_id)
  const hint = dialInHint(brew)
  return (
    <div className="recipe">
      <div className="recipe-head">
        <span className="recipe-title">{title}</span>
        {brew.rating && <Stars value={brew.rating} size="sm" />}
      </div>
      <div className="recipe-grind">
        <span className="label">Mahlgrad</span>
        <span className="value">{brew.grind_setting || '–'}</span>
        {grinder && <span className="sub">{grinder.name}</span>}
      </div>
      <div className="stats">
        <Stat label="Dosis" value={brew.dose} unit="g" />
        <Stat label="Output" value={brew.yield} unit="g" />
        <Stat label="Ratio" value={fmtRatio(r)} />
        <Stat label="Zeit" value={brew.brew_time} unit="s" />
        <Stat label="Temp" value={brew.temperature} unit="°C" />
        <Stat label="Pre-Inf." value={brew.preinfusion} unit="s" />
      </div>
      <div className="recipe-meta">
        {machine && <span>{machine.name}</span>}
        <span>{fmtDate(brew.created_at)}</span>
        {brew.extraction != null && <span>{extractionLabel(brew.extraction)}</span>}
      </div>
      {brew.notes && <p className="recipe-note">„{brew.notes}“</p>}
      {hint && <p className="recipe-hint">💡 {hint}</p>}
      {onReuse && (
        <button className="btn primary block" onClick={() => onReuse(brew)}>
          Mit diesen Werten neuen Bezug starten
        </button>
      )}
    </div>
  )
}

export function Stat({ label, value, unit }: { label: ReactNode; value: ReactNode; unit?: string }) {
  const empty = value == null || value === ''
  return (
    <div className="stat">
      <span className="stat-value">
        {empty ? '–' : value}
        {!empty && unit && <small>{unit}</small>}
      </span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  )
}

type Get<T> = (id: string | null | undefined) => T | undefined
export function byId<T extends { id: string }>(rows: T[]): Get<T> {
  const m = new Map(rows.map((r) => [r.id, r]))
  return (id) => (id ? m.get(id) : undefined)
}
export interface Lookup {
  beans: Get<Bean>
  machines: Get<Machine>
  grinders: Get<Grinder>
}
export function useLookup(data: Pick<Data, 'beans' | 'machines' | 'grinders'>): Lookup {
  return { beans: byId(data.beans), machines: byId(data.machines), grinders: byId(data.grinders) }
}
