import { useCallback, useEffect, useState } from 'react'
import { Segmented, Empty } from '../components/ui'
import FeedCard, { recipeFromBrew } from '../components/FeedCard'
import { socialAvailable, fetchFeed, myId } from '../lib/social'

export function SocialUnavailable() {
  return (
    <Empty>
      Community, Profile und Freunde brauchen ein Konto. Im Demo-Modus (ohne Supabase) sind sie nicht verfügbar.
    </Empty>
  )
}

export default function CommunityPage({ data, go }) {
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

  return (
    <div className="stack">
      <div className="page-head">
        <h2>Community</h2>
        <button className="btn ghost sm" onClick={() => go('profile')}>
          👥 Freunde
        </button>
      </div>
      <Segmented options={{ friends: 'Nur Freunde', all: 'Alle Baristas' }} value={scope} onChange={(v) => v && setScope(v)} />
      {state === 'loading' && <p className="muted">Lade Feed …</p>}
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
      {items.map((b) => (
        <FeedCard key={b.id} brew={b} me={me} onReuse={reuse} onOpenUser={openUser} />
      ))}
      {more && (
        <button className="btn ghost block" onClick={() => load(true, items[items.length - 1].created_at)}>
          Mehr laden
        </button>
      )}
    </div>
  )
}
