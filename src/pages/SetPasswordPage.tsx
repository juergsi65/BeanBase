import { useState } from 'react'
import { requireSupabase } from '../lib/supabase'
import { Field } from '../components/ui'
import { toast } from '../lib/toast'

export const MIN_PASSWORD = 8

/** Neues Passwort setzen – nach Klick auf den Link aus der "Passwort vergessen"-Mail oder im Profil */
export function PasswordForm({ onDone, submitLabel = 'Passwort speichern' }: { onDone?: () => void; submitLabel?: string }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.length < MIN_PASSWORD) return setMsg(`Mindestens ${MIN_PASSWORD} Zeichen.`)
    if (pw !== pw2) return setMsg('Die Passwörter stimmen nicht überein.')
    setBusy(true)
    const { error } = await requireSupabase().auth.updateUser({ password: pw })
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
    <form className="flex flex-col gap-3 text-left" onSubmit={submit}>
      <Field label="Neues Passwort" hint={`mind. ${MIN_PASSWORD} Zeichen`}>
        <input className="input w-full" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={MIN_PASSWORD} value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <Field label="Wiederholen">
        <input className="input w-full" type={show ? 'text' : 'password'} autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </Field>
      <label className="flex items-center gap-3 cursor-pointer font-medium text-sm">
        <input className="checkbox checkbox-primary" type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        <span>Passwort anzeigen</span>
      </label>
      {msg && <div className="alert alert-soft block alert-error">{msg}</div>}
      <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
        {busy ? 'Speichere …' : submitLabel}
      </button>
    </form>
  )
}

export default function SetPasswordPage({ onDone }: { onDone: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center p-5">
      <div className="card w-full max-w-[380px] desk:max-w-[420px] gap-3.5 rounded-[20px] border border-base-300 bg-base-100 px-5.5 py-7 text-center desk:px-8 desk:py-9">
        <div className="text-5xl">🔒</div>
        <h1>Neues Passwort</h1>
        <p className="text-muted">Wähle ein neues Passwort für dein BeanBase-Konto.</p>
        <PasswordForm onDone={onDone} submitLabel="Passwort speichern & weiter" />
      </div>
    </div>
  )
}
