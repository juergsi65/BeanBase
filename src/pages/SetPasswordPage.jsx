import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Field } from '../components/ui'
import { toast } from '../lib/toast'

export const MIN_PASSWORD = 8

/** Neues Passwort setzen – nach Klick auf den Link aus der "Passwort vergessen"-Mail oder im Profil */
export function PasswordForm({ onDone, submitLabel = 'Passwort speichern' }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (pw.length < MIN_PASSWORD) return setMsg(`Mindestens ${MIN_PASSWORD} Zeichen.`)
    if (pw !== pw2) return setMsg('Die Passwörter stimmen nicht überein.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) {
      setMsg(/should be different|same_password/i.test(error.message + error.code) ? 'Das neue Passwort muss sich vom alten unterscheiden.' : error.message)
      return
    }
    setPw('')
    setPw2('')
    setMsg(null)
    toast('Passwort geändert 🔒')
    onDone?.()
  }

  return (
    <form className="stack-sm" onSubmit={submit}>
      <Field label="Neues Passwort" hint={`mind. ${MIN_PASSWORD} Zeichen`}>
        <input type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={MIN_PASSWORD} value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <Field label="Wiederholen">
        <input type={show ? 'text' : 'password'} autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </Field>
      <label className="toggle small">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        <span>Passwort anzeigen</span>
      </label>
      {msg && <div className="banner error">{msg}</div>}
      <button className="btn primary block big" disabled={busy}>
        {busy ? 'Speichere …' : submitLabel}
      </button>
    </form>
  )
}

export default function SetPasswordPage({ onDone }) {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-logo">🔒</div>
        <h1>Neues Passwort</h1>
        <p className="muted">Wähle ein neues Passwort für dein BeanBase-Konto.</p>
        <PasswordForm onDone={onDone} submitLabel="Passwort speichern & weiter" />
      </div>
    </div>
  )
}
