# Zeitstrahl · Gymnasium Neu Wulmstorf

> **Das Gedächtnis der Zeit** — die interaktive Zeitstrahl-Website des Gymnasiums
> Neu Wulmstorf. Öffentlich unter [zeitstrahl-gymnw.de](https://zeitstrahl-gymnw.de)

---

## 1. Worum es geht

Das Gymnasium Neu Wulmstorf besteht seit **1971**. Der Zeitstrahl macht diese Geschichte
sichtbar: eine öffentliche, zoombare Zeitachse, auf der die **Meilensteine der Schule**
und die **persönlichen Erinnerungen** von Schülerinnen und Schülern, Lehrkräften und
Ehemaligen nebeneinander stehen.

Herzstück ist der **Aktionstag**: Auf Schul-iPads melden sich Eintrag-Konten an und tippen
ein, was Besucherinnen und Besucher erzählen. Lesen darf jeder, ohne Anmeldung. Schreiben
dürfen nur die von der Schule eingerichteten Konten. Die Seite ist durchgehend deutsch.

Das Design folgt der Schulwebsite [www.gym-nw.de](https://www.gym-nw.de): warmes
**Papier-Weiß** statt kaltem Weiß, **Schul-Navy** für Kopfzeile und Zeitachse,
**Fuchs-Orange** als sparsamer Akzent (das Wappentier der Schule ist der Fuchs), dazu
Open Sans und weiche Kartenschatten.

---

## 2. Die zentrale Idee: zwei Arten von Erinnerung

Nicht jede Erinnerung hat ein Datum. „Meine Einschulung", „die Pausen mit Freunden",
„der Geschichtsunterricht" — das sind vollständige Erinnerungen **ohne Jahreszahl**. Sie
auf ein geratenes Datum zu schieben wäre eine Erfindung, sie wegzulassen ein Verlust.

Deshalb fragt das Formular als **allererstes**, um welche Art es geht:

| Auswahl | Beispiel | Wo es landet |
| --- | --- | --- |
| **Zeitstrahl-Eintrag** | „Sommerkonzert am 15. Juni" | auf der Zeitachse, am Datum |
| **Moment an der Schule** | „Pausen mit Freunden" | in der **Erinnerungs-Wolke** |

### Die Erinnerungs-Wolke

Alle Einträge ohne Datum bilden eine Wortwolke unter dem Zeitstrahl. **Je mehr Menschen
sich an dasselbe erinnern, desto größer steht das Wort.** Ein Klick öffnet das Thema mit
allen Stimmen dazu. Unter dem Zeitstrahl steht dauerhaft ein schmales Band mit den fünf
größten Wörtern; ein Klick darauf springt direkt in dieses Thema.

### Stimmen: ein Thema, viele Menschen

Erzählen fünf Leute von „Klassenfahrten", entstehen **nicht fünf Einträge**, sondern ein
Thema mit fünf Stimmen. Beim Tippen des Titels sucht die Seite nach ähnlichen vorhandenen
Einträgen und bietet an, sich dort anzuhängen. Bei **exakt gleichem Titel** geschieht das
automatisch, ohne Rückfrage.

Daraus ergibt sich die **Wichtigkeit von selbst**: Ein Thema mit vielen Stimmen wird auf
dem Zeitstrahl größer dargestellt und steht in der Wolke weiter vorne. Niemand muss
ankreuzen, dass etwas wichtig war — das entscheidet, wie viele Menschen es erwähnen.

---

## 3. Was die Seite kann

- **Zoombarer Zeitstrahl** — Mausrad, Ziehen, Touch und Pinch-Geste auf iPad und Handy.
  Beim Hineinzoomen wird die Achse feiner: Jahrzehnte → Jahre → Monate. Gerendert wird
  nicht per CSS-Skalierung, sondern echt neu positioniert — Text bleibt in jeder Zoomstufe
  scharf.
- **Drei Darstellungsstufen** — je nach Rang sieht ein Eintrag anders aus:

  | Stufe | Wer darf das setzen? | Darstellung |
  | --- | --- | --- |
  | **Meilenstein** | nur `admin` | große Bildkarte mit Jahreszahl |
  | **Wichtig** | nur `admin` (oder durch viele Stimmen) | mittelgroße Karte |
  | normal | alle Konten | farbige Pille |

  Wird der Platz eng, stuft der Zeitstrahl von unten herunter: erst normale Einträge, dann
  wichtige — Meilensteine bleiben am längsten groß.
- **Titelbild + Bildergalerie** — bis zu 12 Bilder je Eintrag, im Vollbild durchblätterbar
  (Pfeile, Wischen, Tastatur). **Hochladen darf nur ein Admin-Konto** — so steht es auch
  in der Datenschutzerklärung.
- **Kategorien + Klassen-Filter** — Chips für Schule, Schüler, Lehrkräfte, Ehemalige,
  Sonstiges; bei „Schüler" zusätzlich nach Klasse oder Jahrgang („8a", „Abi 1996").
- **Schreiben wie in einem Textprogramm** — Überschriften, Aufzählungen, fett und kursiv
  direkt im Eingabefeld. Gespeichert wird schlichter Text mit wenigen Markierungen,
  dargestellt aus sicheren Bausteinen — fremdes HTML aus der Zwischenablage kann nicht
  durchrutschen.
- **Smarte Datumseingabe** — es genügt das Jahr. `1996`, `3.1996` und `12.3.1996` werden
  verstanden und live als „1996" / „März 1996" / „12. März 1996" zurückgemeldet.
- **Begrüßung beim ersten Besuch** — ein kurzer Willkommensgruß, der sich nach sieben
  Sekunden von selbst verabschiedet und bei der ersten Berührung sofort. Er erscheint
  **einmal je Gerät**; wer die Seite kennt, sieht ihn nicht wieder.
- **Live-Übertragung (standardmäßig AUS)** — eingeschaltet erscheinen neue Einträge sofort
  bei allen Besuchern. Unten links sammelt ein Kreis die neuen Einträge und zeigt ihre
  Anzahl; ein Klick springt der Reihe nach zu ihnen. Rührt niemand die Seite an, fliegt die
  Kamera nach **8 Sekunden Ruhe** von selbst zum nächsten neuen Eintrag — wer gerade zoomt
  oder schiebt, wird nie unterbrochen.

  > Warum standardmäßig aus? Ein Zeitstrahl, der sich von selbst bewegt, ist auf dem Beamer
  > in der Aula ein Fest und am Handy in der Pause eine Störung. Wer den Effekt will,
  > schaltet ihn im Zahnrad-Menü ein.
- **Einstellungen (Zahnrad oben rechts)**
  - **Mehr Platz** — nimmt die Fußzeile weg, der Zeitstrahl bekommt ihre Höhe dazu.
    Bewusst **kein** Geräte-Vollbild: Der Browser des Smartboards in der Aula bedient
    `requestFullscreen()` nicht zuverlässig. Reines Layout kann kein Gerät ablehnen.
  - **Live-Übertragung** — siehe oben. Diese Einstellung merkt sich das Gerät.
- **Eigene Beiträge im Griff (Stift-Symbol, nur angemeldet)**
  - `editor` sieht **seine letzten 3 Einträge** und kann sie korrigieren.
  - `admin` sieht **alle** Einträge chronologisch, mit Suche und Löschen.
- **Bild-Komprimierung im Browser** — Fotos werden schon auf dem Gerät auf max. 1600 px
  verkleinert und als WebP (Fallback JPEG) hochgeladen.
- **Anmelde-Schutz** — vor der Anmeldung steht **Cloudflare Turnstile**. Für Menschen ist
  es meist unsichtbar; Passwörter durchprobieren geht damit nicht.

---

## 4. Tech-Stack

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
der Datenbank, wo kein Browser mitreden kann. Ein geheimer Schlüssel (`sb_secret_…`)
existiert im Repo und im ausgelieferten Bündel nirgends und wird auch nicht gebraucht.

Dasselbe gilt für den **Turnstile Site Key**: Er ist der öffentliche Teil des Paares, an
unsere Domain gebunden und steht als Rückfall fest im Code
(`src/components/form/Turnstile.tsx`). Eine Umgebungsvariable hat Vorrang, falls die
Schule ihn einmal tauscht. Der geheime Gegenpart liegt allein bei Supabase.

---

## 5. Lokale Entwicklung

```bash
npm install         # Abhängigkeiten installieren
npm run dev         # Entwicklungsserver auf http://localhost:3000
npm run build       # statischer Export nach out/
npm run typecheck   # TypeScript prüfen, ohne zu bauen
```

`npm run build` erzeugt den Ordner **`out/`** — genau dieser Ordner wird von Cloudflare
Pages ausgeliefert. Man kann ihn auch lokal mit jedem statischen Webserver öffnen.

Die Datei **`.env` ist bewusst committet** und enthält ausschließlich öffentliche Werte.
Es müssen also keine Geheimnisse verteilt werden, um lokal zu entwickeln.

---

## 6. Supabase

Projekt-Ref `cudjqqnnnahswtwswicj`, Region **Frankfurt (eu-central-1)** — alle Daten liegen
in der EU.

Das gesamte Schema liegt versioniert unter `supabase/migrations/`:

| Datei | Inhalt |
| --- | --- |
| `0001`–`0005` | Tabelle `entries`, RLS-Policies, Storage-Eimer, Realtime-Trigger, Advisor-Nacharbeiten |
| `0006` | Eigene Dateien im Storage wieder löschen dürfen |
| `0007`–`0010` | Konten nur per SQL, Rollen `admin` / `editor`, erzeugte Passwörter |
| `0011` | Bildergalerie (`image_paths`) |
| `0012` | Konten per Name, merkbare Passwörter |
| `0013` | Stufe „Wichtig" (`is_important`) |
| `0014` | **Einträge ohne Datum** (`year` darf `null` sein) → Erinnerungs-Wolke |
| `0015` | **Tabelle `entry_voices`** — mehrere Stimmen je Thema |
| `0016` | Bilder hochladen dürfen nur Admin-Konten |
| `0017` | Eintrag-Konten dürfen **eigene** Beiträge korrigieren |
| `0018` | Audio-Interviews vollständig entfernt (Spalte, Rechte, Abspieler) |
| `0019` | Eintrags-Grenze je Konto wieder aufgehoben |
| `0020` | Lücke geschlossen: Beim **Anlegen** darf `editor` kein „Wichtig" setzen |

> **`supabase/seed.sql` sind erfundene Beispieldaten für die Entwicklung.** Sie dürfen
> **nicht** in die Live-Datenbank eingespielt werden. Die echten Meilensteine pflegt die
> Schule über das Admin-Konto.

---

## 7. Konten & Rollen

**Konten entstehen ausschließlich per SQL — es gibt keinen anderen Weg.**

Das ist in der Datenbank erzwungen (`0007_accounts_only_via_sql.sql`): Ein Wächter auf der
Nutzertabelle weist **jedes** Anlegen ab, das nicht aus der dafür vorgesehenen Funktion
kommt. Damit sind alle Wege dicht — öffentliche Registrierung, Magic Links, Einladungen,
OAuth und auch der Knopf „Add user" im Supabase-Dashboard.

### Die zwei Rollen

| Rolle | Darf |
| --- | --- |
| `admin` | **alles**: anlegen, bearbeiten, löschen, Meilensteine setzen, „Wichtig" vergeben, Bilder hochladen, Stimmen bearbeiten und löschen |
| `editor` | **neue Einträge anlegen** und **eigene Beiträge korrigieren** — die Rolle für die iPads am Aktionstag |

Es kann mehrere Konten jeder Rolle geben. Anonyme Besucher dürfen ausschließlich lesen.

### Konto anlegen

Supabase-Dashboard → **SQL Editor**. Du gibst nur **Namen** und **Rolle** an — die
Anmelde-Adresse setzt der Server zusammen:

```sql
select * from private.create_account('Anna Meyer', 'admin');
select * from private.create_account('iPad 1',     'editor');
```

Das Ergebnis zeigt Adresse, Rolle und Passwort **ein einziges Mal**:

| konto | rolle | passwort | hinweis |
| --- | --- | --- | --- |
| anna.meyer@zeitstrahl-gymnw.de | admin | `Musikraum+Pausenhof46` | Jetzt notieren — wird nie wieder angezeigt. |

Aus „Anna Meyer" wird `anna.meyer@zeitstrahl-gymnw.de`, aus „iPad 1" wird
`ipad.1@zeitstrahl-gymnw.de`. Umlaute werden ausgeschrieben („Jürgen Groß" →
`juergen.gross@…`).

Die Passwörter bestehen aus zwei gut lesbaren Wörtern, einem Sonderzeichen und Ziffern
(`Zeugnis#Bibliothek813`) — man kann sie vorlesen und sich merken, und sie sind trotzdem
stark. Danach sind sie nur verschlüsselt gespeichert und **können nicht mehr ausgelesen
werden**, auch nicht von der Schulverwaltung.

### Konten verwalten

```sql
select * from private.list_accounts();              -- Übersicht
select * from private.reset_password('iPad 1');     -- neues Passwort (einmalig sichtbar)
select private.set_account_role('iPad 1', 'admin'); -- Rolle wechseln
select private.delete_account('iPad 3');            -- Konto löschen (Einträge bleiben)
```

> **Nach einer Rollen-Änderung** muss sich die betroffene Person **einmal ab- und wieder
> anmelden**. Die Rolle steckt im signierten Anmelde-Token und wird erst beim nächsten
> Login neu ausgestellt.

---

## 8. 🚀 Go-Live-Checkliste

1. **Rollen prüfen.** `select * from private.list_accounts();` — Konten, die nur eintragen
   sollen, gehören auf `editor`. Ein Admin-Konto darf alles löschen; davon sollte es so
   wenige wie möglich geben.
2. **Turnstile scharf schalten** — Supabase-Dashboard → **Authentication → Attack
   Protection** → Captcha aktivieren, Anbieter **Turnstile**, den **Secret Key** aus
   Cloudflare eintragen. Der Site Key steckt bereits im Code. In Cloudflare muss beim
   Widget die Domain `zeitstrahl-gymnw.de` eingetragen sein — sonst meldet die
   Anmeldeseite Fehlercode `110200`.
3. **Registrierung zusätzlich abschalten** (empfohlen): Authentication → **Sign In /
   Providers** → „Allow new users to sign up" **AUS**. Die Datenbanksperre greift auch
   ohne — so bekommen Neugierige aber eine saubere Absage.
4. **Passwort-Mindestlänge auf 12** setzen: Authentication → **Passwords**.
5. **Site URL setzen:** Authentication → **URL Configuration** →
   `https://zeitstrahl-gymnw.de`.
6. **Leeren Audio-Eimer löschen:** Storage → `entry-audio` → *Delete bucket*. Er ist
   nachweislich leer und seit Migration `0018` ohne jede Policy, also für niemanden mehr
   beschreibbar. Per SQL lässt er sich nicht entfernen (Supabase schützt die
   Storage-Tabellen).
7. **Rechtstexte final freigeben** — Impressum, Datenschutzerklärung und
   Nutzungsbedingungen stehen im Wortlaut der Schule unter `/impressum/`,
   `/datenschutz/` und `/nutzungsbedingungen/`.

---

## 9. Deployment (Cloudflare Pages)

### Erstes Deployment

1. **Cloudflare-Dashboard** → **Workers & Pages**
2. **„Create"** → Reiter **„Pages"** → **„Connect to Git"**
3. GitHub verbinden, Repository **`Timeline_GymNW`** auswählen
4. Branch wählen (üblicherweise der Hauptbranch)
5. Build-Einstellungen:
   - **Build command:** `npm run build`
   - **Build output directory:** `out`
6. **Environment Variables** (Werte aus `.env`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` *(optional — steht als Rückfall im Code)*
7. **„Save and Deploy"** — nach ein bis zwei Minuten läuft die Seite unter einer
   `*.pages.dev`-Adresse. Jeder Push auf den gewählten Branch baut neu.

> **Erfahrung aus dem Betrieb:** Umgebungsvariablen kamen beim Bauen schon einmal nicht an,
> und der Turnstile-Schlüssel fehlte im ausgelieferten Bündel — sichtbar nur daran, dass
> auf der Anmeldeseite „Sicherheitsprüfung konnte nicht geladen werden" stand. Deshalb
> steht der Site Key zusätzlich fest im Code. Wer eine Variable ändert: Danach immer
> **neu deployen** und die Live-Seite prüfen, nicht nur die Einstellung speichern.

### Eigene Domain

Pages-Projekt → **Custom domains** → **„Set up a domain"** → `zeitstrahl-gymnw.de`. Da die
Domain bei Cloudflare liegt, werden DNS-Einträge und TLS-Zertifikat automatisch gesetzt.

### Security-Header

Die Header liegen in **`public/_headers`**, landen beim Build unverändert in `out/` und
werden von Cloudflare Pages automatisch angewendet.

Kurz übersetzt, was die **Content-Security-Policy** erlaubt: Skripte, Styles und Schriften
**nur von der eigenen Domain**, dazu Cloudflare Turnstile für die Anmeldung; Bilder, Medien
und Datenverbindungen zusätzlich vom Supabase-Projekt (inklusive `wss://…` für die
Live-Updates). Alles andere — fremde Skripte, Werbenetzwerke, Tracking-Pixel — blockiert der
Browser. Ergänzend: Die Seite darf **nicht in einen iframe** eingebettet werden
(`frame-ancestors 'none'` + `X-Frame-Options: DENY`), der Browser rät keine Dateitypen
(`nosniff`), beim Wechsel auf fremde Seiten wird nur die Domain als Referrer übermittelt,
und Kamera, Mikrofon, Standort und Zahlungs-APIs sind abgeschaltet.

---

## 10. Free-Tier-Grenzen & Betrieb

**Cloudflare Pages (Free)**
- Statische Auslieferung: **unbegrenzt** viele Aufrufe und Bandbreite
- **500 Builds pro Monat**

**Supabase (Free)**
- **500 MB** Datenbank · **1 GB** Storage · **5 GB** Traffic pro Monat
- Realtime: max. **200 gleichzeitige Verbindungen**, **2 Mio. Nachrichten/Monat**

Was passiert bei Überschreitung? Die Seite **funktioniert weiter** — sie ist statisch.
Lediglich die Live-Updates können pausieren; ein Neuladen zeigt trotzdem alle Einträge.
Für den Aktionstag heißt das: Selbst im schlimmsten Fall geht nichts verloren, es fehlt
höchstens der Effekt des automatischen Erscheinens.

Damit der Speicher reicht, werden **Bilder schon im Browser komprimiert** — typisch
**0,2–0,4 MB** pro Foto, bei 1 GB also grob 2.500 bis 5.000 Bilder.

---

## 11. Sicherheitsarchitektur

| Aktion | anonym | `editor` | `admin` |
| --- | :---: | :---: | :---: |
| Einträge und Stimmen lesen | ✓ | ✓ | ✓ |
| Eintrag erstellen | ✗ | ✓ | ✓ |
| **eigenen** Eintrag korrigieren | ✗ | ✓ | ✓ |
| **fremden** Eintrag bearbeiten | ✗ | ✗ | ✓ |
| Eintrag löschen | ✗ | ✗ | ✓ |
| Als „Wichtig" markieren | ✗ | ✗ | ✓ |
| Meilenstein anlegen | ✗ | ✗ | ✓ |
| Bild hochladen | ✗ | ✗ | ✓ |
| Stimme zu einem Thema abgeben | ✗ | ✓ | ✓ |
| Stimme ändern oder löschen | ✗ | ✗ | ✓ |
| **Konto anlegen** | ✗ | ✗ | ✗ (nur per SQL) |

Diese Matrix ist **nicht** eine Frage der Benutzeroberfläche, sondern wird in der Datenbank
erzwungen: Die Rolle liegt fälschungssicher im signierten Anmelde-Token (JWT) unter
`app_metadata` und kann vom Browser aus nicht verändert werden. Jede Anfrage wird gegen die
RLS-Policies geprüft. Ebenso erzwingt der Storage-Eimer Dateigröße und -typ serverseitig
(max. 2 MB, nur WebP/JPEG).

### Bewusste Entscheidung: keine Eintrags-Grenze

Es gab einmal einen Zähler in der Datenbank (max. 10 Einträge je Minute und Konto). Er ist
seit Migration `0019` **weg** — er hätte am Aktionstag als Erstes das Projektteam getroffen,
das Zettel für Zettel abtippt, und einem Angreifer nur ein paar Minuten gekostet. Geschützt
wird stattdessen dort, wo es zählt: Konten gibt es nur per SQL, vor der Anmeldung steht
Turnstile, und was doch danebengeht, räumt die Verwaltung über das Stift-Menü in einer
Minute weg.

### Bekannter offener Punkt

Der Supabase-Advisor meldet **„Leaked Password Protection disabled"**. Dieser Abgleich
gegen bekannte geleakte Passwörter ist ein kostenpflichtiges Feature. Da die Passwörter
vom Server erzeugt und nicht selbst gewählt werden, ist das Risiko gering — der Hinweis
ist bewusst akzeptiert.

---

## 12. Geprüft vor der Freigabe

Stand 20. August 2026:

- **`npm run build`** — statischer Export ohne Fehler; **`npm run typecheck`** sauber.
- **38 von 38 Browser-Prüfungen** bestanden, auf Desktop (1920 px) und Handy (390 px):
  Begrüßung, Zeitstrahl, Erinnerungs-Wolke, Eintrags-Fenster, alle vier Unterseiten,
  kein Querscrollen, keine JavaScript-Fehler.
- **13 Rechte-Prüfungen** direkt in der Datenbank (jeweils in einer zurückgerollten
  Transaktion): anonym darf nichts schreiben; `editor` darf keinen Meilenstein, kein
  „Wichtig", kein Bild und kein fremdes `created_by` setzen, nichts Fremdes löschen —
  `admin` darf all das.
  Dabei wurde die Lücke gefunden und geschlossen, die zu Migration `0020` führte.
- **Kein geheimer Schlüssel** im ausgelieferten Bündel (`out/`) — geprüft auf
  `sb_secret_…` und JWT-Muster.

---

## Weiterführend

- **`PLAN.md`** — der ursprüngliche Projektplan: Architekturentscheidungen, Datenmodell,
  RLS-Konzept, Realtime-Konzept.
- **`supabase/migrations/`** — das komplette Datenbankschema, versioniert und
  nachvollziehbar. Jede Datei erklärt im Kopf, **warum** sie existiert.
