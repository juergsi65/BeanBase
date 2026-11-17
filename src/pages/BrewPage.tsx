import { useMemo, useState } from 'react'
import { errMsg } from '../lib/errors'
import { ChevronLeft } from 'lucide-react'
import { Field, NumberInput, Stars, TasteSegments, Stopwatch, RecipeCard, RatioRuler, useLookup } from '../components/ui'
import CommunityTip from '../components/CommunityTip'
import DialInGuide, { CorrectionHint } from '../components/DialInGuide'
import { availableSources, buildPlan } from '../lib/dialin'
import { ratio, fmtRatio, recipesForBean, daysSince, freshness, fmtDate } from '../lib/coffee'
import { findMachinePreset, grinderScale } from '../data/presets'
import { grindPos, parseGrind, scaleHint } from '../lib/grind'
import GrindInput from '../components/GrindInput'
import MediaPicker from '../components/MediaPicker'
import { uploadMedia, deleteMedia } from '../lib/media'
import { brewCost, beanUsage, fmtMoney, fmtGrams } from '../lib/cost'
import { toast } from '../lib/toast'
import type { Community } from '../lib/community'
import type { Source } from '../lib/dialin'
import type { MediaChange } from '../components/MediaPicker'
import type { NumValue } from '../components/ui'
import type { Brew, BrewPreset, Machine, PageProps } from '../types'

/** z. B. „Di., 17.11., 07:42“ */
const nowLabel = () => new Date().toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
// Eigene Funktion, weil oxlints purity-Regel Date.now() im Submit-Handler fälschlich als Render-Aufruf meldet
const freshKey = () => Date.now()

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
      extraction: null,
      notes: '',
    }
    for (const f of FIELDS) if (src[f] != null && src[f] !== '') (base as unknown as Record<string, unknown>)[f] = src[f]
    if (editing) Object.assign(base, { rating: src.rating ?? null, extraction: src.extraction ?? null, notes: src.notes ?? '' })
    if (!editing) base.brew_time = '' // Zeit wird neu gemessen
    return base
  })
  const [saving, setSaving] = useState(false)
  const [beanTouched, setBeanTouched] = useState(false)
  const beanError = beanTouched && !form.bean_id
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
  /** Mühle wechseln: Mahlgrad leeren, wenn er nicht zur Skala der neuen Mühle passt */
  const changeGrinder = (id: string) =>
    setForm((f) => {
      const keep = parseGrind(grinderScale(lookup.grinders(id)), f.grind_setting) != null
      return { ...f, grinder_id: id, grind_setting: keep ? f.grind_setting : '' }
    })
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
    if (!form.bean_id) {
      setBeanTouched(true)
      document.getElementById('brew-bean')?.focus()
      return
    }
    setSaving(true)
    const n = (v: unknown) => (v === '' || v == null ? null : Number(v))
    const row: Partial<Brew> = {
      bean_id: form.bean_id || null,
      machine_id: form.machine_id || null,
      grinder_id: form.grinder_id || null,
      dose: n(form.dose),
      yield: n(form.yield),
      grind_setting: String(form.grind_setting ?? '').trim() || null,
      grind_pos: grindPos(grinderScale(grinder), form.grind_setting),
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
      toast(editing ? 'Bezug aktualisiert' : 'Bezug gespeichert')
      if (editing) go('history')
      else if (row.extraction != null) go('dialin', { key: freshKey(), brew: row, target: plan?.time ?? null })
      else go('dashboard')
    } catch (err) {
      data.setError(errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => go(editing ? 'history' : 'dashboard')
  const days = daysSince(bean?.roast_date)
  const rowCls = 'flex min-h-13 min-w-0 items-center gap-3 bg-base-100 px-4 focus-within:bg-base-200'
  const rowSelect = 'select grow min-w-0 border-0 bg-transparent px-0 shadow-none outline-none'
  const tile = 'flex min-w-0 flex-col gap-1.5 rounded-[14px] bg-base-200 px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary'
  const tileInput = 'num num-input w-full min-w-0 bg-transparent text-xl font-semibold outline-none'
  const num = (k: 'temperature' | 'preinfusion') => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k)(e.target.value === '' ? '' : Number(e.target.value.replace(',', '.')))

  // Handy: eine Spalte in Design-Reihenfolge (order-*). Desktop: links Bohne/Rezept/Tipp, rechts Stoppuhr/Bewertung
  return (
    <form className="flex flex-col gap-4 pb-21 desk:grid desk:grid-cols-2 desk:items-start desk:gap-6 desk:pb-6" onSubmit={save}>
      <header className="flex items-center gap-2 desk:col-span-2">
        <button type="button" className="btn btn-square size-11 rounded-[12px] border-base-300 bg-base-100 desk:hidden" onClick={cancel} aria-label="Zurück">
          <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
        </button>
        <h2 className="text-xl desk:text-[34px] desk:tracking-[-0.025em]">{editing ? 'Bezug bearbeiten' : 'Neuer Bezug'}</h2>
        <span className="num ml-auto text-xs text-muted desk:hidden">{editing && src.created_at ? fmtDate(src.created_at) : nowLabel()}</span>
        <button type="button" className="btn ml-auto hidden h-11 rounded-[12px] border-base-300 bg-base-100 font-normal desk:inline-flex" onClick={cancel}>
          Abbrechen
        </button>
      </header>

      <div className="contents desk:flex desk:flex-col desk:gap-4">
        <section className="order-1 flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[16px] border border-base-300 bg-base-300 desk:grid-cols-2">
            <label className={`${rowCls} desk:col-span-2`}>
              <span className="lbl w-18 shrink-0">Bohne</span>
              <select
                id="brew-bean"
                className={`${rowSelect} font-semibold ${beanError ? 'text-error' : ''}`}
                value={form.bean_id}
                onChange={set('bean_id')}
                onBlur={() => setBeanTouched(true)}
                aria-invalid={beanError}
                aria-describedby={beanError ? 'brew-bean-err' : undefined}
              >
                <option value="">Bohne wählen …</option>
                {data.beans.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.roaster ? ` (${b.roaster})` : ''}
                    {b.active ? '' : ' · Archiv'}
                  </option>
                ))}
              </select>
              {days != null && days >= 0 && <span className={`num shrink-0 text-xs ${freshness(days)?.tone === 'good' ? 'text-success' : 'text-warning'}`}>{days} T</span>}
            </label>
            <label className={rowCls}>
              <span className="lbl w-18 shrink-0">Maschine</span>
              <select className={rowSelect} value={form.machine_id} onChange={changeMachine}>
                <option value="">—</option>
                {data.machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={rowCls}>
              <span className="lbl w-18 shrink-0">Mühle</span>
              <select className={rowSelect} value={form.grinder_id} onChange={(e) => changeGrinder(e.target.value)}>
                <option value="">—</option>
                {data.grinders.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {beanError && (
            <span id="brew-bean-err" className="text-sm text-error">
              {data.beans.length ? 'Wähle die Bohne für diesen Bezug.' : 'Leg zuerst eine Bohne an.'}{' '}
              {!data.beans.length && (
                <button type="button" className="link link-primary" onClick={() => go('beans')}>
                  Bohne anlegen
                </button>
              )}
            </span>
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

        <section className="order-4 card gap-4 border border-base-300 bg-base-100 p-4 desk:p-5">
          <h3 className="lbl">Rezept</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <div className={tile}>
              <span className="lbl">Dosis · Mehl</span>
              <NumberInput compact label="Dosis" value={form.dose} onChange={set('dose')} step={0.1} decimals={1} min={0} unit="g" />
            </div>
            <div className={tile}>
              <span className="lbl">Output · Getränk</span>
              <NumberInput compact label="Output" value={form.yield} onChange={set('yield')} step={0.5} decimals={1} min={0} unit="g" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="lbl">Verhältnis</span>
              <strong className="num text-[1.4rem] font-semibold text-accent-strong">{fmtRatio(r)}</strong>
            </div>
            <RatioRuler value={r} />
            {cost && (
              <span className="num block text-xs text-muted">
                ≈ {fmtMoney(cost.value, cost.currency)}
                {usage && ` · Rest danach ${fmtGrams(Math.max(0, usage.remaining - (editing ? 0 : Number(form.dose) || 0)))}`}
              </span>
            )}
          </div>
          {/* Mahlgrad volle Breite: mehrteilige Skalen (Innenring, Makro/Mikro, Umdrehung.Zahl.Klick) brauchen Platz */}
          <fieldset className={`${tile} m-0 border-0`} aria-label="Mahlgrad">
            <span className="lbl truncate">Mahlgrad{grinder ? ` · ${grinder.name}` : ''}</span>
            <GrindInput scale={grinderScale(grinder)} value={form.grind_setting} onChange={set('grind_setting')} />
          </fieldset>
          <div className="grid grid-cols-2 gap-2.5">
            <label className={tile}>
              <span className="lbl truncate">Temp. °C</span>
              <input className={tileInput} type="number" inputMode="decimal" step={0.5} min={0} max={100} value={form.temperature ?? ''} onChange={num('temperature')} placeholder="–" />
            </label>
            <label className={tile}>
              <span className="lbl truncate">Pre-Inf. s</span>
              <input className={tileInput} type="number" inputMode="numeric" min={0} value={form.preinfusion ?? ''} onChange={num('preinfusion')} placeholder="–" />
            </label>
          </div>
          {grinder && <p className="-mt-2 text-xs text-muted">{scaleHint(grinderScale(grinder))}</p>}
        </section>

        {!editing && bean && (
          <div className="order-5">
            <CommunityTip
              roaster={bean.roaster}
              name={bean.name}
              grinder={grinder}
              machineType={machine?.type}
              onApply={applyValues}
              onData={setCommunity}
              machine={machine}
            />
          </div>
        )}
      </div>

      <div className="contents desk:flex desk:flex-col desk:gap-4">
        <section className="order-3 card gap-3.5 border border-base-300 bg-base-100 p-4 desk:p-5" aria-label="Stoppuhr">
          <Stopwatch onStop={set('brew_time')} target={plan?.time ?? undefined} />
          <Field label="Brühzeit">
            <NumberInput value={form.brew_time} onChange={set('brew_time')} step={1} min={0} unit="s" placeholder="–" />
          </Field>
        </section>

        <section className="order-6 card gap-3.5 border border-base-300 bg-base-100 p-4 desk:p-5">
          <h3 className="lbl">Geschmack &amp; Bewertung</h3>
          <TasteSegments value={form.extraction} onChange={set('extraction')} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">Bewertung</span>
            <Stars value={form.rating} onChange={set('rating')} />
          </div>
          <CorrectionHint form={form} grinder={grinder} machine={machine} targetTime={plan?.time} onNote={addNote} />
          <Field label="Notiz für den nächsten Versuch">
            <textarea className="textarea w-full" rows={2} value={form.notes} onChange={set('notes')} placeholder="z. B. Crema heller, leicht nussig" />
          </Field>
          <MediaPicker value={media.removed ? null : savedMedia} pending={media.pending} onChange={setMedia} />
        </section>
      </div>

      {!editing && plan && (
        <div className="order-2 desk:order-none desk:col-span-2 desk:row-start-2">
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
          />
        </div>
      )}

      <div className="sticky-actions order-7 desk:order-none desk:col-span-2">
        <button className="btn btn-primary btn-lg grow rounded-[14px] desk:grow-0 desk:basis-80" disabled={saving}>
          {saving ? 'Speichere …' : editing ? 'Änderungen speichern' : 'Bezug speichern'}
        </button>
      </div>
    </form>
  )
}
