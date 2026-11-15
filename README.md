# 🫘 BeanBase

**Dial-In & Brew-Log für Home-Baristas.** Equipment, Bohnen und jeden Bezug digital festhalten – nie wieder Mahlgrad auf Zetteln notieren.

Optimiert fürs Smartphone neben der Maschine: große Buttons, −/+ Zahleneingabe, integrierte Stoppuhr, Dark Mode (folgt automatisch dem System).

## Features

- **Login** per E-Mail/Passwort oder Google (Supabase Auth), jeder Nutzer sieht nur seine eigenen Daten (Row Level Security)
- **Equipment**: Maschinen/Brühmethoden (Siebträger, V60, AeroPress …) mit Notizen; Mühlen mit Skalentyp (stufenlos / Klicks / Zahlen)
- **Bohnen-Datenbank**: Name, Rösterei, Herkunft, Varietät, Aufbereitung, Röstgrad, Röstdatum (→ automatisch „X Tage alt“ + Frische-Ampel), Geschmacksnoten als Tags, Status „Aktiv in der Mühle“ / „Archiv“
- **Brew-Log / Dial-In**: Dosis, Output, automatische **Brew-Ratio**, Mahlgrad (Eingabe passt sich dem Skalentyp der Mühle an), Temperatur, Pre-Infusion, Brühzeit mit **Stoppuhr-Button**, 1–5 Sterne, Extraktions-Regler *sauer ↔ ausgewogen ↔ bitter*, Notiz für den nächsten Versuch
- **Dashboard**: Bohne antippen → sofort **letzter** und **bestbewerteter** Bezug mit großem Mahlgrad-Display + Dial-In-Tipp; „Mit diesen Werten neuen Bezug starten“
- **Suche & Filter** nach Bohne, Röstgrad, Bewertung und Freitext
- **JSON-Export** als Backup
- **Hardware-Presets**: ~25 Maschinen/Brühmethoden und ~22 Mühlen zum Auswählen (Suche tolerant gegenüber Tippfehlern). Füllt Typ, Skala und Notizen vor; Maschinen liefern passende Startwerte (z. B. Dedica 14 g → 28 g, V60 15 g → 250 g). Eigene Geräte bleiben möglich, umbenennen ist erlaubt – die Modell-Verknüpfung (`preset_id`) bleibt.
- **Bohnen-Foto & KI-Etikett-Scan**: Tüte direkt mit der Handykamera fotografieren. Das Foto wird verkleinert und im Supabase Storage gespeichert; eine Edge Function liest per Gemini Vision Name, Rösterei, Herkunft, Varietät, Aufbereitung, Röstgrad, Röstdatum und Geschmacksnoten aus und füllt **nur leere** Felder. Im Demo-Modus wird das Foto lokal gespeichert (ohne KI).
- **Community-Sofort-Check**: Beim Anlegen einer Bohne und beim Bezug zeigt BeanBase anonymisierte Durchschnittswerte anderer Nutzer für dieselbe Bohne (Rösterei + Name, Schreibweise egal), getrennt nach Brühmethode – und mit Mahlgrad, wenn die eigene Mühle mit demselben Modell verknüpft ist. Ein Tipp übernimmt die Werte in den Bezug.

## Tech-Stack

| Teil | Wahl |
|---|---|
| Frontend | React 19 + Vite (reines CSS, kein UI-Framework) |
| Auth & DB | [Supabase](https://supabase.com) (Postgres + Auth, kostenloser Tarif reicht) |
| Hosting | beliebiges Static Hosting (Vercel, Netlify, Cloudflare Pages, GitHub Pages) |

Ohne Supabase-Konfiguration läuft die App im **Demo-Modus**: Alle Daten liegen im `localStorage` des Browsers, ohne Login.

## Lokal starten

```bash
npm install
npm run dev        # http://localhost:5173 – startet im Demo-Modus
```

## Supabase einrichten (Login + Cloud-Speicher)

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen.
2. **SQL Editor** → Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen → *Run*. Damit werden die Tabellen `machines`, `grinders`, `beans` und `brews` inkl. RLS-Policies angelegt.
3. **Project Settings → API**: `Project URL` und `anon public` Key kopieren.
4. `.env.example` nach `.env` kopieren und eintragen:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   Das Skript ist idempotent – bei Updates einfach erneut ausführen (ergänzt neue Spalten, Storage-Bucket `bean-images` und die Funktion `get_community_recipes`).
5. *Optional, Google-Login:* **Authentication → Providers → Google** aktivieren (OAuth-Client aus der Google Cloud Console). Unter **Authentication → URL Configuration** die Site-URL bzw. Redirect-URLs (`http://localhost:5173`, später die Produktions-URL) eintragen.
6. `npm run dev` neu starten → Login-Bildschirm erscheint.

## KI-Etikett-Erkennung aktivieren (optional)

Benötigt die [Supabase CLI](https://supabase.com/docs/guides/cli) und einen Gemini-API-Key aus [Google AI Studio](https://aistudio.google.com/apikey).

```bash
supabase login
supabase link --project-ref <dein-project-ref>
supabase secrets set GEMINI_API_KEY=dein-key
supabase secrets set GEMINI_MODEL=gemini-2.5-flash   # optional, jedes Gemini-Modell mit Bildeingabe
supabase functions deploy analyze-bean-label
```

Der API-Key liegt nur serverseitig in der Edge Function, nie im Browser. Nur eingeloggte Nutzer können die Funktion aufrufen.

## Community-Abgleich & Datenschutz

`get_community_recipes(roaster, name, grinder_preset, machine_type)` ist eine Postgres-Funktion (`security definer`), die **nur Aggregate** liefert:

- nur Bezüge **anderer** Nutzer mit **≥ 4 Sternen**
- Abgleich über normalisierte Rösterei + Bohnenname (`"BONANZA "` = `"bonanza"`, `"Ethiopia-Guji"` = `"ethiopia guji"`)
- Mahlgrad nur bei gleicher Mühle (`preset_id`), nur numerische Werte (Komma oder Punkt)
- Ausgabe erst ab **2 verschiedenen Nutzern** (`min_users` in `schema.sql` anpassbar), keine IDs, keine Notizen
- nur für eingeloggte Nutzer aufrufbar

Bohnen-Fotos liegen im Bucket `bean-images` unter `<user_id>/…`. Lesen ist über die zufällige URL möglich (öffentlicher Bucket), Hochladen/Löschen nur im eigenen Ordner.

## Deployen (Beispiel Vercel)

1. Repo auf [vercel.com](https://vercel.com) importieren (Framework: *Vite* wird erkannt).
2. Environment Variables `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` setzen.
3. Deploy. Die Vercel-URL in Supabase unter *Authentication → URL Configuration* eintragen.

Netlify funktioniert identisch: Build-Befehl `npm run build`, Output-Verzeichnis `dist`.

### Cloudflare Workers

`wrangler.jsonc` ist vorkonfiguriert (statische Assets aus `dist`). In Cloudflare unter *Workers & Pages → Worker → Settings → Build*:

| Einstellung | Wert |
|---|---|
| Branch | der Branch mit dem Code (z. B. `main`) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Build variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

Die `VITE_*`-Variablen müssen als **Build**-Variablen gesetzt sein (nicht als Runtime-Variablen), da Vite sie beim Build einbettet. Danach die `*.workers.dev`-URL in Supabase unter *Authentication → URL Configuration* eintragen.

Lokal: `npm run build && npx wrangler deploy`.

## Datenmodell

```
machines  (id, user_id, name, type, preset_id, notes, created_at)
grinders  (id, user_id, name, scale_type, preset_id, notes, created_at)
beans     (id, user_id, name, roaster, origin, variety, process, roast_level,
           roast_date, flavor_notes[], image_url, active, created_at)
brews     (id, user_id, bean_id→beans, machine_id→machines, grinder_id→grinders,
           dose, yield, grind_setting, temperature, brew_time, preinfusion,
           rating 1–5, extraction -5…+5, notes, created_at)
```

## Projektstruktur

```
src/
  App.jsx               Layout, Tab-Navigation, Auth-Gate
  lib/db.js             Datenschicht (Supabase oder localStorage)
  lib/coffee.js         Fachlogik: Ratio, Röst-Alter, Rezept-Auswahl, Labels
  lib/images.js         Foto verkleinern, Storage-Upload, KI-Analyse aufrufen
  lib/community.js      Community-Abfrage (RPC)
  data/presets.js       Kuratierte Maschinen & Mühlen (preset_id nie ändern!)
  components/ui.jsx     Stoppuhr, Sterne, Extraktions-Regler, Zahlenfeld, Rezeptkarte …
  components/CommunityTip.jsx   Community-Sofort-Check
  pages/                Dashboard, Bezug, Log, Bohnen, Setup, Login
supabase/schema.sql     Tabellen, Row Level Security, Storage, Community-Funktion
supabase/functions/analyze-bean-label/   Edge Function (Gemini Vision)
```
