// Mini-Toast: toast('Gespeichert') → kurze Einblendung unten (siehe <Toaster/> in App.tsx)
import { Store } from '@tanstack/react-store'
import { haptic } from './haptics'

/** Globaler Store: aktuell sichtbare Toasts (es wird immer nur der neueste gezeigt) */
export interface Toast {
  id: number
  text: string
  tone: 'good' | 'info' | 'error'
  /** z. B. Rückgängig – Toast bleibt dann länger stehen */
  action?: { label: string; run: () => unknown }
}
export const toastStore = new Store<Toast[]>([])

export const dismissToast = (id: number) => toastStore.setState((list) => list.filter((x) => x.id !== id))

export function toast(
  text: string,
  { tone = 'good', haptics = true, action }: { tone?: Toast['tone']; haptics?: boolean; action?: Toast['action'] } = {},
) {
  if (haptics) haptic(tone === 'error' ? 'error' : 'success')
  const t: Toast = { id: Date.now() + Math.random(), text, tone, action }
  toastStore.setState(() => [t])
  setTimeout(() => dismissToast(t.id), action ? 6000 : 2400)
}
