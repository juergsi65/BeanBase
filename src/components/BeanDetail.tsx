import { Camera, ChevronLeft } from 'lucide-react'
import { Chip, FreshnessScale } from './ui'
import { PROCESSES, ROAST_LEVELS, daysSince, freshness, fmtRatio, ratio, recipesForBean, plural } from '../lib/coffee'
import { beanUsage, costPerGram, fmtGrams, fmtMoney, stockOf } from '../lib/cost'
import { toast } from '../lib/toast'
import type { Bean, PageProps } from '../types'

const fmtDay = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'
const nowIso = () => new Date().toISOString()
const freshKey = () => Date.now()

/** Detailansicht einer Bohne (Design „Bohne“ / rechte Spalte von „Bohnen · Desktop“) */
export default function BeanDetail({
  bean,
  data,
  go,
  onBack,
  onEdit,
  onToggleActive,
  className = '',
}: {
  bean: Bean
  data: PageProps['data']
  go: PageProps['go']
  onBack: () => void
  onEdit: () => void
  onToggleActive: () => void
  className?: string
}) {
  const days = daysSince(bean.roast_date)
  const fresh = freshness(days)
  const stock = stockOf(bean.id, data.bean_stock)
  const usage = beanUsage(bean.id, data.bean_stock, data.brews)
  const cpg = costPerGram(stock)
  const { best, count } = recipesForBean(data.brews, bean.id)
  // Dial-in-Verlauf: die letzten 12 Bezüge dieser Bohne (neueste zuerst, flex-row-reverse zeigt den ältesten links)
  const history = data.brews.filter((b) => b.bean_id === bean.id).slice(0, 12)
  const brew = () => go('brew', { key: freshKey(), brew: { bean_id: bean.id } })

  const openNewBag = async () => {
    if (!stock) return
    const prev = stock.opened_at
    await data.update('bean_stock', stock.id, { opened_at: nowIso() })
    toast('Neue Packung angebrochen', { tone: 'info', action: { label: 'Rückgängig', run: () => data.update('bean_stock', stock.id, { opened_at: prev }) } })
  }

  const info: [string, string | null][] = [
    ['Herkunft', bean.origin],
    ['Varietät', bean.variety],
    ['Aufbereitung', bean.process ? PROCESSES[bean.process] : null],
    ['Röstdatum', bean.roast_date ? fmtDay(bean.roast_date) : null],
  ]

  return (
    <article className={`flex min-w-0 grow flex-col gap-4.5 desk:card desk:border desk:border-base-300 desk:bg-base-100 desk:p-6 ${className}`}>
      <header className="flex items-center gap-2 desk:hidden">
        <button className="btn btn-square size-11 rounded-[12px] border-base-300 bg-base-100" onClick={onBack} aria-label="Zurück zu Bohnen">
          <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
        </button>
        <button className="btn ml-auto h-11 rounded-[12px] border-base-300 bg-base-100 font-normal" onClick={onEdit}>
          Bearbeiten
        </button>
      </header>

      <section className="flex flex-wrap items-end gap-3.5">
        {bean.image_url ? (
          <img className="h-30 w-24 shrink-0 rounded-[14px] border border-base-300 object-cover" src={bean.image_url} alt="" />
        ) : (
          <button className="grid h-30 w-24 shrink-0 place-items-center rounded-[14px] border border-dashed border-(--line-strong) bg-base-100 text-muted" onClick={onEdit} aria-label="Packungsfoto hinzufügen">
            <Camera size={26} strokeWidth={1.5} aria-hidden />
          </button>
        )}
        <div className="min-w-0 grow basis-48">
          {bean.roaster && <span className="lbl">{bean.roaster}</span>}
          <h2 className="mt-1 text-[30px] leading-[1.05] tracking-[-0.025em]">{bean.name}</h2>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {bean.roast_level && <Chip>{ROAST_LEVELS[bean.roast_level]}</Chip>}
            <Chip tone={bean.active ? 'good' : undefined}>{bean.active ? 'Aktiv' : 'Archiv'}</Chip>
          </div>
        </div>
        <div className="hidden gap-2 desk:flex">
          <button className="btn h-10 rounded-[11px] border-(--line-strong) bg-transparent font-normal" onClick={onEdit}>
            Bearbeiten
          </button>
          {bean.active && (
            <button className="btn btn-primary h-10 rounded-[11px]" onClick={brew}>
              Bezug
            </button>
          )}
        </div>
      </section>

      <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-base-300 bg-base-300 desk:grid-cols-4">
        {info.map(([k, v]) => (
          <div key={k} className="bg-base-100 px-3 py-2.5 desk:bg-page">
            <dt className="lbl">{k}</dt>
            <dd className={`m-0 mt-0.5 ${k === 'Röstdatum' ? 'num' : ''}`}>{v || '–'}</dd>
          </div>
        ))}
        {bean.flavor_notes?.length > 0 && (
          <div className="col-span-2 bg-base-100 px-3 py-2.5 desk:col-span-4 desk:bg-page">
            <dt className="lbl">Aromen</dt>
            <dd className="m-0 mt-0.5">{bean.flavor_notes.join(' · ')}</dd>
          </div>
        )}
      </dl>

      <div className="flex flex-col gap-4.5 desk:flex-row desk:flex-wrap">
        {days != null && days >= 0 && (
          <section className="card min-w-0 desk:flex-1 desk:basis-64 gap-2.5 border border-base-300 bg-base-100 px-4 pt-3.5 pb-4 desk:bg-base-200">
            <div className="flex items-baseline justify-between gap-2">
              <span className="lbl">Frische</span>
              <span>
                <span className={`num text-[22px] font-semibold ${fresh?.tone === 'good' ? 'text-success' : 'text-warning'}`}>{days}</span>{' '}
                <span className="text-sm text-muted">Tage · {fresh?.label}</span>
              </span>
            </div>
            <FreshnessScale days={days} />
            <div className="num relative h-3.5 text-[11px] text-muted" aria-hidden>
              <span className="absolute left-0">0</span>
              <span className="absolute left-[8.3%]">5</span>
              <span className="absolute left-1/2 -translate-x-1/2">30</span>
              <span className="absolute right-0">60 T</span>
            </div>
          </section>
        )}

        <section className="card min-w-0 desk:flex-1 desk:basis-64 gap-3 border border-base-300 bg-base-100 px-4 pt-3.5 pb-4 desk:bg-base-200">
          <div className="flex items-baseline justify-between gap-2">
            <span className="lbl">Packung</span>
            {stock?.opened_at && <span className="num text-xs text-muted">geöffnet {fmtDay(stock.opened_at).slice(0, 6)}</span>}
          </div>
          {usage && stock ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="num text-[34px] font-semibold tracking-[-0.02em]">{Math.round(usage.remaining)}</span>
                <span className="num text-muted">/ {fmtGrams(stock.bag_weight_g)}</span>
                <span className="ml-auto text-sm text-muted">≈ {plural(usage.shotsLeft, 'Bezug', 'Bezüge')}</span>
              </div>
              {/* Restmenge in 10-g-Segmenten */}
              <div className="relative h-3 overflow-hidden rounded-[3px] bg-base-300" aria-hidden>
                <div className={`absolute inset-y-0 left-0 ${usage.remaining <= 0 ? '' : usage.shotsLeft <= 3 ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${usage.pct * 100}%` }} />
                <div
                  className="absolute inset-0"
                  style={{ background: `repeating-linear-gradient(90deg, transparent 0 calc(${(10 / Number(stock.bag_weight_g)) * 100}% - 1px), var(--color-base-100) 0 ${(10 / Number(stock.bag_weight_g)) * 100}%)` }}
                />
              </div>
              {cpg != null && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['Preis', fmtMoney(stock.price, stock.currency)],
                    ['pro 100 g', fmtMoney(cpg * 100, stock.currency)],
                    ['pro Tasse', fmtMoney(usage.perCup, stock.currency)],
                  ].map(([k, v], i) => (
                    <div key={k} className="min-w-0 rounded-[10px] bg-base-200 px-2.5 py-2 desk:bg-base-100">
                      <div className="lbl truncate">{k}</div>
                      <div className={`num font-semibold ${i === 2 ? 'text-accent-strong' : ''}`}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn h-11 rounded-[11px] border-(--line-strong) bg-transparent font-normal" onClick={openNewBag}>
                + Neue Packung anbrechen
              </button>
            </>
          ) : (
            <button className="btn h-11 rounded-[11px] border-(--line-strong) bg-transparent font-normal" onClick={onEdit}>
              + Packungsgröße &amp; Preis eintragen
            </button>
          )}
        </section>
      </div>

      {count > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="lbl">Dial-in-Verlauf · {plural(count, 'Bezug', 'Bezüge')}</h3>
            <span className="num text-xs text-muted">Wertung je Mahlgrad</span>
          </div>
          <div className="flex h-30 flex-row-reverse justify-end gap-1.5 rounded-[14px] border border-base-300 bg-base-100 p-2.5 desk:bg-page" aria-hidden>
            {history.map((h) => (
              <div key={h.id} className="flex h-full max-w-14 min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <span
                  className={`w-full rounded-[3px] ${h.id === best?.id ? 'bg-primary' : (h.rating ?? 0) >= 4 ? 'bg-success' : h.rating ? 'bg-(--line-strong)' : 'bg-base-300'}`}
                  style={{ height: `${h.rating ? (h.rating / 5) * 100 : 6}%` }}
                />
                <span className="num text-[11px] text-muted">{h.grind_setting || '–'}</span>
              </div>
            ))}
          </div>
          {best && (
            <div className="flex flex-wrap items-center gap-2.5 rounded-[14px] border border-primary/40 bg-primary/6 px-3.5 py-3">
              <div className="min-w-0 grow">
                <div className="lbl text-accent-strong">Bestbewertet{best.rating ? ` · ${best.rating.toFixed(1)}` : ''}</div>
                <div className="num mt-0.5 text-[13px]">
                  {best.dose ?? '–'}→{best.yield ?? '–'} g · {fmtRatio(ratio(best.dose, best.yield))} · {best.brew_time ?? '–'} s · {best.grind_setting || '–'}
                </div>
              </div>
              <button className="btn btn-primary h-10 rounded-[10px] text-[13px]" onClick={() => go('brew', { key: freshKey(), brew: best })}>
                Nutzen
              </button>
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-2 desk:justify-end">
        {bean.active && (
          <button className="btn btn-primary h-12 grow rounded-[13px] desk:hidden" onClick={brew}>
            Bezug mit dieser Bohne
          </button>
        )}
        <button className="btn h-12 rounded-[13px] border-(--line-strong) bg-transparent font-normal desk:h-10" onClick={onToggleActive}>
          {bean.active ? 'Aufgebraucht · ins Archiv' : 'Reaktivieren'}
        </button>
      </div>
    </article>
  )
}
