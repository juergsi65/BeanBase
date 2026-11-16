// Cloudflare Worker: liefert die App (statische Assets) aus und stellt einen kleinen
// Proxy für UPCitemdb bereit – deren API erlaubt keine direkten Browser-Anfragen (CORS).
const UPC_RE = /^\/api\/upc\/(\d{8,14})$/

async function upcLookup(code, ctx) {
  const cache = caches.default
  const key = new Request(`https://beanbase-cache/upc/${code}`)
  const hit = await cache.match(key)
  if (hit) return hit

  const upstream = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, {
    headers: { accept: 'application/json', 'user-agent': 'BeanBase/1.0 (+coffee log)' },
  })
  const body = await upstream.text()
  const ok = upstream.ok
  const res = new Response(body, {
    status: upstream.status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Treffer 7 Tage cachen (schont das Tageslimit der Trial-API), Fehler nicht
      'cache-control': ok ? 'public, max-age=604800' : 'no-store',
    },
  })
  if (ok) ctx.waitUntil(cache.put(key, res.clone()))
  return res
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })
      const m = url.pathname.match(UPC_RE)
      if (m) {
        try {
          return await upcLookup(m[1], ctx)
        } catch {
          return Response.json({ code: 'UPSTREAM_ERROR' }, { status: 502 })
        }
      }
      return Response.json({ code: 'NOT_FOUND' }, { status: 404 })
    }
    return env.ASSETS.fetch(request)
  },
}
