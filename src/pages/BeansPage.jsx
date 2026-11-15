import { useEffect, useMemo, useRef, useState } from 'react'
import { Field, TagInput, Segmented, Chip, Empty, Stars } from '../components/ui'
import CommunityTip from '../components/CommunityTip'
import BarcodeScanner from '../components/BarcodeScanner'
import { lookupBarcode } from '../lib/barcode'
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
  barcode: null,
  active: true,
}

export default function BeansPage({ data, go }) {
  const [editing, setEditing] = useState(null) // null | 'new' | { mode: 'new', barcode } | bean
  const [scanning, setScanning] = useState(false)
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

  // Scan auf der Übersicht: eigene Bohne mit diesem Barcode öffnen, sonst neue Bohne vorausfüllen
  const onScan = (code) => {
    setScanning(false)
    setEditing(data.beans.find((b) => b.barcode === code) ?? { mode: 'new', barcode: code })
  }

  if (editing) {
    const isNew = editing === 'new' || editing.mode === 'new'
    return (
      <BeanForm
        key={isNew ? `new-${editing.barcode ?? ''}` : editing.id}
        data={data}
        bean={isNew ? null : editing}
        initialBarcode={editing.mode === 'new' ? editing.barcode : null}
        onOpen={(b) => setEditing(b)}
        onDone={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h2>Bohnen</h2>
        <div className="row-actions">
          <button className="btn ghost" onClick={() => setScanning(true)} aria-label="Barcode scannen">
            ▦ Scan
          </button>
          <button className="btn primary" onClick={() => setEditing('new')}>
            + Bohne
          </button>
        </div>
      </div>
      {scanning && <BarcodeScanner onResult={onScan} onClose={() => setScanning(false)} />}
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

const SOURCE_TEXT = {
  community: (n) => `Erkannt über die BeanBase-Community (${n} Nutzer${n === 1 ? '' : ''}) – leere Felder wurden ergänzt.`,
  openfoodfacts: () => 'Erkannt über Open Food Facts – leere Felder wurden ergänzt. Bitte prüfen.',
}

function BeanForm({ data, bean, onDone, onOpen, initialBarcode }) {
  const [form, setForm] = useState(() => ({ ...blank, ...(bean ?? {}), roast_date: bean?.roast_date ?? '' }))
  const [photo, setPhoto] = useState(null) // { blob, dataUrl } – neues, noch nicht gespeichertes Foto
  const [ai, setAi] = useState({ status: 'idle' })
  const [scan, setScan] = useState({ status: 'idle' }) // idle | loading | found | unknown | existing
  const [scanning, setScanning] = useState(false)
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
        if (res.barcode && !f.barcode) next.barcode = res.barcode
        next.flavor_notes = [...new Set([...(f.flavor_notes ?? []), ...(res.flavor_notes ?? [])])]
        return next
      })
      setAi({ status: 'done', text: 'Etikett ausgelesen – leere Felder wurden ergänzt. Bitte kurz prüfen.' })
    } catch (e) {
      setAi({ status: 'error', text: e.message })
    }
  }

  // Barcode → eigene Bohne? → Community → Open Food Facts; nur leere Felder werden ergänzt
  const handleBarcode = async (code) => {
    setScanning(false)
    setForm((f) => ({ ...f, barcode: code }))
    const own = data.beans.find((b) => b.barcode === code && b.id !== bean?.id)
    if (own) return setScan({ status: 'existing', bean: own })
    setScan({ status: 'loading' })
    const hit = await lookupBarcode(code)
    if (!hit) return setScan({ status: 'unknown' })
    setForm((f) => {
      const next = { ...f }
      for (const k of ['name', 'roaster', 'origin', 'variety', 'process', 'roast_level']) if (hit.data[k] && !f[k]) next[k] = hit.data[k]
      next.flavor_notes = [...new Set([...(f.flavor_notes ?? []), ...(hit.data.flavor_notes ?? [])])]
      return next
    })
    setScan({ status: 'found', text: SOURCE_TEXT[hit.source](hit.users), warn: hit.source === 'openfoodfacts' && !hit.isCoffee })
  }

  useEffect(() => {
    if (initialBarcode) handleBarcode(initialBarcode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        barcode: form.barcode || null,
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
        <h3 className="section-title">Schnell erfassen</h3>
        <button type="button" className="btn primary big block" onClick={() => setScanning(true)}>
          ▦ Barcode scannen
        </button>
        {scanning && <BarcodeScanner onResult={handleBarcode} onClose={() => setScanning(false)} />}
        {form.barcode && (
          <div className="chips">
            <Chip
              onRemove={() => {
                setForm((f) => ({ ...f, barcode: null }))
                setScan({ status: 'idle' })
              }}
            >
              ▦ {form.barcode}
            </Chip>
          </div>
        )}
        {scan.status === 'loading' && <div className="banner info">🔍 Suche Bohne zum Barcode …</div>}
        {scan.status === 'found' && (
          <div className="banner info">
            ✨ {scan.text}
            {scan.warn && ' Hinweis: Das Produkt ist dort nicht als Kaffee eingeordnet.'}
          </div>
        )}
        {scan.status === 'unknown' && (
          <div className="banner info">
            Barcode noch unbekannt – fotografiere das Etikett oder trag die Daten ein. Beim Speichern wird der Barcode hinterlegt, damit die
            Bohne beim nächsten Scan sofort erkannt wird.
          </div>
        )}
        {scan.status === 'existing' && (
          <div className="banner info">
            Diese Bohne hast du schon: <strong>{scan.bean.name}</strong>{' '}
            {onOpen && (
              <button type="button" className="link" onClick={() => onOpen(scan.bean)}>
                Öffnen
              </button>
            )}
          </div>
        )}
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
              ? 'Fotografiere die Vorderseite der Tüte – Sorte, Rösterei, Herkunft & Co. werden automatisch erkannt.'
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
        {canAnalyze && (
          <p className="muted small">
            💡 Tipp: Das Röstdatum steht oft auf der Rückseite oder dem Boden der Tüte – falls es nicht erkannt wird, kannst du es unten schnell ergänzen.
          </p>
        )}
        {ai.status === 'loading' && <div className="banner info">🔍 Etikett wird erkannt …</div>}
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
        <CommunityTip roaster={form.roaster} name={form.name} grinder={ctxGrinder} machine={ctxMachine} />
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
