// Kuratierte Hardware-Presets. Die `id` wird als preset_id gespeichert und macht
// Geräte nutzerübergreifend vergleichbar ("Meine Niche" ≙ "Niche Zero Schwarz").
// IDs nie ändern – nur neue hinzufügen.
// Mahlgrad-Angaben sind grobe Startwerte: Nullpunkte variieren je nach Exemplar & Kalibrierung.

import type { MachineType, ScaleType } from '../types'

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

export const GRINDER_PRESETS: GrinderPreset[] = [
  // Elektrisch – Espresso-fokussiert
  { id: 'niche-zero', name: 'Niche Zero', brand: 'Niche', scale_type: 'stepless', notes: 'Stufenlos, Skala 0–50. Espresso ca. 5–20 (je nach Kalibrierung), Filter ca. 30–50.' },
  { id: 'niche-duo', name: 'Niche Duo', brand: 'Niche', scale_type: 'stepless', notes: 'Stufenlos, Wechsel-Mahlscheiben (Espresso/Filter).' },
  { id: 'eureka-mignon-specialita', name: 'Eureka Mignon Specialità', brand: 'Eureka', scale_type: 'stepless', notes: 'Stufenlos (Mikrometerschraube). Nullpunkt markieren und Umdrehungen ab Nullpunkt notieren.' },
  { id: 'eureka-mignon-silenzio', name: 'Eureka Mignon Silenzio', brand: 'Eureka', scale_type: 'stepless', notes: 'Stufenlos (Mikrometerschraube). Nullpunkt markieren.' },
  { id: 'df64', name: 'G-Iota / Turin DF64', brand: 'DF', scale_type: 'stepless', notes: 'Stufenlos, Zahlenring. Espresso-Bereich hängt stark von Kalibrierung/Burrs ab.' },
  { id: 'df83', name: 'G-Iota / Turin DF83', brand: 'DF', scale_type: 'stepless', notes: 'Stufenlos, 83 mm Flachmahlwerk.' },
  { id: 'lagom-p64', name: 'Option-O Lagom P64', brand: 'Option-O', scale_type: 'stepless', notes: 'Stufenlos, 64 mm Flachmahlwerk.' },
  { id: 'mahlkoenig-x54', name: 'Mahlkönig X54', brand: 'Mahlkönig', scale_type: 'stepless', notes: 'Stufenlos, Skala 1–12 auf Drehring.' },
  { id: 'baratza-sette-270', name: 'Baratza Sette 270', brand: 'Baratza', scale_type: 'numbers', notes: '30 Makro- (1–30) + Mikroschritte (A–I). Als "Makro.Mikro" notieren, z. B. 8.3.' },
  { id: 'baratza-encore-esp', name: 'Baratza Encore ESP', brand: 'Baratza', scale_type: 'numbers', notes: 'Skala 1–40. Espresso ca. 1–20 (Mikroschritte), Filter ca. 21–40.' },
  { id: 'sage-smart-grinder-pro', name: 'Sage / Breville Smart Grinder Pro', brand: 'Sage', scale_type: 'numbers', notes: '60 Stufen. Espresso ca. 1–30, Filter darüber; innerer Ring zusätzlich justierbar.' },
  { id: 'sage-barista-express-builtin', name: 'Sage Barista Express (integrierte Mühle)', brand: 'Sage', scale_type: 'numbers', notes: 'Skala 1–16 + innerer Burr-Ring (Werks-Einstellung 6) notieren.' },
  // Filter-fokussiert
  { id: 'fellow-ode-gen2', name: 'Fellow Ode Gen 2', brand: 'Fellow', scale_type: 'numbers', notes: '31 Stufen (1–11 mit Zwischenschritten), für Filter ausgelegt.' },
  { id: 'baratza-encore', name: 'Baratza Encore', brand: 'Baratza', scale_type: 'numbers', notes: 'Skala 1–40, eher Filter (Espresso nur eingeschränkt).' },
  // Handmühlen
  { id: 'comandante-c40', name: 'Comandante C40', brand: 'Comandante', scale_type: 'clicks', notes: 'Klicks ab Nullpunkt. Espresso ca. 7–13, V60 ca. 20–28 (Standard-Achse).' },
  { id: '1zpresso-jx-pro', name: '1Zpresso JX-Pro', brand: '1Zpresso', scale_type: 'numbers', notes: 'Notation Umdrehung.Zahl.Klick, 40 Klicks/Umdrehung. Espresso ca. 1.0–2.0 Umdrehungen.' },
  { id: '1zpresso-j-ultra', name: '1Zpresso J-Ultra', brand: '1Zpresso', scale_type: 'numbers', notes: 'Feine Schritte (8 µm/Klick), Espresso-fokussiert. Wert vom Zahlenring ablesen.' },
  { id: '1zpresso-k-ultra', name: '1Zpresso K-Ultra', brand: '1Zpresso', scale_type: 'numbers', notes: 'Außen-Zahlenring, Filter-fokussiert; Espresso ca. 2.0–4.0 Umdrehungen.' },
  { id: '1zpresso-zp6', name: '1Zpresso ZP6 Special', brand: '1Zpresso', scale_type: 'numbers', notes: 'Filter-Spezialist, für Espresso ungeeignet.' },
  { id: 'kingrinder-k6', name: 'Kingrinder K6', brand: 'Kingrinder', scale_type: 'clicks', notes: 'Klicks (16 µm). Espresso ca. 30–60, Filter ca. 80–120.' },
  { id: 'timemore-c3', name: 'Timemore Chestnut C3', brand: 'Timemore', scale_type: 'clicks', notes: 'Klicks ab Nullpunkt, eher Filter (V60 ca. 14–20).' },
  { id: 'timemore-sculptor-078', name: 'Timemore Sculptor 078', brand: 'Timemore', scale_type: 'stepless', notes: 'Stufenlos, elektrisch, 78 mm Flachmahlwerk.' },
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
