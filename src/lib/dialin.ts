// Dial-In-Assistent: Zielwerte bestimmen und Korrekturen vorschlagen.
// Faustregeln – bewusst einfach gehalten, keine Garantie für jede Bohne.
import { bestScope, communityValues, type Community } from './community'
import { findMachinePreset, findGrinderPreset, grinderScale } from '../data/presets'
import { scaleHint, shiftGrind, stepLabel, type GrindScale } from './grind'
import type { Bean, Brew, Grinder, Machine, MachineType, RoastLevel } from '../types'

type Range = [number, number]
interface Base {
  ratio: number
  temp: number
  time: Range
}
export type Source = 'own' | 'community' | 'base'
type RefBrew = Pick<Brew, 'dose' | 'yield' | 'temperature' | 'grind_setting' | 'extraction' | 'brew_time' | 'rating'>
export interface Own {
  best?: RefBrew | null
  last?: RefBrew | null
}
export interface Plan {
  type: MachineType | null
  roast: RoastLevel
  source: Source
  note: string | null
  grindNote: string | null
  dose: number | null
  yield: number | null
  temp: number | null
  time: Range | null
  grind: number | string | null
  ratio: number | null
}

/** Basiswerte je Brühmethode und Röstgrad (ratio = Output/Dosis, time in s) */
export const BASE: Partial<Record<MachineType, Record<RoastLevel, Base>>> = {
  espresso: {
    light: { ratio: 2.5, temp: 94, time: [28, 34] },
    medium: { ratio: 2, temp: 93, time: [25, 30] },
    dark: { ratio: 1.8, temp: 90, time: [22, 28] },
  },
  pour_over: {
    light: { ratio: 16, temp: 96, time: [150, 210] },
    medium: { ratio: 16, temp: 94, time: [150, 210] },
    dark: { ratio: 15, temp: 90, time: [140, 180] },
  },
  aeropress: {
    light: { ratio: 15, temp: 90, time: [90, 150] },
    medium: { ratio: 15, temp: 85, time: [90, 150] },
    dark: { ratio: 14, temp: 80, time: [90, 120] },
  },
  french_press: {
    light: { ratio: 16, temp: 95, time: [240, 270] },
    medium: { ratio: 16, temp: 94, time: [240, 270] },
    dark: { ratio: 15, temp: 92, time: [210, 240] },
  },
}
const DEFAULT_DOSE: Partial<Record<MachineType, number>> = { espresso: 18, pour_over: 15, aeropress: 15, french_press: 30 }
const ROAST_TEXT = { light: 'helle Röstung', medium: 'mittlere Röstung', dark: 'dunkle Röstung' }

export const fmtTime = (s: number) => (s >= 90 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')} min` : `${s} s`)
export const fmtRange = ([a, b]: Range) => (b >= 90 ? `${fmtTime(a)}–${fmtTime(b)}` : `${a}–${b} s`)

const toNum = (v: unknown): number | null => {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}

/** Mahlgrad anhand der Extraktion verschieben: sauer → feiner, bitter → gröber (in Einheiten der Mühle) */
export function adjustGrind(grind: unknown, extraction: number | null | undefined, scale: GrindScale) {
  const steps = extraction ? (Math.abs(extraction) >= 3 ? 2 : 1) : 0
  const r = steps ? shiftGrind(scale, grind, Math.sign(extraction!) * steps) : null
  if (!r) return { value: null, steps: 0, label: '', atLimit: false }
  if (!r.ticks) return { value: null, steps: 0, label: '', atLimit: true }
  return { value: r.value, steps, label: stepLabel(scale, r.ticks), atLimit: false }
}

/** Startwert laut Handbuch für die Brühmethode */
function manualStart(grinder: Pick<Grinder, 'preset_id'> | null | undefined, type: MachineType | null) {
  const start = findGrinderPreset(grinder?.preset_id)?.start
  if (!start || !type) return null
  return (type === 'espresso' ? start.espresso : type === 'moka' ? null : start.filter) ?? null
}

/**
 * Verfügbare Quellen für die Zielwerte.
 * own: eigener bester (≥4★) oder letzter Bezug · community · base: Röstgrad-Basiswert
 */
export function availableSources({ own, community }: { own?: Own | null; community?: Community | null }) {
  const s: Source[] = []
  if (own?.best || own?.last) s.push('own')
  if (bestScope(community)) s.push('community')
  s.push('base')
  return s
}

export const SOURCE_LABELS = { own: 'Mein Bezug', community: 'Community', base: 'Basiswert' }

/**
 * Zielwerte berechnen.
 * → { grind, grindNote, dose, yield, temp, time:[a,b], ratio, note, type, roast }
 */
export function buildPlan({
  source,
  bean,
  machine,
  grinder,
  own,
  community,
}: {
  source: Source
  bean?: Pick<Bean, 'roast_level'> | null
  machine?: Pick<Machine, 'type' | 'preset_id'> | null
  grinder?: Pick<Grinder, 'scale_type' | 'preset_id'> | null
  own?: Own | null
  community?: Community | null
}): Plan {
  const mt = machine?.type
  const type: MachineType | null = mt ? (BASE[mt] ? mt : null) : 'espresso'
  const roast: RoastLevel = bean?.roast_level ?? 'medium'
  const base = type ? (BASE[type]?.[roast] ?? null) : null
  const presetDefaults = findMachinePreset(machine?.preset_id)?.defaults
  const scale = grinderScale(grinder)
  const plan: Plan = { type, roast, source, note: null, grindNote: null, dose: null, yield: null, temp: null, time: null, grind: null, ratio: null }
  const goodBest = own?.best && (own.best.rating ?? 0) >= 4 ? own.best : null
  const ref = goodBest ?? own?.last
  const row = bestScope(community)

  if (source === 'own' && ref) {
    plan.dose = toNum(ref.dose)
    plan.yield = toNum(ref.yield)
    plan.temp = toNum(ref.temperature)
    const adj = adjustGrind(ref.grind_setting, ref.extraction, scale)
    plan.grind = adj.value ?? (ref.grind_setting || null)
    if (adj.steps) {
      plan.note = `Dein ${goodBest ? 'bester' : 'letzter'} Bezug war ${(ref.extraction ?? 0) < 0 ? 'zu sauer' : 'zu bitter'} (Mahlgrad ${ref.grind_setting}) → diesmal ${adj.label} ${(ref.extraction ?? 0) < 0 ? 'feiner' : 'gröber'}.`
    } else {
      plan.note = goodBest ? `Basierend auf deinem besten Bezug (${goodBest.rating}★).` : 'Basierend auf deinem letzten Bezug.'
    }
    const t = toNum(ref.brew_time)
    plan.time = t && !ref.extraction ? [t - 2, t + 2] : (base?.time ?? (t ? [t - 3, t + 3] : null))
  } else if (source === 'community' && row) {
    const v = communityValues(row, 'avg', scale)!
    plan.dose = v.dose
    plan.yield = v.yield
    plan.temp = v.temperature
    plan.grind = v.grind_setting
    plan.time = v.time ? [v.time - 3, v.time + 3] : (base?.time ?? null)
    plan.note = `Community-Durchschnitt aus ${row.brew_count} Bezügen (Ø ${row.avg_rating}★).`
    if (plan.grind == null) plan.grindNote = 'Für deine Mühle gibt es noch keine Community-Mahlgrade.'
  } else {
    const dose = presetDefaults?.dose ?? (type && DEFAULT_DOSE[type]) ?? 18
    plan.dose = dose
    plan.yield = base ? Math.round(dose * base.ratio * 2) / 2 : (presetDefaults?.yield ?? null)
    plan.temp = base?.temp ?? presetDefaults?.temperature ?? null
    plan.time = base?.time ?? null
    plan.grind = manualStart(grinder, type)
    if (plan.grind != null) plan.grindNote = 'Startwert laut Handbuch des Herstellers.'
    plan.note = base
      ? `Faustregel für ${ROAST_TEXT[roast]}${bean?.roast_level ? '' : ' (Röstgrad unbekannt)'}: Ratio 1:${base.ratio}, ${base.temp} °C.`
      : 'Für diese Brühmethode gibt es keine Basiswerte – trage deine eigenen ein.'
  }

  if (plan.grind == null && !plan.grindNote) {
    const presetNote = findGrinderPreset(grinder?.preset_id)?.notes
    plan.grindNote = presetNote ? `Hinweis zum Modell: ${presetNote}` : `Starte in der Mitte des Bereichs deiner Mühle für diese Methode (${scaleHint(scale)}).`
  }
  plan.ratio = plan.dose && plan.yield ? plan.yield / plan.dose : null
  return plan
}

/**
 * Korrekturhilfe nach dem Bezug.
 * → { tone: 'good'|'sour'|'bitter'|'none', title, tips: string[] }
 */
export function correction({
  extraction,
  grind,
  scale,
  temperature,
  brewTime,
  targetTime,
  type = 'espresso',
}: {
  extraction: number | null | undefined
  grind: unknown
  scale: GrindScale
  temperature?: unknown
  brewTime?: unknown
  targetTime?: Range | null
  type?: MachineType | null
}): { tone: 'good' | 'sour' | 'bitter' | 'none'; title: string | null; tips: string[] } {
  const tips: string[] = []
  const t = toNum(temperature)
  const time = toNum(brewTime)
  const espresso = type === 'espresso'

  if (extraction == null) return { tone: 'none', title: null, tips }
  if (extraction === 0) {
    const r = { tone: 'good' as const, title: 'Ausgewogen – diese Einstellung beibehalten. 👌', tips }
    if (time && targetTime && (time < targetTime[0] || time > targetTime[1]))
      tips.push(`Geschmack passt, auch wenn die Zeit (${fmtTime(time)}) außerhalb von ${fmtRange(targetTime)} liegt – der Geschmack zählt.`)
    return r
  }

  const sour = extraction < 0
  const adj = adjustGrind(grind, extraction, scale)
  const dir = sour ? 'feiner' : 'gröber'
  tips.push(
    adj.atLimit
      ? `Mahlgrad steht schon am ${sour ? 'feinen' : 'groben'} Ende der Skala${scale.kind === 'number' && scale.ring ? ` – Innenring um 1 ${dir} stellen (laut Handbuch immer nur 1 Schritt)` : ''}`
      : adj.value != null
      ? `Mahlgrad ${adj.label} ${dir}: ${grind} → ${adj.value}`
      : `Mahlgrad ${Math.abs(extraction) >= 3 ? '2' : '1'} Stufe(n) ${dir} stellen`,
  )
  if (t) tips.push(`oder Temperatur ${sour ? '+1' : '−1'} °C → ${Math.round((t + (sour ? 1 : -1)) * 10) / 10} °C`)
  if (espresso) tips.push(sour ? 'oder mehr Output (längere Ratio, z. B. 1:2 → 1:2.3)' : 'oder Bezug früher stoppen (kürzere Ratio)')
  else tips.push(sour ? 'oder länger ziehen lassen / langsamer gießen' : 'oder kürzer ziehen lassen / zügiger gießen')

  if (time && targetTime) {
    if (sour && time < targetTime[0]) tips.unshift(`Zu schnell (${fmtTime(time)} statt ${fmtRange(targetTime)}) – feiner mahlen ist der wichtigste Hebel.`)
    if (!sour && time > targetTime[1]) tips.unshift(`Zu langsam (${fmtTime(time)} statt ${fmtRange(targetTime)}) – gröber mahlen ist der wichtigste Hebel.`)
  }
  return {
    tone: sour ? 'sour' : 'bitter',
    title: sour ? 'Zu sauer = unterextrahiert' : 'Zu bitter = überextrahiert',
    tips,
  }
}

/** Vorbereitungs-Hinweis je Methode */
export function prepText(machine: Pick<Machine, 'type' | 'preset_id' | 'notes'> | null | undefined) {
  const type = machine?.type ?? 'espresso'
  const e61 = /E61/i.test(findMachinePreset(machine?.preset_id)?.notes ?? machine?.notes ?? '')
  switch (type) {
    case 'espresso':
      return `Maschine ${e61 ? 'ca. 25–30 min (E61-Gruppe)' : 'vollständig'} aufheizen, Siebträger eingespannt mit aufheizen, kurzer Leerbezug zum Spülen. Tasse vorwärmen.`
    case 'pour_over':
      return 'Papierfilter mit heißem Wasser ausspülen (Papiergeschmack), Kanne und Tasse vorwärmen, Spülwasser wegschütten.'
    case 'aeropress':
      return 'Filter anfeuchten, AeroPress und Tasse mit heißem Wasser vorwärmen.'
    case 'french_press':
      return 'Kanne mit heißem Wasser vorwärmen und ausleeren.'
    case 'moka':
      return 'Kessel mit vorgeheiztem Wasser bis knapp unter das Ventil füllen, Sieb locker füllen (nicht tampen).'
    default:
      return 'Gerät und Tasse vorwärmen.'
  }
}
