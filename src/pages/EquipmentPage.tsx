import { useState } from 'react'
import { errMsg } from '../lib/errors'
import { Field, Empty, Chip, Segmented } from '../components/ui'
import { MACHINE_TYPES, SCALE_TYPES } from '../lib/coffee'
import { MACHINE_PRESETS, GRINDER_PRESETS, searchPresets } from '../data/presets'
import MediaPicker from '../components/MediaPicker'
import { uploadMedia, deleteMedia } from '../lib/media'
import { toast } from '../lib/toast'
import { exportAll } from '../lib/db'
import { useHapticsSetting } from '../lib/haptics'
import { THEME_LABEL } from '../lib/theme'
import type { RowInput } from '../lib/db'
import type { GrinderPreset, MachinePreset } from '../data/presets'
import type { MediaChange } from '../components/MediaPicker'
import type { Grinder, Machine, PageProps } from '../types'

type Preset = MachinePreset | GrinderPreset
type EquipRow = Machine | Grinder
type EquipTable = 'machines' | 'grinders'
interface EquipForm {
  id?: string
  name: string
  type: string
  notes: string
  preset_id: string | null
  image_url?: string | null
}
const typeOf = (r: EquipRow | Preset): string => ('type' in r ? r.type : r.scale_type)

export default function EquipmentPage({ data, theme }: Pick<PageProps, 'data' | 'theme'>) {
  return (
    <div className="flex flex-col gap-4">
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
      <AppSettings theme={theme} />
    </div>
  )
}

function AppSettings({ theme }: Pick<PageProps, 'theme'>) {
  const [haptics, setHaptics] = useHapticsSetting()
  const download = async () => {
    const blob = new Blob([JSON.stringify(await exportAll(), null, 2)], { type: 'application/json' })
    Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `beanbase-backup-${new Date().toISOString().slice(0, 10)}.json`,
    }).click()
  }
  return (
    <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
      <h3 className="text-xs uppercase tracking-widest text-muted">App</h3>
      {theme && (
        <Field label="Design">
          <Segmented options={THEME_LABEL} value={theme.theme} onChange={(v) => v && theme.setTheme(v)} />
        </Field>
      )}
      <label className="flex items-center gap-3 cursor-pointer font-semibold">
        <input className="checkbox checkbox-primary"
          type="checkbox"
          checked={haptics}
          onChange={(e) => setHaptics(e.target.checked)}
        />
        <span>Haptisches Feedback (Vibration beim Tippen)</span>
      </label>
      <button className="btn btn-ghost border-base-300 btn-block" onClick={download}>
        ⤓ Alle Daten exportieren (JSON-Backup)
      </button>
    </section>
  )
}

/** Suchfeld "Aus bekannten Modellen wählen" */
function PresetPicker({ presets, onPick }: { presets: Preset[]; onPick: (p: Preset) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const hits = searchPresets(presets, q).slice(0, 8)
  return (
    <div className="relative">
      <input className="input w-full"
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
        <ul className="menu absolute inset-x-0 z-5 mt-1 max-h-80 w-full flex-nowrap overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-1 shadow-xl">
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
                  <span className="flex flex-col items-start gap-0.5 text-left">
                    <strong>{p.name}</strong>
                    <span className="text-xs text-muted">{p.notes}</span>
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="p-2.5 text-muted text-sm">Kein bekanntes Modell – einfach unten eigenen Namen eintragen.</li>
          )}
        </ul>
      )}
    </div>
  )
}

function EquipmentSection({
  data,
  table,
  title,
  typeKey,
  types,
  presets,
  defaultType,
  notesHint,
}: {
  data: PageProps['data']
  table: EquipTable
  title: string
  typeKey: 'type' | 'scale_type'
  types: Record<string, string>
  presets: Preset[]
  defaultType: string
  notesHint: string
}) {
  const [form, setForm] = useState<EquipForm | null>(null)
  const [media, setMedia] = useState<MediaChange>({ pending: null, removed: false })
  const rows: EquipRow[] = data[table]
  const presetName = (id: string) => presets.find((p) => p.id === id)?.name

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const row: Record<string, unknown> = { name: form.name.trim(), [typeKey]: form.type, notes: form.notes.trim() || null, preset_id: form.preset_id || null }
    try {
      if (media.pending) row.image_url = (await uploadMedia(media.pending)).url
      else if (media.removed) row.image_url = null
      if (form.id) await data.update(table, form.id, row as RowInput<EquipTable>)
      else await data.add(table, row as RowInput<EquipTable>)
      if (form.image_url && (media.pending || media.removed)) deleteMedia(form.image_url).catch(() => {})
      toast('Gespeichert')
      setForm(null)
      setMedia({ pending: null, removed: false })
    } catch (err) {
      data.setError(errMsg(err))
    }
  }
  const del = async (r: EquipRow) => {
    if (confirm(`„${r.name}“ löschen?`)) await data.remove(table, r.id)
  }
  const pick = (p: Preset) => setForm((f) => ({ ...f, name: p.name, type: typeOf(p), notes: p.notes ?? '', preset_id: p.id }))

  return (
    <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs uppercase tracking-widest text-muted">{title}</h3>
        {!form && (
          <button className="btn btn-primary btn-sm" onClick={() => setForm({ name: '', type: defaultType, notes: '', preset_id: null })}>
            + Hinzufügen
          </button>
        )}
      </div>

      {form && (
        <form className="mb-3 flex flex-col gap-4 rounded-box bg-base-200 p-3" onSubmit={save}>
          <PresetPicker presets={presets} onPick={pick} />
          {form.preset_id && (
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="good" onRemove={() => setForm({ ...form, preset_id: null })}>
                ✓ Modell: {presetName(form.preset_id) ?? form.preset_id}
              </Chip>
            </div>
          )}
          <Field label="Name *" hint={form.preset_id ? 'frei umbenennbar, Modell bleibt verknüpft' : ''}>
            <input className="input w-full" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={typeKey === 'type' ? 'Typ' : 'Skala'}>
            <select className="select w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(types).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notizen">
            <textarea className="textarea w-full" rows={2} value={form.notes} placeholder={notesHint} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <Field label="Foto">
            <MediaPicker
              allowVideo={false}
              value={media.removed || !form.image_url ? null : { url: form.image_url, type: 'image' }}
              pending={media.pending}
              onChange={setMedia}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className="btn btn-ghost border-base-300" onClick={() => { setForm(null); setMedia({ pending: null, removed: false }) }}>
              Abbrechen
            </button>
            <button className="btn btn-primary grow">Speichern</button>
          </div>
        </form>
      )}

      {!rows.length && !form ? (
        <Empty>Noch nichts angelegt.</Empty>
      ) : (
        <ul className="items">
          {rows.map((r) => (
            <li key={r.id} className="item">
              {r.image_url && <img className="thumb" src={r.image_url} alt="" loading="lazy" />}
              <div className="grow">
                <strong>
                  {r.name} {r.preset_id && <span className="badge badge-success badge-soft badge-xs ml-1" title={presetName(r.preset_id)}>✓</span>}
                </strong>
                <span className="text-muted text-sm">
                  {types[typeOf(r)]}
                  {r.notes ? ` · ${r.notes}` : ''}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  className="btn btn-ghost border-base-300 btn-sm"
                  onClick={() => setForm({ id: r.id, name: r.name, type: typeOf(r), notes: r.notes ?? '', preset_id: r.preset_id ?? null, image_url: r.image_url ?? null })}
                >
                  ✎
                </button>
                <button className="btn btn-outline btn-error btn-sm" onClick={() => del(r)}>
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
