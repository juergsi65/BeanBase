import { useEffect, useState } from 'react'
import { communityAvailable, fetchCommunity, roundGrind } from '../lib/community'
import { MACHINE_TYPES } from '../lib/coffee'
import { findGrinderPreset } from '../data/presets'

/**
 * "Sofort-Check": zeigt anonymisierte Werte anderer Nutzer für diese Bohne.
 * onApply(values) – optional, übernimmt Werte in den Bezug.
 */
export default function CommunityTip({ roaster, name, grinder, machineType, onApply }) {
  const [state, setState] = useState({ status: 'idle' })
  const grinderPreset = grinder?.preset_id ?? null

  useEffect(() => {
    if (!communityAvailable || !roaster?.trim() || (name?.trim().length ?? 0) < 3) {
      setState({ status: 'idle' })
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, status: 'loading' }))
    const t = setTimeout(async () => {
      try {
        const result = await fetchCommunity({ roaster, name, grinderPreset, machineType })
        if (!cancelled) setState({ status: 'done', result })
      } catch (e) {
        if (!cancelled) setState({ status: 'error', error: e.message })
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [roaster, name, grinderPreset, machineType])

  if (!communityAvailable)
    return <p className="community muted small">🌍 Community-Check: verfügbar, sobald die App mit Supabase verbunden ist.</p>
  if (state.status === 'idle') return null
  if (state.status === 'loading') return <p className="community muted small">🌍 Suche Community-Werte …</p>
  if (state.status === 'error') return <p className="community muted small">🌍 Community-Check nicht verfügbar ({state.error})</p>

  const { all, grinder: g } = state.result ?? {}
  const methodLabel = machineType ? ` (${MACHINE_TYPES[machineType]})` : ''
  if (!all)
    return <p className="community muted small">🌍 Noch keine Community-Daten für diese Bohne{methodLabel} – du bist der/die Erste!</p>

  const row = g ?? all
  const grind = g ? roundGrind(g.avg_grind, grinder?.scale_type) : null
  const apply = () =>
    onApply({
      dose: row.avg_dose != null ? Number(row.avg_dose) : null,
      yield: row.avg_yield != null ? Number(row.avg_yield) : null,
      temperature: row.avg_temp != null ? Number(row.avg_temp) : null,
      grind_setting: grind,
    })

  return (
    <div className="community card-inner">
      <div className="community-head">
        🌍 {g ? <>Community-Tipp für deine <strong>{findGrinderPreset(grinderPreset)?.name ?? grinder.name}</strong></> : <>Community-Tipp{methodLabel}</>}
      </div>
      {g && grind != null && (
        <div className="community-grind">
          Mahlgrad <strong>{grind}</strong>
          {g.min_grind != null && g.min_grind !== g.max_grind && (
            <span className="muted small">
              {' '}
              (Spanne {Number(g.min_grind)}–{Number(g.max_grind)})
            </span>
          )}
        </div>
      )}
      <p>
        {row.avg_dose ?? '–'} g → {row.avg_yield ?? '–'} g{row.avg_time != null && <> in {row.avg_time} s</>}
        {row.avg_temp != null && <> · {row.avg_temp} °C</>}
      </p>
      <p className="muted small">
        Ø {row.avg_rating} ★ aus {row.brew_count} gut bewerteten Bezügen von {row.user_count} Nutzern
      </p>
      {!g && (
        <p className="muted small">
          {grinderPreset
            ? 'Mahlgrad: noch zu wenige Daten für deine Mühle.'
            : 'Tipp: Verknüpfe deine Mühle unter „Setup“ mit einem Modell, um auch Mahlgrad-Werte zu sehen.'}
        </p>
      )}
      {onApply && (
        <button type="button" className="btn primary block" onClick={apply}>
          Werte in meinen Bezug übernehmen
        </button>
      )}
    </div>
  )
}
