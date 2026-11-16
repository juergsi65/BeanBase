// Mini-Toast: toast('Gespeichert') → kurze Einblendung unten (siehe <Toaster/> in App.jsx)
import { haptic } from './haptics'

const listeners = new Set()
export function toast(text, { tone = 'good', haptics = true } = {}) {
  if (haptics) haptic(tone === 'error' ? 'error' : 'success')
  listeners.forEach((fn) => fn({ id: Date.now() + Math.random(), text, tone }))
}
export function onToast(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
