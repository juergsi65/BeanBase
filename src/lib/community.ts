import { supabase } from './supabase'
import { isNotDefined } from 'only-utils'
import type { MachineType, ScaleType } from '../types'

/** Zeile aus get_community_recipes (supabase/schema.sql) */
export interface CommunityRow {
  scope: 'all' | 'grinder' | 'setup'
  user_count: number
  brew_count: number
  avg_rating: number | null
  avg_dose: number | null
  avg_yield: number | null
  avg_time: number | null
  avg_temp: number | null
  avg_grind: number | null
  min_grind: number | null
  max_grind: number | null
  best_rating: number | null
  best_dose: number | null
  best_yield: number | null
  best_time: number | null
  best_temp: number | null
  best_grind: number | null
}
export type Community = Record<CommunityRow['scope'], CommunityRow | null>
export interface CommunityValues {
  dose: number | null
  yield: number | null
  temperature: number | null
  grind_setting: number | null
  time: number | null
}

export const communityAvailable = !!supabase

/**
 * Anonymisierte Community-Werte für eine Bohne (Rösterei + Name).
 * → { all, grinder, setup } – jeweils null, wenn (noch) zu wenige Daten.
 */
export async function fetchCommunity({
  roaster,
  name,
  grinderPreset,
  machineType,
  machinePreset,
}: {
  roaster?: string | null
  name?: string | null
  grinderPreset?: string | null
  machineType?: MachineType | null
  machinePreset?: string | null
}): Promise<Community | null> {
  if (!supabase || !roaster?.trim() || (name?.trim().length ?? 0) < 3) return null
  const { data, error } = await supabase.rpc('get_community_recipes', {
    p_roaster: roaster,
    p_name: name,
    p_grinder_preset: grinderPreset ?? null,
    p_machine_type: machineType ?? null,
    p_machine_preset: machinePreset ?? null,
  })
  if (error) throw error
  const byScope: Partial<Community> = Object.fromEntries(((data ?? []) as CommunityRow[]).map((r) => [r.scope, r]))
  return { all: byScope.all ?? null, grinder: byScope.grinder ?? null, setup: byScope.setup ?? null }
}

/** Spezifischster verfügbarer Datensatz: gleiche Mühle+Maschine > gleiche Mühle > alle */
export const bestScope = (c: Community | null | undefined): CommunityRow | null => c?.setup ?? c?.grinder ?? c?.all ?? null

/** Mahlgrad passend zum Skalentyp runden */
export function roundGrind(value: unknown, scaleType: ScaleType | null | undefined) {
  if (isNotDefined(value)) return null
  const v = Number(value)
  if (scaleType === 'clicks') return Math.round(v)
  if (scaleType === 'numbers') return v < 5 ? Math.round(v * 10) / 10 : Math.round(v * 2) / 2
  return Math.round(v * 10) / 10
}

const num = (v: unknown) => (isNotDefined(v) ? null : Number(v))

/** Werte einer Community-Zeile für das Formular: kind = 'avg' | 'best' */
export function communityValues(
  row: CommunityRow | null | undefined,
  kind: 'avg' | 'best',
  scaleType: ScaleType | null | undefined,
): CommunityValues | null {
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
