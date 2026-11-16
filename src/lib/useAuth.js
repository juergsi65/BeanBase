import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { queryClient } from './query'

const LOCAL_USER = { id: 'local', email: 'Lokaler Modus' }
// Kommt der Nutzer über den Link aus der "Passwort vergessen"-Mail, steht ?recovery=1 in der URL
const recoveryInUrl = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('recovery')

export function useAuth() {
  const [user, setUser] = useState(supabase ? undefined : LOCAL_USER) // undefined = lädt
  const [recovery, setRecovery] = useState(false)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      if (data.session && recoveryInUrl()) setRecovery(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'SIGNED_OUT') queryClient.clear() // keine Daten des alten Kontos im Cache lassen
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && recoveryInUrl())) setRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  const signOut = () => supabase?.auth.signOut()
  const endRecovery = () => {
    setRecovery(false)
    const url = new URL(window.location.href)
    url.searchParams.delete('recovery')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }
  return { user, signOut, recovery, endRecovery }
}
