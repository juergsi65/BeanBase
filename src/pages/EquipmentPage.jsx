import { useState } from 'react'
import { Field, Empty } from '../components/ui'
import { MACHINE_TYPES, SCALE_TYPES } from '../lib/coffee'

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
        defaultType="espresso"
        notesHint="z. B. 18g-VST-Sieb, 9 bar, Flow-Profiling"
      />
      <EquipmentSection
        data={data}
        table="grinders"
        title="Mühlen"
        typeKey="scale_type"
        types={SCALE_TYPES}
        defaultType="numbers"
        notesHint="z. B. Nullpunkt kalibriert, Burrs gewechselt am …"
      />
    </div>
  )
}

function EquipmentSection({ data, table, title, typeKey, types, defaultType, notesHint }) {
  const [form, setForm] = useState(null) // null | { id?, name, type, notes }
  const rows = data[table]

  const save = async (e) => {
    e.preventDefault()
    const row = { name: form.name.trim(), [typeKey]: form.type, notes: form.notes.trim() || null }
    if (form.id) await data.update(table, form.id, row)
    else await data.add(table, row)
    setForm(null)
  }
  const del = async (r) => {
    if (confirm(`„${r.name}“ löschen?`)) await data.remove(table, r.id)
  }

  return (
    <section className="card">
      <div className="page-head">
        <h3 className="section-title">{title}</h3>
        {!form && (
          <button className="btn primary sm" onClick={() => setForm({ name: '', type: defaultType, notes: '' })}>
            + Hinzufügen
          </button>
        )}
      </div>

      {form && (
        <form className="stack inset" onSubmit={save}>
          <Field label="Name *">
            <input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
                <strong>{r.name}</strong>
                <span className="muted small">
                  {types[r[typeKey]]}
                  {r.notes ? ` · ${r.notes}` : ''}
                </span>
              </div>
              <div className="row-actions">
                <button className="btn ghost sm" onClick={() => setForm({ id: r.id, name: r.name, type: r[typeKey], notes: r.notes ?? '' })}>
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
