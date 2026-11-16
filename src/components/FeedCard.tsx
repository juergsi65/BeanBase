import { useState } from 'react'
import { errMsg } from '../lib/errors'
import Avatar from './Avatar'
import { Stars } from './ui'
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

  const recipe = [
    has(brew.dose) && has(brew.yield) ? `${brew.dose} g → ${brew.yield} g` : has(brew.dose) ? `${brew.dose} g` : null,
    r ? fmtRatio(r) : null,
    has(brew.brew_time) ? `${brew.brew_time} s` : null,
    has(brew.temperature) ? `${brew.temperature} °C` : null,
    has(brew.grind_setting) ? `Mahlgrad ${brew.grind_setting}` : null,
    has(brew.preinfusion) && Number(brew.preinfusion) > 0 ? `Pre-Inf. ${brew.preinfusion} s` : null,
  ].filter(Boolean)
  const gear = [brew.machine?.name || (brew.machine && MACHINE_TYPES[brew.machine.type]), brew.grinder?.name].filter(Boolean).join(' · ')

  return (
    <article className="post feed-card">
      <button type="button" className="post-avatar" onClick={() => onOpenUser?.(brew.user_id)} aria-label={`Profil von @${p?.username}`}>
        <Avatar profile={p} size={44} />
      </button>
      <div className="post-body">
        <header className="post-head">
          <button type="button" className="feed-author post-name" onClick={() => onOpenUser?.(brew.user_id)}>
            <strong>{p?.display_name || p?.username}</strong>
            <span className="post-handle">@{p?.username}</span>
          </button>
          <span className="post-dot">·</span>
          <time dateTime={brew.created_at} title={fmtDate(brew.created_at)}>
            {fmtRelative(brew.created_at)}
          </time>
        </header>

        {brew.notes && <p className="post-text">{brew.notes}</p>}

        <div className="post-bean">
          <span className="post-bean-icon">☕</span>
          <span>
            <strong>{brew.bean?.name ?? 'Unbekannte Bohne'}</strong>
            {brew.bean?.roaster && <span className="muted"> · {brew.bean.roaster}</span>}
            {brew.bean?.roast_level && <span className="muted"> · {ROAST_LEVELS[brew.bean.roast_level]}</span>}
          </span>
          {brew.rating ? <Stars value={brew.rating} size="sm" /> : null}
        </div>

        {recipe.length > 0 && (
          <div className="post-recipe">
            {recipe.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        )}
        {(gear || brew.extraction != null) && (
          <p className="post-meta">
            {gear}
            {gear && brew.extraction != null && ' · '}
            {brew.extraction != null && extractionLabel(brew.extraction)}
          </p>
        )}

        {brew.media_url && <MediaView url={brew.media_url} type={brew.media_type} className="feed-media post-media" />}

        <footer className="post-actions feed-actions">
          <button type="button" className={`post-action ${comments ? 'on' : ''}`} onClick={openComments} aria-expanded={!!comments} aria-label="Kommentare">
            <span className="post-icon">💬</span>
            <span>{commentCount}</span>
          </button>
          <button
            type="button"
            className={`post-action like ${liked ? 'liked' : ''} ${pop ? 'pop' : ''}`}
            onClick={like}
            aria-pressed={liked}
            aria-label="Gefällt mir"
          >
            <span className="post-icon">☕</span>
            <span>{likes}</span>
          </button>
          {!own && onReuse && (
            <button type="button" className="post-action reuse" onClick={() => onReuse(brew)} title="Werte in einen neuen Bezug übernehmen">
              <span className="post-icon">↻</span>
              <span>Rezept übernehmen</span>
            </button>
          )}
        </footer>
        {err && <p className="scanner-error">{err}</p>}

        {comments && (
          <div className="comments">
            {comments.length === 0 && <p className="muted small">Noch keine Kommentare – schreib den ersten.</p>}
            {comments.map((c) => (
              <div key={c.id} className="comment">
                <Avatar profile={c.author} size={30} />
                <div className="comment-bubble">
                  <div className="comment-head">
                    <strong>{c.author?.display_name || c.author?.username}</strong>
                    <span className="post-handle">@{c.author?.username}</span>
                    <span className="post-dot">·</span>
                    <time title={fmtDate(c.created_at)}>{fmtRelative(c.created_at)}</time>
                  </div>
                  <span>{c.body}</span>
                </div>
                {(c.user_id === me || own) && (
                  <button type="button" className="link small" onClick={() => remove(c.id)} aria-label="Kommentar löschen">
                    ✕
                  </button>
                )}
              </div>
            ))}
            <form className="comment-form" onSubmit={send}>
              <input value={draft} maxLength={500} placeholder="Antworten …" onChange={(e) => setDraft(e.target.value)} />
              <button className="btn primary sm" disabled={busy || !draft.trim()}>
                Senden
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  )
}
