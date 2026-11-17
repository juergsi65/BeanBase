// Kuratierte Hardware-Presets. Die `id` wird als preset_id gespeichert und macht
// Geräte nutzerübergreifend vergleichbar ("Meine Niche" ≙ "Niche Zero Schwarz").
// IDs nie ändern – nur neue hinzufügen.
// Mahlgrad-Angaben: Nullpunkte variieren je nach Exemplar & Kalibrierung.

import type { MachineType, ScaleType } from '../types'
import { fallbackScale, type GrindScale } from '../lib/grind'

export interface MachinePreset {
  id: string
  name: string
  brand: string
  type: MachineType
  notes: string
  /** Startwerte für neue Bezüge mit dieser Maschine */
  defaults: { dose: number; yield: number; temperature: number | null }
}
export interface GrinderPreset {
  id: string
  name: string
  brand: string
  scale_type: ScaleType
  /** Echte Skala laut Handbuch (Notation, Bereich, Korrekturschritt) */
  scale: GrindScale
  /** Startwerte laut Handbuch je Methode (Notation der Mühle) */
  start?: { espresso?: string; filter?: string }
  notes: string
}

export const MACHINE_PRESETS: MachinePreset[] = [
  // Siebträger
  { id: 'sage-barista-express', name: 'Sage / Breville Barista Express', brand: 'Sage', type: 'espresso', notes: '54 mm Siebträger, integrierte Mühle, Thermocoil', defaults: { dose: 18, yield: 36, temperature: 93 } },
  { id: 'sage-barista-pro', name: 'Sage / Breville Barista Pro', brand: 'Sage', type: 'espresso', notes: '54 mm Siebträger, integrierte Mühle, ThermoJet', defaults: { dose: 18, yield: 36, temperature: 93 } },
  { id: 'sage-bambino-plus', name: 'Sage / Breville Bambino Plus', brand: 'Sage', type: 'espresso', notes: '54 mm Siebträger, ThermoJet, automatisches Milchschäumen', defaults: { dose: 18, yield: 36, temperature: 93 } },
  { id: 'sage-dual-boiler', name: 'Sage / Breville Dual Boiler', brand: 'Sage', type: 'espresso', notes: '58 mm Siebträger, Dualboiler, PID', defaults: { dose: 18, yield: 36, temperature: 93 } },
  { id: 'delonghi-dedica', name: "De'Longhi Dedica", brand: "De'Longhi", type: 'espresso', notes: '51 mm Siebträger, Thermoblock', defaults: { dose: 14, yield: 28, temperature: 93 } },
  { id: 'gaggia-classic-pro', name: 'Gaggia Classic Pro', brand: 'Gaggia', type: 'espresso', notes: '58 mm Siebträger, Einkreiser (ab Werk ohne PID)', defaults: { dose: 18, yield: 36, temperature: 93 } },
  { id: 'rancilio-silvia', name: 'Rancilio Silvia', brand: 'Rancilio', type: 'espresso', notes: '58 mm Siebträger, Einkreiser', defaults: { dose: 18, yield: 36, temperature: 93 } },
  { id: 'profitec-go', name: 'Profitec Go', brand: 'Profitec', type: 'espresso', notes: '58 mm Siebträger, Einkreiser mit PID', defaults: { dose: 18, yield: 36, temperature: 93 } },
  { id: 'lelit-mara-x', name: 'Lelit Mara X', brand: 'Lelit', type: 'espresso', notes: '58 mm Siebträger, Zweikreiser (HX), E61', defaults: { dose: 18, yield: 36, temperature: 93 } },
  { id: 'lelit-bianca', name: 'Lelit Bianca', brand: 'Lelit', type: 'espresso', notes: '58 mm Siebträger, Dualboiler, Flow-Control-Paddel, E61', defaults: { dose: 18, yield: 36, temperature: 93 } },
  { id: 'lelit-elizabeth', name: 'Lelit Elizabeth', brand: 'Lelit', type: 'espresso', notes: '58 mm Siebträger, Dualboiler, PID', defaults: { dose: 18, yield: 36, temperature: 93 } },
  { id: 'ecm-synchronika', name: 'ECM Synchronika', brand: 'ECM', type: 'espresso', notes: '58 mm Siebträger, Dualboiler, E61', defaults: { dose: 18, yield: 36, temperature: 93 } },
  { id: 'rocket-appartamento', name: 'Rocket Appartamento', brand: 'Rocket', type: 'espresso', notes: '58 mm Siebträger, Zweikreiser (HX), E61', defaults: { dose: 18, yield: 36, temperature: 93 } },
  { id: 'la-marzocco-linea-micra', name: 'La Marzocco Linea Micra', brand: 'La Marzocco', type: 'espresso', notes: '58 mm Siebträger, Dualboiler, Sättigungsbrühgruppe', defaults: { dose: 18, yield: 36, temperature: 93 } },
  { id: 'decent-de1', name: 'Decent DE1', brand: 'Decent', type: 'espresso', notes: '58 mm Siebträger, Druck-/Flow-Profiling per Tablet', defaults: { dose: 18, yield: 36, temperature: 92 } },
  { id: 'flair-58', name: 'Flair 58', brand: 'Flair', type: 'espresso', notes: '58 mm Handhebel, elektrisch beheizte Brühgruppe', defaults: { dose: 18, yield: 36, temperature: 93 } },
  { id: 'cafelat-robot', name: 'Cafelat Robot', brand: 'Cafelat', type: 'espresso', notes: '58 mm Handhebel, ohne Heizung (Wasser vorheizen)', defaults: { dose: 18, yield: 36, temperature: 96 } },
  // Filter & Co.
  { id: 'hario-v60', name: 'Hario V60', brand: 'Hario', type: 'pour_over', notes: 'Konischer Handfilter, Größe 01/02', defaults: { dose: 15, yield: 250, temperature: 94 } },
  { id: 'kalita-wave', name: 'Kalita Wave 185', brand: 'Kalita', type: 'pour_over', notes: 'Flachbodenfilter', defaults: { dose: 15, yield: 250, temperature: 94 } },
  { id: 'chemex', name: 'Chemex 6 Cup', brand: 'Chemex', type: 'pour_over', notes: 'Dicke Papierfilter → etwas feiner/länger', defaults: { dose: 30, yield: 500, temperature: 94 } },
  { id: 'clever-dripper', name: 'Clever Dripper', brand: 'Clever', type: 'pour_over', notes: 'Immersion + Filter (Ventil)', defaults: { dose: 18, yield: 300, temperature: 95 } },
  { id: 'aeropress', name: 'AeroPress', brand: 'AeroPress', type: 'aeropress', notes: 'Standard oder invertiert', defaults: { dose: 15, yield: 230, temperature: 90 } },
  { id: 'french-press', name: 'French Press', brand: '', type: 'french_press', notes: 'Grob mahlen, ca. 4 min ziehen', defaults: { dose: 30, yield: 500, temperature: 95 } },
  { id: 'bialetti-moka', name: 'Bialetti Moka Express', brand: 'Bialetti', type: 'moka', notes: 'Größe (Tassen) notieren', defaults: { dose: 15, yield: 90, temperature: null } },
]

// Quellen: „Handbuch“ = Bedienungsanleitung/offizielle Herstellerseite, „Richtwert“ = Community-Erfahrung.
const SETTE_MIKRO = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
const SAGE_RING = { min: 1, max: 10, default: 6 }
const KLICK: [string, string] = ['Klick', 'Klicks']

export const GRINDER_PRESETS: GrinderPreset[] = [
  // Elektrisch – Espresso-fokussiert
  { id: 'niche-zero', name: 'Niche Zero', brand: 'Niche', scale_type: 'stepless', scale: { kind: 'number', min: 0, max: 50, step: 0.5, adjust: 2 }, notes: 'Stufenlos, Skala 0–50. Nullpunkt = Mahlscheiben berühren sich (Handbuch). Richtwert: Espresso ca. 10–20, Filter ca. 35–50.' },
  { id: 'niche-duo', name: 'Niche Duo', brand: 'Niche', scale_type: 'stepless', scale: { kind: 'free', numeric: true }, notes: 'Stufenlos, Wechsel-Mahlscheiben. Im Uhrzeigersinn feiner; Nullpunkt = Scheiben berühren sich. Filter-Scheiben mahlen nicht fein genug für Espresso (Handbuch).' },
  { id: 'eureka-mignon-specialita', name: 'Eureka Mignon Specialità', brand: 'Eureka', scale_type: 'stepless', scale: { kind: 'free', numeric: true }, notes: 'Stufenlos (Mikrometerschraube). Nullpunkt markieren und Position ab Nullpunkt notieren.' },
  { id: 'eureka-mignon-silenzio', name: 'Eureka Mignon Silenzio', brand: 'Eureka', scale_type: 'stepless', scale: { kind: 'free', numeric: true }, notes: 'Stufenlos (Mikrometerschraube). Nullpunkt markieren.' },
  { id: 'df64', name: 'G-Iota / Turin DF64', brand: 'DF', scale_type: 'stepless', scale: { kind: 'number', min: 0, max: 90, step: 0.5, adjust: 2 }, notes: 'Stufenlos, Zahlenring 0–90. Espresso-Bereich hängt stark von Kalibrierung/Burrs ab.' },
  { id: 'df83', name: 'G-Iota / Turin DF83', brand: 'DF', scale_type: 'stepless', scale: { kind: 'free', numeric: true }, notes: 'Stufenlos, 83 mm Flachmahlwerk.' },
  { id: 'lagom-p64', name: 'Option-O Lagom P64', brand: 'Option-O', scale_type: 'stepless', scale: { kind: 'free', numeric: true }, notes: 'Stufenlos, 64 mm Flachmahlwerk.' },
  { id: 'mahlkoenig-x54', name: 'Mahlkönig X54', brand: 'Mahlkönig', scale_type: 'stepless', scale: { kind: 'free', numeric: true }, notes: 'Stufenlos, Zahlenskala auf dem Drehring.' },
  { id: 'baratza-sette-270', name: 'Baratza Sette 270', brand: 'Baratza', scale_type: 'numbers', scale: { kind: 'compound', min: 1, max: 31, subs: SETTE_MIKRO, adjust: 3 }, start: { espresso: '9E', filter: '20E' }, notes: 'Makro 1–31 (Ring oben) + Mikro A–I (Ring unten, A = feiner). Nur bei laufendem Motor verstellen (Handbuch).' },
  { id: 'baratza-encore-esp', name: 'Baratza Encore ESP', brand: 'Baratza', scale_type: 'numbers', scale: { kind: 'number', min: 1, max: 40, step: 1 }, start: { espresso: '15' }, notes: 'Skala 1–40: 1–20 feine Espresso-Schritte, 21–40 Filter (Handbuch).' },
  { id: 'sage-smart-grinder-pro', name: 'Sage / Breville Smart Grinder Pro', brand: 'Sage', scale_type: 'numbers', scale: { kind: 'number', min: 1, max: 60, step: 1, ring: SAGE_RING }, start: { espresso: '12', filter: '40' }, notes: '60 Stufen: Espresso 1–30, Filter 31–48, French Press 55–60. Innerer Ring Werkseinstellung 6 – nur verstellen, wenn die Skala nicht reicht (Handbuch).' },
  { id: 'sage-barista-express-builtin', name: 'Sage Barista Express (integrierte Mühle)', brand: 'Sage', scale_type: 'numbers', scale: { kind: 'number', min: 1, max: 16, step: 1, ring: SAGE_RING }, start: { espresso: '5' }, notes: 'Außenskala 1–16, Start bei 5. Innerer Ring (obere Mahlscheibe) Werkseinstellung 6, immer nur um 1 verstellen (Handbuch).' },
  { id: 'sage-barista-pro-builtin', name: 'Sage Barista Pro (integrierte Mühle)', brand: 'Sage', scale_type: 'numbers', scale: { kind: 'number', min: 1, max: 30, step: 1, ring: SAGE_RING }, start: { espresso: '15' }, notes: '30 Stufen im Display, Start bei 15. Innerer Ring Werkseinstellung 6 (Handbuch).' },
  // Filter-fokussiert
  { id: 'fellow-ode-gen2', name: 'Fellow Ode Gen 2', brand: 'Fellow', scale_type: 'numbers', scale: { kind: 'compound', min: 1, max: 11, subs: ['', '.1', '.2'] }, notes: '31 Stufen: Zahlen 1–11 mit je 2 Zwischenpunkten (z. B. 3.1, 3.2). Für Filter ausgelegt, kein Espresso.' },
  { id: 'baratza-encore', name: 'Baratza Encore', brand: 'Baratza', scale_type: 'numbers', scale: { kind: 'number', min: 1, max: 40, step: 1 }, start: { espresso: '8' }, notes: 'Skala 1–40, eher Filter (Espresso nur eingeschränkt).' },
  // Handmühlen
  { id: 'comandante-c40', name: 'Comandante C40', brand: 'Comandante', scale_type: 'clicks', scale: { kind: 'clicks', max: 50, perRotation: 12 }, notes: 'Klicks ab Nullpunkt (ganz zu). Richtwert: Espresso ca. 7–13, V60 ca. 20–28 (Standard-Achse).' },
  { id: '1zpresso-jx-pro', name: '1Zpresso JX-Pro', brand: '1Zpresso', scale_type: 'numbers', scale: { kind: 'rotation', numbers: 10, clicks: 4, maxRot: 6, adjust: 2 }, notes: 'Verstellung oben: Umdrehung.Zahl.Klick, 10 Zahlen × 4 Klicks = 40 Klicks/Umdrehung, 12,5 µm/Klick (Hersteller). Richtwert Espresso ca. 1.0–2.0.' },
  { id: '1zpresso-j-ultra', name: '1Zpresso J-Ultra', brand: '1Zpresso', scale_type: 'numbers', scale: { kind: 'rotation', numbers: 10, clicks: 10, maxRot: 6, adjust: 3 }, notes: 'Außenring: Umdrehung.Zahl.Klick, 10 Zahlen × 10 Klicks = 100 Klicks/Umdrehung, 8 µm/Klick (Hersteller). Espresso-fokussiert.' },
  { id: '1zpresso-k-ultra', name: '1Zpresso K-Ultra', brand: '1Zpresso', scale_type: 'numbers', scale: { kind: 'number', min: 0, max: 30, step: 0.1, adjust: 2, unitName: KLICK }, notes: 'Notation Zahl.Klick: 6.5 = Zahl 6 + 5 Klicks; ab der 2. Umdrehung weiterzählen (12.3). 10 Klicks/Zahl, 20 µm/Klick (Hersteller). Filter-fokussiert.' },
  { id: '1zpresso-zp6', name: '1Zpresso ZP6 Special', brand: '1Zpresso', scale_type: 'numbers', scale: { kind: 'number', min: 0, max: 27, step: 0.1, adjust: 2, unitName: KLICK }, notes: 'Notation Zahl.Klick, 9 Zahlen × 10 Klicks = 90 Klicks/Umdrehung, 22 µm/Klick (Hersteller). Filter-Spezialist, kein Espresso.' },
  { id: 'kingrinder-k6', name: 'Kingrinder K6', brand: 'Kingrinder', scale_type: 'clicks', scale: { kind: 'clicks', max: 240, perRotation: 60, adjust: 2 }, notes: 'Klicks ab Nullpunkt (16 µm/Klick). Richtwert: Espresso ca. 30–60, Filter ca. 80–120.' },
  { id: 'timemore-c3', name: 'Timemore Chestnut C3', brand: 'Timemore', scale_type: 'clicks', scale: { kind: 'clicks', max: 36 }, notes: 'Klicks ab Nullpunkt, eher Filter. Richtwert: V60 ca. 14–20.' },
  { id: 'timemore-sculptor-078', name: 'Timemore Sculptor 078', brand: 'Timemore', scale_type: 'stepless', scale: { kind: 'free', numeric: true }, notes: 'Stufenlos, elektrisch, 78 mm Flachmahlwerk.' },
]

export const findMachinePreset = (id: string | null | undefined) => MACHINE_PRESETS.find((p) => p.id === id)
export const findGrinderPreset = (id: string | null | undefined) => GRINDER_PRESETS.find((p) => p.id === id)

/** Einfache Suche über Name + Marke (Groß/Klein & Sonderzeichen egal) */
const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
export function searchPresets<P extends { brand: string; name: string }>(list: P[], query: string): P[] {
  const q = norm(query)
  if (!q) return list
  const words = q.split(' ')
  return list.filter((p) => {
    const hay = norm(`${p.brand} ${p.name}`)
    return words.every((w) => hay.includes(w))
  })
}

/** Skala einer Mühle: Modell-Skala, sonst Fallback aus dem Skalentyp */
export const grinderScale = (g: { preset_id?: string | null; scale_type?: ScaleType | null } | null | undefined): GrindScale =>
  findGrinderPreset(g?.preset_id)?.scale ?? fallbackScale(g?.scale_type)
