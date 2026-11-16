import { useState } from 'react'
import { Segmented } from './ui'
import { SOURCE_LABELS, correction, fmtRange, prepText } from '../lib/dialin'
import { fmtRatio } from '../lib/coffee'
import type { ReactNode } from 'react'
import type { Plan, Source } from '../lib/dialin'
import type { BrewForm } from '../pages/BrewPage'
import type { Grinder, Machine, RoastLevel } from '../types'

const ROAST_TEXT: Record<RoastLevel, string> = { light: 'helle Röstung', medium: 'mittlere Röstung', dark: 'dunkle Röstung' }

function Step({ n, title, done, onToggle, children }: { n: number; title: ReactNode; done?: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <li className={`guide-step ${done ? 'done' : ''}`}>
      <button type="button" className="guide-check" onClick={onToggle} aria-pressed={done} aria-label={`Schritt ${n} erledigt`}>
        {done ? '✓' : n}
      </button>
      <div className="guide-body">
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
  const tasted = form.rating != null || (form.extraction ?? 0) !== 0
  if (!tasted) return <p className="muted small">Nach dem Probieren den Extraktions-Regler einstellen – hier erscheint dann die Korrektur für den nächsten Versuch.</p>
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
    <div className={`correction ${c.tone}`}>
      <strong>{c.title}</strong>
      {c.tips.length > 0 && (
        <ul>
          {c.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {onNote && c.tone !== 'good' && c.tips.length > 0 && (
        <button type="button" className="btn ghost sm" onClick={() => onNote(`Nächstes Mal: ${c.tips.find((t) => t.startsWith('Mahlgrad')) ?? c.tips[0]}`)}>
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
    <details className="card guide" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span>🧭 Dial-In-Assistent</span>
        <span className="muted small">Schritt für Schritt zum Shot</span>
      </summary>

      {sources.length > 1 && (
        <Segmented
          options={Object.fromEntries(sources.map((s) => [s, SOURCE_LABELS[s]])) as Record<Source, string>}
          value={source}
          onChange={(v) => v && onSource(v)}
        />
      )}
      {plan.note && <p className="muted small">{plan.note}</p>}
      <p className="tba-note">
        <span className="tba">KI-Coach · TBA</span> Persönliche KI-Empfehlungen auf Basis deiner Bezüge folgen in einem kommenden Update.
      </p>

      <ol className="guide-steps">
        <Step n={1} title="Mühle einstellen" done={done.grind} onToggle={() => toggle('grind')}>
          {!grinder ? (
            <p>Wähle oben eine Mühle aus.</p>
          ) : plan.grind != null ? (
            <p>
              Stelle deine <strong>{grinderName}</strong> auf <span className="guide-value">{plan.grind}</span>
              <span className="muted small"> (kleinere Zahl = feiner bei den meisten Mühlen)</span>
            </p>
          ) : (
            <p>{plan.grindNote}</p>
          )}
          <p className="muted small">
            Nach dem Verstellen 1–2 g Bohnen durchmahlen und verwerfen (Totraum/Purge) – sonst landet noch Mehl der alten Einstellung im Sieb.
          </p>
        </Step>

        <Step n={2} title={espresso ? 'Maschine vorbereiten' : 'Vorbereiten'} done={done.prep} onToggle={() => toggle('prep')}>
          {plan.temp != null && (
            <p>
              Zieltemperatur <span className="guide-value">{plan.temp} °C</span>
              {plan.source === 'base' && <span className="muted small"> für {ROAST_TEXT[plan.roast]}</span>}
            </p>
          )}
          <p>{prepText(machine)}</p>
          {plan.dose != null && (
            <p>
              <span className="guide-value">{plan.dose} g</span> Kaffeemehl abwiegen{espresso ? ', verteilen (WDT) und gleichmäßig tampen.' : '.'}
            </p>
          )}
        </Step>

        <Step n={3} title="Zielwerte für den Bezug" done={done.target} onToggle={() => toggle('target')}>
          <p>
            {plan.yield != null && (
              <>
                Output <span className="guide-value">{plan.yield} g</span>
                {plan.ratio && <span className="muted small"> (Ratio {fmtRatio(plan.ratio)})</span>}
              </>
            )}
            {plan.time && (
              <>
                {plan.yield != null ? ' in ' : 'Zeit '}
                <span className="guide-value">{fmtRange(plan.time)}</span>
              </>
            )}
          </p>
          {espresso && <p className="muted small">Stoppuhr unten mit dem Pumpenstart starten, bei Erreichen des Ziel-Outputs stoppen.</p>}
          <button
            type="button"
            className="btn primary block"
            onClick={() => onApply({ dose: plan.dose, yield: plan.yield, temperature: plan.temp, grind_setting: plan.grind })}
          >
            Zielwerte ins Formular übernehmen
          </button>
        </Step>

        <Step n={4} title="Nach dem Bezug: Geschmack korrigieren" done={done.taste} onToggle={() => toggle('taste')}>
          <CorrectionHint form={form} grinder={grinder} machine={machine} targetTime={plan.time} />
        </Step>
      </ol>
    </details>
  )
}
