import { useState } from 'react'
import { Field, Empty, Chip } from '../components/ui'
import { MACHINE_TYPES, SCALE_TYPES } from '../lib/coffee'
import { MACHINE_PRESETS, GRINDER_PRESETS, searchPresets } from '../data/presets'

export default function EquipmentPage({ data }) {
  return (
    <div className="stack">
      <h2>Mein Equipment</h2>
      <EquipmentSection
        data={data}
        table="machines"
        title="Maschinen & Brühmethoden"
        typeKey="type"
        types={MACHINE_TYPES}
        presets={MACHINE_PRESETS}
        defaultType="espresso"
        notesHint="z. B. 18g-VST-Sieb, 9 bar, Flow-Profiling"
      />
      <EquipmentSection
        data={data}
        table="grinders"
        title="Mühlen"
        typeKey="scale_type"
        types={SCALE_TYPES}
        presets={GRINDER_PRESETS}
        defaultType="numbers"
        notesHint="z. B. Nullpunkt kalibriert, Burrs gewechselt am …"
      />
    </div>
  )
}

/** Suchfeld "Aus bekannten Modellen wählen" */
function PresetPicker({ presets, onPick }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const hits = searchPresets(presets, q).slice(0, 8)
  return (
    <div className="preset-picker">
      <input
        type="search"
        value={q}
        placeholder="🔍 Bekanntes Modell suchen (z. B. Niche) …"
        aria-label="Aus bekannten Modellen wählen"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
      />
      {open && (
        <ul className="preset-results">
          {hits.length ? (
            hits.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(p)
                    setQ('')
                    setOpen(false)
                  }}
                >
                  <strong>{p.name}</strong>
                  <span>{p.notes}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="muted small">Kein bekanntes Modell – einfach unten eigenen Namen eintragen.</li>
          )}
        </ul>
      )}
    </div>
  )
}

function EquipmentSection({ data, table, title, typeKey, types, presets, defaultType, notesHint }) {
  const [form, setForm] = useState(null) // null | { id?, name, type, notes, preset_id }
  const rows = data[table]
  const presetName = (id) => presets.find((p) => p.id === id)?.name

  const save = async (e) => {
    e.preventDefault()
    const row = { name: form.name.trim(), [typeKey]: form.type, notes: form.notes.trim() || null, preset_id: form.preset_id || null }
    if (form.id) await data.update(table, form.id, row)
    else await data.add(table, row)
    setForm(null)
  }
  const del = async (r) => {
    if (confirm(`„${r.name}“ löschen?`)) await data.remove(table, r.id)
  }
  const pick = (p) => setForm((f) => ({ ...f, name: p.name, type: p[typeKey], notes: p.notes ?? '', preset_id: p.id }))

  return (
    <section className="card">
      <div className="page-head">
        <h3 className="section-title">{title}</h3>
        {!form && (
          <button className="btn primary sm" onClick={() => setForm({ name: '', type: defaultType, notes: '', preset_id: null })}>
            + Hinzufügen
          </button>
        )}
      </div>

      {form && (
        <form className="stack inset" onSubmit={save}>
          <PresetPicker presets={presets} onPick={pick} />
          {form.preset_id && (
            <div className="chips">
              <Chip tone="good" onRemove={() => setForm({ ...form, preset_id: null })}>
                ✓ Modell: {presetName(form.preset_id) ?? form.preset_id}
              </Chip>
            </div>
          )}
          <Field label="Name *" hint={form.preset_id ? 'frei umbenennbar, Modell bleibt verknüpft' : ''}>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={typeKey === 'type' ? 'Typ' : 'Skala'}>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(types).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notizen">
            <textarea rows={2} value={form.notes} placeholder={notesHint} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="row-actions">
            <button type="button" className="btn ghost" onClick={() => setForm(null)}>
              Abbrechen
            </button>
            <button className="btn primary grow">Speichern</button>
          </div>
        </form>
      )}

      {!rows.length && !form ? (
        <Empty>Noch nichts angelegt.</Empty>
      ) : (
        <ul className="list">
          {rows.map((r) => (
            <li key={r.id} className="list-item">
              <div>
                <strong>
                  {r.name} {r.preset_id && <span className="badge" title={presetName(r.preset_id)}>✓</span>}
                </strong>
                <span className="muted small">
                  {types[r[typeKey]]}
                  {r.notes ? ` · ${r.notes}` : ''}
                </span>
              </div>
              <div className="row-actions">
                <button
                  className="btn ghost sm"
                  onClick={() => setForm({ id: r.id, name: r.name, type: r[typeKey], notes: r.notes ?? '', preset_id: r.preset_id ?? null })}
                >
                  ✎
                </button>
                <button className="btn danger-ghost sm" onClick={() => del(r)}>
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
