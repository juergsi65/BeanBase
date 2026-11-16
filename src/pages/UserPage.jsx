import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Avatar from '../components/Avatar'
import FeedCard, { recipeFromBrew } from '../components/FeedCard'
import { Chip, Empty } from '../components/ui'
import { SetupCard } from './ProfilePage'
import { SocialUnavailable } from './CommunityPage'
import { ROAST_LEVELS } from '../lib/coffee'
import { socialAvailable, getBaristaProfile, myId, sendFriendRequest, acceptFriend, removeFriendship } from '../lib/social'

export default function UserPage({ data, go, userId }) {
  const [actionError, setError] = useState(null)
  const { data: me = null } = useQuery({ queryKey: ['myId'], queryFn: myId, enabled: socialAvailable })
  const barista = useQuery({
    queryKey: ['barista', userId],
    queryFn: () => getBaristaProfile(userId),
    enabled: socialAvailable && !!userId,
  })
  const view = barista.data
  const error = actionError ?? barista.error?.message

  if (!socialAvailable) return <SocialUnavailable />
  if (error) return <div className="banner error">{error}</div>
  if (!view) return <p className="muted">Lade Profil …</p>
  if (!view.profile) return <Empty>Profil nicht gefunden.</Empty>

  const { profile: p, relation } = view
  const isMe = userId === me
  const visible = isMe || relation === 'friends' || p.is_public
  const act = (fn) => async () => {
    try {
      await fn()
      await barista.refetch()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="stack">
      <button className="link" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => go('community')}>
        ← Community
      </button>
      <section className="card">
        <div className="profile-head">
          <Avatar profile={p} size={72} />
          <div className="grow">
            <h2>{p.display_name || p.username}</h2>
            <span className="muted small">
              @{p.username} {p.is_public ? '· öffentlich' : '· privat'}
            </span>
          </div>
        </div>
        {p.bio && <p>{p.bio}</p>}
        {!isMe && (
          <div className="row-actions">
            {relation === 'none' && (
              <button className="btn primary" onClick={act(() => sendFriendRequest(userId))}>
                + Freundschaftsanfrage
              </button>
            )}
            {relation === 'outgoing' && <span className="muted small">Anfrage gesendet</span>}
            {relation === 'incoming' && (
              <button className="btn primary" onClick={act(() => acceptFriend(view.friendshipId))}>
                Anfrage annehmen
              </button>
            )}
            {relation === 'friends' && <Chip tone="good">✓ Freunde</Chip>}
          </div>
        )}
      </section>

      {!visible ? (
        <Empty>🔒 Dieses Profil ist privat. Sobald ihr befreundet seid, siehst du Bohnen, Setup und Bezüge.</Empty>
      ) : (
        <>
          <SetupCard machines={view.machines} grinders={view.grinders} beansCount={view.beans.length} setupPhoto={p.setup_photo_url} />
          <section className="card">
            <h3 className="section-title">Aktuelle Bohnen</h3>
            {view.beans.length ? (
              <ul className="list">
                {view.beans.map((b) => (
                  <li key={b.id} className="list-item col">
                    <div className="row">
                      {b.image_url && <img className="thumb" src={b.image_url} alt="" loading="lazy" />}
                      <div className="grow">
                        <strong>{b.name}</strong>
                        <span className="muted small">{[b.roaster, b.origin].filter(Boolean).join(' · ')}</span>
                      </div>
                    </div>
                    <div className="chips">
                      {b.roast_level && <Chip>{ROAST_LEVELS[b.roast_level]}</Chip>}
                      {b.flavor_notes?.map((t) => (
                        <Chip key={t} tone="flavor">
                          {t}
                        </Chip>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Keine aktiven Bohnen.</p>
            )}
          </section>
          <h3 className="section-title">Letzte Bezüge</h3>
          {view.brews.length ? (
            <div className="timeline">
              {view.brews.map((b) => (
                <FeedCard key={b.id} brew={b} me={me} onReuse={(brew) => go('brew', { key: Date.now(), brew: recipeFromBrew(brew, data) })} />
              ))}
            </div>
          ) : (
            <p className="muted small">Noch keine Bezüge.</p>
          )}
        </>
      )}
    </div>
  )
}
