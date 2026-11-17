import { useState } from 'react'
import { errMsg } from '../lib/errors'
import { useQuery } from '@tanstack/react-query'
import { useSessionStorage } from 'use-storage-hook'
import { Field, segBtn, segWrap } from '../components/ui'
import { sendFeedback, listFeedback } from '../lib/admin'
import { toast } from '../lib/toast'
import { fmtDate } from '../lib/coffee'
import type { PageProps, Tab } from '../types'

type Topic = 'bug' | 'idea' | 'ux' | 'other'
const TOPICS: Record<Topic, string> = { bug: 'Fehler', idea: 'Idee', ux: 'Bedienung', other: 'Sonstiges' }

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
      toast('Danke für dein Feedback!')
      refetch()
    } catch (err) {
      toast(errMsg(err), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2>Feedback zur Beta</h2>
      <p className="text-muted">
        Danke, dass du BeanBase testest! Was klemmt, was fehlt, was gefällt dir? Jede Rückmeldung landet direkt beim Entwickler.
      </p>
      <form className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5" onSubmit={submit}>
        <div className={segWrap}>
          {(Object.entries(TOPICS) as [Topic, string][]).map(([k, v]) => (
            <button type="button" key={k} aria-pressed={topic === k} className={segBtn(topic === k)} onClick={() => setTopic(k)}>
              {v}
            </button>
          ))}
        </div>
        <Field label="Deine Nachricht" hint={<span className="num">{text.length}/1900</span>}>
          <textarea className="textarea w-full"
            rows={5}
            required
            maxLength={1900}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={topic === 'bug' ? 'Was hast du gemacht, was ist passiert, was hättest du erwartet?' : 'Erzähl uns mehr …'}
          />
        </Field>
        <p className="text-muted text-sm">Mitgesendet werden die aktuelle Seite, Bildschirmgröße und Browser – keine weiteren Daten.</p>
        <button className="btn btn-primary btn-block btn-lg" disabled={busy || !text.trim()}>
          {busy ? 'Sende …' : 'Feedback senden'}
        </button>
      </form>
      {mine.length > 0 && (
        <section className="card bg-base-100 border border-base-300 p-4 desk:p-5 gap-3.5">
          <h3 className="lbl">Dein bisheriges Feedback</h3>
          <ul className="items">
            {mine.map((f) => (
              <li key={f.id} className="item col">
                <span className="flex items-center justify-between gap-2">
                  <span className="num text-xs text-muted">{fmtDate(f.created_at)}</span>
                  <span className={`num rounded-full border px-2 text-[11px] tracking-wider uppercase ${f.status === 'erledigt' ? 'border-success/40 bg-success/10 text-success' : 'border-base-300 text-muted'}`}>
                    {f.status === 'erledigt' ? 'erledigt' : 'offen'}
                  </span>
                </span>
                <span>{f.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <button className="btn btn-ghost border-base-300 btn-block" onClick={() => go(fromTab)}>
        Zurück
      </button>
    </div>
  )
}
