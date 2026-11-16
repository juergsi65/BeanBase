# BeanBase – Beta-Test (ca. 20 Personen)

## Vor dem Start (Pflicht)

1. **Mail-Versand klären** – der eingebaute Supabase-Mailversand schickt nur an Mitglieder des Supabase-Teams und nur wenige Mails pro Stunde. Für Tester also eine der beiden Varianten:
   - **Schnell:** *Authentication → Sign In / Providers → Email → „Confirm email“* ausschalten. Der Zugang ist trotzdem geschützt, weil die Registrierung einen Einladungscode braucht.
   - **Sauber:** eigenen SMTP-Dienst eintragen (*Authentication → Emails → SMTP Settings*), z. B. Brevo, Resend oder Postmark (alle mit Gratis-Kontingent). Danach kann „Confirm email“ an bleiben.
2. **URL Configuration** – *Authentication → URL Configuration*: Site URL `https://beanbase.wsmronline.uk`, unter *Redirect URLs* `https://beanbase.wsmronline.uk/**` (das `**` erlaubt auch den Link aus „Passwort vergessen“ mit `?recovery=1`).
3. **Einladungscode erstellen** – in der App: 🛠 → Einladungen → z. B. 20 Nutzungen, Notiz „Beta Runde 1“ → „Teilen“. Der Link `…/?invite=CODE` öffnet direkt die Registrierung mit eingetragenem Code.

## Passwort vergessen

Login → „Passwort vergessen?“ → Supabase schickt einen Link → die App öffnet „Neues Passwort“. Eingeloggte Nutzer ändern ihr Passwort unter 👤 → „Passwort ändern“. **Die Reset-Mail erreicht Tester nur mit eigenem SMTP-Dienst** (siehe Punkt 1), der eingebaute Versand liefert nur an das Supabase-Team.

## Feedback per E-Mail an den Admin (optional)

Der Worker schickt jedes neue Feedback per Mail – kostenlos über Cloudflare Email Routing, ohne Drittanbieter. Einmalig einrichten:

1. Cloudflare-Dashboard → **Compute → Email Service → Email Routing** → für `wsmronline.uk` aktivieren.
   ⚠️ Das setzt MX-Einträge für die Domain. Wenn du auf `@wsmronline.uk` bereits E-Mails über einen anderen Anbieter empfängst, vorher prüfen!
2. **Destination Addresses** → deine Empfänger-Adresse eintragen und über den Link in der Bestätigungsmail verifizieren.
3. Worker **beanbase → Settings → Variables and Secrets** → *Secret* `FEEDBACK_TO` = deine Empfänger-Adresse (optional *Variable* `FEEDBACK_FROM`, Standard `beanbase@wsmronline.uk`).
4. ✅ Das Binding `"send_email": [{ "name": "FEEDBACK_EMAIL" }]` ist in `wrangler.jsonc` aktiv.

Feedback landet zusätzlich immer im Admin-Bereich (🛠 → Feedback) – auch falls eine Mail einmal nicht zugestellt wird.

## Empfohlen

- *Authentication → Providers → Email*: „Prevent use of leaked passwords“ aktivieren (falls im Plan verfügbar).
- Free-Plan-Grenzen im Blick behalten (🛠 → Übersicht zeigt den Speicher): 1 GB Speicher, Projekt pausiert nach 7 Tagen ohne Aktivität, keine automatischen Backups zum Download → gelegentlich ⚙️ → „Alle Daten exportieren“.
- Videos bleiben gesperrt (🛠 → Einstellungen), bis klar ist, wie viel Speicher die Fotos brauchen.

## Was Tester wissen sollten (Text zum Weiterleiten)

> Hi! Du bist zum Beta-Test von **BeanBase** eingeladen – einer App, um Espresso & Filterkaffee zu loggen und einzustellen.
>
> **Start:** Link öffnen → Konto erstellen (Code ist schon eingetragen). Am Handy über *Teilen → Zum Home-Bildschirm* als App installieren.
>
> **Feedback:** über das 💬 oben rechts – Fehler, Ideen, alles was nervt.
>
> **Deine Daten:** gespeichert bei Supabase (Rechenzentrum Irland, EU), ausgeliefert über Cloudflare. Bohnen, Setup und Bezüge sehen nur Freunde, die du annimmst – außer du schaltest „Profil öffentlich“ ein. Kaufpreise sieht nur du. Der Admin kann zur Moderation Kommentare und Fotos sehen und entfernen sowie dein Konto sperren. Du kannst dein Konto jederzeit unter 👤 → „Konto löschen“ mitsamt allen Daten löschen.
>
> Es ist eine Beta: Daten können im Ausnahmefall verloren gehen oder zurückgesetzt werden.

## Admin-Bereich (🛠, nur Rolle `admin`)

| Bereich | Funktion |
|---|---|
| Übersicht | Nutzer, Aktivität (7 Tage), Bezüge, Freundschaften, offenes Feedback, Speicherbelegung |
| Nutzer | Liste mit E-Mail, letzter Anmeldung, Bohnen/Bezügen; sperren/entsperren, Konto löschen |
| Einladungen | Codes mit Nutzungsanzahl erstellen, teilen, löschen |
| Feedback | Posteingang der Tester, als erledigt markieren |
| Moderation | neueste Kommentare und Fotos/Videos entfernen |
| Einstellungen | Registrierung nur mit Code, Video-Uploads an/aus (auch serverseitig im Storage) |

Admin festlegen (einmalig im SQL Editor, E-Mail anpassen):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where lower(email) = lower('deine@email'));
```
