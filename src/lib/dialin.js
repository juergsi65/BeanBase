// Dial-In-Assistent: Zielwerte bestimmen und Korrekturen vorschlagen.
// Faustregeln – bewusst einfach gehalten, keine Garantie für jede Bohne.
import { findMachinePreset, findGrinderPreset } from '../data/presets'
import { bestScope, communityValues } from './community'

/** Basiswerte je Brühmethode und Röstgrad (ratio = Output/Dosis, time in s) */
export const BASE = {
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
const DEFAULT_DOSE = { espresso: 18, pour_over: 15, aeropress: 15, french_press: 30 }
const ROAST_TEXT = { light: 'helle Röstung', medium: 'mittlere Röstung', dark: 'dunkle Röstung' }

export const fmtTime = (s) => (s >= 90 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')} min` : `${s} s`)
export const fmtRange = ([a, b]) => (b >= 90 ? `${fmtTime(a)}–${fmtTime(b)}` : `${a}–${b} s`)

const toNum = (v) => {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}

/** Schrittweite einer Mühle (Annahme: kleinere Zahl = feiner) */
function grindStep(value, scaleType) {
  if (scaleType === 'clicks') return 1
  if (value != null && Math.abs(value) < 5) return 0.1 // z. B. Umdrehungen (1Zpresso, Eureka)
  return scaleType === 'numbers' ? 0.5 : 1
}

/** Mahlgrad anhand der Extraktion verschieben: sauer → feiner, bitter → gröber */
export function adjustGrind(grind, extraction, scaleType) {
  const g = toNum(grind)
  if (g == null || !extraction) return { value: g, steps: 0 }
  const steps = Math.abs(extraction) >= 3 ? 2 : 1
  const step = grindStep(g, scaleType)
  const value = Math.round((g + Math.sign(extraction) * steps * step) * 100) / 100
  return { value, steps, step }
}

/**
 * Verfügbare Quellen für die Zielwerte.
 * own: eigener bester (≥4★) oder letzter Bezug · community · base: Röstgrad-Basiswert
 */
export function availableSources({ own, community }) {
  const s = []
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
export function buildPlan({ source, bean, machine, grinder, own, community }) {
  const type = BASE[machine?.type] ? machine.type : machine?.type ? null : 'espresso'
  const roast = bean?.roast_level ?? 'medium'
  const base = type ? BASE[type][roast] : null
  const presetDefaults = findMachinePreset(machine?.preset_id)?.defaults
  const scale = grinder?.scale_type
  const plan = { type, roast, source, note: null, grindNote: null }

  if (source === 'own') {
    const goodBest = own.best && own.best.rating >= 4 ? own.best : null
    const ref = goodBest ?? own.last
    plan.dose = toNum(ref.dose)
    plan.yield = toNum(ref.yield)
    plan.temp = toNum(ref.temperature)
    const adj = adjustGrind(ref.grind_setting, ref.extraction, scale)
    plan.grind = adj.value ?? (ref.grind_setting || null)
    if (adj.steps) {
      plan.note = `Dein ${goodBest ? 'bester' : 'letzter'} Bezug war ${ref.extraction < 0 ? 'zu sauer' : 'zu bitter'} (Mahlgrad ${ref.grind_setting}) → diesmal ${adj.steps} Stufe${adj.steps > 1 ? 'n' : ''} ${ref.extraction < 0 ? 'feiner' : 'gröber'}.`
    } else {
      plan.note = goodBest ? `Basierend auf deinem besten Bezug (${goodBest.rating}★).` : 'Basierend auf deinem letzten Bezug.'
    }
    const t = toNum(ref.brew_time)
    plan.time = t && !ref.extraction ? [t - 2, t + 2] : base?.time ?? (t ? [t - 3, t + 3] : null)
  } else if (source === 'community') {
    const row = bestScope(community)
    const v = communityValues(row, 'avg', scale)
    plan.dose = v.dose
    plan.yield = v.yield
    plan.temp = v.temperature
    plan.grind = v.grind_setting
    plan.time = v.time ? [v.time - 3, v.time + 3] : base?.time ?? null
    plan.note = `Community-Durchschnitt aus ${row.brew_count} Bezügen (Ø ${row.avg_rating}★).`
    if (plan.grind == null) plan.grindNote = 'Für deine Mühle gibt es noch keine Community-Mahlgrade.'
  } else {
    const dose = presetDefaults?.dose ?? DEFAULT_DOSE[type] ?? 18
    plan.dose = dose
    plan.yield = base ? Math.round(dose * base.ratio * 2) / 2 : presetDefaults?.yield ?? null
    plan.temp = base?.temp ?? presetDefaults?.temperature ?? null
    plan.time = base?.time ?? null
    plan.grind = null
    plan.note = base
      ? `Faustregel für ${ROAST_TEXT[roast]}${bean?.roast_level ? '' : ' (Röstgrad unbekannt)'}: Ratio 1:${base.ratio}, ${base.temp} °C.`
      : 'Für diese Brühmethode gibt es keine Basiswerte – trage deine eigenen ein.'
  }

  if (plan.grind == null && !plan.grindNote) {
    const presetNote = findGrinderPreset(grinder?.preset_id)?.notes
    plan.grindNote = presetNote ? `Startpunkt laut Modell: ${presetNote}` : 'Starte in der Mitte des Bereichs deiner Mühle für diese Methode.'
  }
  plan.ratio = plan.dose && plan.yield ? plan.yield / plan.dose : null
  return plan
}

/**
 * Korrekturhilfe nach dem Bezug.
 * → { tone: 'good'|'sour'|'bitter'|'none', title, tips: string[] }
 */
export function correction({ extraction, grind, scaleType, temperature, brewTime, targetTime, type = 'espresso' }) {
  const tips = []
  const t = toNum(temperature)
  const time = toNum(brewTime)
  const espresso = type === 'espresso'

  if (extraction == null) return { tone: 'none', title: null, tips }
  if (extraction === 0) {
    const r = { tone: 'good', title: 'Ausgewogen – diese Einstellung beibehalten. 👌', tips }
    if (time && targetTime && (time < targetTime[0] || time > targetTime[1]))
      tips.push(`Geschmack passt, auch wenn die Zeit (${fmtTime(time)}) außerhalb von ${fmtRange(targetTime)} liegt – der Geschmack zählt.`)
    return r
  }

  const sour = extraction < 0
  const adj = adjustGrind(grind, extraction, scaleType)
  const dir = sour ? 'feiner' : 'gröber'
  tips.push(
    adj.value != null
      ? `Mahlgrad ${adj.steps} Stufe${adj.steps > 1 ? 'n' : ''} ${dir}: ${grind} → ${adj.value}`
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
export function prepText(machine) {
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
