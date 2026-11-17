import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { Brew, Data, Grinder, Machine, Bean } from '../types'
import { extractionLabel, fmtRatio, ratio, dialInHint, fmtDate } from '../lib/coffee'
import { haptic } from '../lib/haptics'

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

const numBtn = 'btn join-item h-(--tap) w-(--tap) min-w-11 px-0 text-2xl font-normal active:btn-primary'

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
        −
      </button>
      <label className="input join-item h-(--tap) grow min-w-0 px-2">
        <input
          type="number"
          className="num-input grow min-w-0 text-center text-[1.35rem] font-bold"
          inputMode={decimals ? 'decimal' : 'numeric'}
          step={step}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value.replace(',', '.')))}
        />
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </label>
      <button type="button" className={numBtn} onClick={() => bump(1)} aria-label="mehr">
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

/** Stoppuhr – übernimmt die gemessenen Sekunden ins Formular */
export function Stopwatch({ onStop }: { onStop: (secs: number) => void }) {
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
  return (
    <div className={`flex flex-col gap-3 ${running ? 'running' : ''}`}>
      <div className="sw-time">
        {Math.floor(s)}
        <small>.{Math.floor((s % 1) * 10)} s</small>
      </div>
      <div className="grid grid-cols-[1fr_72px] gap-2">
        <button type="button" className={`btn btn-lg h-16 text-xl ${running ? 'btn-error' : 'btn-primary'}`} onClick={toggle} data-no-haptic="1">
          {running ? '■ Stopp' : ms ? '▶ Weiter' : '▶ Start'}
        </button>
        <button type="button" className="btn btn-lg btn-ghost border-base-300 h-16 text-xl" onClick={reset} disabled={running || !ms}>
          ↺
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
export const segBtn = (on: boolean) => `btn grow min-h-11 ${on ? 'btn-primary' : 'font-normal'}`

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
    <div className="flex flex-wrap gap-1.5">
      {(Object.entries(options) as [K, ReactNode][]).map(([k, label]) => (
        <button type="button" key={k} className={segBtn(value === k)} onClick={() => onChange(value === k ? null : k)}>
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
        <span className="text-xs font-bold uppercase tracking-widest text-muted">{title}</span>
        {brew.rating && <Stars value={brew.rating} size="sm" />}
      </div>
      <div className="recipe-grind">
        <span className="text-xs uppercase tracking-widest text-muted">Mahlgrad</span>
        <span className="text-[2.6rem] font-extrabold leading-tight text-accent-strong">{brew.grind_setting || '–'}</span>
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
      {hint && <p className="text-sm text-muted">💡 {hint}</p>}
      {onReuse && (
        <button className="btn btn-primary btn-block" onClick={() => onReuse(brew)}>
          Mit diesen Werten neuen Bezug starten
        </button>
      )}
    </div>
  )
}

/** Kennzahl-Kachel (daisyUI stat, kompakt) */
export const statCls = 'stat place-items-center gap-0 rounded-[10px] bg-base-100 px-1 py-2 min-w-0'
export const statValueCls = 'stat-value text-lg font-bold tabular-nums whitespace-normal'
export const statTitleCls = 'stat-title text-[0.7rem] text-muted whitespace-normal text-center'

export function Stat({ label, value, unit, className = '' }: { label: ReactNode; value: ReactNode; unit?: string; className?: string }) {
  const empty = value == null || value === ''
  return (
    <div className={`${statCls} ${className}`}>
      <span className={statValueCls}>
        {empty ? '–' : value}
        {!empty && unit && <small className="ml-px text-xs font-normal text-muted">{unit}</small>}
      </span>
      <span className={statTitleCls}>{label}</span>
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
