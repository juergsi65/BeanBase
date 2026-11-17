import { Camera, ChevronRight, Coffee, Cog, Download, Lock, MessageSquare, Wrench, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { errMsg } from '../lib/errors'
import { Field, Empty, Chip, ConfirmButton, Segmented } from '../components/ui'
import { THEME_LABEL } from '../lib/theme'
import { spending, fmtMoney } from '../lib/cost'
import { downloadBackup } from '../lib/db'
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
import css from './ProfilePage.module.css'

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
      <h3 className="lbl">Barista-Visitenkarte</h3>
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
              <Coffee size={18} className="text-muted" aria-hidden /> {m.name} <span className="text-muted text-sm">{MACHINE_TYPES[m.type]}</span>
            </li>
          ))}
          {grinders.map((g) => (
            <li key={g.id}>
              <Cog size={18} className="text-muted" aria-hidden /> {g.name} <span className="text-muted text-sm">{SCALE_TYPES[g.scale_type]}</span>
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

export default function ProfilePage({ data, go, me, theme }: PageProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [editing, setEditing] = useState(false)
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

  // Öffentlich/privat sofort speichern (Schalter in den Einstellungen)
  const togglePublic = async () => {
    try {
      const p = await updateMyProfile({ is_public: !profile.is_public })
      setProfile(p)
      setForm((f) => f && { ...f, is_public: p.is_public })
    } catch (err) {
      setMsg({ tone: 'error', text: errMsg(err) })
    }
  }

  const ratings = data.brews.map((b) => b.rating).filter((r): r is number => r != null)
  const perCup = spending(data.brews, data.bean_stock, 36500).perCup
  const stats: { k: string; v: string; accent?: boolean; desk?: boolean }[] = [
    { k: 'Bezüge', v: String(data.brews.length) },
    { k: 'Bohnen', v: String(data.beans.length) },
    { k: 'Freunde', v: String(rel.friends.length) },
    { k: 'Ø Wertung', v: ratings.length ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : '–', accent: true },
    { k: 'Ø pro Tasse', v: perCup != null ? fmtMoney(perCup) : '–', desk: true },
  ]
  const gear = [
    ...data.machines.map((m) => ({ id: m.id, img: m.image_url, kind: `Maschine · ${MACHINE_TYPES[m.type]}`, name: m.name })),
    ...data.grinders.map((g) => ({ id: g.id, img: g.image_url, kind: `Mühle · ${SCALE_TYPES[g.scale_type]}`, name: g.name })),
  ]
  const row = 'flex w-full cursor-pointer items-center justify-between gap-3 border-t border-base-300 px-4 py-3.5 text-left'

  return (
    <div className="flex flex-col gap-5 desk:gap-6">
      <header className="flex flex-wrap items-center gap-3.5 desk:gap-5">
        <label className="relative inline-block shrink-0 cursor-pointer" title="Profilbild ändern">
          <span className="desk:hidden"><Avatar profile={profile} size={76} /></span>
          <span className="hidden desk:inline"><Avatar profile={profile} size={96} /></span>
          <span className="absolute -right-0.5 -bottom-0.5 grid size-7 place-items-center rounded-full border-2 border-base-100 bg-accent text-accent-content"><Camera size={14} aria-hidden /></span>
          <input type="file" accept="image/*" hidden onChange={onAvatar} data-testid="avatar-upload" aria-label="Profilbild ändern" />
        </label>
        <div className="min-w-0 grow basis-52">
          <h2 className="text-2xl desk:text-[34px] desk:tracking-[-0.025em]">{profile.display_name || profile.username}</h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted desk:text-base">
            <span>@{profile.username} · {profile.is_public ? 'öffentliches Profil' : 'nur für Freunde'}</span>
            {me?.role === 'admin' ? <Chip tone="good">Admin</Chip> : <Chip>Beta-Tester</Chip>}
          </div>
          {profile.bio && <p className="mt-2 text-base-content/80 [overflow-wrap:anywhere]">{profile.bio}</p>}
        </div>
        <button className="btn h-11 rounded-[12px] border-base-300 bg-base-100 font-normal" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          {editing ? 'Schließen' : 'Profil bearbeiten'}
        </button>
      </header>

      {editing && (
        <form className="card gap-3.5 border border-base-300 bg-base-100 p-4 desk:max-w-xl desk:p-5" onSubmit={save}>
          <Field label="Username" hint="3–20 Zeichen: a–z, 0–9, _">
            <input className="input w-full" value={form.username} onChange={set('username')} autoCapitalize="none" autoCorrect="off" maxLength={20} />
          </Field>
          <Field label="Anzeigename">
            <input className="input w-full" value={form.display_name} onChange={set('display_name')} maxLength={40} placeholder="z. B. Jürgen" />
          </Field>
          <Field label="Bio">
            <textarea className="textarea w-full" rows={2} value={form.bio} onChange={set('bio')} maxLength={280} placeholder="z. B. Espresso-Nerd, helle Röstungen, Lelit Bianca" />
          </Field>
          <button className="btn btn-primary btn-block" disabled={saving}>
            {saving ? 'Speichere …' : 'Profil speichern'}
          </button>
        </form>
      )}
      {msg && <div className={`alert alert-soft block alert-${msg.tone}`}>{msg.text}</div>}

      <div className="flex flex-wrap gap-px overflow-hidden rounded-[16px] border border-base-300 bg-base-300">
        {stats.map((s) => (
          <div key={s.k} className={`min-w-0 flex-1 basis-[22%] bg-base-100 p-2.5 desk:basis-35 desk:p-4 ${s.desk ? 'hidden desk:block' : ''}`}>
            <div className={`num text-xl font-semibold desk:text-[28px] ${s.accent ? 'text-accent-strong' : ''}`}>{s.v}</div>
            <div className="text-xs text-muted desk:text-[13px]">{s.k}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-5 desk:flex-row desk:items-start desk:gap-6">
        <section className="flex min-w-0 flex-col gap-3 desk:flex-[1_1_420px]">
          <h3 className="lbl">Mein Setup</h3>
          {profile.setup_photo_url && <img className="media setup-photo" src={profile.setup_photo_url} alt="Kaffee-Setup" loading="lazy" />}
          {gear.length ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2 desk:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] desk:gap-3">
              {gear.map((g) => (
                <button key={g.id} className="flex cursor-pointer flex-col gap-2.5 rounded-[14px] border border-base-300 bg-base-100 p-3 text-left desk:gap-3 desk:rounded-[16px] desk:p-3.5" onClick={() => go('equipment')}>
                  {g.img ? (
                    <img className="h-22.5 w-full rounded-[10px] object-cover desk:h-37.5 desk:rounded-[12px]" src={g.img} alt="" loading="lazy" />
                  ) : (
                    <span className="grid h-22.5 place-items-center rounded-[10px] border border-dashed border-(--line-strong) text-xs text-muted desk:h-37.5 desk:rounded-[12px]">Foto</span>
                  )}
                  <span>
                    <span className="lbl block">{g.kind}</span>
                    <span className="font-semibold desk:text-[17px]">{g.name}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <button className="btn h-11 rounded-[12px] border-(--line-strong) bg-transparent font-normal" onClick={() => go('equipment')}>
              + Maschine &amp; Mühle eintragen
            </button>
          )}
          <SetupPhotoEditor profile={profile} onSaved={setProfile} />
        </section>

        <section className="flex min-w-0 flex-col gap-3 desk:flex-[1_1_360px]">
          <h3 className="lbl">Einstellungen</h3>
          <div className="overflow-hidden rounded-[14px] border border-base-300 bg-base-100 desk:rounded-[16px] [&>*:first-child]:border-t-0">
            <label className={row} aria-label="Profil öffentlich">
              <span>
                <span className="block font-medium">Profil öffentlich</span>
                <span className="text-[13px] text-muted">{profile.is_public ? 'Alle sehen deine Bezüge, nicht nur Freunde' : 'Nur Freunde sehen deine Bezüge'}</span>
              </span>
              <input className="toggle toggle-primary" type="checkbox" checked={profile.is_public} onChange={() => void togglePublic()} />
            </label>
            <div className="flex flex-col gap-2.5 border-t border-base-300 px-4 py-3.5">
              <span className="font-medium">Darstellung</span>
              <Segmented options={THEME_LABEL} value={theme.theme} onChange={(v) => v && theme.setTheme(v)} />
            </div>
            <button className={row} onClick={() => go('feedback')}>
              <span className="flex items-center gap-2"><MessageSquare size={18} strokeWidth={1.75} aria-hidden /> Feedback an das Team</span>
              <ChevronRight size={16} className="text-muted" aria-hidden />
            </button>
            <button className={row} onClick={() => void downloadBackup()}>
              <span className="flex items-center gap-2"><Download size={18} strokeWidth={1.75} aria-hidden /> Daten exportieren</span>
              <span className="num text-xs text-muted">JSON</span>
            </button>
            <details className="border-t border-base-300 [&[open]>summary]:pb-2">
              <summary className={`${row} list-none border-t-0 [&::-webkit-details-marker]:hidden`}>
                <span className="flex items-center gap-2"><Lock size={18} strokeWidth={1.75} aria-hidden /> Passwort ändern</span>
                <ChevronRight size={16} className="text-muted" aria-hidden />
              </summary>
              <div className="px-4 pb-4"><PasswordForm /></div>
            </details>
            {me?.role === 'admin' && (
              <button className={row} onClick={() => go('admin')}>
                <span className="flex items-center gap-2"><Wrench size={18} strokeWidth={1.75} aria-hidden /> Admin-Bereich</span>
                <ChevronRight size={16} className="text-muted" aria-hidden />
              </button>
            )}
            <button className={`${row} text-error`} onClick={() => supabase?.auth.signOut()}>
              Abmelden
            </button>
          </div>
          <ConfirmButton
            className="btn btn-ghost btn-sm self-start font-normal text-error"
            question="Konto und alle Daten (Bohnen, Bezüge, Foto-Verknüpfungen, Freunde) endgültig löschen? Zum Bestätigen LÖSCHEN eintippen."
            confirmLabel="Konto endgültig löschen"
            typeToConfirm="LÖSCHEN"
            onConfirm={async () => {
              try {
                await deleteMyAccount()
                await supabase?.auth.signOut()
              } catch (e) {
                toast(errMsg(e), { tone: 'error' })
              }
            }}
          >
            Konto löschen
          </ConfirmButton>
        </section>
      </div>

      <div className={`${css.friends} flex flex-col gap-4`}>
      <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
        <h3 className="lbl">Freunde finden</h3>
        <input className="input w-full" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Username suchen …" autoCapitalize="none" />
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
          <h3 className="lbl">Anfragen an dich ({rel.incoming.length})</h3>
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
        <h3 className="lbl">Freunde ({rel.friends.length})</h3>
        {rel.friends.length ? (
          <ul className="items">
            {rel.friends.map(({ friendship, profile: p }) => (
              <PersonRow key={friendship.id} profile={p} onOpen={open}>
                <ConfirmButton
                  question={`Freundschaft mit @${p.username} beenden?`}
                  confirmLabel="Freundschaft beenden"
                  onConfirm={act(() => removeFriendship(friendship.id))}
                  ariaLabel={`Freundschaft mit @${p.username} beenden`}
                >
                  <X size={18} aria-hidden />
                </ConfirmButton>
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
