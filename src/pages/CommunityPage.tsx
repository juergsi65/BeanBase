import { UserPlus } from 'lucide-react'
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
    <div className="feed-page">
      <div className="feed-tabs tabs tabs-border flex-nowrap border-b border-base-300" role="tablist">
        {(Object.entries(TABS) as [Scope, string][]).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={scope === k} className={`tab h-12 grow font-semibold ${scope === k ? 'tab-active font-extrabold text-base-content! [--tab-border-color:var(--accent-strong)]' : 'text-muted'}`} onClick={() => setScope(k)}>
            {label}
          </button>
        ))}
        <button className="btn btn-ghost h-12 px-4 text-lg" onClick={() => go('profile')} aria-label="Freunde finden">
          <UserPlus size={20} aria-hidden />
        </button>
      </div>

      <button className="flex w-full cursor-pointer items-center gap-3 border-b border-base-300 px-4 py-3.5 text-left text-muted hover:bg-base-content/3" onClick={() => go('brew', { key: Date.now() })}>
        <Avatar profile={myProfile} size={44} />
        <span className="flex-1 text-base min-[361px]:text-[1.08rem]">Was brühst du gerade?</span>
        <span className="btn btn-primary btn-sm">+ Bezug</span>
      </button>

      {state === 'loading' && (
        <div className="feed">
          {[0, 1, 2].map((i) => (
            <div key={i} className="post" aria-hidden>
              <span className="skeleton size-11 rounded-full" />
              <div className="flex flex-col gap-2 pt-1">
                <span className="skeleton h-3 w-2/5" />
                <span className="skeleton h-3 w-[90%]" />
                <span className="skeleton h-3 w-[70%]" />
              </div>
            </div>
          ))}
        </div>
      )}
      {state === 'error' && <div className="alert alert-soft block alert-error">Feed konnte nicht geladen werden: {feed.error?.message}</div>}
      {state === 'ready' && !items.length && (
        <Empty
          action={
            <button className="btn btn-primary" onClick={() => go('profile')}>
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
        <div className="feed">
          {items.map((b) => (
            <FeedCard key={b.id} brew={b} me={me} onReuse={reuse} onOpenUser={openUser} />
          ))}
        </div>
      )}
      {feed.hasNextPage && (
        <button className="btn btn-ghost border-base-300 btn-block" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
          {feed.isFetchingNextPage ? 'Lade …' : 'Mehr laden'}
        </button>
      )}
    </div>
  )
}
