// Packung, Bestand & Kosten pro Tasse – Preise sind privat (Tabelle bean_stock, nur Besitzer).

export const CURRENCIES = { EUR: '€', CHF: 'CHF', USD: '$', GBP: '£' }
export const BAG_SIZES = [250, 500, 1000]

export function fmtMoney(value, currency = 'EUR') {
  if (value == null || isNaN(value)) return '–'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}
export const fmtGrams = (g) => (g == null ? '–' : g >= 1000 ? `${(g / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg` : `${Math.round(g)} g`)

export const stockOf = (beanId, stocks = []) => stocks.find((s) => s.bean_id === beanId) ?? null

export function costPerGram(stock) {
  const price = Number(stock?.price)
  const bag = Number(stock?.bag_weight_g)
  return stock?.price != null && price >= 0 && bag > 0 ? price / bag : null
}

/** Kosten eines Bezugs (Dosis × Preis/g) */
export function brewCost(brew, stocks) {
  const cpg = costPerGram(stockOf(brew.bean_id, stocks))
  const dose = Number(brew.dose)
  return cpg != null && dose > 0 ? { value: cpg * dose, currency: stockOf(brew.bean_id, stocks).currency } : null
}

const time = (v) => (v ? new Date(v).getTime() : 0)

/**
 * Verbrauch der aktuellen Packung: alle Bezüge seit "opened_at".
 * → { used, remaining, pct, shotsLeft, avgDose, cpg, perCup, currency } | null
 */
export function beanUsage(beanId, stocks, brews) {
  const stock = stockOf(beanId, stocks)
  const bag = Number(stock?.bag_weight_g)
  if (!stock || !(bag > 0)) return null
  const since = time(stock.opened_at ?? stock.created_at)
  const mine = brews.filter((b) => b.bean_id === beanId && time(b.created_at) >= since && Number(b.dose) > 0)
  const used = mine.reduce((s, b) => s + Number(b.dose), 0)
  const remaining = Math.max(0, bag - used)
  const recent = mine.slice(0, 5)
  const avgDose = recent.length ? recent.reduce((s, b) => s + Number(b.dose), 0) / recent.length : 18
  const cpg = costPerGram(stock)
  return {
    used,
    remaining,
    pct: remaining / bag,
    shotsLeft: Math.floor(remaining / avgDose),
    avgDose,
    cpg,
    perCup: cpg != null ? cpg * avgDose : null,
    currency: stock.currency ?? 'EUR',
    count: mine.length,
  }
}

/** Ausgaben für Kaffee in den letzten `days` Tagen (nur Bezüge mit bekanntem Preis) */
export function spending(brews, stocks, days = 30) {
  const from = Date.now() - days * 86400000
  const recent = brews.filter((b) => time(b.created_at) >= from)
  let total = 0
  let priced = 0
  const currencies = {}
  for (const b of recent) {
    const c = brewCost(b, stocks)
    if (!c) continue
    total += c.value
    priced++
    currencies[c.currency] = (currencies[c.currency] ?? 0) + 1
  }
  const currency = Object.entries(currencies).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'EUR'
  return { count: recent.length, priced, total, currency, perCup: priced ? total / priced : null }
}
