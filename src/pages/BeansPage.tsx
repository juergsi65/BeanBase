import { Camera, Image, PackageOpen, Plus, ScanBarcode, Trash2, X } from 'lucide-react'
import BeanDetail from '../components/BeanDetail'
import { useEffect, useMemo, useRef, useState } from 'react'
import { errMsg } from '../lib/errors'
import { Field, TagInput, Segmented, Chip, Empty, segBtn, segWrap, ConfirmButton, FreshnessScale } from '../components/ui'
import CommunityTip from '../components/CommunityTip'
import BarcodeScanner from '../components/BarcodeScanner'
import { lookupBarcode } from '../lib/barcode'
import { BAG_SIZES, CURRENCIES, beanUsage, costPerGram, fmtGrams, fmtMoney, stockOf } from '../lib/cost'
import StockBar from '../components/StockBar'
import { toast } from '../lib/toast'
import { PROCESSES, ROAST_LEVELS, daysSince, freshness, recipesForBean, plural } from '../lib/coffee'
import { resizeImage, storeBeanImage, deleteBeanImage, analyzeLabel, canAnalyze } from '../lib/images'
import type { BarcodeSource, BeanFields } from '../lib/barcode'
import type { Bean, Currency, PageProps } from '../types'

type BeanFormState = Omit<Bean, 'id' | 'user_id' | 'created_at' | 'roast_date'> & { roast_date: string }
type Editing = null | 'new' | { mode: 'new'; barcode: string } | Bean
type View = 'active' | 'archived'
type FieldEvent = React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
const isEvent = (v: unknown): v is FieldEvent => typeof v === 'object' && v !== null && 'target' in v
/** Nur leere Formularfelder mit erkannten Werten füllen */
const TEXT_KEYS = ['name', 'roaster', 'origin', 'variety', 'process', 'roast_level'] as const
function fillEmpty(f: BeanFormState, src: BeanFields, keys: readonly (keyof BeanFields & keyof BeanFormState)[]) {
  const next = { ...f } as Record<string, unknown>
  for (const k of keys) if (src[k] && !f[k]) next[k] = src[k]
  return next as BeanFormState
}

const blank: BeanFormState = {
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

export default function BeansPage({ data, go }: PageProps) {
  const [editing, setEditing] = useState<Editing>(null)
  const [scanning, setScanning] = useState(false)
  const [view, setView] = useState<View>('active')
  const [selected, setSelected] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [roast, setRoast] = useState('')

  // Archivieren/Reaktivieren mit Rückgängig im Toast (ein Fehltipp soll nichts kosten)
  const toggleActive = async (b: Bean) => {
    await data.update('beans', b.id, { active: !b.active })
    toast(b.active ? `„${b.name}“ ins Archiv verschoben` : `„${b.name}“ wieder aktiv`, {
      tone: 'info',
      action: { label: 'Rückgängig', run: () => data.update('beans', b.id, { active: b.active }) },
    })
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.beans.filter(
      (b) =>
        b.active === (view === 'active') &&
        (!roast || b.roast_level === roast) &&
        (!needle || [b.name, b.roaster, b.origin, b.variety, ...(b.flavor_notes ?? [])].join(' ').toLowerCase().includes(needle)),
    )
  }, [data.beans, view, q, roast])

  // Scan auf der Übersicht: eigene Bohne mit diesem Barcode öffnen, sonst neue Bohne vorausfüllen
  const onScan = (code: string) => {
    setScanning(false)
    setEditing(data.beans.find((b) => b.barcode === code) ?? { mode: 'new', barcode: code })
  }

  if (editing) {
    const scanned = editing !== 'new' && 'mode' in editing ? editing.barcode : null
    const bean = editing === 'new' || 'mode' in editing ? null : editing
    return (
      <BeanForm
        key={bean ? bean.id : `new-${scanned ?? ''}`}
        data={data}
        bean={bean}
        initialBarcode={scanned}
        onOpen={(b) => setEditing(b)}
        onDone={() => setEditing(null)}
      />
    )
  }

  const activeCount = data.beans.filter((b) => b.active).length
  const archivedCount = data.beans.length - activeCount
  // Desktop zeigt immer eine Bohne rechts (gewählt oder die erste); Handy nur nach Antippen
  const current = data.beans.find((b) => b.id === selected) ?? rows[0]
  const open = (id: string | null) => {
    setSelected(id)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  return (
    <div className="flex flex-col gap-4">
      <header className={`flex items-center gap-2 desk:items-end desk:gap-4 ${selected ? 'hidden desk:flex' : ''}`}>
        <div className="grow">
          <span className="lbl hidden desk:inline">{activeCount} aktiv · {archivedCount} im Archiv</span>
          <h2 className="text-[26px] desk:mt-1.5 desk:text-[34px] desk:tracking-[-0.025em]">Bohnen</h2>
        </div>
        <button className="btn h-11 w-11 rounded-[12px] border-base-300 bg-base-100 px-0 desk:w-auto desk:px-4 desk:font-normal" onClick={() => setScanning(true)} aria-label="Barcode scannen">
          <ScanBarcode size={20} strokeWidth={1.75} aria-hidden /> <span className="hidden desk:inline">Scannen</span>
        </button>
        <button className="btn btn-primary h-11 w-11 rounded-[12px] px-0 desk:w-auto desk:px-4.5" onClick={() => setEditing('new')} aria-label="Bohne hinzufügen">
          <Plus size={20} strokeWidth={2.2} aria-hidden /> <span className="hidden desk:inline">Bohne</span>
        </button>
      </header>
      {scanning && <BarcodeScanner onResult={onScan} onClose={() => setScanning(false)} />}

      <div className="flex flex-col gap-4 desk:flex-row desk:items-start desk:gap-6">
      <div className={`flex flex-col gap-3 desk:w-[360px] desk:shrink-0 ${selected ? 'hidden desk:flex' : ''}`}>
      <div className={`${segWrap} grid grid-cols-2 bg-base-100`} role="tablist" aria-label="Bohnen-Ansicht">
        {([['active', 'Aktiv', activeCount], ['archived', 'Archiv', archivedCount]] as const).map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={view === k} className={segBtn(view === k)} onClick={() => setView(k)}>
            {label} <span className="num text-muted">{n}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className="input w-full" type="search" aria-label="Bohnen durchsuchen" placeholder="Suchen …" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select w-full" value={roast} onChange={(e) => setRoast(e.target.value)}>
          <option value="">Jeder Röstgrad</option>
          {Object.entries(ROAST_LEVELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-3.5 text-xs text-muted" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3.5 rounded-[2px] bg-(--scale-rest)" />Ruht</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3.5 rounded-[2px] bg-(--scale-good)" />Optimum</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3.5 rounded-[2px] bg-(--scale-fade)" />Lässt nach</span>
      </div>

      {!rows.length ? (
        <Empty>{data.beans.length ? 'Keine Bohnen in dieser Ansicht.' : 'Noch keine Bohnen angelegt.'}</Empty>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((b) => {
            const days = daysSince(b.roast_date)
            const fresh = freshness(days)
            const { count } = recipesForBean(data.brews, b.id)
            const u = beanUsage(b.id, data.bean_stock, data.brews)
            const meta = [b.roaster, b.origin, b.process && PROCESSES[b.process], b.roast_level && ROAST_LEVELS[b.roast_level]].filter(Boolean).join(' · ')
            return (
              <li key={b.id}>
                <button
                  className={`flex w-full cursor-pointer flex-col gap-3 rounded-[18px] border bg-base-100 p-4 text-left ${current?.id === b.id ? 'border-base-300 desk:border-primary desk:ring-1 desk:ring-inset desk:ring-primary' : 'border-base-300'}`}
                  onClick={() => open(b.id)}
                  aria-current={current?.id === b.id ? 'true' : undefined}
                >
                  <div className="flex w-full justify-between gap-3">
                    {b.image_url && <img className="thumb" src={b.image_url} alt="" loading="lazy" />}
                    <div className="min-w-0 grow">
                      <div className="text-lg font-semibold tracking-[-0.01em]">{b.name}</div>
                      {meta && <div className="mt-0.5 text-[13px] text-muted">{meta}</div>}
                    </div>
                    {days != null && days >= 0 && (
                      <div className="shrink-0 text-right">
                        <div className={`num text-[22px] leading-none font-semibold ${fresh?.tone === 'good' ? 'text-success' : 'text-warning'}`}>{days}</div>
                        <div className="lbl mt-1">Tage</div>
                      </div>
                    )}
                  </div>
                  {days != null && days >= 0 && <div className="w-full"><FreshnessScale days={days} /></div>}
                  {b.flavor_notes?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 desk:hidden">
                      {b.flavor_notes.map((t) => (
                        <Chip key={t} tone="flavor">
                          {t}
                        </Chip>
                      ))}
                    </div>
                  )}
                  <div className="flex w-full items-center justify-between gap-2 border-t border-base-300 pt-2.5 text-[13px]">
                    <span>{u ? <><span className="num font-semibold">{fmtGrams(u.remaining)}</span> <span className="text-muted">übrig</span></> : <span className="text-muted">Kein Vorrat</span>}</span>
                    <span className="text-muted">{plural(count, 'Bezug', 'Bezüge')}</span>
                    {u?.perCup != null && <span className="num text-accent-strong">{fmtMoney(u.perCup, u.currency)} / Tasse</span>}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      </div>

      {current && (
        <BeanDetail
          key={current.id}
          bean={current}
          data={data}
          go={go}
          className={selected ? '' : 'hidden desk:flex'}
          onBack={() => open(null)}
          onEdit={() => setEditing(current)}
          onToggleActive={() => void toggleActive(current)}
        />
      )}
      </div>
    </div>
  )
}

const SOURCE_TEXT: Record<BarcodeSource, (n?: number) => string> = {
  community: (n) => `Erkannt über die BeanBase-Community (${n} Nutzer${n === 1 ? '' : ''}) – leere Felder wurden ergänzt.`,
  openfoodfacts: () => 'Erkannt über Open Food Facts – leere Felder wurden ergänzt. Bitte prüfen.',
  upcitemdb: () => 'Erkannt über UPCitemdb – leere Felder wurden ergänzt. Bitte prüfen.',
}

type AiState = { status: 'idle' | 'loading' } | { status: 'done' | 'error'; text: string }
type ScanState =
  | { status: 'idle' | 'loading' | 'unknown' }
  | { status: 'found'; text: string }
  | { status: 'notcoffee'; productName: string }
  | { status: 'existing'; bean: Bean }

function BeanForm({
  data,
  bean,
  onDone,
  onOpen,
  initialBarcode,
}: {
  data: PageProps['data']
  bean: Bean | null
  onDone: () => void
  onOpen?: (b: Bean) => void
  initialBarcode: string | null
}) {
  const [form, setForm] = useState<BeanFormState>(() => ({ ...blank, ...bean, roast_date: bean?.roast_date ?? '' }))
  const [photo, setPhoto] = useState<{ blob: Blob; dataUrl: string } | null>(null) // neues, noch nicht gespeichertes Foto
  const [ai, setAi] = useState<AiState>({ status: 'idle' })
  const [scan, setScan] = useState<ScanState>({ status: 'idle' })
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const existingStock = bean ? stockOf(bean.id, data.bean_stock) : null
  const [stock, setStock] = useState<{ bag: number | string; price: number | string; currency: Currency; newBag: boolean }>(() => ({
    bag: existingStock?.bag_weight_g ?? '',
    price: existingStock?.price ?? '',
    currency: existingStock?.currency ?? 'EUR',
    newBag: false,
  }))
  const usage = bean ? beanUsage(bean.id, data.bean_stock, data.brews) : null
  const previewCpg = costPerGram({ price: stock.price === '' ? null : Number(stock.price), bag_weight_g: Number(stock.bag) })
  const cameraRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const set =
    <K extends keyof BeanFormState>(k: K) =>
    (v: BeanFormState[K] | FieldEvent) =>
      setForm((f) => ({
        ...f,
        [k]: isEvent(v) ? (v.target instanceof HTMLInputElement && v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v,
      }))
  const days = daysSince(form.roast_date)
  const preview = photo?.dataUrl ?? form.image_url

  // Gerät des letzten Bezugs als Kontext für den Community-Check
  const lastBrew = data.brews[0]
  const ctxGrinder = data.grinders.find((g) => g.id === lastBrew?.grinder_id) ?? data.grinders[0]
  const ctxMachine = data.machines.find((m) => m.id === lastBrew?.machine_id) ?? data.machines[0]

  const runAnalysis = async (dataUrl: string) => {
    setAi({ status: 'loading' })
    try {
      const res = await analyzeLabel(dataUrl)
      setForm((f) => {
        const next = fillEmpty(f, res, [...TEXT_KEYS, 'roast_date'])
        if (res.barcode && !f.barcode) next.barcode = res.barcode
        next.flavor_notes = [...new Set([...(f.flavor_notes ?? []), ...(res.flavor_notes ?? [])])]
        return next
      })
      setAi({ status: 'done', text: 'Etikett ausgelesen – leere Felder wurden ergänzt. Bitte kurz prüfen.' })
    } catch (e) {
      setAi({ status: 'error', text: errMsg(e) })
    }
  }

  // Barcode → eigene Bohne? → Community → Open Food Facts; nur leere Felder werden ergänzt
  const handleBarcode = async (code: string) => {
    setScanning(false)
    setForm((f) => ({ ...f, barcode: code }))
    const own = data.beans.find((b) => b.barcode === code && b.id !== bean?.id)
    if (own) return setScan({ status: 'existing', bean: own })
    setScan({ status: 'loading' })
    const hit = await lookupBarcode(code)
    if (!hit) return setScan({ status: 'unknown' })
    if (hit.notCoffee) {
      // Strikter Kaffee-Filter: nichts übernehmen, Barcode nicht speichern
      setForm((f) => ({ ...f, barcode: bean?.barcode ?? null }))
      return setScan({ status: 'notcoffee', productName: hit.productName })
    }
    setForm((f) => {
      const next = fillEmpty(f, hit.data, TEXT_KEYS)
      next.flavor_notes = [...new Set([...(f.flavor_notes ?? []), ...(hit.data.flavor_notes ?? [])])]
      return next
    })
    setScan({ status: 'found', text: SOURCE_TEXT[hit.source](hit.users) })
  }

  useEffect(() => {
    if (initialBarcode) handleBarcode(initialBarcode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const save = async (e: React.FormEvent) => {
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
      const saved = bean ? await data.update('beans', bean.id, row) : await data.add('beans', row)
      if (bean?.image_url && bean.image_url !== image_url) deleteBeanImage(bean.image_url).catch(() => {})
      // Packung & Preis (private Tabelle bean_stock)
      const bag = Number(stock.bag)
      const stockRow = {
        bag_weight_g: bag > 0 ? bag : null,
        price: stock.price === '' || stock.price == null ? null : Number(stock.price),
        currency: stock.currency,
      }
      const hasStock = stockRow.bag_weight_g || stockRow.price != null
      if (existingStock && !hasStock) await data.remove('bean_stock', existingStock.id)
      else if (existingStock)
        await data.update('bean_stock', existingStock.id, { ...stockRow, ...(stock.newBag ? { opened_at: new Date().toISOString() } : {}) })
      else if (hasStock) await data.add('bean_stock', { ...stockRow, bean_id: saved.id, opened_at: new Date().toISOString() })
      toast(bean ? 'Bohne gespeichert' : 'Bohne angelegt')
      onDone()
    } catch (err) {
      data.setError(errMsg(err))
    } finally {
      setSaving(false)
    }
  }
  const del = async () => {
    if (!bean) return
    await data.remove('beans', bean.id)
    deleteBeanImage(bean.image_url).catch(() => {})
    onDone()
  }

  return (
    <form className="flex flex-col gap-4 pb-21 desk:pb-6" onSubmit={save}>
      <h2>{bean ? 'Bohne bearbeiten' : 'Neue Bohne'}</h2>

      <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
        <h3 className="lbl">Schnell erfassen</h3>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => setScanning(true)}>
          ▦ Barcode scannen
        </button>
        {scanning && <BarcodeScanner onResult={handleBarcode} onClose={() => setScanning(false)} />}
        {form.barcode && (
          <div className="flex flex-wrap gap-1.5">
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
        {scan.status === 'loading' && <div className="alert alert-soft block alert-info">Suche Bohne zum Barcode …</div>}
        {scan.status === 'found' && (
          <div className="alert alert-soft block alert-info">
            {scan.text}
          </div>
        )}
        {scan.status === 'notcoffee' && (
          <div className="alert alert-soft block alert-error" role="alert">
            <strong>Kein Kaffee erkannt:</strong> Dieser Barcode gehört zu einem anderen Produkt ({scan.productName}). Bitte scanne eine
            Kaffeepackung.
          </div>
        )}
        {scan.status === 'unknown' && (
          <div className="alert alert-soft block alert-info">
            Barcode noch unbekannt – fotografiere das Etikett oder trag die Daten ein. Beim Speichern wird der Barcode hinterlegt, damit die
            Bohne beim nächsten Scan sofort erkannt wird.
          </div>
        )}
        {scan.status === 'existing' && (
          <div className="alert alert-soft block alert-info">
            Diese Bohne hast du schon: <strong>{scan.bean.name}</strong>{' '}
            {onOpen && (
              <button type="button" className="link link-primary p-2 no-underline" onClick={() => onOpen(scan.bean)}>
                Öffnen
              </button>
            )}
          </div>
        )}
        {preview ? (
          <div className="photo">
            <img src={preview} alt="Kaffeetüte" />
            <button type="button" className="btn btn-ghost btn-sm absolute top-2 right-2 border-base-300 bg-page/75" onClick={removePhoto} aria-label="Foto entfernen">
              <X size={18} aria-hidden />
            </button>
          </div>
        ) : (
          <p className="text-muted text-sm">
            {canAnalyze
              ? 'Fotografiere die Vorderseite der Tüte – Sorte, Rösterei, Herkunft & Co. werden automatisch erkannt.'
              : 'Fotografiere die Tüte zur Wiedererkennung in deiner Bohnen-Liste.'}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => cameraRef.current?.click()}>
            <Camera size={16} aria-hidden /> Foto
          </button>
          <button type="button" className="btn btn-ghost border-base-300 btn-lg" onClick={() => uploadRef.current?.click()}>
            <Image size={16} aria-hidden /> Hochladen
          </button>
        </div>
        {!canAnalyze && (
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <span className="badge badge-dash badge-info badge-sm font-bold whitespace-nowrap">KI-Erkennung · TBA</span> Automatische Etiketten-Erkennung folgt in einem kommenden Update.
          </p>
        )}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        <input ref={uploadRef} type="file" accept="image/*" hidden onChange={onFile} data-testid="bean-upload" />
        {canAnalyze && (
          <p className="text-muted text-sm">
            Tipp: Das Röstdatum steht oft auf der Rückseite oder dem Boden der Tüte – falls es nicht erkannt wird, kannst du es unten schnell ergänzen.
          </p>
        )}
        {ai.status === 'loading' && <div className="alert alert-soft block alert-info">Etikett wird erkannt …</div>}
        {ai.status === 'done' && <div className="alert alert-soft block alert-info">{ai.text}</div>}
        {ai.status === 'error' && (
          <div className="alert alert-soft block alert-error">
            {ai.text}{' '}
            {preview && canAnalyze && (
              <button type="button" className="link link-primary p-2 no-underline" onClick={() => runAnalysis(photo?.dataUrl ?? preview)}>
                Erneut versuchen
              </button>
            )}
          </div>
        )}
      </section>

      <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
        <Field label="Name *">
          <input className="input w-full" required value={form.name} onChange={set('name')} placeholder="z. B. Ethiopia Guji" />
        </Field>
        <Field label="Rösterei">
          <input className="input w-full" value={form.roaster ?? ''} onChange={set('roaster')} />
        </Field>
        <CommunityTip roaster={form.roaster} name={form.name} grinder={ctxGrinder} machine={ctxMachine} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Herkunft">
            <input className="input w-full" value={form.origin ?? ''} onChange={set('origin')} placeholder="Land / Region / Farm" />
          </Field>
          <Field label="Varietät">
            <input className="input w-full" value={form.variety ?? ''} onChange={set('variety')} placeholder="z. B. Heirloom, Bourbon" />
          </Field>
        </div>
        <Field label="Aufbereitung">
          <Segmented options={PROCESSES} value={form.process} onChange={set('process')} />
        </Field>
        <Field label="Röstgrad">
          <Segmented options={ROAST_LEVELS} value={form.roast_level} onChange={set('roast_level')} />
        </Field>
        <Field label="Röstdatum" hint={days != null ? `→ ${days} Tage alt` : ''}>
          <input className="input w-full" type="date" value={form.roast_date} onChange={set('roast_date')} />
        </Field>
        <Field label="Geschmacksnoten" hint="Enter oder Komma zum Hinzufügen">
          <TagInput value={form.flavor_notes} onChange={set('flavor_notes')} placeholder="Blaubeere, Schokolade …" />
        </Field>
      </section>

      <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
        <h3 className="lbl">Packung & Preis</h3>
        <p className="text-muted text-sm">Nur für dich sichtbar – auch Freunde sehen keine Preise.</p>
        <Field label="Packungsgröße">
          <div className={segWrap}>
            {BAG_SIZES.map((g) => (
              <button type="button" key={g} className={segBtn(Number(stock.bag) === g)} onClick={() => setStock((s) => ({ ...s, bag: g }))}>
                {fmtGrams(g)}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gewicht (g)">
            <input className="input w-full" type="number" inputMode="decimal" min="1" value={stock.bag} placeholder="z. B. 250" onChange={(e) => setStock((s) => ({ ...s, bag: e.target.value }))} />
          </Field>
          <Field label="Kaufpreis">
            <div className="grid grid-cols-[minmax(0,1fr)_76px] gap-1.5">
              <input className="input w-full" type="number" inputMode="decimal" min="0" step="0.01" value={stock.price} placeholder="z. B. 14.90" onChange={(e) => setStock((s) => ({ ...s, price: e.target.value }))} />
              <select className="select w-full" value={stock.currency} onChange={(e) => setStock((s) => ({ ...s, currency: e.target.value as Currency }))} aria-label="Währung">
                {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
                  <option key={c} value={c}>
                    {CURRENCIES[c]}
                  </option>
                ))}
              </select>
            </div>
          </Field>
        </div>
        {previewCpg != null && (
          <div className="grid grid-cols-2 min-[361px]:grid-cols-3 gap-2 max-[360px]:*:last:col-span-2 *:flex *:flex-col *:items-center *:rounded-xl *:bg-base-200 *:px-1.5 *:py-2.5 *:text-center [&_strong]:text-accent-strong [&_strong]:[overflow-wrap:anywhere] [&_span]:text-[0.72rem] [&_span]:text-muted">
            <div>
              <strong>{fmtMoney(previewCpg * 100, stock.currency)}</strong>
              <span>pro 100 g</span>
            </div>
            <div>
              <strong>{fmtMoney(previewCpg * (usage?.avgDose ?? 18), stock.currency)}</strong>
              <span>pro Tasse ({Math.round((usage?.avgDose ?? 18) * 10) / 10} g)</span>
            </div>
            <div>
              <strong>{Math.floor(Number(stock.bag) / (usage?.avgDose ?? 18))}</strong>
              <span>Tassen pro Packung</span>
            </div>
          </div>
        )}
        {usage && !stock.newBag && (
          <div className="flex flex-col gap-2.5">
            <StockBar usage={usage} />
            <button type="button" className="btn btn-ghost border-base-300 btn-sm" onClick={() => setStock((s) => ({ ...s, newBag: true }))}>
              <PackageOpen size={16} aria-hidden /> Neue Packung angebrochen
            </button>
          </div>
        )}
        {stock.newBag && <div className="alert alert-soft block alert-info">Beim Speichern startet der Verbrauch der neuen Packung bei 0.</div>}
      </section>

      <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
        <label className="flex items-center gap-3 cursor-pointer font-semibold">
          <input className="checkbox checkbox-primary" type="checkbox" checked={form.active} onChange={set('active')} />
          <span>{form.active ? 'Aktiv in der Mühle' : 'Aufgebraucht / Archiv'}</span>
        </label>
      </section>
      {bean && (
        <ConfirmButton
          className="btn btn-outline btn-error btn-block"
          question={`„${bean.name}“ löschen? Bezüge bleiben erhalten, verlieren aber die Zuordnung zur Bohne.`}
          confirmLabel="Bohne löschen"
          onConfirm={del}
        >
          <Trash2 size={16} aria-hidden /> Bohne löschen
        </ConfirmButton>
      )}
      <div className="sticky-actions">
        <button type="button" className="btn btn-ghost border-base-300 btn-lg" onClick={onDone}>
          Abbrechen
        </button>
        <button className="btn btn-primary btn-lg grow desk:grow-0 desk:basis-80" disabled={saving}>
          {saving ? 'Speichere …' : 'Speichern'}
        </button>
      </div>
    </form>
  )
}

