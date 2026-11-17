import { Search, UserPlus } from 'lucide-react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useSessionStorage } from 'use-storage-hook'
import { Empty, useLookup } from '../components/ui'
import Avatar from '../components/Avatar'
import CommunityTip from '../components/CommunityTip'
import FeedCard, { recipeFromBrew } from '../components/FeedCard'
import css from '../components/FeedCard.module.css'
import { socialAvailable, fetchFeed, myId, listFriendships, acceptFriend, type FeedBrew } from '../lib/social'
import { errMsg } from '../lib/errors'
import { toast } from '../lib/toast'
import type { PageProps } from '../types'

type Scope = 'friends' | 'all'
const TABS: Record<Scope, string> = { friends: 'Freunde', all: 'Entdecken' }
const freshKey = () => Date.now()
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()

export function SocialUnavailable() {
  return (
    <Empty>
      Community, Profile und Freunde brauchen ein Konto. Im Demo-Modus (ohne Supabase) sind sie nicht verfügbar.
    </Empty>
  )
}

export default function CommunityPage({ data, go }: PageProps) {
  const lookup = useLookup(data)
  const [scope, setScope] = useSessionStorage<Scope>('beanbase:feed-scope', 'friends') // Tab bleibt in der Sitzung gemerkt
  const { data: me = null } = useQuery({ queryKey: ['myId'], queryFn: myId, enabled: socialAvailable })
  const friends = useQuery({ queryKey: ['friendships'], queryFn: listFriendships, enabled: socialAvailable })
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

  const reuse = (brew: FeedBrew) => go('brew', { key: freshKey(), brew: recipeFromBrew(brew, data) })
  const openUser = (id: string) => go('user', { userId: id })
  const accept = async (friendshipId: string) => {
    try {
      await acceptFriend(friendshipId)
      await friends.refetch()
      toast('Freundschaft angenommen')
    } catch (e) {
      data.setError(errMsg(e))
    }
  }

  // Rezept-Radar zur Bohne des letzten eigenen Bezugs
  const last = data.brews[0]
  const radarBean = lookup.beans(last?.bean_id)
  const radarGrinder = lookup.grinders(last?.grinder_id)
  const radarMachine = lookup.machines(last?.machine_id)
  const incoming = friends.data?.incoming ?? []
  const todayCount = items.filter((b) => isToday(b.created_at)).length

  return (
    <div className="flex flex-col gap-4 desk:gap-5.5">
      <header className="flex items-center gap-2 desk:items-end">
        <div className="grow">
          <span className="lbl hidden desk:inline">
            {friends.data ? `${friends.data.friends.length} Freunde · ` : ''}
            {todayCount} neue Bezüge heute
          </span>
          <h2 className="text-[26px] desk:mt-1.5 desk:text-[34px] desk:tracking-[-0.025em]">Community</h2>
        </div>
        <button className="btn relative size-11 rounded-[12px] border-base-300 bg-base-100 px-0 desk:hidden" onClick={() => go('profile')} aria-label={incoming.length ? `Freunde finden, ${incoming.length} offene Anfragen` : 'Freunde finden'}>
          <UserPlus size={20} strokeWidth={1.75} aria-hidden />
          {incoming.length > 0 && <span className="badge badge-primary badge-xs absolute -top-1 -right-1">{incoming.length}</span>}
        </button>
      </header>

      <div className="flex flex-col gap-4 desk:flex-row desk:items-start desk:gap-6">
        <section className={css.feedPage}>
          <div className={`${css.feedTabs} tabs tabs-border flex-nowrap gap-5.5 border-b border-base-300 px-4 desk:px-5`} role="tablist">
            {(Object.entries(TABS) as [Scope, string][]).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={scope === k}
                className={`tab h-12 px-0 ${scope === k ? 'tab-active font-semibold text-base-content! [--tab-border-color:var(--color-primary)]' : 'text-muted'}`}
                onClick={() => setScope(k)}
              >
                {label}
              </button>
            ))}
          </div>

          {state === 'loading' && (
            <div className={css.feed}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={css.post} aria-hidden>
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
                ? 'Noch keine Bezüge von Freunden. Füge Freunde hinzu oder schau bei „Entdecken“.'
                : 'Noch keine öffentlichen Bezüge. Mach dein Profil öffentlich, um hier zu erscheinen.'}
            </Empty>
          )}
          {state === 'ready' && items.length > 0 && (
            <div className={css.feed}>
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
        </section>

        {/* Handy: Radar über dem Feed. Desktop: rechte Spalte mit Radar und Freundschaftsanfragen */}
        <aside className="order-first flex flex-col gap-4 desk:order-none desk:w-80 desk:shrink-0">
          {radarBean && (
            <CommunityTip
              roaster={radarBean.roaster}
              name={radarBean.name}
              grinder={radarGrinder}
              machine={radarMachine}
              onApply={(v) =>
                go('brew', {
                  key: freshKey(),
                  brew: { bean_id: radarBean.id, dose: v.dose, yield: v.yield, temperature: v.temperature, ...(v.grind_setting != null ? { grind_setting: String(v.grind_setting) } : {}) },
                })
              }
            />
          )}
          <section className="card hidden gap-3 border border-base-300 bg-base-100 p-4.5 desk:flex">
            <span className="lbl">Freundschaftsanfragen</span>
            {incoming.length ? (
              incoming.map(({ friendship, profile: p }) => (
                <div key={friendship.id} className="flex items-center gap-2.5">
                  <button className="flex min-w-0 grow cursor-pointer items-center gap-2.5 text-left" onClick={() => openUser(p.id)}>
                    <Avatar profile={p} size={40} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{p.display_name || p.username}</span>
                      <span className="block truncate text-xs text-muted">@{p.username}</span>
                    </span>
                  </button>
                  <button className="btn btn-primary h-9 rounded-[10px] px-3 text-[13px]" onClick={() => void accept(friendship.id)}>
                    Annehmen
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">Keine offenen Anfragen.</p>
            )}
            <button className="btn h-11 justify-start gap-2 rounded-[11px] border-base-300 bg-page font-normal text-muted" onClick={() => go('profile')}>
              <Search size={16} strokeWidth={1.75} aria-hidden /> Nutzername suchen
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}
