import { useEffect, useState } from 'react'
import { errMsg } from '../lib/errors'
import { Field, Empty, Chip } from '../components/ui'
import Avatar from '../components/Avatar'
import { SocialUnavailable } from './CommunityPage'
import { MACHINE_TYPES, SCALE_TYPES, plural } from '../lib/coffee'
import { resizeImage } from '../lib/images'
import MediaPicker from '../components/MediaPicker'
import { uploadMedia, deleteMedia } from '../lib/media'
import { toast } from '../lib/toast'
import { supabase } from '../lib/supabase'
import { deleteMyAccount } from '../lib/admin'
import { PasswordForm } from './SetPasswordPage'
import {
  socialAvailable, myId, getProfile, updateMyProfile, uploadAvatar, deleteAvatar, USERNAME_RE,
  searchProfiles, listFriendships, sendFriendRequest, acceptFriend, removeFriendship,
  type FriendItem, type PublicProfile,
} from '../lib/social'
import type { ReactNode } from 'react'
import type { MediaChange } from '../components/MediaPicker'
import type { Grinder, Machine, PageProps } from '../types'

interface ProfileForm {
  username: string
  display_name: string
  bio: string
  is_public: boolean
}
type Msg = { tone: 'error' | 'info'; text: string }

/** Barista-Visitenkarte: Setup + Kennzahlen */
export function SetupCard({
  machines,
  grinders,
  beansCount,
  brewsCount,
  setupPhoto,
  children,
}: {
  machines: Pick<Machine, 'id' | 'name' | 'type' | 'image_url'>[]
  grinders: Pick<Grinder, 'id' | 'name' | 'scale_type' | 'image_url'>[]
  beansCount?: number | null
  brewsCount?: number | null
  setupPhoto?: string | null
  children?: ReactNode
}) {
  const gear = [...machines, ...grinders].filter((g): g is typeof g & { image_url: string } => !!g.image_url)
  return (
    <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
      <h3 className="text-xs uppercase tracking-widest text-muted">Barista-Visitenkarte</h3>
      {setupPhoto && <img className="media setup-photo" src={setupPhoto} alt="Kaffee-Setup" loading="lazy" />}
      {gear.length > 0 && (
        <div className="gear-strip">
          {gear.map((g) => (
            <figure key={g.id}>
              <img src={g.image_url} alt="" loading="lazy" />
              <figcaption>{g.name}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {children}
      {machines.length || grinders.length ? (
        <ul className="flex flex-col gap-1.5 [&>li]:flex [&>li]:items-baseline [&>li]:gap-2">
          {machines.map((m) => (
            <li key={m.id}>
              <span>☕</span> {m.name} <span className="text-muted text-sm">{MACHINE_TYPES[m.type]}</span>
            </li>
          ))}
          {grinders.map((g) => (
            <li key={g.id}>
              <span>⚙️</span> {g.name} <span className="text-muted text-sm">{SCALE_TYPES[g.scale_type]}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-sm">Noch kein Equipment eingetragen.</p>
      )}
      {(beansCount != null || brewsCount != null) && (
        <p className="text-muted text-sm">
          {beansCount != null && `${beansCount} aktive Bohnen`}
          {beansCount != null && brewsCount != null && ' · '}
          {brewsCount != null && plural(brewsCount, 'Bezug', 'Bezüge')}
        </p>
      )}
    </section>
  )
}

function PersonRow({ profile, onOpen, children }: { profile: PublicProfile; onOpen: (id: string) => void; children: ReactNode }) {
  return (
    <li className="item">
      <button type="button" className="flex min-w-0 cursor-pointer items-center gap-2.5 text-left [&>span]:flex [&>span]:min-w-0 [&>span]:flex-col" onClick={() => onOpen(profile.id)}>
        <Avatar profile={profile} size={36} />
        <span>
          <strong>{profile.display_name || profile.username}</strong>
          <span className="text-muted text-sm">@{profile.username}</span>
        </span>
      </button>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </li>
  )
}

export default function ProfilePage({ data, go, me }: PageProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [form, setForm] = useState<ProfileForm | null>(null)
  const [msg, setMsg] = useState<Msg | null>(null)
  const [saving, setSaving] = useState(false)
  const [rel, setRel] = useState<{ friends: FriendItem[]; incoming: FriendItem[]; outgoing: FriendItem[] }>({
    friends: [],
    incoming: [],
    outgoing: [],
  })
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PublicProfile[]>([])

  const reloadFriends = async () => setRel(await listFriendships())

  useEffect(() => {
    if (!socialAvailable) return
    ;(async () => {
      try {
        const id = await myId()
        const p = id ? await getProfile(id) : null
        setProfile(p)
        setForm({ username: p?.username ?? '', display_name: p?.display_name ?? '', bio: p?.bio ?? '', is_public: !!p?.is_public })
        await reloadFriends()
      } catch (e) {
        setMsg({ tone: 'error', text: errMsg(e) })
      }
    })()
  }, [])

  // Freundessuche (entprellt)
  useEffect(() => {
    if (!socialAvailable) return
    const t = setTimeout(async () => setHits(q.trim().length >= 2 ? await searchProfiles(q).catch(() => []) : []), 300)
    return () => clearTimeout(t)
  }, [q])

  if (!socialAvailable) return <SocialUnavailable />
  if (!form || !profile) return <p className="text-muted">Lade Profil …</p>

  const open = (id: string) => go('user', { userId: id })
  const set = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => f && { ...f, [k]: e.target instanceof HTMLInputElement && e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const username = form.username.trim().toLowerCase()
    if (!USERNAME_RE.test(username)) return setMsg({ tone: 'error', text: 'Username: 3–20 Zeichen, nur a–z, 0–9 und _.' })
    setSaving(true)
    try {
      const p = await updateMyProfile({
        username,
        display_name: form.display_name.trim() || null,
        bio: form.bio.trim() || null,
        is_public: form.is_public,
      })
      setProfile(p)
      setForm((f) => f && { ...f, username: p.username })
      setMsg({ tone: 'info', text: 'Profil gespeichert.' })
    } catch (err) {
      setMsg({ tone: 'error', text: errMsg(err) })
    } finally {
      setSaving(false)
    }
  }

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const { blob } = await resizeImage(file, 400, 0.85)
      const url = await uploadAvatar(blob)
      const old = profile.avatar_url
      setProfile(await updateMyProfile({ avatar_url: url }))
      if (old) deleteAvatar(old).catch(() => {})
    } catch (err) {
      setMsg({ tone: 'error', text: `Profilbild: ${errMsg(err)}` })
    }
  }

  const act = (fn: () => Promise<unknown>) => async () => {
    try {
      await fn()
      await reloadFriends()
    } catch (err) {
      setMsg({ tone: 'error', text: errMsg(err) })
    }
  }
  const relationOf = (id: string) => {
    if (rel.friends.some((f) => f.profile.id === id)) return 'Freund'
    if (rel.outgoing.some((f) => f.profile.id === id)) return 'Angefragt'
    if (rel.incoming.some((f) => f.profile.id === id)) return 'Fragt dich an'
    return null
  }

  return (
    <div className="profile-page flex flex-col gap-4 desk:block">
      <h2>Mein Profil</h2>
      <form className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5" onSubmit={save}>
        <div className="flex items-center gap-3.5 [&>div]:flex [&>div]:flex-col">
          <label className="relative inline-block cursor-pointer" title="Profilbild ändern">
            <Avatar profile={profile} size={72} />
            <span className="avatar-edit">📷</span>
            <input type="file" accept="image/*" hidden onChange={onAvatar} data-testid="avatar-upload" />
          </label>
          <div>
            <strong>{profile.display_name || profile.username}</strong>
            <span className="text-muted text-sm">@{profile.username}</span>
            <span>{me?.role === 'admin' ? <Chip tone="good">Admin</Chip> : <Chip>Beta-Tester</Chip>}</span>
          </div>
        </div>
        <Field label="Username" hint="3–20 Zeichen: a–z, 0–9, _">
          <input className="input w-full" value={form.username} onChange={set('username')} autoCapitalize="none" autoCorrect="off" maxLength={20} />
        </Field>
        <Field label="Anzeigename">
          <input className="input w-full" value={form.display_name} onChange={set('display_name')} maxLength={40} placeholder="z. B. Jürgen" />
        </Field>
        <Field label="Bio">
          <textarea className="textarea w-full" rows={2} value={form.bio} onChange={set('bio')} maxLength={280} placeholder="z. B. Espresso-Nerd, helle Röstungen, Lelit Bianca" />
        </Field>
        <label className="flex items-center gap-3 cursor-pointer font-semibold">
          <input className="checkbox checkbox-primary" type="checkbox" checked={form.is_public} onChange={set('is_public')} />
          <span>
            Profil öffentlich
            <span className="text-muted text-sm" style={{ display: 'block', fontWeight: 400 }}>
              {form.is_public
                ? 'Alle BeanBase-Nutzer sehen deine Bohnen, dein Setup und deine Bezüge („Alle Baristas“).'
                : 'Nur akzeptierte Freunde sehen deine Bohnen, dein Setup und deine Bezüge.'}
            </span>
          </span>
        </label>
        {msg && <div className={`alert alert-soft block alert-${msg.tone}`}>{msg.text}</div>}
        <button className="btn btn-primary btn-block" disabled={saving}>
          {saving ? 'Speichere …' : 'Profil speichern'}
        </button>
      </form>

      <SetupCard
        machines={data.machines}
        grinders={data.grinders}
        beansCount={data.beans.filter((b) => b.active).length}
        brewsCount={data.brews.length}
        setupPhoto={profile.setup_photo_url}
      >
        <SetupPhotoEditor profile={profile} onSaved={setProfile} />
      </SetupCard>

      <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
        {me?.role === 'admin' && (
          <button className="btn btn-primary btn-block" onClick={() => go('admin')}>
            🛠 Admin-Bereich
          </button>
        )}
        <button className="btn btn-ghost border-base-300 btn-block" onClick={() => go('feedback')}>
          💬 Feedback zur Beta geben
        </button>
        <details className="[&[open]>summary]:mb-3">
          <summary className="btn btn-ghost border-base-300 btn-block list-none [&::-webkit-details-marker]:hidden">🔒 Passwort ändern</summary>
          <PasswordForm />
        </details>
        <button className="btn btn-ghost border-base-300 btn-block" onClick={() => supabase?.auth.signOut()}>
          Abmelden
        </button>
        <button
          className="btn btn-outline btn-error btn-block"
          onClick={async () => {
            if (prompt('Konto und ALLE Daten (Bohnen, Bezüge, Fotos-Verknüpfungen, Freunde) endgültig löschen? Zum Bestätigen LÖSCHEN eintippen:') !== 'LÖSCHEN') return
            try {
              await deleteMyAccount()
              await supabase?.auth.signOut()
            } catch (e) {
              toast(errMsg(e), { tone: 'error' })
            }
          }}
        >
          Konto löschen
        </button>
      </section>

      <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
        <h3 className="text-xs uppercase tracking-widest text-muted">Freunde finden</h3>
        <input className="input w-full" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Username suchen …" autoCapitalize="none" />
        {hits.length > 0 && (
          <ul className="items">
            {hits.map((h) => {
              const r = relationOf(h.id)
              return (
                <PersonRow key={h.id} profile={h} onOpen={open}>
                  {r ? (
                    <span className="text-muted text-sm">{r}</span>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={act(() => sendFriendRequest(h.id))}>
                      + Anfrage
                    </button>
                  )}
                </PersonRow>
              )
            })}
          </ul>
        )}
        {q.trim().length >= 2 && !hits.length && <p className="text-muted text-sm">Kein Nutzer gefunden.</p>}
      </section>

      {rel.incoming.length > 0 && (
        <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
          <h3 className="text-xs uppercase tracking-widest text-muted">Anfragen an dich ({rel.incoming.length})</h3>
          <ul className="items">
            {rel.incoming.map(({ friendship, profile: p }) => (
              <PersonRow key={friendship.id} profile={p} onOpen={open}>
                <button className="btn btn-primary btn-sm" onClick={act(() => acceptFriend(friendship.id))}>
                  Annehmen
                </button>
                <button className="btn btn-ghost border-base-300 btn-sm" onClick={act(() => removeFriendship(friendship.id))}>
                  Ablehnen
                </button>
              </PersonRow>
            ))}
          </ul>
        </section>
      )}

      <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
        <h3 className="text-xs uppercase tracking-widest text-muted">Freunde ({rel.friends.length})</h3>
        {rel.friends.length ? (
          <ul className="items">
            {rel.friends.map(({ friendship, profile: p }) => (
              <PersonRow key={friendship.id} profile={p} onOpen={open}>
                <button
                  className="btn btn-outline btn-error btn-sm"
                  onClick={act(async () => {
                    if (confirm(`Freundschaft mit @${p.username} beenden?`)) await removeFriendship(friendship.id)
                  })}
                  aria-label="Freund entfernen"
                >
                  ✕
                </button>
              </PersonRow>
            ))}
          </ul>
        ) : (
          <Empty>Noch keine Freunde – such oben nach einem Username.</Empty>
        )}
        {rel.outgoing.length > 0 && (
          <>
            <p className="text-muted text-sm">Gesendete Anfragen</p>
            <ul className="items">
              {rel.outgoing.map(({ friendship, profile: p }) => (
                <PersonRow key={friendship.id} profile={p} onOpen={open}>
                  <button className="btn btn-ghost border-base-300 btn-sm" onClick={act(() => removeFriendship(friendship.id))}>
                    Zurückziehen
                  </button>
                </PersonRow>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}

/** Foto vom ganzen Setup (wird direkt nach Auswahl gespeichert) */
function SetupPhotoEditor({ profile, onSaved }: { profile: PublicProfile; onSaved: (p: PublicProfile) => void }) {
  const [busy, setBusy] = useState(false)
  const change = async ({ pending, removed }: MediaChange) => {
    setBusy(true)
    try {
      const old = profile.setup_photo_url
      const url = pending ? (await uploadMedia(pending)).url : null
      if (pending || removed) {
        onSaved(await updateMyProfile({ setup_photo_url: url }))
        if (old) deleteMedia(old).catch(() => {})
        toast(url ? 'Setup-Foto gespeichert' : 'Setup-Foto entfernt')
      }
    } catch (e) {
      toast(errMsg(e), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <p className="text-muted text-sm">{busy ? 'Lade hoch …' : profile.setup_photo_url ? 'Setup-Foto ändern:' : 'Zeig dein Setup – ein Foto für deine Visitenkarte:'}</p>
      {!profile.setup_photo_url && <MediaPicker allowVideo={false} onChange={change} />}
      {profile.setup_photo_url && (
        <button type="button" className="btn btn-ghost border-base-300 btn-sm" onClick={() => change({ pending: null, removed: true })} disabled={busy}>
          Setup-Foto entfernen
        </button>
      )}
    </div>
  )
}
