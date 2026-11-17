import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { useAuth } from './lib/useAuth'
import { useData } from './lib/useData'
import { isLocalMode } from './lib/supabase'
import { toastStore } from './lib/toast'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import BrewPage from './pages/BrewPage'
import HistoryPage from './pages/HistoryPage'
import BeansPage from './pages/BeansPage'
import EquipmentPage from './pages/EquipmentPage'
import CommunityPage from './pages/CommunityPage'
import ProfilePage from './pages/ProfilePage'
import UserPage from './pages/UserPage'
import FeedbackPage from './pages/FeedbackPage'
import AdminPage from './pages/AdminPage'
import SetPasswordPage from './pages/SetPasswordPage'
import { getMyProfile } from './lib/social'
import { useTheme } from './lib/theme'
import type { BrewPreset, Go, Tab } from './types'

// Untere Leiste: Daumen-freundlich, mittig der wichtigste Knopf ("+ Bezug")
const TABS: { id: Exclude<Tab, 'user'>; label: string; icon: string; fab?: boolean }[] = [
  { id: 'dashboard', label: 'Start', icon: '☕' },
  { id: 'beans', label: 'Bohnen', icon: '🫘' },
  { id: 'brew', label: 'Bezug', icon: '+', fab: true },
  { id: 'history', label: 'Log', icon: '📋' },
  { id: 'community', label: 'Community', icon: '🌍' },
]
const iconBtn = (on: boolean) =>
  `btn btn-square size-10 min-[401px]:size-11 rounded-[11px] text-lg bg-base-100 ${on ? 'border-primary ring-1 ring-inset ring-primary' : 'border-base-300'}`

const TAB_GROUP: Partial<Record<Tab, Tab | null>> = { user: 'community', profile: 'community', admin: 'community', feedback: null }
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

  if (user === undefined) return <div className="splash gap-3"><span className="loading loading-dots loading-lg text-primary" /> BeanBase lädt …</div>
  if (!user) return <AuthPage />
  if (recovery) return <SetPasswordPage onDone={endRecovery} />

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

  return (
    <div className="app">
      <header className="topbar navbar sticky top-0 z-10 gap-2 px-3 min-h-0 pb-2 pt-[calc(8px+env(safe-area-inset-top))] desk:fixed desk:inset-x-0 desk:z-30 desk:h-16 desk:px-6 desk:py-0 bg-page/88 backdrop-blur-md border-b border-base-300">
        <button className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-lg font-extrabold cursor-pointer desk:text-xl" onClick={() => go('dashboard')}>
          <span>🫘</span> <span className="hidden min-[420px]:inline">BeanBase</span>
          {!isLocalMode && <span className="badge badge-primary badge-xs font-extrabold tracking-wider shrink-0">BETA</span>}
        </button>
        <div className="ml-auto flex shrink-0 gap-1.5">
          <button
            className={iconBtn(false)}
            onClick={theme.toggle}
            aria-label={theme.isDark ? 'Helles Design' : 'Dunkles Design'}
            title={theme.isDark ? 'Zu hell wechseln' : 'Zu dunkel wechseln'}
          >
            {theme.isDark ? '☀️' : '🌙'}
          </button>
          {!isLocalMode && (
            <button className={iconBtn(tab === 'feedback')} onClick={() => go('feedback')} aria-label="Feedback geben">
              💬
            </button>
          )}
          {me?.role === 'admin' && (
            <button className={iconBtn(tab === 'admin')} onClick={() => go('admin')} aria-label="Admin-Bereich">
              🛠
            </button>
          )}
          <button className={iconBtn(tab === 'equipment')} onClick={() => go('equipment')} aria-label="Setup & Einstellungen">
            ⚙️
          </button>
          {!isLocalMode && (
            <button className={iconBtn(tab === 'profile')} onClick={() => go('profile')} aria-label="Mein Profil">
              👤
            </button>
          )}
        </div>
      </header>

      {isLocalMode && (
        <div className="alert alert-soft block">
          Demo-Modus: Daten werden nur in diesem Browser gespeichert. Für Login & Cloud-Sync Supabase in <code>.env</code> konfigurieren.
        </div>
      )}
      {me?.blocked && (
        <div className="alert alert-soft block alert-error">Dein Konto ist gesperrt. Du kannst deine Daten ansehen, aber nichts mehr speichern. Bei Fragen melde dich beim Admin.</div>
      )}
      {data.error && (
        <div className="alert alert-soft block alert-error cursor-pointer" onClick={() => data.setError(null)}>
          Fehler: {data.error} (tippen zum Schließen)
        </div>
      )}

      <main className={`content page-${tab}`} key={tab}>
        {tab === 'dashboard' && <Dashboard {...props} />}
        {tab === 'brew' && <BrewPage {...props} preset={brewPreset} key={brewPreset?.key ?? 'new'} />}
        {tab === 'history' && <HistoryPage {...props} />}
        {tab === 'beans' && <BeansPage {...props} />}
        {tab === 'equipment' && <EquipmentPage {...props} />}
        {tab === 'community' && <CommunityPage {...props} />}
        {tab === 'profile' && <ProfilePage {...props} />}
        {tab === 'user' && <UserPage {...props} userId={userId} key={userId} />}
        {tab === 'feedback' && <FeedbackPage {...props} fromTab={prevTab === 'user' ? 'community' : prevTab} />}
        {tab === 'admin' && <AdminPage {...props} />}
      </main>

      <Toaster />

      {/* Mobil/Tablet: untere Leiste mit zentralem Bezug-Knopf */}
      <nav className="dock dock-lg z-10 max-w-[640px] min-[700px]:max-w-[760px] mx-auto bg-base-100 border-t border-base-300 min-[700px]:border-x min-[700px]:rounded-t-[18px] desk:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${t.fab ? 'dock-fab' : ''} ${activeTab === t.id ? 'dock-active text-accent-strong' : 'text-muted'} ${t.fab ? 'after:hidden' : ''}`}
            onClick={() => go(t.id)}
            aria-label={t.fab ? 'Neuer Bezug' : undefined}
          >
            <span className={t.fab ? 'fab-circle' : 'tab-icon'}>{t.icon}</span>
            <span className="dock-label max-w-full truncate px-0.5">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Desktop: Seitenleiste, "+ Neuer Bezug" als prominenter Knopf oben */}
      <aside className="sidebar hidden desk:block z-20 bg-base-100 border-r border-base-300 px-3.5 py-5">
        <button className="btn btn-primary btn-block justify-start gap-3 mb-3 shadow-md" onClick={() => go('brew')}>
          <span className="w-6 text-center text-2xl font-light leading-none">+</span> Neuer Bezug
        </button>
        <ul className="menu w-full gap-1 p-0 text-[0.95rem] font-semibold">
          {TABS.filter((t) => !t.fab).map((t) => (
            <li key={t.id}>
              <button className={`gap-3 py-2.5 ${activeTab === t.id ? 'menu-active bg-primary/16! text-accent-strong!' : ''}`} onClick={() => go(t.id)}>
                <span className="w-6 text-center text-xl">{t.icon}</span>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
