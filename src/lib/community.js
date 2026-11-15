import { supabase } from './supabase'

export const communityAvailable = !!supabase

/**
 * Anonymisierte Community-Werte für eine Bohne (Rösterei + Name).
 * → { all, grinder, setup } – jeweils null, wenn (noch) zu wenige Daten.
 */
export async function fetchCommunity({ roaster, name, grinderPreset, machineType, machinePreset }) {
  if (!supabase || !roaster?.trim() || (name?.trim().length ?? 0) < 3) return null
  const { data, error } = await supabase.rpc('get_community_recipes', {
    p_roaster: roaster,
    p_name: name,
    p_grinder_preset: grinderPreset ?? null,
    p_machine_type: machineType ?? null,
    p_machine_preset: machinePreset ?? null,
  })
  if (error) throw error
  const byScope = Object.fromEntries((data ?? []).map((r) => [r.scope, r]))
  return { all: byScope.all ?? null, grinder: byScope.grinder ?? null, setup: byScope.setup ?? null }
}

/** Spezifischster verfügbarer Datensatz: gleiche Mühle+Maschine > gleiche Mühle > alle */
export const bestScope = (c) => c?.setup ?? c?.grinder ?? c?.all ?? null

/** Mahlgrad passend zum Skalentyp runden */
export function roundGrind(value, scaleType) {
  if (value == null) return null
  const v = Number(value)
  if (scaleType === 'clicks') return Math.round(v)
  if (scaleType === 'numbers') return v < 5 ? Math.round(v * 10) / 10 : Math.round(v * 2) / 2
  return Math.round(v * 10) / 10
}

const num = (v) => (v == null ? null : Number(v))

/** Werte einer Community-Zeile für das Formular: kind = 'avg' | 'best' */
export function communityValues(row, kind, scaleType) {
  if (!row) return null
  const hasGrind = row.scope !== 'all'
  return kind === 'best'
    ? {
        dose: num(row.best_dose),
        yield: num(row.best_yield),
        temperature: num(row.best_temp),
        grind_setting: hasGrind ? roundGrind(row.best_grind, scaleType) : null,
        time: num(row.best_time),
      }
    : {
        dose: num(row.avg_dose),
        yield: num(row.avg_yield),
        temperature: num(row.avg_temp),
        grind_setting: hasGrind ? roundGrind(row.avg_grind, scaleType) : null,
        time: num(row.avg_time),
      }
}
