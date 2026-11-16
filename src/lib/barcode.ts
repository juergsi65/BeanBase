// Barcode → Bohnen-Daten: 1) Community (andere BeanBase-Nutzer), 2) Open Food Facts
import { supabase } from './supabase'
import type { Bean, Process, RoastLevel } from '../types'

export type BeanFields = Partial<Pick<Bean, 'name' | 'roaster' | 'origin' | 'variety' | 'process' | 'roast_level' | 'roast_date' | 'flavor_notes' | 'barcode'>>
export type BarcodeSource = 'community' | 'openfoodfacts' | 'upcitemdb'
export type BarcodeHit =
  | { source: BarcodeSource; data: BeanFields; users?: number; notCoffee?: undefined }
  | { source: BarcodeSource; notCoffee: true; productName: string }

/** Nur Ziffern; gültig sind EAN-8, UPC-A (12), EAN-13, GTIN-14 */
export function normalizeBarcode(raw: unknown): string | null {
  const c = String(raw ?? '').replace(/\D/g, '')
  return [8, 12, 13, 14].includes(c.length) ? c : null
}

/** GTIN-Prüfziffer (EAN-8/12/13/14) */
export function isValidGtin(code: unknown) {
  const c = normalizeBarcode(code)
  if (!c) return false
  const digits = c.split('').map(Number)
  const check = digits.pop()
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

async function lookupCommunity(code: string): Promise<BarcodeHit | null> {
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

const ROAST_HINTS: [RegExp, RoastLevel][] = [
  [/\b(light|hell|filter)/i, 'light'],
  [/\b(dark|dunkel|dunkl|kräftig|strong|intens)/i, 'dark'],
  [/\b(medium|mittel|mittler)/i, 'medium'],
]
const PROCESS_HINTS: [RegExp, Process][] = [
  [/\b(washed|gewaschen|lavado)\b/i, 'washed'],
  [/\b(natural|naturals?|dry[- ]processed|trocken)\b/i, 'natural'],
  [/\bhoney\b/i, 'honey'],
  [/\banaerob/i, 'anaerobic'],
]
const firstMatch = <T,>(text: string, list: [RegExp, T][]): T | null => list.find(([re]) => re.test(text))?.[1] ?? null

// --- Kaffee-Filter -------------------------------------------------------------
const COFFEE_RE = /(kaffee|coffee|caf[eé]|caff[eè]|espresso|ristretto|arabica|robusta|cold[- ]?brew)/i
// Produkte, die zwar "Kaffee" im Namen/der Kategorie tragen, aber keine Bohnen/kein Kaffeepulver sind
const NOT_COFFEE_RE = /(drinks?|getr[äa]nk|iced|eiskaffee|\beis\b|milk|milch|latte-?macchiato|cappuccino-?drink|chocolate|schokolad|candies|s[üu]ßwaren|biscuit|keks|cookie|ice-?cream|liqueur|lik[öo]r|cake|kuchen|yoghurt|joghurt|dessert|bonbon|sahne|creamer|weißer|filtert[üu]te|filterpapier|entkalk|reinig|cleaner|descal|filters\b|machine|maschine|kitchen|appliance|\bmugs?\b|tasse|grinder|m[üu]hle)/i

/**
 * true = Kaffee, false = eindeutig kein Kaffee.
 * Kategorien haben Vorrang vor dem Produktnamen ("Kaffee-Schokolade" ist Schokolade).
 */
export function isCoffeeProduct({ name = '', categories = [] }: { name?: string; categories?: (string | null | undefined)[] }) {
  const cats = categories.filter((c): c is string => !!c)
  if (cats.length) {
    // Kaffee nur, wenn eine Kategorie Kaffee ist und keine auf ein anderes Produkt hinweist
    const coffeeCat = cats.some((c) => COFFEE_RE.test(c) && !NOT_COFFEE_RE.test(c))
    const otherCat = cats.some((c) => NOT_COFFEE_RE.test(c))
    return coffeeCat && !(otherCat && NOT_COFFEE_RE.test(name))
  }
  return COFFEE_RE.test(name) && !NOT_COFFEE_RE.test(name)
}

function fromText({
  source,
  name,
  brand,
  origin,
  extraText,
}: {
  source: BarcodeSource
  name: string
  brand?: string
  origin?: string
  extraText?: string
}): BarcodeHit {
  const text = [name, extraText].filter(Boolean).join(' ')
  return {
    source,
    data: {
      name,
      roaster: brand || null,
      origin: origin || null,
      process: firstMatch(text, PROCESS_HINTS),
      roast_level: firstMatch(text, ROAST_HINTS),
      flavor_notes: [],
    },
  }
}

/** Open Food Facts – größte freie Lebensmitteldatenbank */
async function lookupOpenFoodFacts(code: string): Promise<BarcodeHit | null> {
  const fields = 'product_name,product_name_de,brands,origins,origin,labels,categories_tags,categories,generic_name'
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`)
  if (!res.ok) return null
  const json = await res.json()
  const p = json?.product
  if (json?.status !== 1 || !p) return null
  const name = (p.product_name_de || p.product_name || p.generic_name || '').trim()
  if (!name) return null
  const categories = [...(p.categories_tags ?? []), ...(p.categories ? p.categories.split(',') : [])]
  if (!isCoffeeProduct({ name, categories })) return { source: 'openfoodfacts', notCoffee: true, productName: name }
  return fromText({
    source: 'openfoodfacts',
    name,
    brand: (p.brands ?? '').split(',')[0].trim(),
    origin: (p.origins || p.origin || '').trim(),
    extraText: [p.generic_name, p.labels].filter(Boolean).join(' '),
  })
}

/**
 * UPCitemdb (Trial-API, ~100 Abfragen/Tag) – v. a. internationale/US-Produkte.
 * Läuft über den eigenen Worker-Endpunkt /api/upc, weil UPCitemdb keine Browser-Anfragen (CORS) erlaubt.
 */
async function lookupUpcItemDb(code: string): Promise<BarcodeHit | null> {
  const res = await fetch(`/api/upc/${code}`)
  if (!res.ok) return null
  const json = await res.json()
  const item = json?.items?.[0]
  const name = (item?.title ?? '').trim()
  if (!name) return null
  const categories = item.category ? item.category.split('>').map((c: string) => c.trim()) : []
  if (!isCoffeeProduct({ name, categories })) return { source: 'upcitemdb', notCoffee: true, productName: name }
  return fromText({ source: 'upcitemdb', name, brand: (item.brand ?? '').trim(), extraText: item.description })
}

const quiet = (fn: (code: string) => Promise<BarcodeHit | null>) => async (code: string) => {
  try {
    return await fn(code)
  } catch {
    return null // Netzwerk/CORS/Limit → nächste Quelle
  }
}

/**
 * Sucht Bohnen-Daten zu einem Barcode – kaskadierend:
 * BeanBase-Community → Open Food Facts → UPCitemdb.
 * → { source, data, users? } | { source, notCoffee: true, productName } | null
 */
export async function lookupBarcode(raw: unknown): Promise<BarcodeHit | null> {
  const code = normalizeBarcode(raw)
  if (!code) return null
  for (const source of [quiet(lookupCommunity), quiet(lookupOpenFoodFacts), quiet(lookupUpcItemDb)]) {
    const hit = await source(code)
    if (hit) return hit // auch "kein Kaffee" ist eine eindeutige Antwort → abbrechen
  }
  return null
}
