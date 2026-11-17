import { useState } from 'react'
import { errMsg } from '../lib/errors'
import { useQuery } from '@tanstack/react-query'
import { Segmented, Empty, Field, Chip, statCls, statValueCls, statTitleCls, ConfirmButton } from '../components/ui'
import Avatar from '../components/Avatar'
import { MediaView } from '../components/MediaPicker'
import { fmtDate, plural } from '../lib/coffee'
import { toast } from '../lib/toast'
import { useSettings } from '../lib/settings'
import {
  adminOverview, adminUsers, adminSetBlocked, adminDeleteUser, adminSetSetting, adminCreateInvite, adminDeleteInvite,
  adminListInvites, adminRecentContent, adminDeleteComment, adminRemoveMedia, listFeedback, setFeedbackStatus, deleteFeedback,
} from '../lib/admin'
import type { ReactNode } from 'react'
import type { AppSettings } from '../lib/settings'
import type { MyProfile } from '../lib/social'
import type { Feedback, PageProps } from '../types'

type Section = 'overview' | 'users' | 'invites' | 'feedback' | 'moderation' | 'settings'
const SECTIONS: Record<Section, string> = { overview: 'Übersicht', users: 'Nutzer', invites: 'Einladungen', feedback: 'Feedback', moderation: 'Moderation', settings: 'Einstellungen' }
const STORAGE_LIMIT_MB = 1024 // Supabase Free Plan

interface LoadState<T> {
  data: T | undefined
  loading: boolean
  error: string | undefined
}
function useLoad<T>(key: string, fn: () => Promise<T>) {
  const q = useQuery({ queryKey: ['admin', key], queryFn: fn })
  const state: LoadState<T> = { data: q.data, loading: q.isPending, error: q.error?.message }
  return [state, q.refetch] as const
}

const act = (fn: () => Promise<unknown>, reload?: (() => Promise<unknown>) | null, ok?: string) => async () => {
  try {
    await fn()
    if (ok) toast(ok)
    await reload?.()
  } catch (e) {
    toast(errMsg(e), { tone: 'error' })
  }
}

function Loading<T>({ state, children }: { state: LoadState<T>; children: (data: T) => ReactNode }) {
  if (state.loading && !state.data) return <p className="flex items-center gap-2 text-muted"><span className="loading loading-dots loading-sm" /> Lade …</p>
  if (state.error) return <div className="alert alert-soft block alert-error">{state.error}</div>
  if (state.data === undefined) return null
  return <>{children(state.data)}</>
}

function Overview() {
  const [state] = useLoad('overview', adminOverview)
  return (
    <Loading state={state}>
      {(o) => (
        <>
          <div className="grid grid-cols-2 min-[361px]:grid-cols-3 min-[700px]:grid-cols-4 desk:grid-cols-5 gap-2">
            {[
              ['Nutzer', o.users, `+${o.users_7d} in 7 Tagen`],
              ['Aktiv (7 Tage)', o.active_7d, 'mit Bezug'],
              ['Bezüge', o.brews, `+${o.brews_7d} in 7 Tagen`],
              ['Bohnen', o.beans, ''],
              ['Freundschaften', o.friendships, `${o.public_profiles} öffentl. Profile`],
              ['Likes / Kommentare', `${o.likes} / ${o.comments}`, ''],
              ['Feedback offen', o.feedback_open, ''],
              ['Gesperrt', o.blocked, ''],
              ['Speicher', `${o.storage_mb} MB`, `von ${STORAGE_LIMIT_MB} MB (Free)`],
            ].map(([label, value, sub]) => (
              <div key={label} className={`${statCls} border border-base-300`}>
                <span className={statValueCls}>{value}</span>
                <span className={statTitleCls}>{label}</span>
                {sub && <span className="stat-desc text-[0.65rem] text-muted whitespace-normal text-center">{sub}</span>}
              </div>
            ))}
          </div>
          <progress className="progress progress-primary h-2.5" title="Speicherbelegung" value={Math.min(100, (o.storage_mb / STORAGE_LIMIT_MB) * 100)} max={100} />
        </>
      )}
    </Loading>
  )
}

function Users({ me }: { me: MyProfile }) {
  const [state, reload] = useLoad('users', adminUsers)
  const [q, setQ] = useState('')
  return (
    <Loading state={state}>
      {(users) => {
        const list = users.filter((u) => !q || `${u.username} ${u.display_name ?? ''} ${u.email ?? ''}`.toLowerCase().includes(q.toLowerCase()))
        return (
          <>
            <input className="input w-full" type="search" placeholder="🔍 Nutzer suchen …" value={q} onChange={(e) => setQ(e.target.value)} />
            <p className="text-muted text-sm">{plural(users.length, 'Konto', 'Konten')} · alle außer Admins sind Beta-Tester</p>
            <ul className="items">
              {list.map((u) => (
                <li key={u.id} className={`item col ${u.blocked ? 'blocked' : ''}`}>
                  <div className="flex flex-nowrap items-center justify-between gap-2.5">
                    <Avatar profile={u} size={36} />
                    <div className="grow">
                      <strong>
                        @{u.username} {u.role === 'admin' ? <Chip tone="good">Admin</Chip> : <Chip>Tester</Chip>}
                        {u.blocked && <Chip tone="bad">gesperrt</Chip>}
                      </strong>
                      <span className="text-muted text-sm">{u.email}</span>
                    </div>
                  </div>
                  <span className="text-muted text-sm">
                    seit {fmtDate(u.created_at)} · zuletzt online {u.last_sign_in_at ? fmtDate(u.last_sign_in_at) : '–'} · {plural(Number(u.beans), 'Bohne', 'Bohnen')} ·{' '}
                    {plural(Number(u.brews), 'Bezug', 'Bezüge')}
                    {u.is_public ? ' · öffentlich' : ''}
                  </span>
                  {u.role !== 'admin' && u.id !== me?.id && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button className="btn btn-ghost border-base-300 btn-sm" onClick={act(() => adminSetBlocked(u.id, !u.blocked), reload, u.blocked ? 'Entsperrt' : 'Gesperrt')}>
                        {u.blocked ? '🔓 Entsperren' : '🔒 Sperren'}
                      </button>
                      <ConfirmButton
                        question={`Konto @${u.username} mit allen Daten endgültig löschen? Zum Bestätigen den Username eintippen.`}
                        confirmLabel="Konto löschen"
                        typeToConfirm={u.username}
                        onConfirm={act(() => adminDeleteUser(u.id), reload, 'Konto gelöscht')}
                      >
                        🗑 Löschen
                      </ConfirmButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )
      }}
    </Loading>
  )
}

function Invites() {
  const [state, reload] = useLoad('invites', adminListInvites)
  const [form, setForm] = useState<{ uses: number | string; note: string; code: string }>({ uses: 1, note: '', code: '' })
  const [created, setCreated] = useState<string | null>(null)
  const link = (code: string) => `${window.location.origin}/?invite=${encodeURIComponent(code)}`
  const share = async (code: string) => {
    const text = `Du bist zum Beta-Test von BeanBase eingeladen ☕\nCode: ${code}\n${link(code)}`
    try {
      if (navigator.share) await navigator.share({ title: 'BeanBase Beta', text })
      else {
        await navigator.clipboard.writeText(text)
        toast('Einladung kopiert')
      }
    } catch {
      /* Teilen abgebrochen */
    }
  }
  const create = act(
    async () => {
      const code = await adminCreateInvite(Number(form.uses) || 1, form.note, form.code)
      setCreated(code)
      setForm({ uses: 1, note: '', code: '' })
    },
    reload,
    'Einladung erstellt',
  )
  return (
    <>
      <form
        className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5"
        onSubmit={(e) => {
          e.preventDefault()
          create()
        }}
      >
        <h3 className="text-xs uppercase tracking-widest text-muted">Neue Einladung</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nutzungen">
            <input className="input w-full" type="number" min="1" max="200" value={form.uses} onChange={(e) => setForm({ ...form, uses: e.target.value })} />
          </Field>
          <Field label="Eigener Code" hint="optional">
            <input className="input w-full" value={form.code} placeholder="automatisch" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          </Field>
        </div>
        <Field label="Notiz" hint="z. B. für wen">
          <input className="input w-full" value={form.note} maxLength={120} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
        <button className="btn btn-primary btn-block">Einladung erstellen</button>
        {created && (
          <div className="alert alert-soft block alert-info">
            Neuer Code: <strong>{created}</strong>{' '}
            <button type="button" className="link link-primary p-2 no-underline" onClick={() => share(created)}>
              Teilen / kopieren
            </button>
          </div>
        )}
      </form>
      <Loading state={state}>
        {(codes) =>
          codes.length ? (
            <ul className="items">
              {codes.map((c) => (
                <li key={c.code} className="item col">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <strong className="font-mono tracking-wider">{c.code}</strong>
                    <Chip tone={c.uses >= c.max_uses ? 'bad' : 'good'}>
                      {c.uses}/{c.max_uses} genutzt
                    </Chip>
                  </div>
                  {c.note && <span className="text-muted text-sm">{c.note}</span>}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button className="btn btn-ghost border-base-300 btn-sm" onClick={() => share(c.code)}>
                      📤 Teilen
                    </button>
                    <button className="btn btn-outline btn-error btn-sm" onClick={act(() => adminDeleteInvite(c.code), reload, 'Code gelöscht')}>
                      🗑
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Noch keine Einladungscodes.</Empty>
          )
        }
      </Loading>
    </>
  )
}

function FeedbackInbox() {
  const [state, reload] = useLoad('feedback', listFeedback)
  const [filter, setFilter] = useState<Feedback['status'] | 'alle'>('neu')
  return (
    <Loading state={state}>
      {(items) => {
        const list = items.filter((f) => filter === 'alle' || f.status === filter)
        return (
          <>
            <Segmented options={{ neu: `Offen (${items.filter((f) => f.status === 'neu').length})`, erledigt: 'Erledigt', alle: 'Alle' }} value={filter} onChange={(v) => v && setFilter(v)} />
            {!list.length && <Empty>Kein Feedback in dieser Ansicht.</Empty>}
            <ul className="items">
              {list.map((f) => (
                <li key={f.id} className="item col">
                  <span className="text-muted text-sm">
                    @{f.author?.username ?? 'gelöscht'} · {fmtDate(f.created_at)} · {f.context}
                  </span>
                  <span className="whitespace-pre-wrap">{f.message}</span>
                  <span className="text-muted text-[0.68rem]">{f.user_agent}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button className="btn btn-ghost border-base-300 btn-sm" onClick={act(() => setFeedbackStatus(f.id, f.status === 'neu' ? 'erledigt' : 'neu'), reload)}>
                      {f.status === 'neu' ? '✅ Erledigt' : '↩︎ Wieder öffnen'}
                    </button>
                    <ConfirmButton question="Dieses Feedback löschen?" confirmLabel="Feedback löschen" onConfirm={act(() => deleteFeedback(f.id), reload, 'Feedback gelöscht')} ariaLabel="Feedback löschen">
                      🗑
                    </ConfirmButton>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )
      }}
    </Loading>
  )
}

function Moderation() {
  const [state, reload] = useLoad('content', adminRecentContent)
  return (
    <Loading state={state}>
      {(content) => {
        const comments = Array.isArray(content?.comments) ? content.comments : []
        const media = Array.isArray(content?.media) ? content.media : []
        return (
        <>
          <h3 className="text-xs uppercase tracking-widest text-muted">Neueste Kommentare</h3>
          {!comments.length && <p className="text-muted text-sm">Keine Kommentare.</p>}
          <ul className="items">
            {comments.map((c) => (
              <li key={c.id} className="item">
                <div className="grow">
                  <span className="text-muted text-sm">
                    @{c.username} · {fmtDate(c.created_at)}
                  </span>
                  <span>{c.body}</span>
                </div>
                <button className="btn btn-outline btn-error btn-sm" onClick={act(() => adminDeleteComment(c.id), reload, 'Kommentar gelöscht')} aria-label="Kommentar löschen">
                  🗑
                </button>
              </li>
            ))}
          </ul>
          <h3 className="text-xs uppercase tracking-widest text-muted">Neueste Fotos/Videos</h3>
          {!media.length && <p className="text-muted text-sm">Keine Medien.</p>}
          <div className="grid grid-cols-2 desk:grid-cols-4 gap-2">
            {media.map((m) => (
              <figure key={m.id}>
                <MediaView url={m.media_url} type={m.media_type} className="h-[140px]" />
                <figcaption className="flex flex-wrap justify-between gap-1 text-xs text-muted">
                  @{m.username}{' '}
                  <button className="link link-primary p-2 no-underline text-sm" onClick={act(() => adminRemoveMedia(m.id), reload, 'Medium entfernt')}>
                    entfernen
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
        )
      }}
    </Loading>
  )
}

function Settings() {
  const settings = useSettings()
  const toggle = (key: keyof AppSettings) => act(() => adminSetSetting(key, !settings[key]), null, 'Gespeichert')
  return (
    <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
      <label className="flex items-center gap-3 cursor-pointer font-semibold">
        <input className="checkbox checkbox-primary" type="checkbox" checked={!!settings.invite_required} onChange={toggle('invite_required')} />
        <span>
          Registrierung nur mit Einladungscode
          <span className="text-muted text-sm" style={{ display: 'block', fontWeight: 400 }}>
            Empfohlen für den Beta-Test – sonst kann sich jeder mit dem Link registrieren.
          </span>
        </span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer font-semibold">
        <input className="checkbox checkbox-primary" type="checkbox" checked={!!settings.video_uploads} onChange={toggle('video_uploads')} />
        <span>
          Video-Uploads erlauben
          <span className="text-muted text-sm" style={{ display: 'block', fontWeight: 400 }}>
            Wird auch serverseitig im Speicher durchgesetzt. Videos füllen den Free-Speicher (1 GB) schnell.
          </span>
        </span>
      </label>
    </section>
  )
}

export default function AdminPage({ me }: Pick<PageProps, 'me'>) {
  const [section, setSection] = useState<Section>('overview')
  if (!me || me.role !== 'admin') return <Empty>Kein Zugriff – dieser Bereich ist nur für Admins.</Empty>
  return (
    <div className="flex flex-col gap-4">
      <h2>🛠 Admin-Bereich</h2>
      <div role="tablist" className="tabs tabs-box flex-wrap bg-base-100 border border-base-300">
        {(Object.entries(SECTIONS) as [Section, string][]).map(([k, label]) => (
          <button key={k} role="tab" className={`tab grow ${section === k ? 'tab-active' : ''}`} aria-selected={section === k} onClick={() => setSection(k)}>
            {label}
          </button>
        ))}
      </div>
      {section === 'overview' && <Overview />}
      {section === 'users' && <Users me={me} />}
      {section === 'invites' && <Invites />}
      {section === 'feedback' && <FeedbackInbox />}
      {section === 'moderation' && <Moderation />}
      {section === 'settings' && <Settings />}
    </div>
  )
}
