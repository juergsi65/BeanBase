// Haptisches Feedback im Browser:
// - Android/Chrome: Vibration API
// - iPhone (Safari ≥ 17.4, auch als Home-Bildschirm-App): Umschalten eines versteckten
//   <input type="checkbox" switch> löst die Taptic Engine aus. Funktioniert nur innerhalb
//   einer Nutzer-Geste (Tippen) – genau dort rufen wir es auf.
import { useLocalStorage } from 'use-storage-hook'
import { isIOS as detectIOS } from 'only-utils'

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'error'
const PATTERNS: Record<HapticKind, number | number[]> = { light: 8, medium: 15, heavy: 30, success: [12, 40, 12], error: [30, 50, 30] }

let iosSwitch: HTMLLabelElement | null = null
const isIOS = typeof navigator !== 'undefined' && detectIOS(navigator.userAgent)
const KEY = 'beanbase:haptics'

// Altbestand: früher 'on'/'off', use-storage-hook speichert JSON (true/false)
const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
if (stored !== null && stored !== 'true' && stored !== 'false') localStorage.setItem(KEY, JSON.stringify(stored !== 'off'))

const enabled = () => typeof localStorage === 'undefined' || localStorage.getItem(KEY) !== 'false'
/** [an, setAn] – Einstellung für die Settings-Seite */
export const useHapticsSetting = () => useLocalStorage(KEY, true)

export function haptic(kind: HapticKind = 'light') {
  if (!enabled()) return
  try {
    if (!isIOS && typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERNS[kind] ?? PATTERNS.light)
      return
    }
    if (isIOS) {
      if (!iosSwitch) {
        iosSwitch = document.createElement('label')
        iosSwitch.setAttribute('aria-hidden', 'true')
        iosSwitch.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none'
        const input = document.createElement('input')
        input.type = 'checkbox'
        input.setAttribute('switch', '')
        input.tabIndex = -1
        iosSwitch.appendChild(input)
        document.body.appendChild(iosSwitch)
      }
      iosSwitch.click()
      if (kind === 'success' || kind === 'error' || kind === 'heavy') setTimeout(() => iosSwitch?.click(), 90)
    }
  } catch {
    /* Haptik ist nur ein Extra */
  }
}

/** Globales leichtes Feedback für alle Buttons/Tabs (einmal in main.tsx registriert) */
export function installGlobalHaptics() {
  const SELECTOR = '.btn, .num-btn, .dock button, .sidebar .menu button, .stars button, .segmented button, .bean-picker button, .guide-check, .fab'
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>(SELECTOR) : null
      if (el && !(el as HTMLButtonElement).disabled && !el.dataset.noHaptic) haptic(['btn-primary', 'fab', 'dock-fab'].some((c) => el.classList.contains(c)) ? 'medium' : 'light')
    },
    { capture: true },
  )
}
