import { useCallback, useEffect, useState } from 'react'
import { Empty } from '../components/ui'
import Avatar from '../components/Avatar'
import FeedCard, { recipeFromBrew } from '../components/FeedCard'
import { socialAvailable, fetchFeed, myId } from '../lib/social'

export function SocialUnavailable() {
  return (
    <Empty>
      Community, Profile und Freunde brauchen ein Konto. Im Demo-Modus (ohne Supabase) sind sie nicht verfügbar.
    </Empty>
  )
}

export default function CommunityPage({ data, go, me: myProfile }) {
  const [scope, setScope] = useState('friends')
  const [items, setItems] = useState([])
  const [me, setMe] = useState(null)
  const [state, setState] = useState('loading') // loading | ready | error
  const [error, setError] = useState(null)
  const [more, setMore] = useState(false)

  const load = useCallback(
    async (append = false, before = null) => {
      if (!append) setState('loading')
      try {
        const [rows, id] = await Promise.all([fetchFeed({ scope, before }), myId()])
        setMe(id)
        setItems((prev) => (append ? [...prev, ...rows] : rows))
        setMore(rows.length === 20)
        setState('ready')
      } catch (e) {
        setError(e.message)
        setState('error')
      }
    },
    [scope],
  )

  useEffect(() => {
    if (socialAvailable) load()
  }, [load])

  if (!socialAvailable) return <SocialUnavailable />

  const reuse = (brew) => go('brew', { key: Date.now(), brew: recipeFromBrew(brew, data) })
  const openUser = (id) => go('user', { userId: id })

  const TABS = { friends: 'Freunde', all: 'Alle Baristas' }

  return (
    <div className="timeline-page">
      <div className="timeline-tabs" role="tablist">
        {Object.entries(TABS).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={scope === k} className={scope === k ? 'on' : ''} onClick={() => setScope(k)}>
            {label}
          </button>
        ))}
        <button className="timeline-friends" onClick={() => go('profile')} aria-label="Freunde finden">
          👥
        </button>
      </div>

      <button className="composer" onClick={() => go('brew', { key: Date.now() })}>
        <Avatar profile={myProfile} size={44} />
        <span className="composer-prompt">Was brühst du gerade?</span>
        <span className="btn primary sm">+ Bezug</span>
      </button>

      {state === 'loading' && (
        <div className="timeline">
          {[0, 1, 2].map((i) => (
            <div key={i} className="post skeleton" aria-hidden>
              <span className="sk-avatar" />
              <div className="post-body">
                <span className="sk-line w40" />
                <span className="sk-line w90" />
                <span className="sk-line w70" />
              </div>
            </div>
          ))}
        </div>
      )}
      {state === 'error' && <div className="banner error">Feed konnte nicht geladen werden: {error}</div>}
      {state === 'ready' && !items.length && (
        <Empty
          action={
            <button className="btn primary" onClick={() => go('profile')}>
              Freunde finden
            </button>
          }
        >
          {scope === 'friends'
            ? 'Noch keine Bezüge von Freunden. Füge Freunde hinzu oder schau bei „Alle Baristas“.'
            : 'Noch keine öffentlichen Bezüge. Mach dein Profil öffentlich, um hier zu erscheinen.'}
        </Empty>
      )}
      {state === 'ready' && items.length > 0 && (
        <div className="timeline">
          {items.map((b) => (
            <FeedCard key={b.id} brew={b} me={me} onReuse={reuse} onOpenUser={openUser} />
          ))}
        </div>
      )}
      {more && (
        <button className="btn ghost block" onClick={() => load(true, items[items.length - 1].created_at)}>
          Mehr laden
        </button>
      )}
    </div>
  )
}
