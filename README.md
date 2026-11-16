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
- **Packung, Bestand & Kosten** (privat, Tabelle `bean_stock`): Packungsgröße (250 g / 500 g / 1 kg oder frei) und Kaufpreis je Bohne → Preis pro 100 g, **Kosten pro Tasse**, Tassen pro Packung, **Restmenge** mit Füllstandsbalken („noch 232 g ≈ 12 Tassen“, Warnung „fast leer“), „Neue Packung angebrochen“, Kosten pro Bezug im Formular und im Log, **Kaffee-Ausgaben der letzten 30 Tage** auf dem Start-Bildschirm. Preise sieht nur der Besitzer – auch Freunde nicht.
- **Fotos & Videos**: Foto oder Video (bis 60 s / 50 MB) zu jedem Bezug, sichtbar im Log und im Community-Feed; Fotos von Maschine und Mühle; Setup-Foto auf der Barista-Visitenkarte (Bucket `brew-media`).
- **Desktop & Mobil**: ab 960 px App-Layout mit Seitenleiste, Start und Bezug zweispaltig, Listen als Raster; auf dem Handy untere Leiste mit zentralem „+“. Automatisch geprüft auf 320–1440 px (nichts ragt über).
- **Bedienung**: zentraler „+ Bezug“-Knopf, haptisches Feedback (Android: Vibration, iPhone ab iOS 17.4: Taptic-Engine über den Safari-Switch), kurze Bestätigungen („Bezug gespeichert ☕“), Druck-Animationen, als App installierbar (PWA: „Zum Home-Bildschirm“), Export & Haptik-Schalter unter ⚙️.
- **Bohnen-Foto**: Tüte mit der Handykamera fotografieren oder hochladen; das Foto wird verkleinert im Supabase Storage gespeichert (Demo-Modus: lokal).
- **KI-Funktionen · TBA**: Etiketten-Erkennung per Gemini (Edge Function `analyze-bean-label`) und ein KI-Dial-In-Coach sind vorbereitet, aber noch nicht freigeschaltet (`AI_LABEL_ENABLED` in `src/lib/images.js`). In der App sind sie als „TBA“ gekennzeichnet.
- **Barcode-Scanner**: EAN/UPC der Tüte mit der Handykamera scannen (eingebauter `BarcodeDetector` auf Android/Chrome, sonst ZXing – wird erst beim Öffnen geladen) oder Nummer eintippen (mit Prüfziffer-Check). Erkennung kaskadierend: **eigene Bohne** mit dem Barcode → direkt öffnen; **BeanBase-Community** (häufigste Produktangaben aller Nutzer, die die Bohne schon erfasst haben) → **Open Food Facts** → **UPCitemdb** (Trial-API, ~100 Abfragen/Tag; läuft über den Worker-Endpunkt `/api/upc/<code>`, da UPCitemdb keine Browser-Anfragen erlaubt, Treffer werden 7 Tage gecacht). **Strikter Kaffee-Filter**: Ist das Produkt laut Kategorien/Name kein Kaffee (Milch, Schokolade, Kaffeesahne, Filter …), wird nichts übernommen und „Kein Kaffee erkannt“ angezeigt. Unbekannte Barcodes werden beim Speichern hinterlegt, sodass der nächste Scan sie sofort erkennt. Auch der KI-Foto-Scan liest einen sichtbaren Barcode mit aus.
- **Social Barista**: Profil mit Username, Anzeigename, Bio und Profilbild (Bucket `avatars`), automatisch beim Registrieren angelegt (`barista_xxxxxx`, ohne Bezug zur E-Mail). Freunde per Username suchen, Anfragen senden/annehmen/ablehnen. **Community-Tab** mit Feed („Nur Freunde“ / „Alle Baristas“): Bezüge mit Bohne, Setup, Parametern, Bewertung und Notiz, ☕-Likes, Kommentare und „Rezept übernehmen“ (Mahlgrad nur, wenn man dieselbe Mühle besitzt). **Barista-Profile** zeigen Setup, aktuelle Bohnen und letzte Bezüge.
  - **Privat per Default**: Bohnen, Equipment und Bezüge sehen nur akzeptierte Freunde. Wer „Profil öffentlich“ einschaltet, erscheint für alle eingeloggten Nutzer (Feed „Alle Baristas“). Schreiben darf immer nur der Besitzer (RLS).
- **Beta-Test & Admin**: Registrierung nur mit Einladungscode (Link `…/?invite=CODE`), Rollen Admin/Tester, 💬-Feedback aus der App, Admin-Bereich 🛠 (Übersicht, Nutzer sperren/löschen, Einladungen, Feedback, Moderation, Einstellungen), Video-Uploads per Schalter gesperrt (auch serverseitig), „Konto löschen“ für alle, „Passwort vergessen“ + „Passwort ändern“, Feedback optional per E-Mail an den Admin (Worker + Cloudflare Email Routing). Ablauf & Checkliste: [`docs/BETA-TEST.md`](docs/BETA-TEST.md).
- **Community-Sofort-Check**: Beim Anlegen einer Bohne und beim Bezug zeigt BeanBase anonymisierte Durchschnittswerte **und das bestbewertete Rezept** anderer Nutzer für dieselbe Bohne (Rösterei + Name, Schreibweise egal), getrennt nach Brühmethode – mit Mahlgrad, wenn die eigene Mühle mit demselben Modell verknüpft ist, und noch genauer bei gleicher Mühle **und** Maschine. „Rezept übernehmen“ bzw. „Ø übernehmen“ füllt den Bezug aus.
- **Dial-In-Assistent** auf der Bezug-Seite: Checkliste in 4 Schritten (Mühle einstellen inkl. Purge-Hinweis → Maschine vorbereiten → Zielwerte Output/Zeit → Geschmack korrigieren). Zielwerte wahlweise aus dem **eigenen** besten/letzten Bezug (automatisch korrigiert, wenn er zu sauer/bitter war), der **Community** oder **Basiswerten** je Röstgrad und Brühmethode. Die Korrekturhilfe nennt konkrete neue Werte (z. B. „Mahlgrad 15 → 14“, „Temperatur +1 °C“) und übernimmt sie auf Wunsch als Notiz.

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

## KI-Etikett-Erkennung aktivieren (optional, derzeit „TBA“)

In `src/lib/images.js` `AI_LABEL_ENABLED = true` setzen und die Edge Function deployen:

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

`get_community_recipes(roaster, name, grinder_preset, machine_type, machine_preset)` ist eine Postgres-Funktion (`security definer`), die **nur Aggregate** liefert:

- nur Bezüge **anderer** Nutzer mit **≥ 4 Sternen**
- Abgleich über normalisierte Rösterei + Bohnenname (`"BONANZA "` = `"bonanza"`, `"Ethiopia-Guji"` = `"ethiopia guji"`)
- Mahlgrad nur bei gleicher Mühle (`preset_id`), nur numerische Werte (Komma oder Punkt)
- Ausgabe erst ab **2 verschiedenen Nutzern** je Bereich (`min_users` in `schema.sql` anpassbar), keine IDs, keine Notizen, keine Zeitstempel
- „Bestes Rezept“ = Messwerte des bestbewerteten Bezugs (bei Gleichstand: ausgewogenste Extraktion, dann neuester) – ohne Nutzerbezug
- nur für eingeloggte Nutzer aufrufbar

`lookup_bean_by_barcode(barcode)` gibt nur **Produktangaben** zurück (Name, Rösterei, Herkunft, Varietät, Aufbereitung, Röstgrad, häufigste Geschmacksnoten – jeweils der häufigste Wert aller Einträge) plus die Anzahl der Nutzer; keine Notizen, Röstdaten, Fotos oder IDs. Nur für eingeloggte Nutzer.

Beim Scan wird der Barcode (nur die Nummer) an [Open Food Facts](https://world.openfoodfacts.org) gesendet, falls die Community ihn nicht kennt.

Bohnen-Fotos liegen im Bucket `bean-images` unter `<user_id>/…`. Lesen ist über die zufällige URL möglich (öffentlicher Bucket), Hochladen/Löschen nur im eigenen Ordner.

## Deployen (Beispiel Vercel)

1. Repo auf [vercel.com](https://vercel.com) importieren (Framework: *Vite* wird erkannt).
2. Environment Variables `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` setzen.
3. Deploy. Die Vercel-URL in Supabase unter *Authentication → URL Configuration* eintragen.

Netlify funktioniert identisch: Build-Befehl `npm run build`, Output-Verzeichnis `dist`.

### Cloudflare Workers

`wrangler.jsonc` ist vorkonfiguriert: statische Assets aus `dist` (mit `public/_headers` für Caching), dazu `worker/index.js` für `/api/*` (UPCitemdb-Proxy). In Cloudflare unter *Workers & Pages → Worker → Settings → Build*:

| Einstellung | Wert |
|---|---|
| Branch | der Branch mit dem Code (z. B. `main`) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Build variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

Für dieses Repo sind URL und Publishable-Key bereits in `.env.production` hinterlegt (beide sind öffentlich und landen ohnehin im Browser-JavaScript) – Cloudflare braucht dann keine eigenen Variablen. Wer andere Werte nutzen will, setzt sie in Cloudflare; die `VITE_*`-Variablen müssen dort als **Build**-Variablen gesetzt sein (nicht als Runtime-Variablen), da Vite sie beim Build einbettet. Danach die `*.workers.dev`-URL in Supabase unter *Authentication → URL Configuration* eintragen.

Lokal: `npm run build && npx wrangler deploy`.

## Datenmodell

```
machines  (id, user_id, name, type, preset_id, notes, created_at)
grinders  (id, user_id, name, scale_type, preset_id, notes, created_at)
beans     (id, user_id, name, roaster, origin, variety, process, roast_level,
           roast_date, flavor_notes[], image_url, barcode, active, created_at)
profiles  (id→auth.users, username, display_name, avatar_url, bio, is_public, created_at)
friendships (id, requester_id, addressee_id, status pending|accepted, created_at)
brew_likes (brew_id, user_id) · brew_comments (id, brew_id, user_id, body, created_at)
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
  lib/dialin.js         Dial-In-Logik: Basiswerte, Zielwerte, Mahlgrad-Korrektur
  lib/barcode.js        Barcode prüfen + nachschlagen (Community → Open Food Facts → UPCitemdb) + Kaffee-Filter
  lib/social.js         Profile, Freunde, Feed, Likes, Kommentare
  data/presets.js       Kuratierte Maschinen & Mühlen (preset_id nie ändern!)
  components/ui.jsx     Stoppuhr, Sterne, Extraktions-Regler, Zahlenfeld, Rezeptkarte …
  components/CommunityTip.jsx   Community-Sofort-Check
  components/DialInGuide.jsx    Dial-In-Assistent + Korrekturhilfe
  components/BarcodeScanner.jsx Kamera-Scanner (BarcodeDetector / ZXing) + manuelle Eingabe
  components/FeedCard.jsx       Feed-Karte (Likes, Kommentare, Rezept übernehmen)
  pages/                Dashboard, Bezug, Log, Bohnen, Community, Profil, Barista-Profil, Setup, Login
lib/cost.js / lib/media.js / lib/haptics.js / lib/toast.js   Kosten & Bestand · Fotos/Videos · Haptik · Bestätigungen
worker/index.js         Cloudflare Worker: Assets + /api/upc-Proxy
supabase/schema.sql     Tabellen, Row Level Security, Storage, Community-Funktion
supabase/functions/analyze-bean-label/   Edge Function (Gemini Vision)
```
