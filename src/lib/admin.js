// Beta-Test: Feedback (alle) und Admin-Funktionen (nur Rolle admin – serverseitig geprüft)
import { supabase } from './supabase'
import { loadSettings } from './settings'

const check = ({ data, error }) => {
  if (error) throw new Error(error.message.replace(/^NOT_ADMIN$/, 'Keine Admin-Berechtigung.'))
  return data
}
const rpc = async (fn, args) => check(await supabase.rpc(fn, args))

// Feedback ------------------------------------------------------------------------
export async function sendFeedback(message, context) {
  const row = check(
    await supabase
      .from('feedback')
      .insert({ message: message.trim(), context, user_agent: navigator.userAgent.slice(0, 300) })
      .select('id')
      .single(),
  )
  notifyAdmin(row.id) // E-Mail an den Admin (falls im Worker eingerichtet) – Fehler stören den Nutzer nicht
  return row
}

async function notifyAdmin(id) {
  try {
    const { data } = await supabase.auth.getSession()
    await fetch('/api/feedback-notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token}` },
      body: JSON.stringify({ id }),
    })
  } catch {
    /* E-Mail ist nur ein Extra – Feedback ist bereits gespeichert */
  }
}
export async function listFeedback() {
  return check(
    await supabase
      .from('feedback')
      .select('id,message,context,user_agent,status,created_at,author:profiles!feedback_user_id_fkey(username,display_name)')
      .order('created_at', { ascending: false })
      .limit(200),
  )
}
export async function setFeedbackStatus(id, status) {
  return check(await supabase.from('feedback').update({ status }).eq('id', id))
}
export async function deleteFeedback(id) {
  return check(await supabase.from('feedback').delete().eq('id', id))
}

// Admin -----------------------------------------------------------------------------
export const adminOverview = () => rpc('admin_overview')
export const adminUsers = () => rpc('admin_users')
export const adminSetBlocked = (userId, blocked) => rpc('admin_set_blocked', { p_user: userId, p_blocked: blocked })
export const adminDeleteUser = (userId) => rpc('admin_delete_user', { p_user: userId })
export async function adminSetSetting(key, value) {
  await rpc('admin_set_setting', { p_key: key, p_value: value })
  return loadSettings(true)
}
export const adminCreateInvite = (maxUses, note, code) =>
  rpc('admin_create_invite', { p_max_uses: maxUses, p_note: note || null, p_code: code || null })
export const adminDeleteInvite = (code) => rpc('admin_delete_invite', { p_code: code })
export async function adminListInvites() {
  return check(await supabase.from('invite_codes').select('*').order('created_at', { ascending: false }))
}
export const adminRecentContent = () => rpc('admin_recent_content')
export const adminDeleteComment = (id) => rpc('admin_delete_comment', { p_id: id })
export const adminRemoveMedia = (brewId) => rpc('admin_remove_media', { p_brew: brewId })

export const deleteMyAccount = () => rpc('delete_my_account')
