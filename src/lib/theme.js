// Hell/Dunkel-Umschaltung: 'system' (folgt dem Gerät) | 'light' | 'dark'
import { useEffect } from 'react'
import { useLocalStorage } from 'use-storage-hook'
import { tryCatchOrUndefined } from 'only-utils'

const KEY = 'beanbase:theme'
export const THEMES = ['system', 'light', 'dark']
export const THEME_LABEL = { system: 'Automatisch', light: 'Hell', dark: 'Dunkel' }

// Altbestand: früher roh gespeichert ('dark'), use-storage-hook erwartet JSON ('"dark"')
const stored = localStorage.getItem(KEY)
if (stored !== null && !THEMES.includes(tryCatchOrUndefined(JSON.parse)(stored)))
  localStorage.setItem(KEY, JSON.stringify(THEMES.includes(stored) ? stored : 'system'))

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
  const [theme, setTheme] = useLocalStorage(KEY, 'system')
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [theme])
  // Header-Knopf: zwischen Hell und Dunkel wechseln (ausgehend vom aktuell sichtbaren Modus)
  const toggle = () => setTheme(resolvedTheme(theme) === 'dark' ? 'light' : 'dark')
  return { theme, setTheme, toggle, isDark: resolvedTheme(theme) === 'dark' }
}
