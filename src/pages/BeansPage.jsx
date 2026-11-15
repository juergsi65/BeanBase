import { useMemo, useRef, useState } from 'react'
import { Field, TagInput, Segmented, Chip, Empty, Stars } from '../components/ui'
import CommunityTip from '../components/CommunityTip'
import { PROCESSES, ROAST_LEVELS, daysSince, freshness, recipesForBean } from '../lib/coffee'
import { resizeImage, storeBeanImage, deleteBeanImage, analyzeLabel, canAnalyze } from '../lib/images'

const blank = {
  name: '',
  roaster: '',
  origin: '',
  variety: '',
  process: null,
  roast_level: null,
  roast_date: '',
  flavor_notes: [],
  image_url: null,
  active: true,
}

export default function BeansPage({ data, go }) {
  const [editing, setEditing] = useState(null) // null | 'new' | bean
  const [view, setView] = useState('active')
  const [q, setQ] = useState('')
  const [roast, setRoast] = useState('')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.beans.filter(
      (b) =>
        (view === 'all' || b.active === (view === 'active')) &&
        (!roast || b.roast_level === roast) &&
        (!needle || [b.name, b.roaster, b.origin, b.variety, ...(b.flavor_notes ?? [])].join(' ').toLowerCase().includes(needle)),
    )
  }, [data.beans, view, q, roast])

  if (editing) return <BeanForm data={data} bean={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />

  return (
    <div className="stack">
      <div className="page-head">
        <h2>Bohnen</h2>
        <button className="btn primary" onClick={() => setEditing('new')}>
          + Bohne
        </button>
      </div>
      <Segmented options={{ active: 'In der Mühle', archived: 'Archiv', all: 'Alle' }} value={view} onChange={(v) => setView(v ?? 'all')} />
      <div className="grid2">
        <input type="search" placeholder="Suchen …" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={roast} onChange={(e) => setRoast(e.target.value)}>
          <option value="">Jeder Röstgrad</option>
          {Object.entries(ROAST_LEVELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {!rows.length ? (
        <Empty>{data.beans.length ? 'Keine Bohnen in dieser Ansicht.' : 'Noch keine Bohnen angelegt.'}</Empty>
      ) : (
        <ul className="list">
          {rows.map((b) => {
            const days = daysSince(b.roast_date)
            const fresh = freshness(days)
            const { best, count } = recipesForBean(data.brews, b.id)
            return (
              <li key={b.id} className="list-item col">
                <div className="row" onClick={() => setEditing(b)}>
                  {b.image_url && <img className="thumb" src={b.image_url} alt="" loading="lazy" />}
                  <div className="grow">
                    <strong>{b.name}</strong>
                    <span className="muted small">{[b.roaster, b.origin, b.variety].filter(Boolean).join(' · ') || '—'}</span>
                  </div>
                  {days != null && (
                    <div className={`age sm ${fresh?.tone}`}>
                      <strong>{days}</strong>
                      <span>Tage</span>
                    </div>
                  )}
                </div>
                <div className="chips">
                  {b.process && <Chip>{PROCESSES[b.process]}</Chip>}
                  {b.roast_level && <Chip>{ROAST_LEVELS[b.roast_level]}</Chip>}
                  {b.flavor_notes?.map((t) => (
                    <Chip key={t} tone="flavor">
                      {t}
                    </Chip>
                  ))}
                </div>
                <div className="row small">
                  <span className="muted">
                    {count} Bezüge{best ? ' · bestes: ' : ''}
                  </span>
                  {best && <Stars value={best.rating} size="sm" />}
                  <span className="grow" />
                  <button className="btn ghost sm" onClick={() => data.update('beans', b.id, { active: !b.active })}>
                    {b.active ? 'Aufgebraucht' : 'Reaktivieren'}
                  </button>
                  {b.active && (
                    <button className="btn primary sm" onClick={() => go('brew', { key: Date.now(), brew: { bean_id: b.id } })}>
                      Bezug
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function BeanForm({ data, bean, onDone }) {
  const [form, setForm] = useState(() => ({ ...blank, ...(bean ?? {}), roast_date: bean?.roast_date ?? '' }))
  const [photo, setPhoto] = useState(null) // { blob, dataUrl } – neues, noch nicht gespeichertes Foto
  const [ai, setAi] = useState({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const cameraRef = useRef(null)
  const uploadRef = useRef(null)
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }))
  const days = daysSince(form.roast_date)
  const preview = photo?.dataUrl ?? form.image_url

  // Gerät des letzten Bezugs als Kontext für den Community-Check
  const lastBrew = data.brews[0]
  const ctxGrinder = data.grinders.find((g) => g.id === lastBrew?.grinder_id) ?? data.grinders[0]
  const ctxMachine = data.machines.find((m) => m.id === lastBrew?.machine_id) ?? data.machines[0]

  const runAnalysis = async (dataUrl) => {
    setAi({ status: 'loading' })
    try {
      const res = await analyzeLabel(dataUrl)
      setForm((f) => {
        const next = { ...f }
        for (const k of ['name', 'roaster', 'origin', 'variety', 'process', 'roast_level', 'roast_date']) {
          if (res[k] && !f[k]) next[k] = res[k]
        }
        next.flavor_notes = [...new Set([...(f.flavor_notes ?? []), ...(res.flavor_notes ?? [])])]
        return next
      })
      setAi({ status: 'done', text: 'Etikett ausgelesen – leere Felder wurden ergänzt. Bitte kurz prüfen.' })
    } catch (e) {
      setAi({ status: 'error', text: e.message })
    }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const img = await resizeImage(file)
      setPhoto(img)
      if (canAnalyze) runAnalysis(img.dataUrl)
    } catch {
      setAi({ status: 'error', text: 'Bild konnte nicht geladen werden.' })
    }
  }

  const removePhoto = () => {
    setPhoto(null)
    setForm((f) => ({ ...f, image_url: null }))
    setAi({ status: 'idle' })
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      let image_url = form.image_url ?? null
      if (photo) image_url = await storeBeanImage(photo)
      const row = {
        name: form.name.trim(),
        roaster: form.roaster?.trim() || null,
        origin: form.origin?.trim() || null,
        variety: form.variety?.trim() || null,
        process: form.process || null,
        roast_level: form.roast_level || null,
        roast_date: form.roast_date || null,
        flavor_notes: form.flavor_notes,
        image_url,
        active: form.active,
      }
      if (bean) await data.update('beans', bean.id, row)
      else await data.add('beans', row)
      if (bean?.image_url && bean.image_url !== image_url) deleteBeanImage(bean.image_url).catch(() => {})
      onDone()
    } catch (err) {
      data.setError(err.message)
    } finally {
      setSaving(false)
    }
  }
  const del = async () => {
    if (confirm(`„${bean.name}“ löschen? Bezüge bleiben erhalten, verlieren aber die Zuordnung.`)) {
      await data.remove('beans', bean.id)
      deleteBeanImage(bean.image_url).catch(() => {})
      onDone()
    }
  }

  return (
    <form className="stack" onSubmit={save}>
      <h2>{bean ? 'Bohne bearbeiten' : 'Neue Bohne'}</h2>

      <section className="card">
        <h3 className="section-title">Foto der Tüte</h3>
        {preview ? (
          <div className="photo">
            <img src={preview} alt="Kaffeetüte" />
            <button type="button" className="btn ghost sm photo-remove" onClick={removePhoto} aria-label="Foto entfernen">
              ✕
            </button>
          </div>
        ) : (
          <p className="muted small">
            {canAnalyze
              ? 'Fotografiere das Etikett – Name, Rösterei, Herkunft & Co. werden automatisch erkannt.'
              : 'Fotografiere die Tüte zur Wiedererkennung. (KI-Etikett-Erkennung ist mit Supabase + Gemini verfügbar.)'}
          </p>
        )}
        <div className="grid2">
          <button type="button" className="btn primary big" onClick={() => cameraRef.current.click()}>
            📷 Foto aufnehmen
          </button>
          <button type="button" className="btn ghost big" onClick={() => uploadRef.current.click()}>
            🖼 Hochladen
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        <input ref={uploadRef} type="file" accept="image/*" hidden onChange={onFile} data-testid="bean-upload" />
        {ai.status === 'loading' && <div className="banner info">🔍 Lese Etikett aus …</div>}
        {ai.status === 'done' && <div className="banner info">✨ {ai.text}</div>}
        {ai.status === 'error' && (
          <div className="banner error">
            {ai.text}{' '}
            {preview && canAnalyze && (
              <button type="button" className="link" onClick={() => runAnalysis(photo?.dataUrl ?? preview)}>
                Erneut versuchen
              </button>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <Field label="Name *">
          <input required value={form.name} onChange={set('name')} placeholder="z. B. Ethiopia Guji" />
        </Field>
        <Field label="Rösterei">
          <input value={form.roaster ?? ''} onChange={set('roaster')} />
        </Field>
        <CommunityTip roaster={form.roaster} name={form.name} grinder={ctxGrinder} machineType={ctxMachine?.type} />
        <div className="grid2">
          <Field label="Herkunft">
            <input value={form.origin ?? ''} onChange={set('origin')} placeholder="Land / Region / Farm" />
          </Field>
          <Field label="Varietät">
            <input value={form.variety ?? ''} onChange={set('variety')} placeholder="z. B. Heirloom, Bourbon" />
          </Field>
        </div>
        <Field label="Aufbereitung">
          <Segmented options={PROCESSES} value={form.process} onChange={set('process')} />
        </Field>
        <Field label="Röstgrad">
          <Segmented options={ROAST_LEVELS} value={form.roast_level} onChange={set('roast_level')} />
        </Field>
        <Field label="Röstdatum" hint={days != null ? `→ ${days} Tage alt` : ''}>
          <input type="date" value={form.roast_date} onChange={set('roast_date')} />
        </Field>
        <Field label="Geschmacksnoten" hint="Enter oder Komma zum Hinzufügen">
          <TagInput value={form.flavor_notes} onChange={set('flavor_notes')} placeholder="Blaubeere, Schokolade …" />
        </Field>
        <label className="toggle">
          <input type="checkbox" checked={form.active} onChange={set('active')} />
          <span>{form.active ? 'Aktiv in der Mühle' : 'Aufgebraucht / Archiv'}</span>
        </label>
      </section>
      <div className="sticky-actions">
        {bean && (
          <button type="button" className="btn danger-ghost big" onClick={del}>
            Löschen
          </button>
        )}
        <button type="button" className="btn ghost big" onClick={onDone}>
          Abbrechen
        </button>
        <button className="btn primary big grow" disabled={saving}>
          {saving ? 'Speichere …' : 'Speichern'}
        </button>
      </div>
    </form>
  )
}
