// Hell/Dunkel-Umschaltung: 'system' (folgt dem Gerät) | 'light' | 'dark'
import { useEffect } from 'react'
import { useLocalStorage } from 'use-storage-hook'
import { tryCatchOrUndefined } from 'only-utils'

const KEY = 'beanbase:theme'
export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]
const isTheme = (v: unknown): v is Theme => THEMES.includes(v as Theme)
export const THEME_LABEL: Record<Theme, string> = { system: 'Automatisch', light: 'Hell', dark: 'Dunkel' }

// Altbestand: früher roh gespeichert ('dark'), use-storage-hook erwartet JSON ('"dark"')
const stored = localStorage.getItem(KEY)
if (stored !== null && !isTheme(tryCatchOrUndefined(JSON.parse)(stored)))
  localStorage.setItem(KEY, JSON.stringify(isTheme(stored) ? stored : 'system'))

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches
export const resolvedTheme = (t: Theme): 'light' | 'dark' => (t === 'system' ? (systemDark() ? 'dark' : 'light') : t)

export function applyTheme(t: Theme) {
  const root = document.documentElement
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
  // Statusleiste/Browser-Leiste passend einfärben
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolvedTheme(t) === 'dark' ? '#0e0c0b' : '#f7f3ee')
}

export function useTheme() {
  const [theme, setTheme] = useLocalStorage<Theme>(KEY, 'system')
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
