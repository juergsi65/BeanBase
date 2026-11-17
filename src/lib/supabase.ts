import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** null => lokaler Demo-Modus (localStorage) */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const isLocalMode = !supabase

/** Für Funktionen, die nur mit Konto existieren (Social, Admin, Medien-Upload) */
export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Nur mit Konto (Supabase) verfügbar.')
  return supabase
}
