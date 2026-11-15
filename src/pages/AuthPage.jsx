import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Field } from '../components/ui'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const fn = mode === 'login' ? supabase.auth.signInWithPassword : supabase.auth.signUp
    const { data, error } = await fn.call(supabase.auth, { email, password })
    setBusy(false)
    if (error) setMsg({ tone: 'error', text: error.message })
    else if (mode === 'signup' && !data.session)
      setMsg({ tone: 'info', text: 'Fast geschafft! Bitte bestätige deine E-Mail-Adresse über den Link im Postfach.' })
  }

  const google = () =>
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-logo">🫘</div>
        <h1>BeanBase</h1>
        <p className="muted">Dein digitales Barista-Notizbuch. Nie wieder Dial-In auf Zetteln.</p>
        <form onSubmit={submit}>
          <Field label="E-Mail">
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Passwort">
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {msg && <div className={`banner ${msg.tone}`}>{msg.text}</div>}
          <button className="btn primary block big" disabled={busy}>
            {mode === 'login' ? 'Einloggen' : 'Konto erstellen'}
          </button>
        </form>
        <button className="btn ghost block" onClick={google}>
          Mit Google anmelden
        </button>
        <button className="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Schon registriert? Einloggen'}
        </button>
      </div>
    </div>
  )
}
