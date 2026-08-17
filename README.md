# Zeitstrahl · Gymnasium Neu Wulmstorf

> **Das Gedächtnis der Zeit** — die interaktive Zeitstrahl-Website des Gymnasiums Neu Wulmstorf.
> Öffentlich unter [zeitstrahl-gymnw.de](https://zeitstrahl-gymnw.de)

---

## 1. Projekt

Das Gymnasium Neu Wulmstorf besteht seit **1971**. Der Zeitstrahl macht diese Geschichte
sichtbar: eine öffentliche, zoombare Zeitachse, auf der die **Meilensteine der Schule**
(Gründung, Einweihungen, Jubiläen — große Bildkarten) und die **persönlichen Erinnerungen**
von Schülerinnen und Schülern, Lehrkräften und Ehemaligen nebeneinander stehen.

Herzstück ist der **Aktionstag**: Auf Schul-iPads melden sich einige wenige
Eintrag-Accounts an und tippen ein, was Besucherinnen und Besucher erzählen. Jeder neue
Eintrag erscheint **live und ohne Neuladen** bei allen, die die Seite gerade offen haben —
auf dem Beamer in der Aula genauso wie auf dem Handy zu Hause.

Lesen darf jeder, ohne Anmeldung. Schreiben dürfen nur die von der Schule eingerichteten
Accounts. Die Seite ist durchgehend deutsch.

Das Design folgt der Schulwebsite [www.gym-nw.de](https://www.gym-nw.de): warmes
**Papier-Weiß** statt kaltem Weiß, **Schul-Navy** für Kopfzeile und Zeitachse,
**Fuchs-Orange** als sparsam eingesetzter Akzent (das Wappentier der Schule ist der Fuchs),
dazu Open Sans und weiche Kartenschatten.

---

## 2. Features

- **Zoombarer Zeitstrahl** — Mausrad, Ziehen, Touch und Pinch-Geste auf iPad und Handy.
  Beim Hineinzoomen wird die Achse feiner: Jahrzehnte → Jahre → Monate. Gerendert wird
  nicht per CSS-Skalierung, sondern echt neu positioniert — Text bleibt in jeder Zoomstufe
  gestochen scharf.
- **Meilensteine mit Bildern** — große Karten unterhalb der Achse, nur vom Admin gepflegt.
- **Kategorien + Klassen-Filter** — Filter-Chips für Schule, Schüler, Lehrer, Ehemalige,
  Sonstiges; bei „Schüler“ kann zusätzlich nach Klasse bzw. Jahrgang gefiltert werden
  („8a“, „Abi 1996“).
- **Smarte Datumseingabe** — es genügt das Jahr. `1996`, `3.1996` und `12.3.1996` werden
  automatisch verstanden und live als „1996“ / „März 1996“ / „12. März 1996“ zurückgemeldet.
  Nur-Jahr-Einträge landen in der Jahresmitte.
- **Live-Updates ohne Reload** — neue Einträge erscheinen sofort bei allen Besuchern.
  Dabei gilt die **3-Sekunden-Regel**: Wer gerade selbst zoomt oder schiebt (Interaktion
  vor weniger als 3 Sekunden), wird *nicht* unterbrochen und bekommt nur einen dezenten
  Hinweis-Toast („Neuer Eintrag: … — anzeigen“). Wer nur zuschaut, erlebt einen animierten
  Kameraflug zum neuen Eintrag samt Puls-Highlight.
- **Bild-Komprimierung im Browser** — Fotos werden schon auf dem Gerät auf max. 1600 px
  verkleinert und als WebP (Fallback JPEG) hochgeladen. Das spart Upload-Zeit im
  Schul-WLAN und hält den Speicherplatz klein.
- **Audio-Interviews** — aufgenommene Gespräche mit Ehemaligen lassen sich anhören.
  Hochladen darf sie ausschließlich der Admin.

---

## 3. Tech-Stack

| Baustein | Technologie |
| --- | --- |
| Frontend | **Next.js 15** (App Router, TypeScript), `output: 'export'` → rein statisches `out/` |
| Styling | **Tailwind CSS v4**, Design-Tokens via `@theme` in `src/app/globals.css` |
| Backend | **Supabase**: Auth, Postgres + Row Level Security, Realtime (Broadcast), Storage |
| Hosting | **Cloudflare Pages** (statische Auslieferung, kostenlos) |
| Zoom/Pan | `d3-zoom`, `d3-selection`, `d3-scale` (nur diese drei Module) |

**Es gibt bewusst keinen eigenen Server.** Die Website besteht ausschließlich aus HTML,
CSS und JavaScript und wird direkt vom CDN ausgeliefert — nichts kann abstürzen, nichts
muss gewartet werden, und die Seite bleibt auch bei sehr vielen Zugriffen kostenlos.

Daraus folgt eine wichtige Eigenschaft: Der **Publishable Key** in `.env` ist **öffentlich**
und darf das auch sein. Er identifiziert nur das Supabase-Projekt; er berechtigt zu nichts.
**Sämtliche Rechte erzwingt Supabase serverseitig über Row Level Security (RLS)** — also in
der Datenbank selbst, wo kein Browser mitreden kann. Ein geheimer Schlüssel
(`sb_secret_…`) existiert im Repo und im ausgelieferten Bundle nirgends und wird auch
nicht gebraucht.

---

## 4. Lokale Entwicklung

```bash
npm install     # Abhängigkeiten installieren
npm run dev     # Entwicklungsserver auf http://localhost:3000
npm run build   # statischer Export nach out/
npm run typecheck   # TypeScript prüfen, ohne zu bauen
```

`npm run build` erzeugt den Ordner **`out/`** — genau dieser Ordner wird später von
Cloudflare Pages ausgeliefert. Man kann ihn auch lokal mit jedem statischen Webserver
öffnen.

Die Datei **`.env` ist bewusst committet** und enthält ausschließlich öffentliche Werte
(Projekt-URL und Publishable Key, siehe oben). Es müssen also keine Geheimnisse verteilt
werden, um lokal zu entwickeln.

---

## 5. Supabase

Projekt-Ref `cudjqqnnnahswtwswicj`, Region **Frankfurt (eu-central-1)** — alle Daten
liegen in der EU.

Das gesamte Datenbank-Schema liegt versioniert im Repo unter `supabase/migrations/`:

| Datei | Inhalt |
| --- | --- |
| `0001_schema.sql` | Tabelle `entries`, Indizes, Constraints, `sort_date` |
| `0002_policies.sql` | Row-Level-Security-Policies (wer darf was) |
| `0003_storage.sql` | Storage-Buckets `entry-images` und `entry-audio` inkl. Limits |
| `0004_realtime.sql` | Trigger für die Live-Updates (Realtime Broadcast) |
| `0005_advisor_fixes.sql` | Nacharbeiten aus den Supabase-Advisors (Security/Performance) |

Zusätzlich gibt es **Beispieldaten** in `supabase/seed.sql`: 16 fiktive, aber realistisch
klingende Einträge über 1971–2025, damit der Zeitstrahl beim Entwickeln gut aussieht.
**Das sind keine echten historischen Daten der Schule** — sie müssen vor dem Go-Live weg:

```sql
delete from public.entries
where created_by in (
  select id from auth.users where email like 'dev-%@zeitstrahl-gymnw.de'
);
```

---

## 6. Accounts & Rollen

**Es gibt bewusst keine Registrierung.** Niemand kann sich selbst einen Zugang anlegen.
Accounts werden ausschließlich manuell im Supabase-Dashboard erstellt:

1. Supabase-Dashboard → **Authentication → Users → „Add user“**
2. E-Mail und Passwort eintragen, **„Auto Confirm“ aktivieren**
   (sonst wartet der Account auf eine Bestätigungsmail)
3. Danach die Rolle setzen — Dashboard → **SQL Editor**:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"app_role":"admin"}'::jsonb
where email = 'admin@beispiel.de';

update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"app_role":"editor"}'::jsonb
where email = 'eintrag1@beispiel.de';
```

**Die beiden Rollen:**

| Rolle | Darf |
| --- | --- |
| `admin` | alles: Einträge anlegen, **bearbeiten und löschen**, Meilensteine anlegen, Audio-Interviews hochladen |
| `editor` | **nur neue Einträge anlegen** — die typische Rolle für die iPads am Aktionstag |

> **Wichtig:** Nach einer Rollen-Änderung muss sich der betroffene Account **einmal ab- und
> wieder anmelden**. Die Rolle steckt im signierten Anmelde-Token (JWT) und wird erst beim
> nächsten Login neu ausgestellt.

---

## 7. 🚀 Go-Live-Checkliste

Diese Schritte bitte **in genau dieser Reihenfolge** abarbeiten — Schritt 3 sperrt die
Registrierung, danach lassen sich Accounts nur noch über das Dashboard anlegen.

1. **Echte Accounts anlegen** (1× `admin`, ca. 3× `editor`) und die Rollen setzen (SQL
   siehe Abschnitt 6). Passwörter **mindestens 12 Zeichen**, erzeugt und gespeichert im
   Passwortmanager der Schule — niemals per Mail oder Chat verschicken.
2. **Dev-Accounts entfernen.** Zuerst deren Einträge löschen (SQL-Befehl aus Abschnitt 5),
   danach im Dashboard die Nutzer `dev-admin@zeitstrahl-gymnw.de` und
   `dev-editor@zeitstrahl-gymnw.de` löschen (Authentication → Users).
3. **Registrierung deaktivieren:** Dashboard → **Authentication → Sign In / Providers** →
   Schalter **„Allow new users to sign up“ AUS**.
4. **Passwort-Mindestlänge auf 12 setzen:** Authentication → **Passwords**.
5. **Site URL setzen:** Authentication → **URL Configuration** →
   `https://zeitstrahl-gymnw.de`.
6. **Impressum und Datenschutzerklärung** von der Schule prüfen und vervollständigen
   lassen. Beide Seiten sind derzeit als **Entwurf** gekennzeichnet und enthalten
   orange markierte Stellen `[BITTE PRÜFEN]`, die noch geklärt werden müssen
   (Schulleitung, Schulträger, Aufsichtsbehörde, Verantwortliche(r) nach § 18 MStV,
   Datenschutzbeauftragte(r), Einwilligungsprozess für Fotos und Audio).
7. **Optional: Captcha (Cloudflare Turnstile)** gegen automatisierte Login-Versuche —
   Dashboard → Authentication → **Attack Protection**. Das erfordert eine kleine
   Code-Ergänzung beim Login (Widget einbinden und `captchaToken` mitschicken); siehe die
   Supabase-Dokumentation zum Stichwort „Captcha“. Für vier Accounts reichen die
   eingebauten Rate-Limits in der Regel aus.

---

## 8. Deployment (Cloudflare Pages)

### Erstes Deployment

1. **Cloudflare-Dashboard** öffnen → **Workers & Pages**
2. **„Create“** → Reiter **„Pages“** → **„Connect to Git“**
3. GitHub verbinden und das Repository **`Timeline_GymNW`** auswählen
4. Branch wählen (der Branch, der veröffentlicht werden soll — üblicherweise der
   Hauptbranch)
5. Build-Einstellungen:
   - **Build command:** `npm run build`
   - **Build output directory:** `out`
6. **Environment Variables** (Werte aus `.env` übernehmen):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://cudjqqnnnahswtwswicj.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = der `sb_publishable_…`-Wert aus `.env`
7. **„Save and Deploy“** — nach ein bis zwei Minuten ist die Seite unter einer
   `*.pages.dev`-Adresse erreichbar. Jeder Push auf den gewählten Branch löst
   automatisch ein neues Deployment aus.

### Eigene Domain

Pages-Projekt → **Custom domains** → **„Set up a domain“** → `zeitstrahl-gymnw.de`
hinzufügen. Da die Domain bereits bei Cloudflare liegt, werden die DNS-Einträge
**automatisch** gesetzt und das TLS-Zertifikat automatisch ausgestellt — es ist nichts
manuell einzutragen.

Optional lässt sich zusätzlich `www.zeitstrahl-gymnw.de` hinzufügen und per
Weiterleitungsregel (Rules → Redirect Rules) auf die Hauptdomain umleiten, damit die Seite
nur unter einer Adresse erreichbar ist.

### Security-Header

Die Sicherheits-Header liegen in **`public/_headers`**. Die Datei landet beim Build
unverändert in `out/` und wird von Cloudflare Pages **automatisch** auf alle Seiten
angewendet — es ist keine weitere Konfiguration nötig.

Kurz übersetzt, was die **Content-Security-Policy** erlaubt: Skripte, Styles und
Schriftarten dürfen **ausschließlich von der eigenen Domain** kommen; Bilder, Medien und
Datenverbindungen zusätzlich vom Supabase-Projekt (inklusive der WebSocket-Verbindung
`wss://…` für die Live-Updates). Alles andere — fremde Skripte, Werbenetzwerke,
Tracking-Pixel — wird vom Browser blockiert. Ergänzend gilt: Die Seite **darf nicht in
einen iframe eingebettet** werden (`frame-ancestors 'none'` + `X-Frame-Options: DENY`,
Schutz vor Clickjacking), der Browser rät keine Dateitypen (`nosniff`), beim Wechsel auf
fremde Seiten wird nur die Domain als Referrer übermittelt, und Kamera, Mikrofon,
Standort und Zahlungs-APIs sind komplett abgeschaltet.

---

## 9. Free-Tier-Grenzen & Betrieb

Der Betrieb ist auf den kostenlosen Tarifen ausgelegt:

**Cloudflare Pages (Free)**
- Statische Auslieferung: **unbegrenzt** viele Aufrufe und Bandbreite
- **500 Builds pro Monat** (also 500 Pushes/Deployments — für dieses Projekt reichlich)

**Supabase (Free)**
- **500 MB** Datenbank
- **1 GB** Speicher (Storage) für Bilder und Audio
- **5 GB** Traffic pro Monat
- Realtime: max. **200 gleichzeitige Verbindungen** und **2 Mio. Nachrichten/Monat**

Was passiert bei Überschreitung? Die Seite **funktioniert weiter** — sie ist ja statisch.
Lediglich die Live-Updates können pausieren; ein Neuladen der Seite zeigt dann trotzdem
alle Einträge. Für den Aktionstag heißt das: Selbst im schlimmsten Fall geht nichts
verloren, es fehlt höchstens der „Wow“-Effekt des automatischen Erscheinens.

Damit der Speicher lange reicht, werden **Bilder schon im Browser komprimiert** — typisch
landen sie bei **0,2–0,4 MB** pro Foto. Bei 1 GB Storage sind das grob 2.500 bis 5.000
Bilder. Audio-Interviews sind deutlich größer (max. 25 MB pro Datei); hier lohnt es sich,
sparsam zu sein.

---

## 10. Sicherheitsarchitektur

Wer darf was?

| Aktion | anonyme Besucher | Eintrag-Account (`editor`) | Admin (`admin`) |
| --- | :---: | :---: | :---: |
| Einträge lesen | ✓ | ✓ | ✓ |
| Eintrag erstellen | ✗ | ✓ | ✓ |
| Eintrag bearbeiten | ✗ | ✗ | ✓ |
| Eintrag löschen | ✗ | ✗ | ✓ |
| Meilenstein anlegen | ✗ | ✗ | ✓ |
| Audio-Interview hochladen | ✗ | ✗ | ✓ |

Diese Matrix ist **nicht** bloß eine Frage der Benutzeroberfläche, sondern wird in der
Datenbank erzwungen: Die Rolle liegt fälschungssicher im signierten Anmelde-Token (JWT)
unter `app_metadata` und kann vom Browser aus nicht verändert werden — jede Anfrage wird
serverseitig gegen die RLS-Policies geprüft. Ebenso erzwingt der Storage-Bucket die Limits
für Dateigröße und Dateityp serverseitig (Bilder max. 2 MB und nur WebP/JPEG, Audio max.
25 MB und nur gängige Audioformate), sodass auch manipulierte Uploads abgewiesen werden.

---

## Weiterführend

- **`PLAN.md`** — der vollständige Projektplan: Architekturentscheidungen, Datenmodell,
  RLS-Policies, Realtime-Konzept und Verifikationsschritte.
- **`supabase/migrations/`** — das komplette Datenbankschema, versioniert und
  nachvollziehbar.
