// Fachlogik & Labels

export const MACHINE_TYPES = {
  espresso: 'Siebträger / Espresso',
  pour_over: 'Handfilter (V60, Kalita …)',
  aeropress: 'AeroPress',
  french_press: 'French Press',
  moka: 'Mokkakanne',
  cold_brew: 'Cold Brew',
  other: 'Sonstiges',
}
export const SCALE_TYPES = { stepless: 'Stufenlos', clicks: 'Klicks', numbers: 'Zahlenskala' }
export const PROCESSES = { washed: 'Washed', natural: 'Natural', honey: 'Honey', anaerobic: 'Anaerob', other: 'Andere' }
export const ROAST_LEVELS = { light: 'Hell', medium: 'Mittel', dark: 'Dunkel' }

export function daysSince(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((today - d) / 86400000)
}

/** Frische-Einschätzung nach Tagen seit Röstung */
export function freshness(days) {
  if (days == null) return null
  if (days < 0) return { label: 'Röstdatum in der Zukunft', tone: 'muted' }
  if (days < 5) return { label: 'Ruht noch (Degassing)', tone: 'info' }
  if (days <= 30) return { label: 'Optimal', tone: 'good' }
  if (days <= 60) return { label: 'Lässt nach', tone: 'warn' }
  return { label: 'Alt', tone: 'bad' }
}

export function ratio(dose, yld) {
  const d = Number(dose)
  const y = Number(yld)
  if (!d || !y) return null
  return y / d
}
export const fmtRatio = (r) => (r == null ? '–' : `1:${r.toFixed(r < 10 ? 1 : 0)}`)

export function extractionLabel(v) {
  if (v == null) return '–'
  if (v <= -3) return 'Deutlich zu sauer'
  if (v < 0) return 'Leicht sauer'
  if (v === 0) return 'Perfekt ausgewogen'
  if (v < 3) return 'Leicht bitter'
  return 'Deutlich zu bitter'
}

/** Einfacher Dial-In-Hinweis aus Extraktion */
export function dialInHint(brew) {
  if (!brew || brew.extraction == null) return null
  if (brew.extraction < 0) return 'Unterextrahiert → feiner mahlen, länger laufen lassen oder Temperatur erhöhen.'
  if (brew.extraction > 0) return 'Überextrahiert → gröber mahlen, kürzer laufen lassen oder Temperatur senken.'
  return 'Sitzt! Diese Einstellung beibehalten.'
}

/** 1 Bezug / 2 Bezüge */
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

export const fmtDate = (iso) =>
  new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Letzter und bestbewerteter Bezug einer Bohne */
export function recipesForBean(brews, beanId) {
  const list = brews.filter((b) => b.bean_id === beanId).sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
  const last = list[0] ?? null
  const best =
    [...list]
      .filter((b) => b.rating)
      .sort((a, b) => b.rating - a.rating || Math.abs(a.extraction ?? 0) - Math.abs(b.extraction ?? 0) || (b.created_at > a.created_at ? 1 : -1))[0] ?? null
  return { last, best, count: list.length }
}
