// Mini-Toast: toast('Gespeichert') → kurze Einblendung unten (siehe <Toaster/> in App.jsx)
import { Store } from '@tanstack/react-store'
import { haptic } from './haptics'

/** Globaler Store: aktuell sichtbare Toasts (es wird immer nur der neueste gezeigt) */
export const toastStore = new Store([])

export function toast(text, { tone = 'good', haptics = true } = {}) {
  if (haptics) haptic(tone === 'error' ? 'error' : 'success')
  const t = { id: Date.now() + Math.random(), text, tone }
  toastStore.setState(() => [t])
  setTimeout(() => toastStore.setState((list) => list.filter((x) => x.id !== t.id)), 2400)
}
