// Haptisches Feedback im Browser:
// - Android/Chrome: Vibration API
// - iPhone (Safari ≥ 17.4, auch als Home-Bildschirm-App): Umschalten eines versteckten
//   <input type="checkbox" switch> löst die Taptic Engine aus. Funktioniert nur innerhalb
//   einer Nutzer-Geste (Tippen) – genau dort rufen wir es auf.
const PATTERNS = { light: 8, medium: 15, heavy: 30, success: [12, 40, 12], error: [30, 50, 30] }

let iosSwitch = null
const isIOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent)
let enabled = typeof localStorage === 'undefined' || localStorage.getItem('beanbase:haptics') !== 'off'

export const hapticsEnabled = () => enabled
export function setHapticsEnabled(on) {
  enabled = on
  localStorage.setItem('beanbase:haptics', on ? 'on' : 'off')
}

export function haptic(kind = 'light') {
  if (!enabled) return
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
      if (kind === 'success' || kind === 'error' || kind === 'heavy') setTimeout(() => iosSwitch.click(), 90)
    }
  } catch {
    /* Haptik ist nur ein Extra */
  }
}

/** Globales leichtes Feedback für alle Buttons/Tabs (einmal in main.jsx registriert) */
export function installGlobalHaptics() {
  const SELECTOR = '.btn, .num-btn, .tabbar button, .stars button, .segmented button, .bean-picker button, .guide-check, .fab'
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target.closest?.(SELECTOR)
      if (el && !el.disabled && !el.dataset.noHaptic) haptic(el.classList.contains('primary') || el.classList.contains('fab') ? 'medium' : 'light')
    },
    { capture: true },
  )
}
