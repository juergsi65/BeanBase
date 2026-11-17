import { useState } from 'react'
import { errMsg } from '../lib/errors'
import { useQuery } from '@tanstack/react-query'
import Avatar from '../components/Avatar'
import FeedCard, { recipeFromBrew } from '../components/FeedCard'
import { Chip, Empty } from '../components/ui'
import { SetupCard } from './ProfilePage'
import { SocialUnavailable } from './CommunityPage'
import { ROAST_LEVELS } from '../lib/coffee'
import { socialAvailable, getBaristaProfile, myId, sendFriendRequest, acceptFriend } from '../lib/social'
import type { PageProps } from '../types'

export default function UserPage({ data, go, userId }: PageProps & { userId: string | null }) {
  const [actionError, setError] = useState<string | null>(null)
  const { data: me = null } = useQuery({ queryKey: ['myId'], queryFn: myId, enabled: socialAvailable })
  const barista = useQuery({
    queryKey: ['barista', userId],
    queryFn: () => getBaristaProfile(userId!), // nur aktiv, wenn userId gesetzt
    enabled: socialAvailable && !!userId,
  })
  const view = barista.data
  const error = actionError ?? barista.error?.message

  if (!socialAvailable) return <SocialUnavailable />
  if (error) return <div className="alert alert-soft block alert-error">{error}</div>
  if (!view) return <p className="text-muted">Lade Profil …</p>
  if (!view.profile) return <Empty>Profil nicht gefunden.</Empty>

  const { profile: p, relation } = view
  const isMe = userId === me
  const visible = isMe || relation === 'friends' || p.is_public
  const act = (fn: () => Promise<unknown>) => async () => {
    try {
      await fn()
      await barista.refetch()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="link link-primary p-2 no-underline" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => go('community')}>
        ← Community
      </button>
      <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
        <div className="flex items-center gap-3.5 [&>div]:flex [&>div]:flex-col">
          <Avatar profile={p} size={72} />
          <div className="grow">
            <h2>{p.display_name || p.username}</h2>
            <span className="text-muted text-sm">
              @{p.username} {p.is_public ? '· öffentlich' : '· privat'}
            </span>
          </div>
        </div>
        {p.bio && <p>{p.bio}</p>}
        {!isMe && (
          <div className="flex flex-wrap items-center gap-1.5">
            {relation === 'none' && (
              <button className="btn btn-primary" onClick={act(() => sendFriendRequest(p.id))}>
                + Freundschaftsanfrage
              </button>
            )}
            {relation === 'outgoing' && <span className="text-muted text-sm">Anfrage gesendet</span>}
            {relation === 'incoming' && (
              <button className="btn btn-primary" onClick={act(async () => view.friendshipId && acceptFriend(view.friendshipId))}>
                Anfrage annehmen
              </button>
            )}
            {relation === 'friends' && <Chip tone="good">✓ Freunde</Chip>}
          </div>
        )}
      </section>

      {!visible ? (
        <Empty>Dieses Profil ist privat. Sobald ihr befreundet seid, siehst du Bohnen, Setup und Bezüge.</Empty>
      ) : (
        <>
          <SetupCard machines={view.machines} grinders={view.grinders} beansCount={view.beans.length} setupPhoto={p.setup_photo_url} />
          <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
            <h3 className="lbl">Aktuelle Bohnen</h3>
            {view.beans.length ? (
              <ul className="items">
                {view.beans.map((b) => (
                  <li key={b.id} className="item col">
                    <div className="flex flex-nowrap items-center justify-between gap-2.5">
                      {b.image_url && <img className="thumb" src={b.image_url} alt="" loading="lazy" />}
                      <div className="grow">
                        <strong>{b.name}</strong>
                        <span className="text-muted text-sm">{[b.roaster, b.origin].filter(Boolean).join(' · ')}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
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
              <p className="text-muted text-sm">Keine aktiven Bohnen.</p>
            )}
          </section>
          <h3 className="lbl">Letzte Bezüge</h3>
          {view.brews.length ? (
            <div className="feed">
              {view.brews.map((b) => (
                <FeedCard key={b.id} brew={b} me={me} onReuse={(brew) => go('brew', { key: Date.now(), brew: recipeFromBrew(brew, data) })} />
              ))}
            </div>
          ) : (
            <p className="text-muted text-sm">Noch keine Bezüge.</p>
          )}
        </>
      )}
    </div>
  )
}
