import { useMemo, useState } from 'react'
import { errMsg } from '../lib/errors'
import { Field, NumberInput, Stars, ExtractionSlider, Stopwatch, RecipeCard, useLookup } from '../components/ui'
import CommunityTip from '../components/CommunityTip'
import DialInGuide, { CorrectionHint } from '../components/DialInGuide'
import { availableSources, buildPlan } from '../lib/dialin'
import { ratio, fmtRatio, recipesForBean, SCALE_TYPES } from '../lib/coffee'
import { findMachinePreset } from '../data/presets'
import MediaPicker from '../components/MediaPicker'
import { uploadMedia, deleteMedia } from '../lib/media'
import { brewCost, beanUsage, fmtMoney, fmtGrams } from '../lib/cost'
import { toast } from '../lib/toast'
import type { Community } from '../lib/community'
import type { Source } from '../lib/dialin'
import type { MediaChange } from '../components/MediaPicker'
import type { NumValue } from '../components/ui'
import type { Brew, BrewPreset, Machine, PageProps } from '../types'

export interface BrewForm {
  bean_id: string
  machine_id: string
  grinder_id: string
  dose: NumValue
  yield: NumValue
  temperature: NumValue
  grind_setting: string | number
  brew_time: NumValue
  preinfusion: NumValue
  rating: number | null
  extraction: number | null
  notes: string
}
type FieldEvent = React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
const isEvent = (v: unknown): v is FieldEvent => typeof v === 'object' && v !== null && 'target' in v

const DEFAULTS = { dose: 18, yield: 36, temperature: 93 }
/** Startwerte einer Maschine (aus Preset), sonst Espresso-Standard */
function machineDefaults(machine: Machine | undefined) {
  const d: { dose?: number; yield?: number; temperature?: number | null } = findMachinePreset(machine?.preset_id)?.defaults ?? {}
  return {
    dose: d.dose ?? DEFAULTS.dose,
    yield: d.yield ?? DEFAULTS.yield,
    temperature: (d.temperature === null ? '' : (d.temperature ?? DEFAULTS.temperature)) as NumValue,
  }
}

const FIELDS: (keyof BrewForm & keyof Brew)[] = ['bean_id', 'machine_id', 'grinder_id', 'dose', 'yield', 'grind_setting', 'temperature', 'brew_time', 'preinfusion']

/**
 * preset: { brew, editId? } – Werte werden übernommen (Rezept wiederverwenden),
 * bei editId wird ein bestehender Bezug bearbeitet.
 */
export default function BrewPage({ data, go, preset }: PageProps & { preset: BrewPreset | null }) {
  const lookup = useLookup(data)
  const editing = preset?.editId
  const src: Partial<Brew> = preset?.brew ?? {}
  const lastBrew: Partial<Brew> = data.brews[0] ?? {}

  const [form, setForm] = useState<BrewForm>(() => {
    const machine_id = src.machine_id ?? lastBrew.machine_id ?? data.machines[0]?.id ?? ''
    const base: BrewForm = {
      bean_id: data.beans.find((b) => b.active)?.id ?? '',
      machine_id,
      grinder_id: lastBrew.grinder_id ?? data.grinders[0]?.id ?? '',
      ...machineDefaults(lookup.machines(machine_id)),
      grind_setting: '',
      brew_time: '',
      preinfusion: '',
      rating: null,
      extraction: 0,
      notes: '',
    }
    for (const f of FIELDS) if (src[f] != null && src[f] !== '') (base as unknown as Record<string, unknown>)[f] = src[f]
    if (editing) Object.assign(base, { rating: src.rating ?? null, extraction: src.extraction ?? 0, notes: src.notes ?? '' })
    if (!editing) base.brew_time = '' // Zeit wird neu gemessen
    return base
  })
  const [saving, setSaving] = useState(false)
  const [media, setMedia] = useState<MediaChange>({ pending: null, removed: false })
  const savedMedia = editing && src.media_url ? { url: src.media_url, type: src.media_type } : null
  const [community, setCommunity] = useState<Community | null>(null)
  const [guideSource, setGuideSource] = useState<Source | null>(null)
  const set =
    <K extends keyof BrewForm>(k: K) =>
    (v: BrewForm[K] | FieldEvent) =>
      setForm((f) => ({ ...f, [k]: isEvent(v) ? v.target.value : v }))

  const r = ratio(form.dose, form.yield)
  const prev = useMemo(
    () => (form.bean_id ? recipesForBean(data.brews, form.bean_id) : { last: null, best: null, count: 0 }),
    [data.brews, form.bean_id],
  )
  const grinder = lookup.grinders(form.grinder_id)
  const cost = brewCost({ bean_id: form.bean_id, dose: Number(form.dose) || null }, data.bean_stock)
  const usage = form.bean_id ? beanUsage(form.bean_id, data.bean_stock, data.brews) : null
  const bean = lookup.beans(form.bean_id)
  const machine = lookup.machines(form.machine_id)

  // Maschinenwechsel: unveränderte Startwerte durch die der neuen Maschine ersetzen
  const changeMachine = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    setForm((f) => {
      if (editing) return { ...f, machine_id: id }
      const oldD = machineDefaults(lookup.machines(f.machine_id))
      const newD = machineDefaults(lookup.machines(id))
      const next = { ...f, machine_id: id }
      for (const k of ['dose', 'yield', 'temperature'] as const) if (f[k] === oldD[k]) next[k] = newD[k]
      return next
    })
  }

  // Werte (Community, Assistent) ins Formular übernehmen – nur bekannte Felder, nur gesetzte Werte
  const applyValues = (v: { dose?: number | null; yield?: number | null; temperature?: number | null; grind_setting?: number | string | null }) =>
    setForm((f) => {
      const next = { ...f }
      for (const k of ['dose', 'yield', 'temperature', 'grind_setting'] as const) {
        const val = v[k]
        if (val != null && val !== '') (next as Record<typeof k, unknown>)[k] = val
      }
      return next
    })

  // Dial-In-Assistent: Quelle wählen (eigener Bezug > Community > Basiswert) und Plan berechnen
  const sources = availableSources({ own: prev, community })
  const source = guideSource && sources.includes(guideSource) ? guideSource : sources[0]
  const plan = bean ? buildPlan({ source, bean, machine, grinder, own: prev, community }) : null
  const addNote = (text: string) => setForm((f) => ({ ...f, notes: f.notes?.trim() ? `${f.notes.trim()}\n${text}` : text }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const n = (v: unknown) => (v === '' || v == null ? null : Number(v))
    const row: Partial<Brew> = {
      bean_id: form.bean_id || null,
      machine_id: form.machine_id || null,
      grinder_id: form.grinder_id || null,
      dose: n(form.dose),
      yield: n(form.yield),
      grind_setting: String(form.grind_setting ?? '').trim() || null,
      temperature: n(form.temperature),
      brew_time: n(form.brew_time),
      preinfusion: n(form.preinfusion),
      rating: form.rating,
      extraction: form.extraction,
      notes: form.notes.trim() || null,
      ...(media.pending || media.removed ? { media_url: null, media_type: null } : {}),
    }
    try {
      if (media.pending) {
        const up = await uploadMedia(media.pending)
        row.media_url = up.url
        row.media_type = up.type
      }
      if (editing) await data.update('brews', editing, row)
      else await data.add('brews', row)
      if (savedMedia?.url && (media.pending || media.removed)) deleteMedia(savedMedia.url).catch(() => {})
      toast(editing ? 'Bezug aktualisiert' : 'Bezug gespeichert ☕')
      go(editing ? 'history' : 'dashboard')
    } catch (err) {
      data.setError(errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="brew-form flex flex-col gap-4 pb-21 desk:grid desk:gap-x-6 desk:pb-6" onSubmit={save}>
      <h2 className="brew-title">{editing ? 'Bezug bearbeiten' : 'Neuer Bezug'}</h2>

      <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5 brew-bean">
        <Field label="Bohne">
          <select className="select w-full" value={form.bean_id} onChange={set('bean_id')}>
            <option value="">— keine —</option>
            {data.beans.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.roaster ? ` (${b.roaster})` : ''}
                {b.active ? '' : ' · Archiv'}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Maschine / Methode">
            <select className="select w-full" value={form.machine_id} onChange={changeMachine}>
              <option value="">—</option>
              {data.machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mühle">
            <select className="select w-full" value={form.grinder_id} onChange={set('grinder_id')}>
              <option value="">—</option>
              {data.grinders.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {!editing && bean && (
          <CommunityTip
            roaster={bean.roaster}
            name={bean.name}
            grinder={grinder}
            machineType={machine?.type}
            onApply={applyValues}
            onData={setCommunity}
            machine={machine}
          />
        )}
        {!editing && prev.last && (
          <details className="collapse collapse-arrow rounded-none">
            <summary className="collapse-title min-h-0 py-1 pl-0 pr-8 text-sm text-muted after:top-3! [&_strong]:text-accent-strong">
              Letzter Bezug dieser Bohne: Mahlgrad <strong>{prev.last.grind_setting || '–'}</strong> · {prev.last.dose ?? '–'}g →{' '}
              {prev.last.yield ?? '–'}g · {prev.last.brew_time ?? '–'}s
            </summary>
            <div className="collapse-content px-0 pt-2.5">
              <RecipeCard title="Letzter Bezug" brew={prev.last} lookup={lookup} />
            </div>
          </details>
        )}
      </section>

      {!editing && plan && (
        <DialInGuide
          key={form.bean_id}
          plan={plan}
          sources={sources}
          source={source}
          onSource={setGuideSource}
          form={form}
          grinder={grinder}
          machine={machine}
          onApply={applyValues}
          defaultOpen={!prev.count}
        />
      )}

      <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5 brew-recipe">
        <h3 className="text-xs uppercase tracking-widest text-muted">Rezept</h3>
        <div className="grid grid-cols-1 gap-3 min-[561px]:grid-cols-2 desk:max-[1199px]:grid-cols-1">
          <Field label="Dosis (Mehl)">
            <NumberInput value={form.dose} onChange={set('dose')} step={0.1} decimals={1} min={0} unit="g" />
          </Field>
          <Field label="Output (Getränk)">
            <NumberInput value={form.yield} onChange={set('yield')} step={0.5} decimals={1} min={0} unit="g" />
          </Field>
        </div>
        <div className="rounded-xl bg-base-200 p-2.5 text-center text-muted">
          Brew-Ratio <strong className="ml-2 text-[1.6rem] text-accent-strong">{fmtRatio(r)}</strong>
          {cost && (
            <span className="mt-1 block text-sm text-muted">
              ≈ {fmtMoney(cost.value, cost.currency)}
              {usage && ` · Rest danach ${fmtGrams(Math.max(0, usage.remaining - (editing ? 0 : Number(form.dose) || 0)))}`}
            </span>
          )}
        </div>
        <Field label="Mahlgrad" hint={grinder ? `${grinder.name} · ${SCALE_TYPES[grinder.scale_type] ?? ''}` : ''}>
          {grinder?.scale_type === 'stepless' ? (
            <input value={form.grind_setting ?? ''} onChange={set('grind_setting')} placeholder="z. B. 2.4 oder ‚zwischen 2 und 3‘" className="input w-full big-input" />
          ) : (
            <NumberInput
              value={form.grind_setting === '' || form.grind_setting == null || isNaN(Number(form.grind_setting)) ? '' : Number(form.grind_setting)}
              onChange={set('grind_setting')}
              step={grinder?.scale_type === 'numbers' ? 0.5 : 1}
              decimals={grinder?.scale_type === 'numbers' ? 1 : 0}
              unit={grinder?.scale_type === 'clicks' ? 'Klicks' : ''}
              placeholder="–"
            />
          )}
        </Field>
        <div className="grid grid-cols-1 gap-3 min-[561px]:grid-cols-2 desk:max-[1199px]:grid-cols-1">
          <Field label="Temperatur">
            <NumberInput value={form.temperature} onChange={set('temperature')} step={0.5} decimals={1} min={0} max={100} unit="°C" />
          </Field>
          <Field label="Pre-Infusion">
            <NumberInput value={form.preinfusion} onChange={set('preinfusion')} step={1} min={0} unit="s" placeholder="–" />
          </Field>
        </div>
      </section>

      <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5 brew-timer">
        <h3 className="text-xs uppercase tracking-widest text-muted">Durchlaufzeit</h3>
        <Stopwatch onStop={set('brew_time')} />
        <Field label="Brühzeit">
          <NumberInput value={form.brew_time} onChange={set('brew_time')} step={1} min={0} unit="s" placeholder="–" />
        </Field>
      </section>

      <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5 brew-rating">
        <h3 className="text-xs uppercase tracking-widest text-muted">Bewertung</h3>
        <MediaPicker value={media.removed ? null : savedMedia} pending={media.pending} onChange={setMedia} />
        <Stars value={form.rating} onChange={set('rating')} />
        <Field label="Extraktion">
          <ExtractionSlider value={form.extraction} onChange={set('extraction')} />
        </Field>
        <CorrectionHint form={form} grinder={grinder} machine={machine} targetTime={plan?.time} onNote={addNote} />
        <Field label="Notiz für den nächsten Versuch">
          <textarea className="textarea w-full" rows={3} value={form.notes} onChange={set('notes')} placeholder="z. B. Nächstes Mal 2 Klicks feiner mahlen" />
        </Field>
      </section>

      <div className="sticky-actions">
        <button type="button" className="btn btn-ghost border-base-300 btn-lg" onClick={() => go(editing ? 'history' : 'dashboard')}>
          Abbrechen
        </button>
        <button className="btn btn-primary btn-lg grow desk:grow-0 desk:basis-80" disabled={saving}>
          {saving ? 'Speichere …' : editing ? 'Änderungen speichern' : 'Bezug speichern'}
        </button>
      </div>
    </form>
  )
}
