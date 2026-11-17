import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { Brew, Data, Grinder, Machine, Bean } from '../types'
import { extractionLabel, fmtRatio, ratio, dialInHint, fmtDate } from '../lib/coffee'
import { haptic } from '../lib/haptics'
import { Lightbulb, Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react'

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="fieldset gap-1.5 p-0 min-w-0">
      <span className="fieldset-legend justify-start flex-wrap gap-x-1 gap-y-0 p-0 text-sm">
        {label} {hint && <em className="font-normal not-italic text-muted">{hint}</em>}
      </span>
      {children}
    </label>
  )
}

/** Große Zahleneingabe mit −/+ Buttons (Smartphone-tauglich) */
/** '' = leer (Eingabefeld gelöscht) */
export type NumValue = number | '' | null | undefined

const numBtn = 'btn join-item h-(--tap) w-(--tap) min-w-11 px-0 bg-base-200 border-base-300 active:btn-primary'

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
    <div className="join num w-full">
      <button type="button" className={numBtn} onClick={() => bump(-1)} aria-label="weniger">
        <Minus size={20} aria-hidden />
      </button>
      <label className="input join-item h-(--tap) grow min-w-0 px-2">
        <input
          type="number"
          className="num-input num grow min-w-0 text-center text-[1.35rem] font-semibold"
          inputMode={decimals ? 'decimal' : 'numeric'}
          step={step}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value.replace(',', '.')))}
        />
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </label>
      <button type="button" className={numBtn} onClick={() => bump(1)} aria-label="mehr">
        <Plus size={20} aria-hidden />
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
  const name = useId()
  const star = 'mask mask-star-2 bg-accent-strong'
  if (!onChange)
    return (
      <div className="rating rating-xs shrink-0">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className={star} aria-label={`${n} Sterne`} aria-current={n === value} />
        ))}
      </div>
    )
  return (
    <div className={`rating justify-center w-full ${size === 'lg' ? 'rating-xl gap-1' : 'rating-sm'}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <input
          key={n}
          type="radio"
          name={name}
          className={star}
          aria-label={`${n} Sterne`}
          checked={n === value}
          onChange={() => {}}
          onClick={() => onChange(n === value ? null : n)}
        />
      ))}
    </div>
  )
}

/** null = noch nicht bewertet (Daumen bleibt blass, bis der Regler berührt wird) */
export function ExtractionSlider({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  const unset = value == null
  const v = value ?? 0
  const tone = unset ? 'text-muted font-normal' : v < 0 ? 'text-(--sour)' : v > 0 ? 'text-accent-strong' : 'text-success'
  return (
    <div>
      <input
        type="range"
        className={`range range-lg w-full rounded-full text-base-content [--range-bg:transparent] [--range-fill:0] bg-[linear-gradient(90deg,var(--sour),var(--color-success)_50%,var(--bitter))] ${unset ? '[&::-webkit-slider-thumb]:opacity-40 [&::-moz-range-thumb]:opacity-40' : ''}`}
        min={-5}
        max={5}
        step={1}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        // Tippen auf die Mitte löst kein change aus → als "ausgewogen" werten
        onPointerUp={() => unset && onChange(0)}
        aria-label="Extraktion"
        aria-valuetext={unset ? 'Nicht bewertet' : extractionLabel(v)}
      />
      <div className="flex justify-between text-xs text-muted mt-1.5">
        <span>Sauer</span>
        <span>Ausgewogen</span>
        <span>Bitter</span>
      </div>
      <div className={`flex items-center justify-center gap-2 font-bold mt-1 ${tone}`}>
        {unset ? 'Nicht bewertet' : extractionLabel(v)}
        {!unset && (
          <button type="button" className="btn btn-ghost btn-xs font-normal text-muted" onClick={() => onChange(null)}>
            Zurücksetzen
          </button>
        )}
      </div>
    </div>
  )
}

/** Klickbare Nicht-Button-Elemente (Listenzeilen) tastatur- und screenreaderfähig machen */
export const pressable = (fn: () => void, expanded?: boolean) => ({
  role: 'button',
  tabIndex: 0,
  'aria-expanded': expanded,
  onClick: fn,
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fn()
    }
  },
})

/**
 * Löschen & Co. mit Inline-Bestätigung statt confirm()/prompt().
 * typeToConfirm: Wort, das zur Bestätigung eingetippt werden muss (für endgültige Aktionen).
 */
export function ConfirmButton({
  children,
  question,
  confirmLabel,
  onConfirm,
  typeToConfirm,
  className = 'btn btn-outline btn-error btn-sm',
  ariaLabel,
}: {
  children: ReactNode
  question: ReactNode
  confirmLabel: string
  onConfirm: () => unknown
  typeToConfirm?: string
  className?: string
  ariaLabel?: string
}) {
  const [asking, setAsking] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const close = () => {
    setAsking(false)
    setTyped('')
  }
  if (!asking)
    return (
      <button type="button" className={className} onClick={() => setAsking(true)} aria-label={ariaLabel}>
        {children}
      </button>
    )
  const ok = !typeToConfirm || typed === typeToConfirm
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape schließt die Bestätigung
    <div
      role="alertdialog"
      aria-label={typeof question === 'string' ? question : confirmLabel}
      className="flex w-full basis-full flex-col gap-2 rounded-xl border border-error/40 bg-error/8 p-3 text-sm"
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      <span>{question}</span>
      {typeToConfirm && (
        <input
          className="input input-sm w-full"
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- Bestätigung wurde gerade per Klick geöffnet, Fokus gehört hinein
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={typeToConfirm}
          aria-label={`Zum Bestätigen „${typeToConfirm}“ eintippen`}
          autoComplete="off"
        />
      )}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className="btn btn-error btn-sm"
          disabled={!ok || busy}
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- s. o.
          autoFocus={!typeToConfirm}
          onClick={async () => {
            setBusy(true)
            try {
              await onConfirm()
            } finally {
              setBusy(false)
              close()
            }
          }}
        >
          {busy ? '…' : confirmLabel}
        </button>
        <button type="button" className="btn btn-ghost border-base-300 btn-sm" onClick={close}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}

/** Stoppuhr – übernimmt die gemessenen Sekunden ins Formular. target = Zielfenster [von, bis] in s */
export function Stopwatch({ onStop, target = [25, 30] }: { onStop: (secs: number) => void; target?: [number, number] }) {
  const [running, setRunning] = useState(false)
  const [ms, setMs] = useState(0)
  const start = useRef(0)
  const raf = useRef(0)

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const tick = () => {
    // oxlint-disable-next-line react/purity -- false positive: läuft im rAF-Callback, nicht im Render
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
  // Ring: voller Kreis = 4/3 des Zielendes (Espresso: 40 s)
  const max = Math.round((target[1] * 4) / 3)
  const inWin = s >= target[0] && s <= target[1]
  const over = s > target[1]
  const C = 2 * Math.PI * 90
  const C2 = 2 * Math.PI * 102
  const ticks = 40
  return (
    <div className="flex flex-col gap-3">
      <div className="sw-ring">
        <svg viewBox="0 0 240 240" aria-hidden>
          {Array.from({ length: ticks }, (_, i) => {
            const t = (i / ticks) * max
            const win = t >= target[0] && t <= target[1]
            return (
              <line
                key={i}
                x1="120"
                y1="4"
                x2="120"
                y2={i % 5 ? 9 : 14}
                stroke={win ? 'var(--color-success)' : i % 5 ? 'var(--color-base-300)' : 'var(--line-strong)'}
                strokeWidth="1.5"
                transform={`rotate(${(i * 360) / ticks} 120 120)`}
              />
            )
          })}
          <circle
            cx="120"
            cy="120"
            r="102"
            fill="none"
            stroke="var(--color-success)"
            strokeWidth="4"
            opacity="0.9"
            strokeDasharray={`${(C2 * (target[1] - target[0])) / max} ${C2}`}
            strokeDashoffset={(-C2 * target[0]) / max}
            transform="rotate(-90 120 120)"
          />
          <circle cx="120" cy="120" r="90" fill="none" stroke="var(--color-base-200)" strokeWidth="10" />
          <circle
            className="arc"
            cx="120"
            cy="120"
            r="90"
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            stroke={inWin ? 'var(--color-success)' : over ? 'var(--color-warning)' : 'var(--color-primary)'}
            strokeDasharray={`${(Math.min(s, max) / max) * C} ${C}`}
            transform="rotate(-90 120 120)"
          />
        </svg>
        <div className="sw-face">
          <span className="lbl">{running ? 'Läuft' : inWin ? 'Im Zielfenster' : 'Brühzeit'}</span>
          <span className={`sw-time num ${inWin ? 'in-win' : over ? 'over' : ''}`} role="timer">
            {s.toFixed(1)}
          </span>
          <span className="num text-xs text-muted">
            Ziel {target[0]}–{target[1]} s
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_56px] gap-2">
        <button
          type="button"
          className={`btn btn-lg h-14 text-lg font-semibold ${running ? 'bg-base-content text-base-100 border-base-content' : 'btn-primary'}`}
          onClick={toggle}
          data-no-haptic="1"
        >
          {running ? <Pause size={20} aria-hidden /> : <Play size={20} aria-hidden />}
          {running ? 'Stopp' : ms ? 'Weiter' : 'Start'}
        </button>
        <button type="button" className="btn btn-lg btn-ghost border-base-300 h-14 px-0" onClick={reset} disabled={running || !ms} aria-label="Stoppuhr zurücksetzen">
          <RotateCcw size={20} aria-hidden />
        </button>
      </div>
    </div>
  )
}

const CHIP_TONE: Record<string, string> = {
  good: 'badge-soft badge-success',
  info: 'badge-soft badge-info',
  warn: 'badge-soft badge-warning',
  bad: 'badge-soft badge-error',
  flavor: 'badge-outline badge-primary text-accent-strong',
  muted: 'bg-base-200 border-base-300 text-muted',
}

export function Chip({ children, tone, onRemove }: { children: ReactNode; tone?: string; onRemove?: () => void }) {
  return (
    <span className={`badge h-auto min-h-6 gap-1 ${CHIP_TONE[tone ?? ''] ?? 'bg-base-200 border-base-300'}`}>
      {children}
      {onRemove && (
        <button type="button" className="cursor-pointer text-base text-muted leading-none" onClick={onRemove} aria-label="entfernen">
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
    <div className="tags-input input w-full h-auto flex-wrap gap-1.5 py-1.5">
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

/** Klassen für einen Segment-Knopf (auch für eigene Segment-Leisten in Seiten) */
export const segBtn = (on: boolean) =>
  `btn btn-ghost grow min-h-10 h-auto border-0 rounded-[9px] px-3 ${on ? 'bg-base-300 text-base-content font-semibold' : 'font-normal text-muted hover:text-base-content'}`
/** Hülle für segBtn-Knöpfe */
export const segWrap = 'flex flex-wrap gap-1 rounded-xl border border-base-300 bg-base-200 p-1'

/** Auswahl-Knöpfe; nochmal tippen hebt die Auswahl auf */
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
    <div className={segWrap}>
      {(Object.entries(options) as [K, ReactNode][]).map(([k, label]) => (
        <button type="button" key={k} className={segBtn(value === k)} aria-pressed={value === k} onClick={() => onChange(value === k ? null : k)}>
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
    <div className="flex flex-col gap-3 rounded-[14px] bg-base-200 p-3.5">
      <div className="flex items-center justify-between">
        <span className="lbl">{title}</span>
        {brew.rating && <Stars value={brew.rating} size="sm" />}
      </div>
      <div className="recipe-grind">
        <span className="lbl">Mahlgrad</span>
        <span className="num text-[2.6rem] font-semibold leading-tight text-accent-strong">{brew.grind_setting || '–'}</span>
        {grinder && <span className="text-xs text-muted">{grinder.name}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Dosis" value={brew.dose} unit="g" />
        <Stat label="Output" value={brew.yield} unit="g" />
        <Stat label="Ratio" value={fmtRatio(r)} />
        <Stat label="Zeit" value={brew.brew_time} unit="s" />
        <Stat label="Temp" value={brew.temperature} unit="°C" />
        <Stat label="Pre-Inf." value={brew.preinfusion} unit="s" />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted [overflow-wrap:anywhere]">
        {machine && <span>{machine.name}</span>}
        <span>{fmtDate(brew.created_at)}</span>
        {brew.extraction != null && <span>{extractionLabel(brew.extraction)}</span>}
      </div>
      {brew.notes && <p className="italic [overflow-wrap:anywhere]">„{brew.notes}“</p>}
      {hint && (
        <p className="flex gap-1.5 text-sm text-muted">
          <Lightbulb size={16} className="mt-0.5 shrink-0" aria-hidden />
          {hint}
        </p>
      )}
      {onReuse && (
        <button className="btn btn-primary btn-block" onClick={() => onReuse(brew)}>
          Mit diesen Werten neuen Bezug starten
        </button>
      )}
    </div>
  )
}

/** Kennzahl-Kachel (daisyUI stat, kompakt) */
export const statCls = 'stat place-items-start gap-1 rounded-[10px] bg-base-100 px-2.5 py-2.5 min-w-0'
export const statValueCls = 'stat-value num text-lg font-semibold whitespace-normal'
export const statTitleCls = 'stat-title lbl whitespace-normal'

export function Stat({ label, value, unit, className = '' }: { label: ReactNode; value: ReactNode; unit?: string; className?: string }) {
  const empty = value == null || value === ''
  return (
    <div className={`${statCls} ${className}`}>
      <span className={statTitleCls}>{label}</span>
      <span className={statValueCls}>
        {empty ? '–' : value}
        {!empty && unit && <small className="ml-0.5 text-xs font-normal text-muted">{unit}</small>}
      </span>
    </div>
  )
}

/** Frische-Skala (rein visuell, die Tage stehen daneben als Zahl): Ruhen 0–5 Tage · Optimum bis 30 · Nachlassend bis 60 (wie freshness() in lib/coffee) */
export function FreshnessScale({ days }: { days: number }) {
  const pos = Math.min(100, Math.max(0, (days / 60) * 100))
  return (
    <div className="scale" aria-hidden>
      <span className="bg-(--scale-rest)" style={{ flex: 5 }} />
      <span className="bg-(--scale-good)" style={{ flex: 25 }} />
      <span className="bg-(--scale-fade)" style={{ flex: 30 }} />
      <span className="needle" style={{ left: `${pos}%` }} />
    </div>
  )
}

/** Ratio-Lineal 1:1.5 – 1:3.0 (Espresso); bei Filter-Ratios (> 1:5) ausgeblendet */
export function RatioRuler({ value }: { value: number | null }) {
  if (value == null || value > 5) return null
  const pos = Math.min(100, Math.max(0, ((value - 1.5) / 1.5) * 100))
  return (
    <div aria-hidden>
      <div className="ruler">
        <span className="needle" style={{ left: `${pos}%` }} />
      </div>
      <div className="num relative mt-1.5 h-4 text-[11px] text-muted">
        <span className="absolute left-0">1:1.5</span>
        <span className="absolute left-1/3 -translate-x-1/2">1:2.0</span>
        <span className="absolute left-2/3 -translate-x-1/2">1:2.5</span>
        <span className="absolute right-0">1:3.0</span>
      </div>
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
