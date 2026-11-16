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
    <section className="card">
      <h3 className="section-title">Barista-Visitenkarte</h3>
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
        <ul className="setup-list">
          {machines.map((m) => (
            <li key={m.id}>
              <span>☕</span> {m.name} <span className="muted small">{MACHINE_TYPES[m.type]}</span>
            </li>
          ))}
          {grinders.map((g) => (
            <li key={g.id}>
              <span>⚙️</span> {g.name} <span className="muted small">{SCALE_TYPES[g.scale_type]}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Noch kein Equipment eingetragen.</p>
      )}
      {(beansCount != null || brewsCount != null) && (
        <p className="muted small">
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
    <li className="list-item">
      <button type="button" className="feed-author" onClick={() => onOpen(profile.id)}>
        <Avatar profile={profile} size={36} />
        <span>
          <strong>{profile.display_name || profile.username}</strong>
          <span className="muted small">@{profile.username}</span>
        </span>
      </button>
      <div className="row-actions">{children}</div>
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
  if (!form || !profile) return <p className="muted">Lade Profil …</p>

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
    <div className="stack profile-page">
      <h2>Mein Profil</h2>
      <form className="card" onSubmit={save}>
        <div className="profile-head">
          <label className="avatar-upload" title="Profilbild ändern">
            <Avatar profile={profile} size={72} />
            <span className="avatar-edit">📷</span>
            <input type="file" accept="image/*" hidden onChange={onAvatar} data-testid="avatar-upload" />
          </label>
          <div>
            <strong>{profile.display_name || profile.username}</strong>
            <span className="muted small">@{profile.username}</span>
            <span>{me?.role === 'admin' ? <Chip tone="good">Admin</Chip> : <Chip>Beta-Tester</Chip>}</span>
          </div>
        </div>
        <Field label="Username" hint="3–20 Zeichen: a–z, 0–9, _">
          <input value={form.username} onChange={set('username')} autoCapitalize="none" autoCorrect="off" maxLength={20} />
        </Field>
        <Field label="Anzeigename">
          <input value={form.display_name} onChange={set('display_name')} maxLength={40} placeholder="z. B. Jürgen" />
        </Field>
        <Field label="Bio">
          <textarea rows={2} value={form.bio} onChange={set('bio')} maxLength={280} placeholder="z. B. Espresso-Nerd, helle Röstungen, Lelit Bianca" />
        </Field>
        <label className="toggle">
          <input type="checkbox" checked={form.is_public} onChange={set('is_public')} />
          <span>
            Profil öffentlich
            <span className="muted small" style={{ display: 'block', fontWeight: 400 }}>
              {form.is_public
                ? 'Alle BeanBase-Nutzer sehen deine Bohnen, dein Setup und deine Bezüge („Alle Baristas“).'
                : 'Nur akzeptierte Freunde sehen deine Bohnen, dein Setup und deine Bezüge.'}
            </span>
          </span>
        </label>
        {msg && <div className={`banner ${msg.tone}`}>{msg.text}</div>}
        <button className="btn primary block" disabled={saving}>
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

      <section className="card">
        {me?.role === 'admin' && (
          <button className="btn primary block" onClick={() => go('admin')}>
            🛠 Admin-Bereich
          </button>
        )}
        <button className="btn ghost block" onClick={() => go('feedback')}>
          💬 Feedback zur Beta geben
        </button>
        <details className="pw-change">
          <summary className="btn ghost block">🔒 Passwort ändern</summary>
          <PasswordForm />
        </details>
        <button className="btn ghost block" onClick={() => supabase?.auth.signOut()}>
          Abmelden
        </button>
        <button
          className="btn danger-ghost block"
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

      <section className="card">
        <h3 className="section-title">Freunde finden</h3>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Username suchen …" autoCapitalize="none" />
        {hits.length > 0 && (
          <ul className="list">
            {hits.map((h) => {
              const r = relationOf(h.id)
              return (
                <PersonRow key={h.id} profile={h} onOpen={open}>
                  {r ? (
                    <span className="muted small">{r}</span>
                  ) : (
                    <button className="btn primary sm" onClick={act(() => sendFriendRequest(h.id))}>
                      + Anfrage
                    </button>
                  )}
                </PersonRow>
              )
            })}
          </ul>
        )}
        {q.trim().length >= 2 && !hits.length && <p className="muted small">Kein Nutzer gefunden.</p>}
      </section>

      {rel.incoming.length > 0 && (
        <section className="card">
          <h3 className="section-title">Anfragen an dich ({rel.incoming.length})</h3>
          <ul className="list">
            {rel.incoming.map(({ friendship, profile: p }) => (
              <PersonRow key={friendship.id} profile={p} onOpen={open}>
                <button className="btn primary sm" onClick={act(() => acceptFriend(friendship.id))}>
                  Annehmen
                </button>
                <button className="btn ghost sm" onClick={act(() => removeFriendship(friendship.id))}>
                  Ablehnen
                </button>
              </PersonRow>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h3 className="section-title">Freunde ({rel.friends.length})</h3>
        {rel.friends.length ? (
          <ul className="list">
            {rel.friends.map(({ friendship, profile: p }) => (
              <PersonRow key={friendship.id} profile={p} onOpen={open}>
                <button
                  className="btn danger-ghost sm"
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
            <p className="muted small">Gesendete Anfragen</p>
            <ul className="list">
              {rel.outgoing.map(({ friendship, profile: p }) => (
                <PersonRow key={friendship.id} profile={p} onOpen={open}>
                  <button className="btn ghost sm" onClick={act(() => removeFriendship(friendship.id))}>
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
      <p className="muted small">{busy ? 'Lade hoch …' : profile.setup_photo_url ? 'Setup-Foto ändern:' : 'Zeig dein Setup – ein Foto für deine Visitenkarte:'}</p>
      {!profile.setup_photo_url && <MediaPicker allowVideo={false} onChange={change} />}
      {profile.setup_photo_url && (
        <button type="button" className="btn ghost sm" onClick={() => change({ pending: null, removed: true })} disabled={busy}>
          Setup-Foto entfernen
        </button>
      )}
    </div>
  )
}
