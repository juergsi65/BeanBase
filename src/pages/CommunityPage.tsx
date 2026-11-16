import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useSessionStorage } from 'use-storage-hook'
import { Empty } from '../components/ui'
import Avatar from '../components/Avatar'
import FeedCard, { recipeFromBrew } from '../components/FeedCard'
import { socialAvailable, fetchFeed, myId, type FeedBrew } from '../lib/social'
import type { PageProps } from '../types'

type Scope = 'friends' | 'all'
const TABS: Record<Scope, string> = { friends: 'Freunde', all: 'Alle Baristas' }

export function SocialUnavailable() {
  return (
    <Empty>
      Community, Profile und Freunde brauchen ein Konto. Im Demo-Modus (ohne Supabase) sind sie nicht verfügbar.
    </Empty>
  )
}

export default function CommunityPage({ data, go, me: myProfile }: PageProps) {
  const [scope, setScope] = useSessionStorage<Scope>('beanbase:feed-scope', 'friends') // Tab bleibt in der Sitzung gemerkt
  const { data: me = null } = useQuery({ queryKey: ['myId'], queryFn: myId, enabled: socialAvailable })
  const feed = useInfiniteQuery({
    queryKey: ['feed', scope],
    queryFn: ({ pageParam }) => fetchFeed({ scope, before: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: FeedBrew[]) => (last.length === 20 ? last[last.length - 1].created_at : undefined),
    enabled: socialAvailable,
  })
  const items = feed.data?.pages.flat() ?? []
  const state = feed.isPending ? 'loading' : feed.isError ? 'error' : 'ready'

  if (!socialAvailable) return <SocialUnavailable />

  const reuse = (brew: FeedBrew) => go('brew', { key: Date.now(), brew: recipeFromBrew(brew, data) })
  const openUser = (id: string) => go('user', { userId: id })


  return (
    <div className="timeline-page">
      <div className="timeline-tabs" role="tablist">
        {(Object.entries(TABS) as [Scope, string][]).map(([k, label]) => (
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
      {state === 'error' && <div className="banner error">Feed konnte nicht geladen werden: {feed.error?.message}</div>}
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
      {feed.hasNextPage && (
        <button className="btn ghost block" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
          {feed.isFetchingNextPage ? 'Lade …' : 'Mehr laden'}
        </button>
      )}
    </div>
  )
}
