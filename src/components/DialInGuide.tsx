import { Check, Compass } from 'lucide-react'
import { useState } from 'react'
import { Segmented } from './ui'
import { SOURCE_LABELS, correction, fmtRange, prepText } from '../lib/dialin'
import { fmtRatio } from '../lib/coffee'
import type { ReactNode } from 'react'
import type { Plan, Source } from '../lib/dialin'
import type { BrewForm } from '../pages/BrewPage'
import type { Grinder, Machine, RoastLevel } from '../types'
import css from './DialInGuide.module.css'

const ROAST_TEXT: Record<RoastLevel, string> = { light: 'helle Röstung', medium: 'mittlere Röstung', dark: 'dunkle Röstung' }

function Step({ n, title, done, onToggle, children }: { n: number; title: ReactNode; done?: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <li className={`${css.step} grid grid-cols-[40px_1fr] items-start gap-3 ${done ? css.done : ''}`}>
      <button type="button" className={`btn btn-square size-10 rounded-[12px] num text-[15px] font-semibold ${done ? 'btn-success' : 'btn-ghost border-[1.5px] border-primary text-accent-strong'}`} onClick={onToggle} aria-pressed={done} aria-label={`Schritt ${n} erledigt`}>
        {done ? <Check size={18} aria-hidden /> : n}
      </button>
      <div className={`${css.body} flex flex-col gap-1.5 pt-2`}>
        <strong>{title}</strong>
        {children}
      </div>
    </li>
  )
}

/** Korrekturhilfe nach dem Bezug (auch separat im Bewertungsbereich genutzt) */
type HintForm = Pick<BrewForm, 'rating' | 'extraction' | 'grind_setting' | 'temperature' | 'brew_time'>

export function CorrectionHint({
  form,
  grinder,
  machine,
  targetTime,
  onNote,
}: {
  form: HintForm
  grinder?: Grinder
  machine?: Machine
  targetTime?: Plan['time']
  onNote?: (text: string) => void
}) {
  if (form.extraction == null) return <p className="text-muted text-sm">Nach dem Probieren den Extraktions-Regler einstellen – hier erscheint dann die Korrektur für den nächsten Versuch.</p>
  const c = correction({
    extraction: form.extraction,
    grind: form.grind_setting,
    scaleType: grinder?.scale_type,
    temperature: form.temperature,
    brewTime: form.brew_time,
    targetTime,
    type: machine?.type,
  })
  return (
    <div className={`${css.correction} ${css[c.tone] ?? ''} flex flex-col gap-1.5 rounded-xl bg-base-200 px-3 py-2.5`}>
      <strong>{c.title}</strong>
      {c.tips.length > 0 && (
        <ul className="flex list-disc flex-col gap-0.5 pl-4.5">
          {c.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {onNote && c.tone !== 'good' && c.tips.length > 0 && (
        <button type="button" className="btn btn-ghost border-base-300 btn-sm self-start" onClick={() => onNote(`Nächstes Mal: ${c.tips.find((t) => t.startsWith('Mahlgrad')) ?? c.tips[0]}`)}>
          Als Notiz übernehmen
        </button>
      )}
    </div>
  )
}

type StepKey = 'grind' | 'prep' | 'target' | 'taste'

export default function DialInGuide({
  plan,
  sources,
  source,
  onSource,
  form,
  grinder,
  machine,
  onApply,
  defaultOpen,
}: {
  plan: Plan
  sources: Source[]
  source: Source
  onSource: (s: Source) => void
  form: HintForm
  grinder?: Grinder
  machine?: Machine
  onApply: (v: { dose: number | null; yield: number | null; temperature: number | null; grind_setting: number | string | null }) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [done, setDone] = useState<Partial<Record<StepKey, boolean>>>({})
  const toggle = (k: StepKey) => setDone((d) => ({ ...d, [k]: !d[k] }))
  const grinderName = grinder?.name ?? 'Mühle'
  const espresso = (machine?.type ?? 'espresso') === 'espresso'

  return (
    <details className="guide collapse collapse-arrow bg-base-100 border border-base-300" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="collapse-title flex flex-col gap-0.5 text-[1.05rem] font-bold">
        <span className="flex items-center gap-2"><Compass size={18} aria-hidden /> Dial-In-Assistent</span>
        <span className="text-muted text-sm font-normal">Schritt für Schritt zum Shot</span>
      </summary>
      <div className="collapse-content flex flex-col gap-3.5">

      {sources.length > 1 && (
        <Segmented
          options={Object.fromEntries(sources.map((s) => [s, SOURCE_LABELS[s]])) as Record<Source, string>}
          value={source}
          onChange={(v) => v && onSource(v)}
        />
      )}
      {plan.note && <p className="text-muted text-sm">{plan.note}</p>}
      <div className="grid grid-cols-4 gap-px overflow-hidden rounded-[14px] border border-base-300 bg-base-300">
        {(
          [
            ['Mahlgrad', plan.grind ?? '–', true],
            ['Dosis', plan.dose != null ? `${plan.dose} g` : '–'],
            ['Output', plan.yield != null ? `${plan.yield} g` : '–'],
            ['Temp.', plan.temp != null ? `${plan.temp} °C` : '–'],
          ] as const
        ).map(([k, v, accent]) => (
          <div key={k} className="bg-base-100 p-2.5 min-w-0">
            <div className="lbl">{k}</div>
            <div className={`num text-lg font-semibold ${accent ? 'text-accent-strong' : ''}`}>{v}</div>
          </div>
        ))}
      </div>
      <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <span className="num rounded-md border border-dashed border-info px-1.5 text-[11px] text-info whitespace-nowrap">KI-COACH · TBA</span> Persönliche KI-Empfehlungen auf Basis deiner Bezüge folgen in einem kommenden Update.
      </p>

      <ol className="flex flex-col gap-3">
        <Step n={1} title="Mühle einstellen" done={done.grind} onToggle={() => toggle('grind')}>
          {!grinder ? (
            <p>Wähle oben eine Mühle aus.</p>
          ) : plan.grind != null ? (
            <p>
              Stelle deine <strong>{grinderName}</strong> auf <span className={css.val}>{plan.grind}</span>
              <span className="text-muted text-sm"> (kleinere Zahl = feiner bei den meisten Mühlen)</span>
            </p>
          ) : (
            <p>{plan.grindNote}</p>
          )}
          <p className="text-muted text-sm">
            Nach dem Verstellen 1–2 g Bohnen durchmahlen und verwerfen (Totraum/Purge) – sonst landet noch Mehl der alten Einstellung im Sieb.
          </p>
        </Step>

        <Step n={2} title={espresso ? 'Maschine vorbereiten' : 'Vorbereiten'} done={done.prep} onToggle={() => toggle('prep')}>
          {plan.temp != null && (
            <p>
              Zieltemperatur <span className={css.val}>{plan.temp} °C</span>
              {plan.source === 'base' && <span className="text-muted text-sm"> für {ROAST_TEXT[plan.roast]}</span>}
            </p>
          )}
          <p>{prepText(machine)}</p>
          {plan.dose != null && (
            <p>
              <span className={css.val}>{plan.dose} g</span> Kaffeemehl abwiegen{espresso ? ', verteilen (WDT) und gleichmäßig tampen.' : '.'}
            </p>
          )}
        </Step>

        <Step n={3} title="Zielwerte für den Bezug" done={done.target} onToggle={() => toggle('target')}>
          <p>
            {plan.yield != null && (
              <>
                Output <span className={css.val}>{plan.yield} g</span>
                {plan.ratio && <span className="text-muted text-sm"> (Ratio {fmtRatio(plan.ratio)})</span>}
              </>
            )}
            {plan.time && (
              <>
                {plan.yield != null ? ' in ' : 'Zeit '}
                <span className={css.val}>{fmtRange(plan.time)}</span>
              </>
            )}
          </p>
          {espresso && <p className="text-muted text-sm">Stoppuhr unten mit dem Pumpenstart starten, bei Erreichen des Ziel-Outputs stoppen.</p>}
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => onApply({ dose: plan.dose, yield: plan.yield, temperature: plan.temp, grind_setting: plan.grind })}
          >
            Zielwerte ins Formular übernehmen
          </button>
        </Step>

        <Step n={4} title="Nach dem Bezug: Geschmack korrigieren" done={done.taste} onToggle={() => toggle('taste')}>
          <CorrectionHint form={form} grinder={grinder} machine={machine} targetTime={plan.time} />
        </Step>
      </ol>
      </div>
    </details>
  )
}
