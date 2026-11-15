// Supabase Edge Function: liest das Etikett einer Kaffeetüte per Gemini Vision aus.
//
// Deploy:
//   supabase secrets set GEMINI_API_KEY=...            (Google AI Studio)
//   supabase secrets set GEMINI_MODEL=gemini-2.5-flash  (optional)
//   supabase functions deploy analyze-bean-label
//
// Nur eingeloggte Nutzer können die Funktion aufrufen (JWT-Prüfung ist bei
// Supabase Edge Functions standardmäßig aktiv).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const MAX_BASE64 = 7_000_000 // ≈ 5 MB Bild
const MIME = ['image/jpeg', 'image/png', 'image/webp']
const PROCESSES = ['washed', 'natural', 'honey', 'anaerobic', 'other']
const ROASTS = ['light', 'medium', 'dark']

const PROMPT = `Du siehst das Foto einer Kaffeetüte / eines Kaffee-Etiketts.
Lies die Angaben aus und antworte ausschließlich mit JSON nach dem Schema.
Regeln:
- name: Name der Kaffeesorte bzw. des Blends (ohne Röstereinamen).
- roaster: Name der Rösterei.
- origin: Herkunft (Land, Region, Farm/Kooperative), kurz.
- variety: Varietät(en), z. B. "Heirloom", "Bourbon, Caturra".
- process: eines von ${PROCESSES.join(', ')} ("washed" = gewaschen/lavado, "natural" = trocken/dry).
- roast_level: eines von ${ROASTS.join(', ')} (Espresso-Röstung ohne weitere Angabe eher medium; "Filter"/"Omni" hell eher light).
- roast_date: Röstdatum als YYYY-MM-DD, nur wenn eindeutig ein Röstdatum (nicht MHD) aufgedruckt ist.
- flavor_notes: Geschmacksnoten als kurze Begriffe, ins Deutsche übersetzt (max. 6).
Unbekannte oder nicht lesbare Felder: null. Nichts erfinden.`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', nullable: true },
    roaster: { type: 'STRING', nullable: true },
    origin: { type: 'STRING', nullable: true },
    variety: { type: 'STRING', nullable: true },
    process: { type: 'STRING', nullable: true },
    roast_level: { type: 'STRING', nullable: true },
    roast_date: { type: 'STRING', nullable: true },
    flavor_notes: { type: 'ARRAY', items: { type: 'STRING' } },
  },
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const str = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

function sanitize(raw: Record<string, unknown>) {
  const date = str(raw.roast_date, 10)
  return {
    name: str(raw.name),
    roaster: str(raw.roaster),
    origin: str(raw.origin),
    variety: str(raw.variety),
    process: PROCESSES.includes(raw.process as string) ? raw.process : null,
    roast_level: ROASTS.includes(raw.roast_level as string) ? raw.roast_level : null,
    roast_date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)) ? date : null,
    flavor_notes: Array.isArray(raw.flavor_notes)
      ? raw.flavor_notes.map((t) => str(t, 40)).filter(Boolean).slice(0, 6)
      : [],
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Nur POST' }, 405)

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ error: 'GEMINI_API_KEY ist nicht gesetzt' }, 500)
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash'

  let image: string, mimeType: string
  try {
    ;({ image, mimeType } = await req.json())
  } catch {
    return json({ error: 'Ungültiger Request' }, 400)
  }
  if (typeof image !== 'string' || !image || image.length > MAX_BASE64) return json({ error: 'Bild fehlt oder ist zu groß' }, 400)
  if (!MIME.includes(mimeType)) return json({ error: 'Nicht unterstütztes Bildformat' }, 400)

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType, data: image } }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA },
    }),
  })
  if (!res.ok) {
    console.error('Gemini error', res.status, await res.text())
    return json({ error: `Gemini-API antwortete mit ${res.status}` }, 502)
  }
  const out = await res.json()
  const text = out?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  try {
    return json(sanitize(JSON.parse(text)))
  } catch {
    return json({ error: 'Etikett konnte nicht gelesen werden' }, 422)
  }
})
