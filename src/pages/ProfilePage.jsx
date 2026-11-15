import { useEffect, useState } from 'react'
import { Field, Empty } from '../components/ui'
import Avatar from '../components/Avatar'
import { SocialUnavailable } from './CommunityPage'
import { MACHINE_TYPES, SCALE_TYPES } from '../lib/coffee'
import { resizeImage } from '../lib/images'
import {
  socialAvailable, myId, getProfile, updateMyProfile, uploadAvatar, deleteAvatar, USERNAME_RE,
  searchProfiles, listFriendships, sendFriendRequest, acceptFriend, removeFriendship,
} from '../lib/social'

/** Barista-Visitenkarte: Setup + Kennzahlen */
export function SetupCard({ machines, grinders, beansCount, brewsCount }) {
  return (
    <section className="card">
      <h3 className="section-title">Barista-Visitenkarte</h3>
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
          {brewsCount != null && `${brewsCount} Bezüge`}
        </p>
      )}
    </section>
  )
}

function PersonRow({ profile, onOpen, children }) {
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

export default function ProfilePage({ data, go }) {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(null)
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [rel, setRel] = useState({ friends: [], incoming: [], outgoing: [] })
  const [q, setQ] = useState('')
  const [hits, setHits] = useState([])

  const reloadFriends = async () => setRel(await listFriendships())

  useEffect(() => {
    if (!socialAvailable) return
    ;(async () => {
      try {
        const p = await getProfile(await myId())
        setProfile(p)
        setForm({ username: p?.username ?? '', display_name: p?.display_name ?? '', bio: p?.bio ?? '', is_public: !!p?.is_public })
        await reloadFriends()
      } catch (e) {
        setMsg({ tone: 'error', text: e.message })
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
  if (!form) return <p className="muted">Lade Profil …</p>

  const open = (id) => go('user', { userId: id })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const save = async (e) => {
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
      setForm((f) => ({ ...f, username: p.username }))
      setMsg({ tone: 'info', text: 'Profil gespeichert.' })
    } catch (err) {
      setMsg({ tone: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const onAvatar = async (e) => {
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
      setMsg({ tone: 'error', text: `Profilbild: ${err.message}` })
    }
  }

  const act = (fn) => async (...args) => {
    try {
      await fn(...args)
      await reloadFriends()
    } catch (err) {
      setMsg({ tone: 'error', text: err.message })
    }
  }
  const relationOf = (id) => {
    if (rel.friends.some((f) => f.profile.id === id)) return 'Freund'
    if (rel.outgoing.some((f) => f.profile.id === id)) return 'Angefragt'
    if (rel.incoming.some((f) => f.profile.id === id)) return 'Fragt dich an'
    return null
  }

  return (
    <div className="stack">
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
      />

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
