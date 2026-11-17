import { useEffect, useState } from 'react'
import { errMsg } from '../lib/errors'
import { communityAvailable, fetchCommunity, bestScope, communityValues, type Community, type CommunityValues } from '../lib/community'
import type { Grinder, Machine, MachineType } from '../types'

type TipState =
  | { status: 'idle' | 'loading'; result?: Community | null }
  | { status: 'done'; result: Community | null }
  | { status: 'error'; error: string }
import { MACHINE_TYPES } from '../lib/coffee'
import { findGrinderPreset, findMachinePreset } from '../data/presets'

/**
 * "Sofort-Check": zeigt anonymisierte Werte anderer Nutzer für diese Bohne.
 * onApply(values) – optional, übernimmt Werte in den Bezug.
 * onData(result)  – optional, meldet das Ergebnis an die Elternkomponente.
 */
export default function CommunityTip({
  roaster,
  name,
  grinder,
  machine,
  machineType,
  onApply,
  onData,
}: {
  roaster?: string | null
  name?: string | null
  grinder?: Pick<Grinder, 'preset_id' | 'name' | 'scale_type'> | null
  machine?: Pick<Machine, 'preset_id' | 'name' | 'type'> | null
  machineType?: MachineType | null
  onApply?: (v: CommunityValues) => void
  onData?: (c: Community | null) => void
}) {
  const [state, setState] = useState<TipState>({ status: 'idle' })
  const grinderPreset = grinder?.preset_id ?? null
  const machinePreset = machine?.preset_id ?? null
  const type = machineType ?? machine?.type ?? null

  useEffect(() => {
    if (!communityAvailable || !roaster?.trim() || (name?.trim().length ?? 0) < 3) {
      setState({ status: 'idle' })
      onData?.(null)
      return
    }
    let cancelled = false
    setState((s) => ({ status: 'loading', result: 'result' in s ? s.result : undefined }))
    const t = setTimeout(async () => {
      try {
        const result = await fetchCommunity({ roaster, name, grinderPreset, machineType: type, machinePreset })
        if (cancelled) return
        setState({ status: 'done', result })
        onData?.(result)
      } catch (e) {
        if (!cancelled) setState({ status: 'error', error: errMsg(e) })
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // onData bewusst nicht in den Abhängigkeiten (Callback-Identität ändert sich je Render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roaster, name, grinderPreset, machinePreset, type])

  if (!communityAvailable)
    return <p className="py-0.5 text-muted text-sm">🌍 Community-Check: verfügbar, sobald die App mit Supabase verbunden ist.</p>
  if (state.status === 'idle') return null
  if (state.status === 'loading') return <p className="py-0.5 text-muted text-sm">🌍 Suche Community-Werte …</p>
  if (state.status === 'error') return <p className="py-0.5 text-muted text-sm">🌍 Community-Check nicht verfügbar ({state.error})</p>

  if (state.status !== 'done') return null
  const row = bestScope(state.result)
  const methodLabel = type ? ` (${MACHINE_TYPES[type]})` : ''
  if (!row)
    return <p className="py-0.5 text-muted text-sm">🌍 Noch keine Community-Daten für diese Bohne{methodLabel} – du bist der/die Erste!</p>

  const grinderName = findGrinderPreset(grinderPreset)?.name ?? grinder?.name
  const machineName = findMachinePreset(machinePreset)?.name ?? machine?.name
  const avg = communityValues(row, 'avg', grinder?.scale_type)!
  const best = communityValues(row, 'best', grinder?.scale_type)!
  const head =
    row.scope === 'setup' ? (
      <>
        für deine <strong>{grinderName}</strong> + <strong>{machineName}</strong>
      </>
    ) : row.scope === 'grinder' ? (
      <>
        für diese Bohne auf deiner <strong>{grinderName}</strong>
      </>
    ) : (
      <>für diese Bohne{methodLabel}</>
    )
  const line = (v: CommunityValues) => (
    <>
      {v.grind_setting != null && (
        <>
          Mahlgrad <strong>{v.grind_setting}</strong> ·{' '}
        </>
      )}
      {v.dose ?? '–'} g → {v.yield ?? '–'} g{v.time != null && <> in {v.time} s</>}
      {v.temperature != null && <> · {v.temperature} °C</>}
    </>
  )

  return (
    <div className="community-tip flex flex-col gap-1.5 rounded-[14px] px-3.5 py-3">
      <div className="font-semibold">🌍 Community {head}</div>
      <div className="flex flex-col gap-px">
        <span className="text-[0.72rem] uppercase tracking-wider text-muted">Ø Durchschnitt</span>
        <span>{line(avg)}</span>
      </div>
      <div className="flex flex-col gap-px">
        <span className="text-[0.72rem] uppercase tracking-wider text-muted">★ Bestes Rezept ({row.best_rating}★)</span>
        <span>{line(best)}</span>
      </div>
      {row.min_grind != null && row.min_grind !== row.max_grind && (
        <p className="text-muted text-sm">
          Mahlgrad-Spanne {Number(row.min_grind)}–{Number(row.max_grind)}
        </p>
      )}
      <p className="text-muted text-sm">
        Ø {row.avg_rating} ★ aus {row.brew_count} gut bewerteten Bezügen von {row.user_count} Nutzern
      </p>
      {row.scope === 'all' && (
        <p className="text-muted text-sm">
          {grinderPreset
            ? 'Mahlgrad: noch zu wenige Daten für deine Mühle.'
            : 'Tipp: Verknüpfe deine Mühle unter „Setup“ mit einem Modell, um auch Mahlgrad-Werte zu sehen.'}
        </p>
      )}
      {onApply && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className="btn btn-primary grow mt-1" onClick={() => onApply(best)}>
            Rezept übernehmen
          </button>
          <button type="button" className="btn btn-ghost border-base-300 mt-1" onClick={() => onApply(avg)}>
            Ø übernehmen
          </button>
        </div>
      )}
    </div>
  )
}
