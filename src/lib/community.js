import { supabase } from './supabase'

export const communityAvailable = !!supabase

/**
 * Anonymisierte Community-Werte für eine Bohne (Rösterei + Name).
 * → { all, grinder } – jeweils null, wenn (noch) zu wenige Daten.
 */
export async function fetchCommunity({ roaster, name, grinderPreset, machineType }) {
  if (!supabase || !roaster?.trim() || (name?.trim().length ?? 0) < 3) return null
  const { data, error } = await supabase.rpc('get_community_recipes', {
    p_roaster: roaster,
    p_name: name,
    p_grinder_preset: grinderPreset ?? null,
    p_machine_type: machineType ?? null,
  })
  if (error) throw error
  const byScope = Object.fromEntries((data ?? []).map((r) => [r.scope, r]))
  return { all: byScope.all ?? null, grinder: byScope.grinder ?? null }
}

/** Mahlgrad passend zum Skalentyp runden */
export function roundGrind(value, scaleType) {
  if (value == null) return null
  const v = Number(value)
  if (scaleType === 'clicks') return Math.round(v)
  if (scaleType === 'numbers') return Math.round(v * 2) / 2
  return Math.round(v * 10) / 10
}
