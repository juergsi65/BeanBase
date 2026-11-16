// Einheitliche Datenschicht: Supabase (Cloud) oder localStorage (Demo-Modus).
import { supabase } from './supabase'

export const TABLES = ['machines', 'grinders', 'beans', 'brews', 'bean_stock']
const LS_KEY = 'beanbase:v1'

function lsRead() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) ?? {}
  } catch {
    return {}
  }
}
function lsWrite(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))

const local = {
  async list(table) {
    const rows = lsRead()[table] ?? []
    return [...rows].sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
  },
  async insert(table, row) {
    const data = lsRead()
    const rec = { id: uid(), created_at: new Date().toISOString(), ...row }
    data[table] = [...(data[table] ?? []), rec]
    lsWrite(data)
    return rec
  },
  async update(table, id, patch) {
    const data = lsRead()
    let rec
    data[table] = (data[table] ?? []).map((r) => (r.id === id ? (rec = { ...r, ...patch }) : r))
    lsWrite(data)
    return rec
  },
  async remove(table, id) {
    const data = lsRead()
    data[table] = (data[table] ?? []).filter((r) => r.id !== id)
    // verwaiste Referenzen wie "on delete set null"
    const fk = { beans: 'bean_id', machines: 'machine_id', grinders: 'grinder_id' }[table]
    if (fk) data.brews = (data.brews ?? []).map((b) => (b[fk] === id ? { ...b, [fk]: null } : b))
    if (table === 'beans') data.bean_stock = (data.bean_stock ?? []).filter((st) => st.bean_id !== id) // wie "on delete cascade"
    lsWrite(data)
  },
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id
}

const remote = {
  // Nur eigene Zeilen – RLS erlaubt zusätzlich das Lesen von Freunden/öffentlichen Profilen
  async list(table) {
    const uid = await currentUserId()
    const { data, error } = await supabase.from(table).select('*').eq('user_id', uid).order('created_at', { ascending: false })
    if (error) throw error
    return data
  },
  async insert(table, row) {
    const { data, error } = await supabase.from(table).insert(row).select().single()
    if (error) throw error
    return data
  },
  async update(table, id, patch) {
    const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  },
}

export const db = supabase ? remote : local

/** Export aller Daten als JSON (Backup) */
export async function exportAll() {
  const out = {}
  for (const t of TABLES) out[t] = await db.list(t)
  return out
}
