// Mahlgrad-Skalen: Notation lesen/schreiben, Korrekturen in echten Mühlen-Einheiten.
// Jede Skala hat eine kanonische Position `pos` (Dezimalzahl in der Haupteinheit der Mühle,
// kleiner = feiner). Damit sind Altwerte wie "1.5" oder "12" weiterhin gültig und
// die Community-Durchschnitte bleiben vergleichbar.
import type { ScaleType } from '../types'

interface Common {
  /** Kleinste Schritte pro Korrekturstufe (Standard 1) */
  adjust?: number
  /** Name der kleinsten Einheit [Einzahl, Mehrzahl], z. B. ['Klick', 'Klicks'] */
  unitName?: [string, string]
}
/** Innerer Mahlring (z. B. Sage: obere Mahlscheibe), selten verstellt */
export interface Ring {
  min: number
  max: number
  default: number
}
export type GrindScale = Common &
  (
    | { kind: 'number'; min: number; max: number; step: number; ring?: Ring }
    | { kind: 'clicks'; max: number; perRotation?: number }
    /** Hauptzahl + Unterstufe, z. B. Sette "9E" oder Fellow Ode "3.1" */
    | { kind: 'compound'; min: number; max: number; subs: string[] }
    /** 1Zpresso Umdrehung.Zahl.Klick, z. B. "1.5.2" */
    | { kind: 'rotation'; numbers: number; clicks: number; maxRot: number }
    /** Stufenlos ohne feste Skala – freier Text, Zahlen werden erkannt */
    | { kind: 'free'; numeric?: boolean }
  )

export interface GrindValue {
  pos: number
  ring?: number
}

const toNum = (v: unknown): number | null => {
  if (v === '' || v == null) return null
  const n = Number(String(v).trim().replace(',', '.'))
  return isNaN(n) ? null : n
}
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d
const decimalsOf = (step: number) => (String(step).split('.')[1] ?? '').length

/** Fallback für eigene Mühlen ohne Modell */
export function fallbackScale(scaleType: ScaleType | null | undefined): GrindScale {
  if (scaleType === 'clicks') return { kind: 'clicks', max: 999 }
  return { kind: 'free', numeric: scaleType === 'numbers' }
}

/** Kleinste Einheit der Skala (in pos) */
export function unitOf(scale: GrindScale, pos?: number | null): number {
  switch (scale.kind) {
    case 'number':
      return scale.step
    case 'clicks':
      return 1
    case 'compound':
      return 1 / scale.subs.length
    case 'rotation':
      return 1 / (scale.numbers * scale.clicks)
    case 'free':
      // Annahme wie bisher: kleine Werte sind Umdrehungen o. Ä.
      return pos != null && Math.abs(pos) < 5 ? 0.1 : scale.numeric ? 0.5 : 1
  }
}

/** Notation → Position. Unbekanntes Format → null */
export function parseGrind(scale: GrindScale, input: unknown): GrindValue | null {
  if (input == null || input === '') return null
  if (typeof input === 'number') return isNaN(input) ? null : { pos: input }
  const s = String(input).trim()
  switch (scale.kind) {
    case 'number': {
      const m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*(?:\(?\s*(?:innerer\s+)?(?:ring|r)\s*(\d+)\s*\)?)?$/i)
      if (!m) return null
      const pos = toNum(m[1])!
      return m[2] ? { pos, ring: Number(m[2]) } : { pos }
    }
    case 'compound': {
      const m = s.match(/^(\d+)\s*(.*)$/)
      if (!m) return null
      const main = Number(m[1])
      const rest = m[2].trim().toLowerCase()
      let idx = scale.subs.findIndex((l) => l.trim().toLowerCase() === rest)
      // Altnotation "8.3" bei Buchstaben-Unterstufen (A = 1)
      if (idx < 0 && /^[.,]\d$/.test(rest) && /^[a-z]$/i.test(scale.subs[0])) idx = Number(rest[1]) - 1
      if (idx < 0 || idx >= scale.subs.length) {
        const n = toNum(s)
        return n == null ? null : { pos: n }
      }
      return { pos: round(main + idx / scale.subs.length) }
    }
    case 'rotation': {
      const parts = s.split(/[.,]/)
      if (parts.every((p) => /^\d+$/.test(p)) && parts.length <= 3) {
        const [r, n = '0', c = '0'] = parts
        if (n.length === 1 && Number(c) < scale.clicks)
          return { pos: round(Number(r) + Number(n) / scale.numbers + Number(c) / (scale.numbers * scale.clicks)) }
      }
      const n = toNum(s)
      return n == null ? null : { pos: n }
    }
    case 'clicks':
    case 'free': {
      const n = toNum(s.replace(/\s*klicks?$/i, ''))
      return n == null ? null : { pos: n }
    }
  }
}

/** Position → Notation der Mühle (auf die kleinste Einheit gerundet) */
export function formatGrind(scale: GrindScale, v: GrindValue | number | null | undefined): string {
  if (v == null) return ''
  const { pos, ring } = typeof v === 'number' ? { pos: v, ring: undefined } : v
  switch (scale.kind) {
    case 'number': {
      const n = (Math.round(pos / scale.step) * scale.step).toFixed(decimalsOf(scale.step))
      return scale.ring && ring != null && ring !== scale.ring.default ? `${n} (Ring ${ring})` : n
    }
    case 'clicks':
      return String(Math.round(pos))
    case 'compound': {
      const k = scale.subs.length
      const ticks = Math.round(pos * k)
      const main = Math.floor(ticks / k)
      return `${main}${scale.subs[ticks - main * k]}`
    }
    case 'rotation': {
      const per = scale.numbers * scale.clicks
      const ticks = Math.round(pos * per)
      const r = Math.floor(ticks / per)
      const n = Math.floor((ticks - r * per) / scale.clicks)
      const c = ticks - r * per - n * scale.clicks
      return c ? `${r}.${n}.${c}` : `${r}.${n}`
    }
    case 'free':
      return String(round(pos, 2))
  }
}

function limits(scale: GrindScale): [number, number] {
  switch (scale.kind) {
    case 'number':
    case 'compound':
      return [scale.min, scale.max]
    case 'clicks':
      return [0, scale.max]
    case 'rotation':
      return [0, scale.maxRot]
    case 'free':
      return [-Infinity, Infinity]
  }
}

/** Um `stufen` Korrekturstufen verschieben (+ = gröber). Ring bleibt erhalten. */
export function shiftGrind(scale: GrindScale, input: unknown, stufen: number) {
  const v = parseGrind(scale, input)
  if (!v) return null
  const unit = unitOf(scale, v.pos)
  const ticks = stufen * (scale.kind === 'free' ? 1 : (scale.adjust ?? 1))
  const [lo, hi] = limits(scale)
  const pos = Math.min(hi, Math.max(lo, round(Math.round(v.pos / unit) * unit + ticks * unit)))
  // tatsächlich gefahrene Schritte (am Skalenende ggf. weniger)
  const moved = Math.round(Math.abs(pos - v.pos) / unit)
  return { value: formatGrind(scale, { pos, ring: v.ring }), ticks: moved, pos }
}

/**
 * Position für den Community-Vergleich. Bei verstelltem Innenring (≠ Werkseinstellung)
 * null – die Außenskala ist dann nicht mit anderen Nutzern vergleichbar.
 */
export function grindPos(scale: GrindScale, input: unknown): number | null {
  const v = parseGrind(scale, input)
  if (!v) return null
  if (scale.kind === 'number' && scale.ring && v.ring != null && v.ring !== scale.ring.default) return null
  return v.pos
}

/** Beschreibung der Korrektur in Mühlen-Einheiten, z. B. "2 Klicks" */
export function stepLabel(scale: GrindScale, ticks: number): string {
  const n = ticks
  if (scale.unitName) return `${n} ${scale.unitName[n === 1 ? 0 : 1]}`
  switch (scale.kind) {
    case 'clicks':
    case 'rotation':
      return `${n} Klick${n === 1 ? '' : 's'}`
    case 'compound':
      return /^[a-z]$/i.test(scale.subs[1] ?? '') ? `${n} Mikroschritt${n === 1 ? '' : 'e'}` : `${n} Zwischenstufe${n === 1 ? '' : 'n'}`
    case 'number':
      return scale.step === 1 ? `${n} Stufe${n === 1 ? '' : 'n'}` : `${round(n * scale.step, 2)} auf der Skala`
    case 'free':
      return `${n} Stufe${n === 1 ? '' : 'n'}`
  }
}

/** Kurze Lesehilfe zur Notation */
export function scaleHint(scale: GrindScale): string {
  switch (scale.kind) {
    case 'number':
      return `Skala ${scale.min}–${scale.max}, kleiner = feiner${scale.ring ? ` · innerer Ring Werkseinstellung ${scale.ring.default}` : ''}`
    case 'clicks':
      return `Klicks ab Nullpunkt (ganz zu), weniger = feiner${scale.perRotation ? ` · ${scale.perRotation} Klicks/Umdrehung` : ''}`
    case 'compound':
      return /^[a-z]$/i.test(scale.subs[1] ?? '')
        ? `Makro ${scale.min}–${scale.max} + Mikro ${scale.subs[0]}–${scale.subs[scale.subs.length - 1]}, kleiner/früher = feiner`
        : `Skala ${scale.min}–${scale.max} mit ${scale.subs.length - 1} Zwischenstufen (z. B. ${scale.min}${scale.subs[1]}), kleiner = feiner`
    case 'rotation':
      return `Umdrehung.Zahl.Klick ab Nullpunkt (${scale.numbers} Zahlen × ${scale.clicks} Klicks = ${scale.numbers * scale.clicks} Klicks/Umdrehung), kleiner = feiner`
    case 'free':
      return 'Stufenlos – Wert ab deinem Nullpunkt notieren'
  }
}
