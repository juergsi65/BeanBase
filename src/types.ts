// Zeilentypen der Supabase-Tabellen (siehe supabase/schema.sql)
import type { MACHINE_TYPES, SCALE_TYPES, PROCESSES, ROAST_LEVELS } from './lib/coffee'
import type { CURRENCIES } from './lib/cost'

export type MachineType = keyof typeof MACHINE_TYPES
export type ScaleType = keyof typeof SCALE_TYPES
export type Process = keyof typeof PROCESSES
export type RoastLevel = keyof typeof ROAST_LEVELS
export type Currency = keyof typeof CURRENCIES
export type MediaType = 'image' | 'video'

interface Row {
  id: string
  user_id: string
  created_at: string
}

export interface Machine extends Row {
  name: string
  type: MachineType
  preset_id: string | null
  notes: string | null
  image_url: string | null
}

export interface Grinder extends Row {
  name: string
  scale_type: ScaleType
  preset_id: string | null
  notes: string | null
  image_url: string | null
}

export interface Bean extends Row {
  name: string
  roaster: string | null
  origin: string | null
  variety: string | null
  process: Process | null
  roast_level: RoastLevel | null
  roast_date: string | null
  flavor_notes: string[]
  image_url: string | null
  barcode: string | null
  active: boolean
}

export interface Brew extends Row {
  bean_id: string | null
  machine_id: string | null
  grinder_id: string | null
  dose: number | null
  yield: number | null
  grind_setting: string | null
  temperature: number | null
  brew_time: number | null
  preinfusion: number | null
  rating: number | null
  extraction: number | null
  notes: string | null
  media_url: string | null
  media_type: MediaType | null
}

export interface BeanStock extends Row {
  bean_id: string
  bag_weight_g: number | null
  price: number | null
  currency: Currency
  opened_at: string
}

export interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  is_public: boolean
  setup_photo_url: string | null
  role: 'admin' | 'tester'
  blocked: boolean
  created_at: string
}

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
  created_at: string
}

export interface BrewComment {
  id: string
  brew_id: string
  user_id: string
  body: string
  created_at: string
}

export interface Feedback {
  id: string
  user_id: string | null
  message: string
  context: string | null
  user_agent: string | null
  status: 'neu' | 'erledigt'
  created_at: string
}

export interface InviteCode {
  code: string
  max_uses: number
  uses: number
  note: string | null
  created_by: string | null
  created_at: string
}

/** Tabellen der eigenen Daten (db.ts / useData.ts) */
export interface TableMap {
  machines: Machine
  grinders: Grinder
  beans: Bean
  brews: Brew
  bean_stock: BeanStock
}
export type TableName = keyof TableMap
export type Data = { [K in TableName]: TableMap[K][] }

/** Eingeloggter Nutzer (Supabase-User oder lokaler Demo-Nutzer) */
export interface AppUser {
  id: string
  email?: string
}

// --- Navigation / Seiten-Props ------------------------------------------------------
export type Tab = 'dashboard' | 'beans' | 'brew' | 'dialin' | 'history' | 'community' | 'equipment' | 'profile' | 'user' | 'feedback' | 'admin'
/** Bezug vorbefüllen (Rezept übernehmen) oder bearbeiten (editId) */
export interface BrewPreset {
  key?: string | number
  brew?: Partial<Brew>
  editId?: string
  /** Zielfenster der Brühzeit in s (für die Dial-In-Auswertung nach dem Speichern) */
  target?: [number, number] | null
}
export interface Go {
  (tab: 'user', preset: { userId: string }): void
  (tab: 'brew' | 'dialin', preset?: BrewPreset | null): void
  (tab: Exclude<Tab, 'user'>): void
}
export interface PageProps {
  data: import('./lib/useData').DataApi
  go: Go
  me: import('./lib/social').MyProfile | null
  theme: ReturnType<typeof import('./lib/theme').useTheme>
}
