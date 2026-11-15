// Barcode → Bohnen-Daten: 1) Community (andere BeanBase-Nutzer), 2) Open Food Facts
import { supabase } from './supabase'

/** Nur Ziffern; gültig sind EAN-8, UPC-A (12), EAN-13, GTIN-14 */
export function normalizeBarcode(raw) {
  const c = String(raw ?? '').replace(/\D/g, '')
  return [8, 12, 13, 14].includes(c.length) ? c : null
}

/** GTIN-Prüfziffer (EAN-8/12/13/14) */
export function isValidGtin(code) {
  const c = normalizeBarcode(code)
  if (!c) return false
  const digits = c.split('').map(Number)
  const check = digits.pop()
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

async function lookupCommunity(code) {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('lookup_bean_by_barcode', { p_barcode: code })
  if (error) throw error
  const row = data?.[0]
  if (!row || (!row.name && !row.roaster)) return null
  return {
    source: 'community',
    users: row.user_count,
    data: {
      name: row.name,
      roaster: row.roaster,
      origin: row.origin,
      variety: row.variety,
      process: row.process,
      roast_level: row.roast_level,
      flavor_notes: row.flavor_notes ?? [],
    },
  }
}

const ROAST_HINTS = [
  [/\b(light|hell|filter)/i, 'light'],
  [/\b(dark|dunkel|dunkl|kräftig|strong|intens)/i, 'dark'],
  [/\b(medium|mittel|mittler)/i, 'medium'],
]
const PROCESS_HINTS = [
  [/\b(washed|gewaschen|lavado)\b/i, 'washed'],
  [/\b(natural|naturals?|dry[- ]processed|trocken)\b/i, 'natural'],
  [/\bhoney\b/i, 'honey'],
  [/\banaerob/i, 'anaerobic'],
]
const firstMatch = (text, list) => list.find(([re]) => re.test(text))?.[1] ?? null

async function lookupOpenFoodFacts(code) {
  const fields = 'product_name,product_name_de,brands,origins,origin,labels,categories_tags,generic_name'
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`)
  if (!res.ok) return null
  const json = await res.json()
  const p = json?.product
  if (json?.status !== 1 || !p) return null
  const isCoffee = (p.categories_tags ?? []).some((t) => /coffee|kaffee|cafe/.test(t))
  const name = (p.product_name_de || p.product_name || '').trim()
  if (!name) return null
  const text = [name, p.generic_name, p.labels].filter(Boolean).join(' ')
  return {
    source: 'openfoodfacts',
    isCoffee,
    data: {
      name,
      roaster: (p.brands ?? '').split(',')[0].trim() || null,
      origin: (p.origins || p.origin || '').trim() || null,
      process: firstMatch(text, PROCESS_HINTS),
      roast_level: firstMatch(text, ROAST_HINTS),
      flavor_notes: [],
    },
  }
}

/**
 * Sucht Bohnen-Daten zu einem Barcode.
 * → { source: 'community'|'openfoodfacts', data, users?, isCoffee? } oder null
 */
export async function lookupBarcode(raw) {
  const code = normalizeBarcode(raw)
  if (!code) return null
  try {
    const hit = await lookupCommunity(code)
    if (hit) return hit
  } catch {
    /* Community nicht verfügbar → weiter mit Open Food Facts */
  }
  try {
    return await lookupOpenFoodFacts(code)
  } catch {
    return null
  }
}
