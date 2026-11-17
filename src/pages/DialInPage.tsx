import { ArrowRight, Check, X } from 'lucide-react'
import { Empty, useLookup } from '../components/ui'
import { adjustGrind, correction, fmtRange } from '../lib/dialin'
import { extractionLabel, fmtRatio, ratio } from '../lib/coffee'
import type { BrewPreset, PageProps } from '../types'

const TONE = {
  good: { chip: 'border-success/40 bg-success/12 text-success', label: 'Im Ziel' },
  sour: { chip: 'border-warning/40 bg-warning/12 text-warning', label: 'Unterextrahiert' },
  bitter: { chip: 'border-(--bitter)/45 bg-(--bitter)/12 text-(--bitter)', label: 'Überextrahiert' },
  none: { chip: 'border-base-300 text-muted', label: 'Nicht bewertet' },
} as const

/** Ergebnis nach dem Speichern: Diagnose aus Zeit + Geschmack und der nächste Versuch */
export default function DialInPage({ data, go, preset }: PageProps & { preset: BrewPreset | null }) {
  const lookup = useLookup(data)
  const brew = preset?.brew
  if (!brew)
    return (
      <Empty action={<button className="btn btn-primary" onClick={() => go('brew', { key: Date.now() })}>Bezug loggen</button>}>
        Kein Bezug zum Auswerten.
      </Empty>
    )
  const grinder = lookup.grinders(brew.grinder_id)
  const machine = lookup.machines(brew.machine_id)
  const target = preset?.target ?? null
  const c = correction({
    extraction: brew.extraction,
    grind: brew.grind_setting,
    scaleType: grinder?.scale_type,
    temperature: brew.temperature,
    brewTime: brew.brew_time,
    targetTime: target,
    type: machine?.type,
  })
  const tone = TONE[c.tone]
  const adj = adjustGrind(brew.grind_setting, brew.extraction, grinder?.scale_type)
  const nextGrind = c.tone !== 'good' && adj.value != null && adj.steps ? adj.value : null
  const time = brew.brew_time ?? null
  // Zeitskala: 0 bis 4/3 des Zielendes (wie die Stoppuhr)
  const max = target ? Math.round((target[1] * 4) / 3) : null
  const pct = (t: number) => (max ? Math.min(100, (t / max) * 100) : 0)
  const taste = brew.extraction ?? null

  const next = () =>
    go('brew', {
      key: Date.now(),
      brew: { ...brew, id: undefined, created_at: undefined, brew_time: null, rating: null, extraction: null, notes: null, media_url: null, media_type: null, ...(nextGrind != null ? { grind_setting: String(nextGrind) } : {}) },
    })

  const sour = (brew.extraction ?? 0) < 0
  const attempt = data.brews.filter((b) => b.bean_id === brew.bean_id).length
  const timeTone = time == null || !target ? '' : time < target[0] ? 'text-warning' : time > target[1] ? 'text-(--bitter)' : 'text-success'
  const tasteTone = taste == null ? '' : taste < 0 ? 'text-warning' : taste > 0 ? 'text-(--bitter)' : 'text-success'
  const axis = 'num flex justify-between text-[11px] text-muted'
  // Zeit-Hinweis („Zu schnell …“) wird zur Diagnose-Aussage; der Mahlgrad-Tipp steht schon in „Nächster Versuch“
  const timeTip = c.tips.find((t) => t.startsWith('Zu schnell') || t.startsWith('Zu langsam'))
  const alternatives = c.tips
    .filter((t) => t !== timeTip && !(nextGrind != null && t.startsWith('Mahlgrad')))
    .map((t) => t.replace(/^oder /, ''))
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))

  // Handy: eine Spalte. Desktop: Diagnose links, nächster Versuch und Alternativen rechts
  return (
    <div className="flex flex-col gap-4.5 desk:grid desk:grid-cols-2 desk:items-start desk:gap-6">
      <header className="flex items-center gap-2.5 desk:col-span-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-success/40 bg-success/12 text-success">
          <Check size={18} strokeWidth={2.2} aria-hidden />
        </span>
        <div className="min-w-0 grow">
          <h2 className="text-lg desk:text-[34px] desk:tracking-[-0.025em]">Bezug gespeichert</h2>
          <p className="num truncate text-xs text-muted">
            {lookup.beans(brew.bean_id)?.name ?? 'Bezug'}
            {attempt > 0 && ` · Versuch ${attempt}`}
          </p>
        </div>
        <button className="btn btn-square size-11 rounded-[12px] border-base-300 bg-base-100" onClick={() => go('dashboard')} aria-label="Schließen">
          <X size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      <section className="card gap-4 border border-base-300 bg-base-100 p-4 desk:p-5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="lbl">Diagnose</span>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs ${tone.chip}`}>{tone.label}</span>
        </div>
        <p className="text-xl font-semibold leading-snug tracking-[-0.01em]">{timeTip ?? c.title ?? 'Ohne Geschmacksbewertung keine Korrektur.'}</p>

        {max && time != null && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Brühzeit</span>
              <span className="num">
                <span className={`font-semibold ${timeTone}`}>{time} s</span> <span className="text-muted">/ Ziel {fmtRange(target!)}</span>
              </span>
            </div>
            <div className="relative h-3.5 rounded-[4px] bg-base-300" aria-hidden>
              <span className="absolute inset-y-0 border-x border-success bg-success/20" style={{ left: `${pct(target![0])}%`, width: `${pct(target![1]) - pct(target![0])}%` }} />
              <span className="absolute -top-[3px] -bottom-[3px] w-[3px] -ml-px rounded-sm bg-base-content" style={{ left: `${pct(time)}%` }} />
            </div>
            <div className={axis} aria-hidden>
              <span>0 s</span>
              <span>{max / 2}</span>
              <span>{max} s</span>
            </div>
          </div>
        )}
        {taste != null && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Geschmack</span>
              <span className={`font-semibold ${tasteTone}`}>{extractionLabel(taste)}</span>
            </div>
            <div className="relative h-3.5 rounded-[4px] bg-[linear-gradient(90deg,var(--scale-rest),var(--color-base-300)_40%,var(--scale-good)_50%,var(--color-base-300)_60%,color-mix(in_srgb,var(--bitter)_45%,var(--color-base-300)))]" aria-hidden>
              <span className="absolute -top-[3px] -bottom-[3px] w-[3px] -ml-px rounded-sm bg-base-content" style={{ left: `${((taste + 5) / 10) * 100}%` }} />
            </div>
            <div className={axis} aria-hidden>
              <span>Sauer</span>
              <span>Balance</span>
              <span>Bitter</span>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-4.5">
        {nextGrind != null && (
          <section className="flex flex-col gap-2.5">
            <h3 className="lbl">Nächster Versuch</h3>
            <div className="card gap-3.5 border-[1.5px] border-primary bg-primary/6 p-4">
              <div className="flex items-center gap-3.5">
                <div className="grow">
                  <div className="lbl">Mahlgrad</div>
                  <div className="mt-0.5 flex items-baseline gap-2.5">
                    <span className="num text-[22px] text-muted line-through decoration-1">{brew.grind_setting}</span>
                    <ArrowRight size={20} className="self-center text-primary" aria-hidden />
                    <span className="num text-[40px] leading-none font-semibold text-accent-strong">{nextGrind}</span>
                  </div>
                </div>
                <span className="rounded-[10px] bg-primary/15 px-2.5 py-1.5 text-sm font-semibold text-accent-strong">{sour ? 'feiner' : 'gröber'}</span>
              </div>
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[10px] bg-primary/25">
                {[
                  ['Dosis', brew.dose != null ? `${brew.dose} g` : '–'],
                  ['Output', brew.yield != null ? `${brew.yield} g` : '–'],
                  ['Ziel', target ? fmtRange(target) : fmtRatio(ratio(brew.dose, brew.yield))],
                ].map(([k, v]) => (
                  <div key={k} className="bg-base-100 px-2.5 py-2">
                    <div className="lbl">{k}</div>
                    <div className="num font-semibold">{v}</div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-base-content/80">Nur eine Variable ändern. Dosis und Output bleiben gleich, damit du den Effekt klar schmeckst.</p>
            </div>
          </section>
        )}

        {alternatives.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="lbl">{nextGrind != null ? `Falls es danach noch ${sour ? 'sauer' : 'bitter'} ist` : 'Hinweise'}</h3>
            <ol className="flex flex-col gap-1.5">
              {alternatives.map((t, i) => (
                <li key={t} className="flex items-center gap-3 rounded-[12px] border border-base-300 bg-base-100 px-3.5 py-2.5">
                  <span className="num text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
                  <span className="grow">{t}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <div className="flex flex-col gap-2 desk:col-span-2 desk:flex-row">
        <button className="btn btn-primary h-13.5 rounded-[14px] text-base desk:basis-80" onClick={next}>
          {nextGrind != null ? `Nächsten Bezug mit ${nextGrind} starten` : 'Nächsten Bezug starten'}
        </button>
        <button className="btn h-12.5 rounded-[14px] border-(--line-strong) bg-transparent font-medium" onClick={() => go('dashboard')}>
          Fertig für heute
        </button>
      </div>
    </div>
  )
}
