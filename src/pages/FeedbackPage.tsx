import { useState } from 'react'
import { errMsg } from '../lib/errors'
import { useQuery } from '@tanstack/react-query'
import { useSessionStorage } from 'use-storage-hook'
import { Field } from '../components/ui'
import { sendFeedback, listFeedback } from '../lib/admin'
import { toast } from '../lib/toast'
import { fmtDate } from '../lib/coffee'
import type { PageProps, Tab } from '../types'

type Topic = 'bug' | 'idea' | 'ux' | 'other'
const TOPICS: Record<Topic, string> = { bug: '🐞 Fehler', idea: '💡 Idee', ux: '👆 Bedienung', other: '💬 Sonstiges' }

export default function FeedbackPage({ go, fromTab }: Pick<PageProps, 'go'> & { fromTab: Exclude<Tab, 'user'> }) {
  const [topic, setTopic] = useState<Topic>('bug')
  const [text, setText] = useSessionStorage('beanbase:feedback-draft', '') // Entwurf überlebt Seitenwechsel/Reload
  const [busy, setBusy] = useState(false)
  const { data: mine = [], refetch } = useQuery({ queryKey: ['feedback'], queryFn: listFeedback })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await sendFeedback(`[${TOPICS[topic]}] ${text}`, `Seite: ${fromTab ?? '–'} · ${window.innerWidth}×${window.innerHeight}`)
      setText('')
      toast('Danke für dein Feedback! ☕')
      refetch()
    } catch (err) {
      toast(errMsg(err), { tone: 'error' })
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
          {(Object.entries(TOPICS) as [Topic, string][]).map(([k, v]) => (
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
      <button className="btn ghost block" onClick={() => go(fromTab)}>
        Zurück
      </button>
    </div>
  )
}
