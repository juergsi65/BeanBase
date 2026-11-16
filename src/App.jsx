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
import FeedbackPage from './pages/FeedbackPage'
import AdminPage from './pages/AdminPage'
import SetPasswordPage from './pages/SetPasswordPage'
import { getMyProfile } from './lib/social'

// Untere Leiste: Daumen-freundlich, mittig der wichtigste Knopf ("+ Bezug")
const TABS = [
  { id: 'dashboard', label: 'Start', icon: '☕' },
  { id: 'beans', label: 'Bohnen', icon: '🫘' },
  { id: 'brew', label: 'Bezug', icon: '+', fab: true },
  { id: 'history', label: 'Log', icon: '📋' },
  { id: 'community', label: 'Community', icon: '🌍' },
]
const TAB_GROUP = { user: 'community', profile: 'community', admin: 'community', feedback: null }

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
  const { user, recovery, endRecovery } = useAuth()
  const data = useData(user)
  // Start-Tab aus dem PWA-Shortcut (?tab=brew)
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    return ['brew', 'beans', 'history', 'community'].includes(t) ? t : 'dashboard'
  })
  const [brewPreset, setBrewPreset] = useState(null)
  const [userId, setUserId] = useState(null)
  const [prevTab, setPrevTab] = useState('dashboard')
  const [me, setMe] = useState(null) // eigenes Profil (Rolle, Sperre)

  useEffect(() => {
    if (!user || isLocalMode) return
    getMyProfile().then(setMe).catch(() => {})
  }, [user])

  if (user === undefined) return <div className="splash">☕ BeanBase lädt …</div>
  if (!user) return <AuthPage />
  if (recovery) return <SetPasswordPage onDone={endRecovery} />

  // go('brew', { key, brew }) · go('user', { userId }) · go('<tab>')
  const go = (t, preset = null) => {
    if (t === 'user') setUserId(preset?.userId ?? null)
    else setBrewPreset(preset)
    if (t === 'feedback') setPrevTab(tab)
    setTab(t)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const props = { data, go, me }
  const activeTab = TAB_GROUP[tab] ?? tab

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => go('dashboard')}>
          <span className="logo">🫘</span> <span className="brand-name">BeanBase</span>
          {!isLocalMode && <span className="beta-pill">BETA</span>}
        </button>
        <div className="topbar-actions">
          {!isLocalMode && (
            <button className={`icon-btn ${tab === 'feedback' ? 'on' : ''}`} onClick={() => go('feedback')} aria-label="Feedback geben">
              💬
            </button>
          )}
          {me?.role === 'admin' && (
            <button className={`icon-btn ${tab === 'admin' ? 'on' : ''}`} onClick={() => go('admin')} aria-label="Admin-Bereich">
              🛠
            </button>
          )}
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
      {me?.blocked && (
        <div className="banner error">Dein Konto ist gesperrt. Du kannst deine Daten ansehen, aber nichts mehr speichern. Bei Fragen melde dich beim Admin.</div>
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
        {tab === 'feedback' && <FeedbackPage {...props} fromTab={prevTab} />}
        {tab === 'admin' && <AdminPage {...props} />}
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
