// Social-Funktionen (Profile, Freunde, Feed, Likes, Kommentare) – nur mit Supabase verfügbar.
// Sichtbarkeit regelt die Datenbank (RLS): eigene Daten, akzeptierte Freunde, öffentliche Profile.
import { supabase } from './supabase'

export const socialAvailable = !!supabase

const PROFILE_COLS = 'id,username,display_name,avatar_url,bio,is_public,setup_photo_url'
const check = ({ data, error }) => {
  if (error) throw error
  return data
}

export async function myId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

// --- Profil ---------------------------------------------------------------------
export async function getProfile(id) {
  return check(await supabase.from('profiles').select(PROFILE_COLS).eq('id', id).maybeSingle())
}

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/

export async function updateMyProfile(patch) {
  const id = await myId()
  const res = await supabase.from('profiles').update(patch).eq('id', id).select(PROFILE_COLS).single()
  if (res.error?.code === '23505') throw new Error('Dieser Username ist schon vergeben.')
  return check(res)
}

export async function uploadAvatar(blob) {
  const id = await myId()
  const path = `${id}/${crypto.randomUUID()}.jpg`
  check(await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' }))
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

export async function deleteAvatar(url) {
  const path = url?.split('/avatars/')[1]
  if (path) await supabase.storage.from('avatars').remove([decodeURIComponent(path)])
}

// --- Freunde ----------------------------------------------------------------------
export async function searchProfiles(query) {
  const q = query.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
  if (q.length < 2) return []
  const me = await myId()
  return check(
    await supabase.from('profiles').select(PROFILE_COLS).ilike('username', `%${q}%`).neq('id', me).order('username').limit(10),
  )
}

const FRIEND_SELECT = `id,status,created_at,requester_id,addressee_id,
  requester:profiles!friendships_requester_id_fkey(${PROFILE_COLS}),
  addressee:profiles!friendships_addressee_id_fkey(${PROFILE_COLS})`

/** → { friends: [{friendship, profile}], incoming: [...], outgoing: [...] } */
export async function listFriendships() {
  const me = await myId()
  const rows = check(await supabase.from('friendships').select(FRIEND_SELECT).order('created_at', { ascending: false }))
  const out = { friends: [], incoming: [], outgoing: [] }
  for (const f of rows) {
    const other = f.requester_id === me ? f.addressee : f.requester
    const item = { friendship: f, profile: other }
    if (f.status === 'accepted') out.friends.push(item)
    else if (f.addressee_id === me) out.incoming.push(item)
    else out.outgoing.push(item)
  }
  return out
}

export async function sendFriendRequest(profileId) {
  const res = await supabase.from('friendships').insert({ addressee_id: profileId }).select('id').single()
  if (res.error?.code === '23505') throw new Error('Es gibt bereits eine Anfrage zwischen euch.')
  return check(res)
}
export async function acceptFriend(friendshipId) {
  return check(await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId))
}
export async function removeFriendship(friendshipId) {
  return check(await supabase.from('friendships').delete().eq('id', friendshipId))
}

// --- Feed ---------------------------------------------------------------------------
const BREW_SELECT = `id,user_id,created_at,dose,yield,grind_setting,temperature,brew_time,preinfusion,rating,extraction,notes,media_url,media_type,
  profile:profiles!brews_user_profile_fkey(${PROFILE_COLS}),
  bean:beans(name,roaster,roast_level,image_url),
  machine:machines(name,type,preset_id),
  grinder:grinders(name,scale_type,preset_id),
  likes:brew_likes(count),
  comments:brew_comments(count)`

async function withMyLikes(brews) {
  if (!brews.length) return brews
  const me = await myId()
  const liked = check(
    await supabase.from('brew_likes').select('brew_id').eq('user_id', me).in('brew_id', brews.map((b) => b.id)),
  )
  const set = new Set(liked.map((l) => l.brew_id))
  return brews.map((b) => ({
    ...b,
    likeCount: b.likes?.[0]?.count ?? 0,
    commentCount: b.comments?.[0]?.count ?? 0,
    likedByMe: set.has(b.id),
  }))
}

/** scope: 'friends' | 'all' (alle für mich sichtbaren: Freunde + öffentliche Profile + eigene) */
export async function fetchFeed({ scope = 'friends', before = null, limit = 20 } = {}) {
  let q = supabase.from('brews').select(BREW_SELECT).order('created_at', { ascending: false }).limit(limit)
  if (before) q = q.lt('created_at', before)
  if (scope === 'friends') {
    const { friends } = await listFriendships()
    const ids = friends.map((f) => f.profile.id)
    if (!ids.length) return []
    q = q.in('user_id', ids)
  }
  return withMyLikes(check(await q))
}

export async function toggleLike(brewId, liked) {
  if (liked) return check(await supabase.from('brew_likes').delete().eq('brew_id', brewId).eq('user_id', await myId()))
  return check(await supabase.from('brew_likes').insert({ brew_id: brewId }))
}

export async function listComments(brewId) {
  return check(
    await supabase
      .from('brew_comments')
      .select(`id,body,created_at,user_id,author:profiles!brew_comments_user_id_fkey(${PROFILE_COLS})`)
      .eq('brew_id', brewId)
      .order('created_at'),
  )
}
export async function addComment(brewId, body) {
  return check(await supabase.from('brew_comments').insert({ brew_id: brewId, body: body.trim() }))
}
export async function deleteComment(id) {
  return check(await supabase.from('brew_comments').delete().eq('id', id))
}

// --- Barista-Profil eines anderen Nutzers -------------------------------------------
export async function getBaristaProfile(userId) {
  const [profile, beans, machines, grinders, brews, rel] = await Promise.all([
    getProfile(userId),
    supabase.from('beans').select('id,name,roaster,origin,roast_level,image_url,flavor_notes').eq('user_id', userId).eq('active', true).order('created_at', { ascending: false }),
    supabase.from('machines').select('id,name,type,preset_id,image_url').eq('user_id', userId),
    supabase.from('grinders').select('id,name,scale_type,preset_id,image_url').eq('user_id', userId),
    supabase.from('brews').select(BREW_SELECT).eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    listFriendships(),
  ])
  const all = [...rel.friends, ...rel.incoming, ...rel.outgoing]
  const link = all.find((f) => f.profile?.id === userId)
  const relation = !link ? 'none' : rel.friends.includes(link) ? 'friends' : rel.incoming.includes(link) ? 'incoming' : 'outgoing'
  return {
    profile,
    beans: check(beans),
    machines: check(machines),
    grinders: check(grinders),
    brews: await withMyLikes(check(brews)),
    relation,
    friendshipId: link?.friendship.id ?? null,
  }
}
