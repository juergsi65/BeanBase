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
5. *Optional, Google-Login:* **Authentication → Providers → Google** aktivieren (OAuth-Client aus der Google Cloud Console). Unter **Authentication → URL Configuration** die Site-URL bzw. Redirect-URLs (`http://localhost:5173`, später die Produktions-URL) eintragen.
6. `npm run dev` neu starten → Login-Bildschirm erscheint.

## Deployen (Beispiel Vercel)

1. Repo auf [vercel.com](https://vercel.com) importieren (Framework: *Vite* wird erkannt).
2. Environment Variables `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` setzen.
3. Deploy. Die Vercel-URL in Supabase unter *Authentication → URL Configuration* eintragen.

Netlify / Cloudflare Pages funktionieren identisch: Build-Befehl `npm run build`, Output-Verzeichnis `dist`.

## Datenmodell

```
machines  (id, user_id, name, type, notes, created_at)
grinders  (id, user_id, name, scale_type, notes, created_at)
beans     (id, user_id, name, roaster, origin, variety, process, roast_level,
           roast_date, flavor_notes[], active, created_at)
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
  components/ui.jsx     Stoppuhr, Sterne, Extraktions-Regler, Zahlenfeld, Rezeptkarte …
  pages/                Dashboard, Bezug, Log, Bohnen, Setup, Login
supabase/schema.sql     Tabellen + Row Level Security
```
