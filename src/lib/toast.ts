// Mini-Toast: toast('Gespeichert') → kurze Einblendung unten (siehe <Toaster/> in App.tsx)
import { Store } from '@tanstack/react-store'
import { haptic } from './haptics'

/** Globaler Store: aktuell sichtbare Toasts (es wird immer nur der neueste gezeigt) */
export interface Toast {
  id: number
  text: string
  tone: 'good' | 'info' | 'error'
}
export const toastStore = new Store<Toast[]>([])

export function toast(text: string, { tone = 'good', haptics = true }: { tone?: Toast['tone']; haptics?: boolean } = {}) {
  if (haptics) haptic(tone === 'error' ? 'error' : 'success')
  const t: Toast = { id: Date.now() + Math.random(), text, tone }
  toastStore.setState(() => [t])
  setTimeout(() => toastStore.setState((list) => list.filter((x) => x.id !== t.id)), 2400)
}
