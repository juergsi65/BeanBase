import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const LOCAL_USER = { id: 'local', email: 'Lokaler Modus' }

export function useAuth() {
  const [user, setUser] = useState(supabase ? undefined : LOCAL_USER) // undefined = lädt
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])
  const signOut = () => supabase?.auth.signOut()
  return { user, signOut }
}
