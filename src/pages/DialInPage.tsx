import { ArrowRight, Check } from 'lucide-react'
import { Empty, useLookup } from '../components/ui'
import { adjustGrind, correction, fmtRange } from '../lib/dialin'
import { extractionLabel, fmtRatio, ratio } from '../lib/coffee'
import type { BrewPreset, PageProps } from '../types'

const TONE = {
  good: { text: 'text-success', box: 'border-success/40 bg-success/8', label: 'Im Ziel' },
  sour: { text: 'text-warning', box: 'border-warning/40 bg-warning/8', label: 'Unterextrahiert' },
  bitter: { text: 'text-(--bitter)', box: 'border-(--bitter)/45 bg-(--bitter)/8', label: 'Überextrahiert' },
  none: { text: 'text-muted', box: 'border-base-300 bg-base-100', label: 'Nicht bewertet' },
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

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-success/15 text-success">
          <Check size={22} aria-hidden />
        </span>
        <div>
          <span className="lbl">Bezug gespeichert</span>
          <h2 className="text-2xl">{lookup.beans(brew.bean_id)?.name ?? 'Bezug'}</h2>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-px overflow-hidden rounded-[14px] border border-base-300 bg-base-300">
        {[
          ['Dosis', brew.dose != null ? `${brew.dose} g` : '–'],
          ['Output', brew.yield != null ? `${brew.yield} g` : '–'],
          ['Ratio', fmtRatio(ratio(brew.dose, brew.yield))],
          ['Zeit', time != null ? `${time} s` : '–'],
        ].map(([k, v]) => (
          <div key={k} className="bg-base-100 p-2.5">
            <div className="lbl">{k}</div>
            <div className="num text-lg font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <section className={`card border p-4 gap-3.5 ${tone.box}`}>
        <span className={`lbl ${tone.text}`}>Diagnose · {tone.label}</span>
        <strong className="text-lg font-semibold">{c.title ?? 'Ohne Geschmacksbewertung keine Korrektur.'}</strong>

        {max && time != null && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="lbl">Brühzeit</span>
              <span className="num text-muted">
                {time} s · Ziel {fmtRange(target!)}
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-base-300" aria-hidden>
              <span className="absolute inset-y-0 rounded-full bg-success/45" style={{ left: `${pct(target![0])}%`, width: `${pct(target![1]) - pct(target![0])}%` }} />
              <span className="absolute -top-1 -bottom-1 w-[3px] -ml-px rounded-sm bg-base-content" style={{ left: `${pct(time)}%` }} />
            </div>
          </div>
        )}
        {taste != null && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="lbl">Geschmack</span>
              <span className="text-muted">{extractionLabel(taste)}</span>
            </div>
            <div className="relative h-2.5 rounded-full bg-[linear-gradient(90deg,var(--sour),var(--color-success)_50%,var(--bitter))]" aria-hidden>
              <span className="absolute -top-1 -bottom-1 w-[3px] -ml-px rounded-sm bg-base-content" style={{ left: `${((taste + 5) / 10) * 100}%` }} />
            </div>
          </div>
        )}
      </section>

      {nextGrind != null && (
        <section className="card bg-base-100 border border-base-300 p-4 gap-3">
          <span className="lbl">Nächster Versuch</span>
          <div className="flex items-center gap-3">
            <div>
              <div className="lbl">Mahlgrad</div>
              <div className="num text-3xl font-semibold text-muted line-through decoration-1">{brew.grind_setting}</div>
            </div>
            <ArrowRight className="text-muted" aria-hidden />
            <div>
              <div className="lbl">{(brew.extraction ?? 0) < 0 ? 'feiner' : 'gröber'}</div>
              <div className="num text-3xl font-semibold text-accent-strong">{nextGrind}</div>
            </div>
          </div>
        </section>
      )}

      {c.tips.length > 0 && (
        <section className="card bg-base-100 border border-base-300 p-4 gap-2">
          <span className="lbl">{nextGrind != null ? 'Alternativ' : 'Hinweise'}</span>
          <ul className="flex list-disc flex-col gap-1 pl-4.5 text-sm">
            {c.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-2 min-[480px]:flex-row">
        <button className="btn btn-primary btn-lg grow" onClick={next}>
          {nextGrind != null ? `Nächster Bezug mit ${nextGrind}` : 'Nächster Bezug'}
        </button>
        <button className="btn btn-ghost border-base-300 btn-lg" onClick={() => go('dashboard')}>
          Zur Startseite
        </button>
      </div>
    </div>
  )
}
