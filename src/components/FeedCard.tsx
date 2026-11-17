import { Heart, MessageCircle, Repeat2, X } from 'lucide-react'
import { useState } from 'react'
import { errMsg } from '../lib/errors'
import Avatar from './Avatar'
import { MediaView } from './MediaPicker'
import { fmtDate, fmtRelative, fmtRatio, ratio, extractionLabel, MACHINE_TYPES, ROAST_LEVELS } from '../lib/coffee'
import { toggleLike, listComments, addComment, deleteComment, type Comment, type FeedBrew } from '../lib/social'
import type { Brew, Data } from '../types'
import { haptic } from '../lib/haptics'
import { isDefined } from 'only-utils'

/** Rezept eines anderen Nutzers auf das eigene Setup abbilden (Mühle/Maschine über preset_id) */
export function recipeFromBrew(brew: FeedBrew, own: Pick<Data, 'grinders' | 'machines'>): Partial<Brew> {
  const gp = brew.grinder?.preset_id
  const mp = brew.machine?.preset_id
  const myGrinder = gp && own.grinders.find((g) => g.preset_id === gp)
  const myMachine = mp && own.machines.find((m) => m.preset_id === mp)
  return {
    dose: brew.dose,
    yield: brew.yield,
    temperature: brew.temperature,
    preinfusion: brew.preinfusion,
    ...(myMachine ? { machine_id: myMachine.id } : {}),
    // Mahlgrad nur übernehmen, wenn ich dieselbe Mühle (Modell) habe – sonst nicht vergleichbar
    ...(myGrinder ? { grinder_id: myGrinder.id, grind_setting: brew.grind_setting } : {}),
  }
}

const has = (v: unknown) => isDefined(v) && v !== ''

/** Beitrag im Timeline-Stil: Avatar links, Name · @handle · Zeit, Text, Rezept-Zeile, Medien, Aktionen */
export default function FeedCard({
  brew,
  me,
  onReuse,
  onOpenUser,
}: {
  brew: FeedBrew
  me: string | null
  onReuse?: (brew: FeedBrew) => void
  onOpenUser?: (userId: string) => void
}) {
  const [liked, setLiked] = useState(brew.likedByMe)
  const [likes, setLikes] = useState(brew.likeCount ?? 0)
  const [commentCount, setCommentCount] = useState(brew.commentCount ?? 0)
  const [comments, setComments] = useState<Comment[] | null>(null) // null = zugeklappt
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pop, setPop] = useState(false)
  const p = brew.profile
  const own = brew.user_id === me
  const r = ratio(brew.dose, brew.yield)

  const like = async () => {
    const was = liked
    setLiked(!was)
    setLikes((n) => n + (was ? -1 : 1))
    if (!was) {
      setPop(true)
      setTimeout(() => setPop(false), 400)
    }
    try {
      await toggleLike(brew.id, was)
    } catch (e) {
      setLiked(was)
      setLikes((n) => n + (was ? 1 : -1))
      setErr(errMsg(e))
    }
  }
  const openComments = async () => {
    if (comments) return setComments(null)
    try {
      setComments(await listComments(brew.id))
    } catch (e) {
      setErr(errMsg(e))
    }
  }
  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    setBusy(true)
    try {
      await addComment(brew.id, draft)
      setDraft('')
      const list = await listComments(brew.id)
      setComments(list)
      setCommentCount(list.length)
      haptic('success')
    } catch (e2) {
      setErr(errMsg(e2))
    } finally {
      setBusy(false)
    }
  }
  const remove = async (id: string) => {
    await deleteComment(id)
    const list = await listComments(brew.id)
    setComments(list)
    setCommentCount(list.length)
  }

  // Rezept-Leiste: Messwerte als Mono-Zellen, Akzentfarbe für Ratio und Bewertung
  const cells: { k: string; v: string; accent?: boolean }[] = [
    has(brew.dose) ? { k: 'dose', v: `${brew.dose} g` } : null,
    has(brew.yield) ? { k: 'yield', v: `${brew.yield} g` } : null,
    r ? { k: 'ratio', v: fmtRatio(r), accent: true } : null,
    has(brew.brew_time) ? { k: 'time', v: `${brew.brew_time} s` } : null,
    brew.rating ? { k: 'rating', v: `${Number(brew.rating).toFixed(1)}★`, accent: true } : null,
  ].filter(isDefined)
  const extra = [
    has(brew.grind_setting) ? `Mahlgrad ${brew.grind_setting}` : null,
    has(brew.temperature) ? `${brew.temperature} °C` : null,
    has(brew.preinfusion) && Number(brew.preinfusion) > 0 ? `Pre-Inf. ${brew.preinfusion} s` : null,
  ].filter(Boolean)
  const gear = [brew.machine?.name || (brew.machine && MACHINE_TYPES[brew.machine.type]), brew.grinder?.name].filter(Boolean).join(' · ')

  return (
    <article className="post">
      <button type="button" className="self-start cursor-pointer" onClick={() => onOpenUser?.(brew.user_id)} aria-label={`Profil von @${p?.username}`}>
        <Avatar profile={p} size={44} />
      </button>
      <div className="flex min-w-0 flex-col gap-1.5">
        <header className="flex min-w-0 items-baseline gap-1 text-[0.95rem]">
          <button type="button" className="post-name flex min-w-0 items-baseline gap-1 cursor-pointer text-left" onClick={() => onOpenUser?.(brew.user_id)}>
            <strong className="truncate">{p?.display_name || p?.username}</strong>
            <span className="truncate text-muted">@{p?.username}</span>
          </button>
          <span className="text-muted">·</span>
          <time className="shrink-0 whitespace-nowrap text-muted" dateTime={brew.created_at} title={fmtDate(brew.created_at)}>
            {fmtRelative(brew.created_at)}
          </time>
        </header>

        {brew.notes && <p className="text-[1.02rem] leading-[1.45] whitespace-pre-wrap [overflow-wrap:anywhere]">{brew.notes}</p>}

        <div className="flex flex-wrap gap-px overflow-hidden rounded-xl border border-base-300 bg-base-300">
          <span className="min-w-0 flex-[2_1_150px] bg-base-100 px-3 py-2 text-sm font-semibold [overflow-wrap:anywhere]">
            {brew.bean?.name ?? 'Unbekannte Bohne'}
            {brew.bean?.roast_level && <span className="block text-xs font-normal text-muted">{ROAST_LEVELS[brew.bean.roast_level]}{brew.bean?.roaster && ` · ${brew.bean.roaster}`}</span>}
          </span>
          {cells.map((c) => (
            <span key={c.k} className={`num flex flex-[1_1_56px] items-center bg-base-200 px-3 py-2 text-[13px] ${c.accent ? 'text-accent-strong' : ''}`}>
              {c.v}
            </span>
          ))}
        </div>
        {(gear || extra.length > 0 || brew.extraction != null) && (
          <p className="text-xs text-muted [overflow-wrap:anywhere]">
            {[gear, ...extra, brew.extraction != null ? extractionLabel(brew.extraction) : null].filter(Boolean).join(' · ')}
          </p>
        )}

        {brew.media_url && <MediaView url={brew.media_url} type={brew.media_type} className="mt-1 max-h-[480px] rounded-2xl border border-base-300" />}

        <footer className="-mx-2 mt-0.5 flex items-center gap-1">
          <button type="button" className={`post-action ${comments ? 'on' : ''}`} onClick={openComments} aria-expanded={!!comments} aria-label="Kommentare">
            <MessageCircle size={18} className="post-icon" aria-hidden />
            <span>{commentCount}</span>
          </button>
          <button
            type="button"
            className={`post-action like ${liked ? 'liked' : ''} ${pop ? 'pop' : ''}`}
            onClick={like}
            aria-pressed={liked}
            aria-label="Gefällt mir"
          >
            <Heart size={18} className="post-icon" fill={liked ? "currentColor" : "none"} aria-hidden />
            <span>{likes}</span>
          </button>
          {!own && onReuse && (
            <button type="button" className="post-action reuse ml-auto" onClick={() => onReuse(brew)} title="Werte in einen neuen Bezug übernehmen">
              <Repeat2 size={18} className="post-icon" aria-hidden />
              <span>Rezept übernehmen</span>
            </button>
          )}
        </footer>
        {err && <p className="text-sm text-error">{err}</p>}

        {comments && (
          <div className="flex flex-col gap-2.5 pt-1">
            {comments.length === 0 && <p className="text-muted text-sm">Noch keine Kommentare – schreib den ersten.</p>}
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar profile={c.author} size={30} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-[14px] bg-base-200 px-3 py-2 [overflow-wrap:anywhere]">
                  <div className="flex min-w-0 items-baseline gap-1 text-sm">
                    <strong className="truncate">{c.author?.display_name || c.author?.username}</strong>
                    <span className="truncate text-muted">@{c.author?.username}</span>
                    <span className="text-muted">·</span>
                    <time className="whitespace-nowrap text-muted" title={fmtDate(c.created_at)}>{fmtRelative(c.created_at)}</time>
                  </div>
                  <span>{c.body}</span>
                </div>
                {(c.user_id === me || own) && (
                  <button type="button" className="link link-primary p-2 no-underline text-sm" onClick={() => remove(c.id)} aria-label="Kommentar löschen">
                    <X size={18} aria-hidden />
                  </button>
                )}
              </div>
            ))}
            <form className="grid grid-cols-[1fr_auto] gap-2" onSubmit={send}>
              <input className="input input-sm h-10 w-full" value={draft} maxLength={500} placeholder="Antworten …" onChange={(e) => setDraft(e.target.value)} />
              <button className="btn btn-primary btn-sm" disabled={busy || !draft.trim()}>
                Senden
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  )
}
