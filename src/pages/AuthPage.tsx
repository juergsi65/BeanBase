import { useEffect, useState } from 'react'
import { requireSupabase } from '../lib/supabase'
import { Field } from '../components/ui'
import { useSettings } from '../lib/settings'

/** Verständliche Fehlermeldungen statt technischer Supabase-Texte */
function authError(error: { message?: string; code?: string }) {
  const m = error.message ?? ''
  if (/Database error saving new user|INVITE_INVALID/i.test(m)) return 'Einladungscode ungültig oder schon aufgebraucht.'
  if (/Invalid login credentials/i.test(m)) return 'E-Mail oder Passwort falsch.'
  if (/Email not confirmed/i.test(m)) return 'Bitte bestätige zuerst deine E-Mail-Adresse (Link im Postfach).'
  if (/User already registered/i.test(m)) return 'Für diese E-Mail gibt es schon ein Konto – bitte einloggen.'
  if (/email_address_not_authorized|not authorized/i.test(m) || error.code === 'email_address_not_authorized')
    return 'Bestätigungs-Mail konnte nicht zugestellt werden (Mail-Versand noch nicht eingerichtet). Bitte melde dich beim BeanBase-Team.'
  if (/email rate limit/i.test(m) || error.code === 'over_email_send_rate_limit')
    return 'Gerade werden zu viele E-Mails verschickt – bitte in einer Stunde erneut versuchen.'
  if (/rate limit|too many/i.test(m)) return 'Zu viele Versuche – bitte in ein paar Minuten erneut probieren.'
  if (/Password should be at least/i.test(m)) return 'Das Passwort muss mindestens 6 Zeichen haben.'
  return m
}

export default function AuthPage() {
  const [mode, setMode] = useState(() => (new URLSearchParams(window.location.search).get('invite') ? 'signup' : 'login'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState(() => (new URLSearchParams(window.location.search).get('invite') ?? '').toUpperCase())
  const settings = useSettings()
  // Google-Button nur zeigen, wenn der Provider in Supabase aktiviert ist
  const [googleEnabled, setGoogleEnabled] = useState(false)
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key ?? '' } })
      .then((r) => r.json())
      .then((j) => setGoogleEnabled(!!j?.external?.google))
      .catch(() => {})
  }, [])
  const [msg, setMsg] = useState<{ tone: 'error' | 'info'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = requireSupabase()
    setBusy(true)
    setMsg(null)
    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/?recovery=1` })
      setBusy(false)
      // Aus Datenschutzgründen nicht verraten, ob es ein Konto zu der Adresse gibt
      if (error && !/not.?found|user/i.test(error.message)) return setMsg({ tone: 'error', text: authError(error) })
      return setMsg({ tone: 'info', text: 'Falls es ein Konto mit dieser E-Mail gibt, ist jetzt ein Link zum Zurücksetzen unterwegs. Schau auch im Spam-Ordner nach.' })
    }
    const { data, error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin, data: { invite_code: invite.trim().toUpperCase() } },
          })
    setBusy(false)
    if (error) setMsg({ tone: 'error', text: authError(error) })
    else if (mode === 'signup' && !data.session)
      setMsg({ tone: 'info', text: 'Fast geschafft! Bitte bestätige deine E-Mail-Adresse über den Link im Postfach.' })
  }

  const google = () =>
    requireSupabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })

  return (
    <div className="grid min-h-dvh place-items-center p-5">
      <div className="card w-full max-w-[380px] desk:max-w-[420px] gap-3.5 rounded-[20px] border border-base-300 bg-base-100 px-5.5 py-7 text-center desk:px-8 desk:py-9">
        <div className="text-5xl">🫘</div>
        <h1>BeanBase</h1>
        <p className="text-muted">Dein digitales Barista-Notizbuch. Nie wieder Dial-In auf Zetteln.</p>
        <form className="flex flex-col gap-3 text-left" onSubmit={submit}>
          <Field label="E-Mail">
            <input className="input w-full" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {mode === 'signup' && settings.invite_required && (
            <Field label="Einladungscode" hint="BeanBase ist in der Beta – nur mit Einladung">
              <input className="input w-full"
                required
                value={invite}
                onChange={(e) => setInvite(e.target.value.toUpperCase())}
                placeholder="z. B. BEAN-3F9A2C"
                autoCapitalize="characters"
                autoCorrect="off"
              />
            </Field>
          )}
          {mode !== 'reset' && (
          <Field label="Passwort">
            <input className="input w-full"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          )}
          {msg && <div className={`alert alert-soft block alert-${msg.tone}`}>{msg.text}</div>}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {mode === 'login' ? 'Einloggen' : mode === 'signup' ? 'Konto erstellen' : 'Link zum Zurücksetzen senden'}
          </button>
        </form>
        {googleEnabled && mode !== 'reset' && (
          <button className="btn btn-ghost border-base-300 btn-block" onClick={google}>
            Mit Google anmelden
          </button>
        )}
        {mode === 'login' && (
          <button className="link link-primary p-2 no-underline" onClick={() => { setMode('reset'); setMsg(null) }}>
            Passwort vergessen?
          </button>
        )}
        <button className="link link-primary p-2 no-underline" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg(null) }}>
          {mode === 'login' ? 'Noch kein Konto? Registrieren' : mode === 'signup' ? 'Schon registriert? Einloggen' : '← Zurück zum Login'}
        </button>
      </div>
    </div>
  )
}
