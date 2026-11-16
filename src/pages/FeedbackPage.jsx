import { useEffect, useState } from 'react'
import { Field } from '../components/ui'
import { sendFeedback, listFeedback } from '../lib/admin'
import { toast } from '../lib/toast'
import { fmtDate } from '../lib/coffee'

const TOPICS = { bug: '🐞 Fehler', idea: '💡 Idee', ux: '👆 Bedienung', other: '💬 Sonstiges' }

export default function FeedbackPage({ go, fromTab }) {
  const [topic, setTopic] = useState('bug')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [mine, setMine] = useState([])

  const reload = () => listFeedback().then(setMine).catch(() => {})
  useEffect(() => {
    reload()
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await sendFeedback(`[${TOPICS[topic]}] ${text}`, `Seite: ${fromTab ?? '–'} · ${window.innerWidth}×${window.innerHeight}`)
      setText('')
      toast('Danke für dein Feedback! ☕')
      reload()
    } catch (err) {
      toast(err.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <h2>Feedback zur Beta</h2>
      <p className="muted">
        Danke, dass du BeanBase testest! Was klemmt, was fehlt, was gefällt dir? Jede Rückmeldung landet direkt beim Entwickler.
      </p>
      <form className="card" onSubmit={submit}>
        <div className="segmented">
          {Object.entries(TOPICS).map(([k, v]) => (
            <button type="button" key={k} className={topic === k ? 'on' : ''} onClick={() => setTopic(k)}>
              {v}
            </button>
          ))}
        </div>
        <Field label="Deine Nachricht" hint={`${text.length}/1900`}>
          <textarea
            rows={5}
            required
            maxLength={1900}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={topic === 'bug' ? 'Was hast du gemacht, was ist passiert, was hättest du erwartet?' : 'Erzähl uns mehr …'}
          />
        </Field>
        <p className="muted small">Mitgesendet werden die aktuelle Seite, Bildschirmgröße und Browser – keine weiteren Daten.</p>
        <button className="btn primary block big" disabled={busy || !text.trim()}>
          {busy ? 'Sende …' : 'Feedback senden'}
        </button>
      </form>
      {mine.length > 0 && (
        <section className="card">
          <h3 className="section-title">Dein bisheriges Feedback</h3>
          <ul className="list">
            {mine.map((f) => (
              <li key={f.id} className="list-item col">
                <span className="muted small">
                  {fmtDate(f.created_at)} · {f.status === 'erledigt' ? '✅ erledigt' : '🕒 offen'}
                </span>
                <span>{f.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <button className="btn ghost block" onClick={() => go(fromTab ?? 'dashboard')}>
        Zurück
      </button>
    </div>
  )
}
