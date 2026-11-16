// Einheitliche Datenschicht: Supabase (Cloud) oder localStorage (Demo-Modus).
import { supabase } from './supabase'
import { tryCatchOrUndefined } from 'only-utils'
import type { Data, TableMap, TableName } from '../types'

export const TABLES = ['machines', 'grinders', 'beans', 'brews', 'bean_stock'] as const satisfies readonly TableName[]
const LS_KEY = 'beanbase:v1'

/** Neue/geänderte Zeile: Server setzt id, user_id, created_at */
export type RowInput<T extends TableName> = Partial<TableMap[T]>

interface Db {
  list<T extends TableName>(table: T): Promise<TableMap[T][]>
  insert<T extends TableName>(table: T, row: RowInput<T>): Promise<TableMap[T]>
  update<T extends TableName>(table: T, id: string, patch: RowInput<T>): Promise<TableMap[T]>
  remove(table: TableName, id: string): Promise<void>
}

const lsRead = (): Partial<Data> => tryCatchOrUndefined(JSON.parse)(localStorage.getItem(LS_KEY) ?? '') ?? {}
function lsWrite(data: Partial<Data>) {
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))
// Lokale Zeilen sind generisch über die Tabelle – Typ-Zuordnung pro Tabelle gilt per Konstruktion
const rowsOf = <T extends TableName>(data: Partial<Data>, table: T) => (data[table] ?? []) as TableMap[T][]

const local: Db = {
  async list(table) {
    return [...rowsOf(lsRead(), table)].sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
  },
  async insert(table, row) {
    const data = lsRead()
    const rec = { id: uid(), created_at: new Date().toISOString(), ...row } as TableMap[typeof table]
    ;(data as Record<TableName, unknown[]>)[table] = [...rowsOf(data, table), rec]
    lsWrite(data)
    return rec
  },
  async update(table, id, patch) {
    const data = lsRead()
    let rec: TableMap[typeof table] | undefined
    ;(data as Record<TableName, unknown[]>)[table] = rowsOf(data, table).map((r) => (r.id === id ? (rec = { ...r, ...patch }) : r))
    lsWrite(data)
    if (!rec) throw new Error('Eintrag nicht gefunden.')
    return rec
  },
  async remove(table, id) {
    const data = lsRead()
    ;(data as Record<TableName, unknown[]>)[table] = rowsOf(data, table).filter((r) => r.id !== id)
    // verwaiste Referenzen wie "on delete set null"
    const fk = ({ beans: 'bean_id', machines: 'machine_id', grinders: 'grinder_id' } as const)[table as 'beans' | 'machines' | 'grinders']
    if (fk) data.brews = (data.brews ?? []).map((b) => (b[fk] === id ? { ...b, [fk]: null } : b))
    if (table === 'beans') data.bean_stock = (data.bean_stock ?? []).filter((st) => st.bean_id !== id) // wie "on delete cascade"
    lsWrite(data)
  },
}

async function currentUserId() {
  const { data } = await supabase!.auth.getSession()
  return data.session?.user?.id
}

// Nur aktiv, wenn supabase gesetzt ist (siehe `db` unten)
const remote: Db = {
  // Nur eigene Zeilen – RLS erlaubt zusätzlich das Lesen von Freunden/öffentlichen Profilen
  async list(table) {
    const uid = await currentUserId()
    const { data, error } = await supabase!.from(table).select('*').eq('user_id', uid).order('created_at', { ascending: false })
    if (error) throw error
    return data
  },
  async insert(table, row) {
    const { data, error } = await supabase!.from(table).insert(row as Record<string, unknown>).select().single()
    if (error) throw error
    return data
  },
  async update(table, id, patch) {
    const { data, error } = await supabase!.from(table).update(patch as Record<string, unknown>).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(table, id) {
    const { error } = await supabase!.from(table).delete().eq('id', id)
    if (error) throw error
  },
}

export const db: Db = supabase ? remote : local

/** Export aller Daten als JSON (Backup) */
export async function exportAll() {
  const out: Partial<Data> = {}
  for (const t of TABLES) (out as Record<TableName, unknown[]>)[t] = await db.list(t)
  return out as Data
}
