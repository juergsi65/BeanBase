import { lazy, Suspense, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { useAuth } from './lib/useAuth'
import { useData } from './lib/useData'
import { isLocalMode } from './lib/supabase'
import { toastStore, dismissToast } from './lib/toast'
import { useLocalStorage } from 'use-storage-hook'
import Dashboard from './pages/Dashboard'
import { getMyProfile } from './lib/social'
import { useTheme } from './lib/theme'
import { Bean, House, MessageSquare, Moon, Plus, ScrollText, SlidersHorizontal, Sun, User, Users, Wrench, X, type LucideIcon } from 'lucide-react'
import Logo from './components/Logo'
import Avatar from './components/Avatar'
import type { BrewPreset, Go, Tab } from './types'

// Start-Seite sofort, alle anderen Seiten erst beim ersten Öffnen laden (kleinerer Start-Chunk)
const AuthPage = lazy(() => import('./pages/AuthPage'))
const BrewPage = lazy(() => import('./pages/BrewPage'))
const DialInPage = lazy(() => import('./pages/DialInPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const BeansPage = lazy(() => import('./pages/BeansPage'))
const EquipmentPage = lazy(() => import('./pages/EquipmentPage'))
const CommunityPage = lazy(() => import('./pages/CommunityPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const UserPage = lazy(() => import('./pages/UserPage'))
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const SetPasswordPage = lazy(() => import('./pages/SetPasswordPage'))

const pageLoading = <div className="flex justify-center p-8"><span className="loading loading-dots loading-lg text-primary" aria-label="Seite lädt" /></div>

// Untere Leiste: Daumen-freundlich, mittig der wichtigste Knopf ("+ Bezug")
const TABS: { id: Exclude<Tab, 'user'>; label: string; icon: LucideIcon; fab?: boolean }[] = [
  { id: 'dashboard', label: 'Start', icon: House },
  { id: 'beans', label: 'Bohnen', icon: Bean },
  { id: 'brew', label: 'Bezug', icon: Plus, fab: true },
  { id: 'history', label: 'Log', icon: ScrollText },
  { id: 'community', label: 'Community', icon: Users },
]
const iconBtn = (on: boolean) =>
  `btn btn-square size-10 min-[401px]:size-11 rounded-[12px] bg-base-100 ${on ? 'border-primary text-accent-strong ring-1 ring-inset ring-primary' : 'border-base-300 text-base-content/80'}`
const ICON = { size: 20, strokeWidth: 1.75, 'aria-hidden': true } as const

const TAB_GROUP: Partial<Record<Tab, Tab | null>> = { user: 'community', profile: 'community', admin: 'community', feedback: null, dialin: 'brew' }
const START_TABS: Tab[] = ['brew', 'beans', 'history', 'community']
const isStartTab = (t: string | null): t is Tab => START_TABS.includes(t as Tab)

const TOAST_TONE = { good: 'bg-base-content text-base-100', info: 'bg-base-200 border-base-300', error: 'alert-error' } as const

function Toaster() {
  const items = useStore(toastStore)
  return (
    <div className="toast toast-center bottom-[calc(96px+env(safe-area-inset-bottom))] desk:bottom-7 desk:ml-[calc(var(--sidebar)/2)] z-60 items-center pointer-events-none" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`alert rounded-full py-2.5 px-4.5 font-semibold text-[0.92rem] shadow-lg ${TOAST_TONE[t.tone]}`}>
          {t.text}
          {t.action && (
            <button
              className="btn btn-sm btn-ghost pointer-events-auto underline underline-offset-2"
              onClick={() => {
                dismissToast(t.id)
                t.action!.run()
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const { user, recovery, endRecovery } = useAuth()
  const theme = useTheme()
  const data = useData(user)
  // Start-Tab aus dem PWA-Shortcut (?tab=brew)
  const [tab, setTab] = useState<Tab>(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    return isStartTab(t) ? t : 'dashboard'
  })
  const [brewPreset, setBrewPreset] = useState<BrewPreset | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [prevTab, setPrevTab] = useState<Tab>('dashboard')
  // eigenes Profil (Rolle, Sperre)
  const { data: me = null } = useQuery({ queryKey: ['me', user?.id], queryFn: getMyProfile, enabled: !!user && !isLocalMode })
  const [demoHint, setDemoHint] = useLocalStorage<boolean>('beanbase:demo-hint', true)
  // Tastenkürzel N = Neuer Bezug (nicht beim Tippen in Feldern)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.key !== 'n' || e.ctrlKey || e.metaKey || e.altKey || el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      setBrewPreset(null)
      setTab('brew')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (user === undefined) return <div className="splash gap-3"><span className="loading loading-dots loading-lg text-primary" /> BeanBase lädt …</div>
  if (!user) return <Suspense fallback={pageLoading}><AuthPage /></Suspense>
  if (recovery) return <Suspense fallback={pageLoading}><SetPasswordPage onDone={endRecovery} /></Suspense>

  // go('brew', { key, brew }) · go('user', { userId }) · go('<tab>')
  const go: Go = (t: Tab, preset: BrewPreset | { userId: string } | null = null) => {
    if (t === 'user') setUserId(preset && 'userId' in preset ? preset.userId : null)
    else setBrewPreset(preset && !('userId' in preset) ? preset : null)
    if (t === 'feedback') setPrevTab(tab)
    setTab(t)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const props = { data, go, me, theme }
  const activeTab = TAB_GROUP[tab] ?? tab
  const beta = !isLocalMode && <span className="num shrink-0 rounded-md border border-primary/45 px-1.5 py-px text-[10px] font-semibold tracking-widest text-accent-strong">BETA</span>
  // Desktop-Seitenleiste: Zähler neben den Tabs, Konto-Links darunter
  const counts: Partial<Record<Tab, number>> = { beans: data.beans.filter((b) => b.active).length, history: data.brews.length }
  const sideLinks: { label: string; icon: LucideIcon; on: boolean; run: () => void }[] = [
    { label: 'Setup', icon: SlidersHorizontal, on: tab === 'equipment', run: () => go('equipment') },
    ...(isLocalMode ? [] : [{ label: 'Feedback', icon: MessageSquare, on: tab === 'feedback', run: () => go('feedback') }]),
    ...(me?.role === 'admin' ? [{ label: 'Admin', icon: Wrench, on: tab === 'admin', run: () => go('admin') }] : []),
    { label: theme.isDark ? 'Helles Design' : 'Dunkles Design', icon: theme.isDark ? Sun : Moon, on: false, run: theme.toggle },
  ]

  return (
    <div className="app">
      {/* Mobil/Tablet: Kopfleiste. Auf dem Desktop übernimmt die Seitenleiste Logo und Konto-Links */}
      <header className="topbar navbar sticky top-0 z-10 gap-2 px-3 min-h-0 pb-2 pt-[calc(8px+env(safe-area-inset-top))] bg-page/88 backdrop-blur-md border-b border-base-300 desk:hidden">
        <button className="flex min-w-0 items-center gap-2.5 overflow-hidden whitespace-nowrap text-[17px] font-semibold tracking-tight cursor-pointer" onClick={() => go('dashboard')}>
          <Logo /> <span className="hidden min-[420px]:inline">BeanBase</span>
          {beta}
        </button>
        <div className="ml-auto flex shrink-0 gap-1.5">
          <button
            className={iconBtn(false)}
            onClick={theme.toggle}
            aria-label={theme.isDark ? 'Helles Design' : 'Dunkles Design'}
            title={`${theme.isDark ? 'Zu hell wechseln' : 'Zu dunkel wechseln'} („Automatisch“ unter Setup)`}
          >
            {theme.isDark ? <Sun {...ICON} /> : <Moon {...ICON} />}
          </button>
          {!isLocalMode && (
            <button className={iconBtn(tab === 'feedback')} onClick={() => go('feedback')} aria-label="Feedback geben" title="Feedback geben">
              <MessageSquare {...ICON} />
            </button>
          )}
          {me?.role === 'admin' && (
            <button className={iconBtn(tab === 'admin')} onClick={() => go('admin')} aria-label="Admin-Bereich" title="Admin-Bereich">
              <Wrench {...ICON} />
            </button>
          )}
          <button className={iconBtn(tab === 'equipment')} onClick={() => go('equipment')} aria-label="Setup & Einstellungen" title="Setup & Einstellungen">
            <SlidersHorizontal {...ICON} />
          </button>
          {!isLocalMode && (
            <button className={iconBtn(tab === 'profile')} onClick={() => go('profile')} aria-label="Mein Profil" title="Mein Profil">
              <User {...ICON} />
            </button>
          )}
        </div>
      </header>

      {isLocalMode && demoHint && (
        <div className="alert alert-soft flex items-start justify-between gap-2">
          <span>Demo-Modus: Daten werden nur in diesem Browser gespeichert. Für Login & Cloud-Sync Supabase in <code>.env</code> konfigurieren.</span>
          <button className="btn btn-ghost btn-sm btn-square -my-1" onClick={() => setDemoHint(false)} aria-label="Hinweis ausblenden" title="Hinweis ausblenden">
            <X size={18} aria-hidden />
          </button>
        </div>
      )}
      {me?.blocked && (
        <div className="alert alert-soft block alert-error">Dein Konto ist gesperrt. Du kannst deine Daten ansehen, aber nichts mehr speichern. Bei Fragen melde dich beim Admin.</div>
      )}
      {data.error && (
        <div className="alert alert-soft alert-error flex items-start justify-between gap-2" role="alert">
          <span>Das hat nicht geklappt: {data.error}</span>
          <button className="btn btn-ghost btn-sm btn-square -my-1" onClick={() => data.setError(null)} aria-label="Fehlermeldung schließen">
            <X size={18} aria-hidden />
          </button>
        </div>
      )}

      <main className={`content page-${tab}`} key={tab}>
        <Suspense fallback={pageLoading}>
        {tab === 'dashboard' && <Dashboard {...props} />}
        {tab === 'brew' && <BrewPage {...props} preset={brewPreset} key={brewPreset?.key ?? 'new'} />}
        {tab === 'dialin' && <DialInPage {...props} preset={brewPreset} />}
        {tab === 'history' && <HistoryPage {...props} />}
        {tab === 'beans' && <BeansPage {...props} />}
        {tab === 'equipment' && <EquipmentPage {...props} />}
        {tab === 'community' && <CommunityPage {...props} />}
        {tab === 'profile' && <ProfilePage {...props} />}
        {tab === 'user' && <UserPage {...props} userId={userId} key={userId} />}
        {tab === 'feedback' && <FeedbackPage {...props} fromTab={prevTab === 'user' ? 'community' : prevTab} />}
        {tab === 'admin' && <AdminPage {...props} />}
        </Suspense>
      </main>

      <Toaster />

      {/* Mobil/Tablet: untere Leiste mit zentralem Bezug-Knopf */}
      <nav className="dock dock-lg z-10 max-w-[640px] min-[700px]:max-w-[760px] mx-auto bg-base-100 border-t border-base-300 min-[700px]:border-x min-[700px]:rounded-t-[18px] desk:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${t.fab ? 'dock-fab' : ''} ${activeTab === t.id ? 'dock-active text-accent-strong' : 'text-muted'} ${t.fab || activeTab !== t.id ? 'after:hidden' : ''}`}
            onClick={() => go(t.id)}
            aria-label={t.fab ? 'Neuer Bezug' : undefined}
          >
            <span className={t.fab ? 'fab-circle' : 'tab-icon'}>
              <t.icon size={t.fab ? 28 : 22} strokeWidth={t.fab ? 2.2 : 1.75} aria-hidden />
            </span>
            <span className="dock-label max-w-full truncate px-0.5">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Desktop: Seitenleiste, "+ Neuer Bezug" als prominenter Knopf oben */}
      <aside className="sidebar hidden desk:flex flex-col gap-4.5 overflow-y-auto z-20 bg-base-100 border-r border-base-300 px-3.5 py-5">
        <button className="flex items-center gap-2.5 px-1.5 text-[17px] font-semibold tracking-tight cursor-pointer" onClick={() => go('dashboard')}>
          <Logo /> BeanBase {beta}
        </button>
        <button className="btn btn-primary btn-block h-12 justify-start gap-2.5 rounded-[13px]" onClick={() => go('brew')}>
          <Plus size={20} strokeWidth={2.2} aria-hidden /> Neuer Bezug
          <kbd className="num ml-auto text-[11px] font-normal opacity-70" aria-label="Tastenkürzel N">N</kbd>
        </button>
        <ul className="menu w-full gap-0.5 p-0 text-[15px]" aria-label="Hauptnavigation">
          {TABS.filter((t) => !t.fab).map((t) => (
            <li key={t.id}>
              <button className={`h-11 gap-3 rounded-[11px] ${activeTab === t.id ? 'menu-active bg-primary/14! text-accent-strong! font-semibold' : 'text-base-content/80 font-medium'}`} onClick={() => go(t.id)} aria-current={activeTab === t.id ? 'page' : undefined}>
                <t.icon {...ICON} />
                {t.label}
                {counts[t.id] ? <span className="num ml-auto text-xs font-normal text-muted">{counts[t.id]}</span> : null}
              </button>
            </li>
          ))}
        </ul>
        <div className="h-px shrink-0 bg-base-300" />
        <ul className="menu w-full gap-0.5 p-0 text-sm" aria-label="Konto">
          {sideLinks.map((l) => (
            <li key={l.label}>
              <button className={`h-10 gap-3 rounded-[11px] ${l.on ? 'menu-active bg-primary/14! text-accent-strong!' : 'text-muted'}`} onClick={l.run}>
                <l.icon size={18} strokeWidth={1.75} aria-hidden />
                {l.label}
              </button>
            </li>
          ))}
        </ul>
        {me && (
          <button className={`mt-auto flex shrink-0 items-center gap-2.5 rounded-[13px] border bg-base-200 p-2.5 text-left cursor-pointer ${tab === 'profile' ? 'border-primary' : 'border-base-300'}`} onClick={() => go('profile')} aria-label="Mein Profil">
            <Avatar profile={me} size={36} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">{me.display_name || me.username}</span>
              <span className="truncate text-xs text-muted">@{me.username}</span>
            </span>
          </button>
        )}
      </aside>
    </div>
  )
}
