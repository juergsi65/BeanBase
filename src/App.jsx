import { useState } from 'react'
import { useAuth } from './lib/useAuth'
import { useData } from './lib/useData'
import { isLocalMode } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import BrewPage from './pages/BrewPage'
import HistoryPage from './pages/HistoryPage'
import BeansPage from './pages/BeansPage'
import EquipmentPage from './pages/EquipmentPage'
import { exportAll } from './lib/db'

const TABS = [
  { id: 'dashboard', label: 'Start', icon: '☕' },
  { id: 'brew', label: 'Bezug', icon: '⏱' },
  { id: 'history', label: 'Log', icon: '📋' },
  { id: 'beans', label: 'Bohnen', icon: '🫘' },
  { id: 'equipment', label: 'Setup', icon: '⚙️' },
]

export default function App() {
  const { user, signOut } = useAuth()
  const data = useData(user)
  const [tab, setTab] = useState('dashboard')
  const [brewPreset, setBrewPreset] = useState(null)

  if (user === undefined) return <div className="splash">BeanBase lädt …</div>
  if (!user) return <AuthPage />

  const go = (t, preset = null) => {
    setBrewPreset(preset)
    setTab(t)
    window.scrollTo(0, 0)
  }

  const download = async () => {
    const blob = new Blob([JSON.stringify(await exportAll(), null, 2)], { type: 'application/json' })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `beanbase-backup-${new Date().toISOString().slice(0, 10)}.json`,
    })
    a.click()
  }

  const props = { data, go }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🫘</span> BeanBase
        </div>
        <div className="topbar-actions">
          <button className="btn ghost sm" onClick={download} title="Daten als JSON exportieren">
            Export
          </button>
          {!isLocalMode && (
            <button className="btn ghost sm" onClick={signOut}>
              Logout
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

      <main className="content">
        {tab === 'dashboard' && <Dashboard {...props} />}
        {tab === 'brew' && <BrewPage {...props} preset={brewPreset} key={brewPreset?.key ?? 'new'} />}
        {tab === 'history' && <HistoryPage {...props} />}
        {tab === 'beans' && <BeansPage {...props} />}
        {tab === 'equipment' && <EquipmentPage {...props} />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
