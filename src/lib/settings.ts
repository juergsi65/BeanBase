// App-weite Einstellungen aus Supabase (app_settings), z. B. Video-Sperre im Beta-Test.
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { queryClient } from './query'

export interface AppSettings {
  video_uploads: boolean
  invite_required: boolean
}
export const DEFAULT_SETTINGS: AppSettings = { video_uploads: false, invite_required: false }

const settingsQuery = {
  queryKey: ['settings'],
  staleTime: Infinity,
  queryFn: async (): Promise<AppSettings> => {
    if (!supabase) return DEFAULT_SETTINGS
    const { data, error } = await supabase.from('app_settings').select('key,value')
    if (error) throw error
    return { ...DEFAULT_SETTINGS, ...Object.fromEntries((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value])) }
  },
}

/** Außerhalb von React: gecachte Einstellungen (force = neu laden). Fehler → Standardwerte. */
export const loadSettings = (force = false) =>
  (force ? queryClient.fetchQuery({ ...settingsQuery, staleTime: 0 }) : queryClient.ensureQueryData(settingsQuery)).catch(
    () => DEFAULT_SETTINGS,
  )

export const useSettings = () => useQuery(settingsQuery).data ?? DEFAULT_SETTINGS
