/** Fehlermeldung aus catch – auch für Supabase-Fehlerobjekte ({ message }) */
export const errMsg = (e: unknown): string =>
  typeof e === 'object' && e !== null && 'message' in e ? String(e.message) : String(e)
