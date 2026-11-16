// App-weite Einstellungen aus Supabase (app_settings), z. B. Video-Sperre im Beta-Test.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const DEFAULT_SETTINGS = { video_uploads: false, invite_required: false }
let cache = null
let pending = null
const listeners = new Set()

export async function loadSettings(force = false) {
  if (!supabase) return DEFAULT_SETTINGS
  if (cache && !force) return cache
  if (!pending || force) {
    pending = supabase
      .from('app_settings')
      .select('key,value')
      .then(({ data, error }) => {
        if (error) return DEFAULT_SETTINGS
        cache = { ...DEFAULT_SETTINGS, ...Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) }
        listeners.forEach((fn) => fn(cache))
        return cache
      })
  }
  return pending
}

export function useSettings() {
  const [settings, setSettings] = useState(cache ?? DEFAULT_SETTINGS)
  useEffect(() => {
    listeners.add(setSettings)
    loadSettings().then(setSettings)
    return () => listeners.delete(setSettings)
  }, [])
  return settings
}
