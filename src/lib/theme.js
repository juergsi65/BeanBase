// Hell/Dunkel-Umschaltung: 'system' (folgt dem Gerät) | 'light' | 'dark'
import { useEffect, useState } from 'react'

const KEY = 'beanbase:theme'
export const THEMES = ['system', 'light', 'dark']
export const THEME_LABEL = { system: 'Automatisch', light: 'Hell', dark: 'Dunkel' }

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches
export const resolvedTheme = (t) => (t === 'system' ? (systemDark() ? 'dark' : 'light') : t)

export function applyTheme(t) {
  const root = document.documentElement
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
  // Statusleiste/Browser-Leiste passend einfärben
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolvedTheme(t) === 'dark' ? '#16110e' : '#f6efe6')
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => localStorage.getItem(KEY) || 'system')
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [theme])
  const setTheme = (t) => {
    localStorage.setItem(KEY, t)
    setThemeState(t)
  }
  // Header-Knopf: zwischen Hell und Dunkel wechseln (ausgehend vom aktuell sichtbaren Modus)
  const toggle = () => setTheme(resolvedTheme(theme) === 'dark' ? 'light' : 'dark')
  return { theme, setTheme, toggle, isDark: resolvedTheme(theme) === 'dark' }
}
