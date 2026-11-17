// Beta-Test: Feedback (alle) und Admin-Funktionen (nur Rolle admin – serverseitig geprüft)
import { requireSupabase } from './supabase'
import { loadSettings, type AppSettings } from './settings'
import type { Feedback, InviteCode, MediaType, Profile } from '../types'

const sb = requireSupabase

export type FeedbackItem = Pick<Feedback, 'id' | 'message' | 'context' | 'user_agent' | 'status' | 'created_at'> & {
  author: Pick<Profile, 'username' | 'display_name'> | null
}
export interface AdminOverview {
  users: number
  users_7d: number
  active_7d: number
  blocked: number
  public_profiles: number
  beans: number
  brews: number
  brews_7d: number
  friendships: number
  likes: number
  comments: number
  feedback_open: number
  storage_mb: number
}
export interface AdminUser {
  id: string
  username: string
  display_name: string | null
  email: string | null
  role: Profile['role']
  blocked: boolean
  is_public: boolean
  created_at: string
  last_sign_in_at: string | null
  beans: number
  brews: number
  last_brew_at: string | null
}
export interface RecentContent {
  comments: { id: string; body: string; created_at: string; username: string }[]
  media: { id: string; media_url: string; media_type: MediaType; created_at: string; username: string }[]
}

// Ohne generierte DB-Typen: Zeilen-Typ wird vom Aufrufer festgelegt (Grenze zur API)
const check = <T,>({ data, error }: { data: unknown; error: { message: string } | null }): T => {
  if (error) throw new Error(error.message.replace(/^NOT_ADMIN$/, 'Keine Admin-Berechtigung.'))
  return data as T
}
const rpc = async <T = void,>(fn: string, args?: Record<string, unknown>): Promise<T> => check(await sb().rpc(fn, args))

// Feedback ------------------------------------------------------------------------
export async function sendFeedback(message: string, context: string | null) {
  const row: { id: string } = check(
    await sb()
      .from('feedback')
      .insert({ message: message.trim(), context, user_agent: navigator.userAgent.slice(0, 300) })
      .select('id')
      .single(),
  )
  notifyAdmin(row.id) // E-Mail an den Admin (falls im Worker eingerichtet) – Fehler stören den Nutzer nicht
  return row
}

async function notifyAdmin(id: string) {
  try {
    const { data } = await sb().auth.getSession()
    await fetch('/api/feedback-notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token}` },
      body: JSON.stringify({ id }),
    })
  } catch {
    /* E-Mail ist nur ein Extra – Feedback ist bereits gespeichert */
  }
}
export async function listFeedback(): Promise<FeedbackItem[]> {
  return check(
    await sb()
      .from('feedback')
      .select('id,message,context,user_agent,status,created_at,author:profiles!feedback_user_id_fkey(username,display_name)')
      .order('created_at', { ascending: false })
      .limit(200),
  )
}
export async function setFeedbackStatus(id: string, status: Feedback['status']) {
  return check(await sb().from('feedback').update({ status }).eq('id', id))
}
export async function deleteFeedback(id: string) {
  return check(await sb().from('feedback').delete().eq('id', id))
}

// Admin -----------------------------------------------------------------------------
export const adminOverview = () => rpc<AdminOverview>('admin_overview')
export const adminUsers = () => rpc<AdminUser[]>('admin_users')
export const adminSetBlocked = (userId: string, blocked: boolean) => rpc('admin_set_blocked', { p_user: userId, p_blocked: blocked })
export const adminDeleteUser = (userId: string) => rpc('admin_delete_user', { p_user: userId })
export async function adminSetSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  await rpc('admin_set_setting', { p_key: key, p_value: value })
  return loadSettings(true)
}
export const adminCreateInvite = (maxUses: number, note?: string | null, code?: string | null) =>
  rpc<string>('admin_create_invite', { p_max_uses: maxUses, p_note: note || null, p_code: code || null })
export const adminDeleteInvite = (code: string) => rpc('admin_delete_invite', { p_code: code })
export async function adminListInvites(): Promise<InviteCode[]> {
  return check(await sb().from('invite_codes').select('*').order('created_at', { ascending: false }))
}
export const adminRecentContent = () => rpc<RecentContent>('admin_recent_content')
export const adminDeleteComment = (id: string) => rpc('admin_delete_comment', { p_id: id })
export const adminRemoveMedia = (brewId: string) => rpc('admin_remove_media', { p_brew: brewId })

export const deleteMyAccount = () => rpc('delete_my_account')
