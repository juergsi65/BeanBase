// Cloudflare Worker: liefert die App (statische Assets) aus und stellt kleine Server-Endpunkte bereit:
//   GET  /api/upc/<code>        Proxy für UPCitemdb (deren API erlaubt keine Browser-Anfragen/CORS)
//   POST /api/feedback-notify   E-Mail an den Admin, wenn ein Tester Feedback schickt
interface Env {
  ASSETS: Fetcher
  SUPABASE_URL: string
  SUPABASE_KEY: string
  FEEDBACK_EMAIL?: SendEmail
  FEEDBACK_TO?: string
  FEEDBACK_FROM?: string
}
interface Mail {
  from: string
  to: string
  subject: string
  text: string
  host: string
}
interface FeedbackRow {
  id: string
  message: string
  context: string | null
  user_agent: string | null
  created_at: string
  author: { username: string; display_name: string | null } | null
}

const UPC_RE = /^\/api\/upc\/(\d{8,14})$/
const json = (body: unknown, status = 200) => Response.json(body, { status })

async function upcLookup(code: string, ctx: ExecutionContext) {
  const cache = caches.default
  const key = new Request(`https://beanbase-cache/upc/${code}`)
  const hit = await cache.match(key)
  if (hit) return hit
  const upstream = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, {
    headers: { accept: 'application/json', 'user-agent': 'BeanBase/1.0 (+coffee log)' },
  })
  const body = await upstream.text()
  const res = new Response(body, {
    status: upstream.status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': upstream.ok ? 'public, max-age=604800' : 'no-store',
    },
  })
  if (upstream.ok) ctx.waitUntil(cache.put(key, res.clone()))
  return res
}

// --- Feedback per E-Mail ------------------------------------------------------------
// Voraussetzungen (siehe docs/BETA-TEST.md):
//   1. Cloudflare Email Routing für die Absender-Domain aktiv, Empfänger-Adresse dort verifiziert
//   2. Binding "FEEDBACK_EMAIL" (send_email) in wrangler.jsonc
//   3. Secret FEEDBACK_TO (Empfänger) im Worker; optional Variable FEEDBACK_FROM (Absender)
// Ohne Binding/Secret antwortet der Endpunkt mit 202 "nicht eingerichtet" – die App funktioniert normal weiter.
const b64utf8 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))

function rawMime({ from, to, subject, text, host }: Mail) {
  return [
    `From: BeanBase <${from}>`,
    `To: <${to}>`,
    `Subject: =?UTF-8?B?${b64utf8(subject)}?=`,
    `Message-ID: <${crypto.randomUUID()}@${host}>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64utf8(text).replace(/(.{76})/g, '$1\r\n'),
  ].join('\r\n')
}

async function sendMail(email: SendEmail, mail: Mail) {
  // Neuere Email-Service-API (strukturiert); Fallback: klassisches EmailMessage mit MIME
  try {
    return await email.send({ to: mail.to, from: { email: mail.from, name: 'BeanBase' }, subject: mail.subject, text: mail.text })
  } catch (e) {
    if (!(e instanceof TypeError)) throw e
    const { EmailMessage } = await import('cloudflare:email')
    return email.send(new EmailMessage(mail.from, mail.to, rawMime(mail)))
  }
}

async function feedbackNotify(request: Request, env: Env, ctx: ExecutionContext) {
  if (!env.FEEDBACK_EMAIL || !env.FEEDBACK_TO) return json({ status: 'not_configured' }, 202)
  const auth = request.headers.get('authorization') ?? ''
  const { id } = await request.json<{ id?: unknown }>().catch(() => ({ id: undefined }))
  if (!/^Bearer\s+\S+$/.test(auth) || typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'bad_request' }, 400)

  // Feedback mit dem Token des Nutzers lesen → RLS stellt sicher, dass es sein eigenes ist
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/feedback?id=eq.${id}&select=id,message,context,user_agent,created_at,author:profiles!feedback_user_id_fkey(username,display_name)`,
    { headers: { apikey: env.SUPABASE_KEY, authorization: auth, accept: 'application/json' } },
  )
  const [fb]: (FeedbackRow | undefined)[] = res.ok ? await res.json() : []
  if (!fb) return json({ error: 'not_found' }, 404)
  if (Date.now() - new Date(fb.created_at).getTime() > 10 * 60 * 1000) return json({ status: 'too_old' }, 409)

  // Jede Rückmeldung nur einmal mailen
  const cache = caches.default
  const key = new Request(`https://beanbase-cache/feedback-mail/${fb.id}`)
  if (await cache.match(key)) return json({ status: 'already_sent' })

  const host = new URL(request.url).hostname
  const who = fb.author?.display_name ? `${fb.author.display_name} (@${fb.author.username})` : `@${fb.author?.username ?? 'unbekannt'}`
  const text = [
    `Neues Feedback von ${who}`,
    '',
    fb.message,
    '',
    '—',
    `Kontext: ${fb.context ?? '–'}`,
    `Gerät: ${fb.user_agent ?? '–'}`,
    `Zeit: ${new Date(fb.created_at).toLocaleString('de-AT', { timeZone: 'Europe/Vienna' })}`,
    `Admin-Bereich: https://${host}/ (🛠 → Feedback)`,
  ].join('\n')
  await sendMail(env.FEEDBACK_EMAIL, {
    from: env.FEEDBACK_FROM || `beanbase@${host.split('.').slice(-2).join('.')}`,
    to: env.FEEDBACK_TO,
    subject: `BeanBase Feedback: ${fb.message.slice(0, 70)}`,
    text,
    host,
  })
  ctx.waitUntil(cache.put(key, new Response('1', { headers: { 'cache-control': 'max-age=86400' } })))
  return json({ status: 'sent' })
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      try {
        if (url.pathname === '/api/feedback-notify' && request.method === 'POST') return await feedbackNotify(request, env, ctx)
        if (request.method !== 'GET') return json({ code: 'METHOD_NOT_ALLOWED' }, 405)
        const m = url.pathname.match(UPC_RE)
        if (m) return await upcLookup(m[1], ctx)
        return json({ code: 'NOT_FOUND' }, 404)
      } catch (e) {
        return json({ code: 'SERVER_ERROR', message: String(e instanceof Error ? e.message : e).slice(0, 200) }, 502)
      }
    }
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
