import { useMemo, useState } from 'react'
import { Field, NumberInput, Stars, ExtractionSlider, Stopwatch, RecipeCard, useLookup } from '../components/ui'
import CommunityTip from '../components/CommunityTip'
import { ratio, fmtRatio, recipesForBean, SCALE_TYPES } from '../lib/coffee'
import { findMachinePreset } from '../data/presets'

const DEFAULTS = { dose: 18, yield: 36, temperature: 93 }
/** Startwerte einer Maschine (aus Preset), sonst Espresso-Standard */
function machineDefaults(machine) {
  const d = findMachinePreset(machine?.preset_id)?.defaults ?? {}
  return {
    dose: d.dose ?? DEFAULTS.dose,
    yield: d.yield ?? DEFAULTS.yield,
    temperature: d.temperature === null ? '' : d.temperature ?? DEFAULTS.temperature,
  }
}

const FIELDS = ['bean_id', 'machine_id', 'grinder_id', 'dose', 'yield', 'grind_setting', 'temperature', 'brew_time', 'preinfusion']

/**
 * preset: { brew, editId? } – Werte werden übernommen (Rezept wiederverwenden),
 * bei editId wird ein bestehender Bezug bearbeitet.
 */
export default function BrewPage({ data, go, preset }) {
  const lookup = useLookup(data)
  const editing = preset?.editId
  const src = preset?.brew ?? {}
  const lastBrew = data.brews[0] ?? {}

  const [form, setForm] = useState(() => {
    const machine_id = src.machine_id ?? lastBrew.machine_id ?? data.machines[0]?.id ?? ''
    const base = {
      bean_id: data.beans.find((b) => b.active)?.id ?? '',
      machine_id,
      grinder_id: lastBrew.grinder_id ?? data.grinders[0]?.id ?? '',
      ...machineDefaults(lookup.machines[machine_id]),
      grind_setting: '',
      brew_time: '',
      preinfusion: '',
      rating: null,
      extraction: 0,
      notes: '',
    }
    for (const f of FIELDS) if (src[f] != null && src[f] !== '') base[f] = src[f]
    if (editing) Object.assign(base, { rating: src.rating, extraction: src.extraction ?? 0, notes: src.notes ?? '' })
    if (!editing) base.brew_time = '' // Zeit wird neu gemessen
    return base
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }))

  const r = ratio(form.dose, form.yield)
  const prev = useMemo(() => (form.bean_id ? recipesForBean(data.brews, form.bean_id) : {}), [data.brews, form.bean_id])
  const grinder = lookup.grinders[form.grinder_id]
  const bean = lookup.beans[form.bean_id]
  const machine = lookup.machines[form.machine_id]

  // Maschinenwechsel: unveränderte Startwerte durch die der neuen Maschine ersetzen
  const changeMachine = (e) => {
    const id = e.target.value
    setForm((f) => {
      if (editing) return { ...f, machine_id: id }
      const oldD = machineDefaults(lookup.machines[f.machine_id])
      const newD = machineDefaults(lookup.machines[id])
      const next = { ...f, machine_id: id }
      for (const k of Object.keys(newD)) if (f[k] === oldD[k]) next[k] = newD[k]
      return next
    })
  }

  const applyCommunity = (v) =>
    setForm((f) => {
      const next = { ...f }
      for (const [k, val] of Object.entries(v)) if (val != null) next[k] = val
      return next
    })

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const n = (v) => (v === '' || v == null ? null : Number(v))
    const row = {
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
    }
    try {
      if (editing) await data.update('brews', editing, row)
      else await data.add('brews', row)
      go(editing ? 'history' : 'dashboard')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="stack" onSubmit={save}>
      <h2>{editing ? 'Bezug bearbeiten' : 'Neuer Bezug'}</h2>

      <section className="card">
        <Field label="Bohne">
          <select value={form.bean_id} onChange={set('bean_id')}>
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
        <div className="grid2">
          <Field label="Maschine / Methode">
            <select value={form.machine_id} onChange={changeMachine}>
              <option value="">—</option>
              {data.machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mühle">
            <select value={form.grinder_id} onChange={set('grinder_id')}>
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
            onApply={applyCommunity}
          />
        )}
        {!editing && prev.last && (
          <details className="prev">
            <summary>
              Letzter Bezug dieser Bohne: Mahlgrad <strong>{prev.last.grind_setting || '–'}</strong> · {prev.last.dose ?? '–'}g →{' '}
              {prev.last.yield ?? '–'}g · {prev.last.brew_time ?? '–'}s
            </summary>
            <RecipeCard title="Letzter Bezug" brew={prev.last} lookup={lookup} />
          </details>
        )}
      </section>

      <section className="card">
        <h3 className="section-title">Rezept</h3>
        <div className="grid2 nums">
          <Field label="Dosis (Mehl)">
            <NumberInput value={form.dose} onChange={set('dose')} step={0.1} decimals={1} min={0} unit="g" />
          </Field>
          <Field label="Output (Getränk)">
            <NumberInput value={form.yield} onChange={set('yield')} step={0.5} decimals={1} min={0} unit="g" />
          </Field>
        </div>
        <div className="ratio-display">
          Brew-Ratio <strong>{fmtRatio(r)}</strong>
        </div>
        <Field label="Mahlgrad" hint={grinder ? `${grinder.name} · ${SCALE_TYPES[grinder.scale_type] ?? ''}` : ''}>
          {grinder?.scale_type === 'stepless' ? (
            <input value={form.grind_setting ?? ''} onChange={set('grind_setting')} placeholder="z. B. 2.4 oder ‚zwischen 2 und 3‘" className="big-input" />
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
        <div className="grid2 nums">
          <Field label="Temperatur">
            <NumberInput value={form.temperature} onChange={set('temperature')} step={0.5} decimals={1} min={0} max={100} unit="°C" />
          </Field>
          <Field label="Pre-Infusion">
            <NumberInput value={form.preinfusion} onChange={set('preinfusion')} step={1} min={0} unit="s" placeholder="–" />
          </Field>
        </div>
      </section>

      <section className="card">
        <h3 className="section-title">Durchlaufzeit</h3>
        <Stopwatch onStop={set('brew_time')} />
        <Field label="Brühzeit">
          <NumberInput value={form.brew_time} onChange={set('brew_time')} step={1} min={0} unit="s" placeholder="–" />
        </Field>
      </section>

      <section className="card">
        <h3 className="section-title">Bewertung</h3>
        <Stars value={form.rating} onChange={set('rating')} />
        <Field label="Extraktion">
          <ExtractionSlider value={form.extraction} onChange={set('extraction')} />
        </Field>
        <Field label="Notiz für den nächsten Versuch">
          <textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="z. B. Nächstes Mal 2 Klicks feiner mahlen" />
        </Field>
      </section>

      <div className="sticky-actions">
        <button type="button" className="btn ghost big" onClick={() => go(editing ? 'history' : 'dashboard')}>
          Abbrechen
        </button>
        <button className="btn primary big grow" disabled={saving}>
          {saving ? 'Speichere …' : editing ? 'Änderungen speichern' : 'Bezug speichern'}
        </button>
      </div>
    </form>
  )
}
