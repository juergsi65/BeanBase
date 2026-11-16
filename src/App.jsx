import { useEffect, useState } from 'react'
import { useAuth } from './lib/useAuth'
import { useData } from './lib/useData'
import { isLocalMode } from './lib/supabase'
import { onToast } from './lib/toast'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import BrewPage from './pages/BrewPage'
import HistoryPage from './pages/HistoryPage'
import BeansPage from './pages/BeansPage'
import EquipmentPage from './pages/EquipmentPage'
import CommunityPage from './pages/CommunityPage'
import ProfilePage from './pages/ProfilePage'
import UserPage from './pages/UserPage'

// Untere Leiste: Daumen-freundlich, mittig der wichtigste Knopf ("+ Bezug")
const TABS = [
  { id: 'dashboard', label: 'Start', icon: '☕' },
  { id: 'beans', label: 'Bohnen', icon: '🫘' },
  { id: 'brew', label: 'Bezug', icon: '+', fab: true },
  { id: 'history', label: 'Log', icon: '📋' },
  { id: 'community', label: 'Community', icon: '🌍' },
]
const TAB_GROUP = { user: 'community', profile: 'community' }

function Toaster() {
  const [items, setItems] = useState([])
  useEffect(
    () =>
      onToast((t) => {
        setItems([t])
        setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), 2400)
      }),
    [],
  )
  return (
    <div className="toaster" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const { user } = useAuth()
  const data = useData(user)
  // Start-Tab aus dem PWA-Shortcut (?tab=brew)
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    return ['brew', 'beans', 'history', 'community'].includes(t) ? t : 'dashboard'
  })
  const [brewPreset, setBrewPreset] = useState(null)
  const [userId, setUserId] = useState(null)

  if (user === undefined) return <div className="splash">☕ BeanBase lädt …</div>
  if (!user) return <AuthPage />

  // go('brew', { key, brew }) · go('user', { userId }) · go('<tab>')
  const go = (t, preset = null) => {
    if (t === 'user') setUserId(preset?.userId ?? null)
    else setBrewPreset(preset)
    setTab(t)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const props = { data, go }
  const activeTab = TAB_GROUP[tab] ?? tab

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => go('dashboard')}>
          <span className="logo">🫘</span> BeanBase
        </button>
        <div className="topbar-actions">
          <button className={`icon-btn ${tab === 'equipment' ? 'on' : ''}`} onClick={() => go('equipment')} aria-label="Setup & Einstellungen">
            ⚙️
          </button>
          {!isLocalMode && (
            <button className={`icon-btn ${tab === 'profile' ? 'on' : ''}`} onClick={() => go('profile')} aria-label="Mein Profil">
              👤
            </button>
          )}
        </div>
      </header>

      {isLocalMode && (
        <div className="banner">
          Demo-Modus: Daten werden nur in diesem Browser gespeichert. Für Login & Cloud-Sync Supabase in <code>.env</code> konfigurieren.
        </div>
      )}
      {data.error && (
        <div className="banner error" onClick={() => data.setError(null)}>
          Fehler: {data.error} (tippen zum Schließen)
        </div>
      )}

      <main className="content" key={tab}>
        {tab === 'dashboard' && <Dashboard {...props} />}
        {tab === 'brew' && <BrewPage {...props} preset={brewPreset} key={brewPreset?.key ?? 'new'} />}
        {tab === 'history' && <HistoryPage {...props} />}
        {tab === 'beans' && <BeansPage {...props} />}
        {tab === 'equipment' && <EquipmentPage {...props} />}
        {tab === 'community' && <CommunityPage {...props} />}
        {tab === 'profile' && <ProfilePage {...props} />}
        {tab === 'user' && <UserPage {...props} userId={userId} key={userId} />}
      </main>

      <Toaster />

      <nav className="tabbar">
        {TABS.map((t) =>
          t.fab ? (
            <button key={t.id} className={`fab ${activeTab === t.id ? 'active' : ''}`} onClick={() => go(t.id)} aria-label="Neuer Bezug">
              <span className="fab-circle">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ) : (
            <button key={t.id} className={activeTab === t.id ? 'active' : ''} onClick={() => go(t.id)}>
              <span className="tab-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ),
        )}
      </nav>
    </div>
  )
}
