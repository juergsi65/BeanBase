import { useState } from 'react'
import Avatar from './Avatar'
import { Stars, Stat } from './ui'
import { fmtDate, fmtRatio, ratio, extractionLabel, MACHINE_TYPES } from '../lib/coffee'
import { toggleLike, listComments, addComment, deleteComment } from '../lib/social'

/** Rezept eines anderen Nutzers auf das eigene Setup abbilden (Mühle/Maschine über preset_id) */
export function recipeFromBrew(brew, own) {
  const myGrinder = brew.grinder?.preset_id && own.grinders.find((g) => g.preset_id === brew.grinder.preset_id)
  const myMachine = brew.machine?.preset_id && own.machines.find((m) => m.preset_id === brew.machine.preset_id)
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

export default function FeedCard({ brew, me, onReuse, onOpenUser, showAuthor = true }) {
  const [liked, setLiked] = useState(brew.likedByMe)
  const [likes, setLikes] = useState(brew.likeCount ?? 0)
  const [commentCount, setCommentCount] = useState(brew.commentCount ?? 0)
  const [comments, setComments] = useState(null) // null = zugeklappt
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const p = brew.profile
  const own = brew.user_id === me

  const like = async () => {
    const was = liked
    setLiked(!was)
    setLikes((n) => n + (was ? -1 : 1))
    try {
      await toggleLike(brew.id, was)
    } catch (e) {
      setLiked(was)
      setLikes((n) => n + (was ? 1 : -1))
      setErr(e.message)
    }
  }
  const openComments = async () => {
    if (comments) return setComments(null)
    try {
      setComments(await listComments(brew.id))
    } catch (e) {
      setErr(e.message)
    }
  }
  const send = async (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    setBusy(true)
    try {
      await addComment(brew.id, draft)
      setDraft('')
      const list = await listComments(brew.id)
      setComments(list)
      setCommentCount(list.length)
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async (id) => {
    await deleteComment(id)
    const list = await listComments(brew.id)
    setComments(list)
    setCommentCount(list.length)
  }

  return (
    <article className="feed-card">
      {showAuthor && (
        <header className="feed-head">
          <button type="button" className="feed-author" onClick={() => onOpenUser?.(p.id)}>
            <Avatar profile={p} size={40} />
            <span>
              <strong>{p?.display_name || p?.username}</strong>
              <span className="muted small">
                @{p?.username} · {fmtDate(brew.created_at)}
              </span>
            </span>
          </button>
        </header>
      )}
      <div className="feed-bean">
        {brew.bean?.image_url && <img className="thumb" src={brew.bean.image_url} alt="" loading="lazy" />}
        <div className="feed-bean-info">
          <strong>{brew.bean?.name ?? 'Unbekannte Bohne'}</strong>
          <span className="muted small">
            {[brew.bean?.roaster, brew.machine?.name, brew.grinder?.name].filter(Boolean).join(' · ') ||
              MACHINE_TYPES[brew.machine?.type] ||
              ''}
            {!showAuthor && ` · ${fmtDate(brew.created_at)}`}
          </span>
        </div>
        <Stars value={brew.rating} size="sm" />
      </div>
      <div className="stats">
        <Stat label="Dosis" value={brew.dose} unit="g" />
        <Stat label="Output" value={brew.yield} unit="g" />
        <Stat label="Ratio" value={fmtRatio(ratio(brew.dose, brew.yield))} />
        <Stat label="Mahlgrad" value={brew.grind_setting} />
        <Stat label="Zeit" value={brew.brew_time} unit="s" />
        <Stat label="Temp" value={brew.temperature} unit="°C" />
      </div>
      {brew.extraction != null && <p className="muted small">{extractionLabel(brew.extraction)}</p>}
      {brew.notes && <p className="recipe-note">„{brew.notes}“</p>}
      <div className="feed-actions">
        <button type="button" className={`btn ghost sm ${liked ? 'liked' : ''}`} onClick={like} aria-pressed={liked} aria-label="Gefällt mir">
          ☕ {likes}
        </button>
        <button type="button" className="btn ghost sm" onClick={openComments} aria-expanded={!!comments}>
          💬 {commentCount}
        </button>
        <span className="grow" />
        {!own && onReuse && (
          <button type="button" className="btn primary sm" onClick={() => onReuse(brew)}>
            Rezept übernehmen
          </button>
        )}
      </div>
      {err && <p className="scanner-error">{err}</p>}
      {comments && (
        <div className="comments">
          {comments.length === 0 && <p className="muted small">Noch keine Kommentare.</p>}
          {comments.map((c) => (
            <div key={c.id} className="comment">
              <Avatar profile={c.author} size={28} />
              <div className="grow">
                <strong className="small">@{c.author?.username}</strong> <span>{c.body}</span>
              </div>
              {(c.user_id === me || own) && (
                <button type="button" className="link small" onClick={() => remove(c.id)} aria-label="Kommentar löschen">
                  ✕
                </button>
              )}
            </div>
          ))}
          <form className="comment-form" onSubmit={send}>
            <input value={draft} maxLength={500} placeholder="Kommentar schreiben …" onChange={(e) => setDraft(e.target.value)} />
            <button className="btn primary sm" disabled={busy || !draft.trim()}>
              Senden
            </button>
          </form>
        </div>
      )}
    </article>
  )
}
