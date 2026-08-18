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
- **Meilensteine mit Bildern** — große Karten unterhalb der Achse für die wichtigen
  Ereignisse der Schulgeschichte, gepflegt über ein Admin-Konto.
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
  Hochladen kann sie ein Admin-Konto.

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

**Konten entstehen ausschließlich per SQL — es gibt keinen anderen Weg.**

Das ist in der Datenbank erzwungen (Migration `0007_accounts_only_via_sql.sql`): Ein
Wächter auf der Nutzertabelle weist **jedes** Anlegen eines Kontos ab, das nicht aus der
dafür vorgesehenen Funktion kommt. Damit sind alle Wege dicht — die öffentliche
Registrierung, Magic Links, Einladungen, OAuth und auch der Knopf „Add user“ im
Supabase-Dashboard. Selbst wenn im Dashboard versehentlich der Schalter „Allow new users
to sign up“ aktiviert wird, kann sich niemand ein Konto anlegen.

### Die zwei Rollen

| Rolle | Darf |
| --- | --- |
| `admin` | **alles**: Einträge anlegen, **bearbeiten und löschen**, Meilensteine setzen, Audio-Interviews hochladen |
| `editor` | **nur neue Einträge anlegen** — die Rolle für die iPads am Aktionstag |

Es kann mehrere Konten jeder Rolle geben. Anonyme Besucher dürfen ausschließlich lesen.

### Konto anlegen

Supabase-Dashboard → **SQL Editor**. Du gibst nur den **Namen** und die **Rolle** an —
die Anmelde-Adresse setzt der Server automatisch zusammen:

```sql
select * from private.create_account('Anna Meyer', 'admin');
select * from private.create_account('iPad 1',     'editor');
select * from private.create_account('iPad 2',     'editor');
select * from private.create_account('iPad 3',     'editor');
```

Das Ergebnis zeigt Adresse, Rolle und Passwort **ein einziges Mal**:

| konto | rolle | passwort | hinweis |
| --- | --- | --- | --- |
| anna.meyer@zeitstrahl-gymnw.de | admin | `Musikraum+Pausenhof46` | Jetzt notieren — das Passwort wird nie wieder angezeigt. |

Aus „Anna Meyer" wird `anna.meyer@zeitstrahl-gymnw.de`, aus „iPad 1" wird
`ipad.1@zeitstrahl-gymnw.de`. Umlaute werden ausgeschrieben („Jürgen Groß" →
`juergen.gross@…`). Mit dieser Adresse meldet man sich auf der Website an.

Die Passwörter bestehen aus zwei gut lesbaren Wörtern, einem Sonderzeichen und
Ziffern (`Zeugnis#Bibliothek813`) — man kann sie vorlesen und sich merken, und sie sind
trotzdem stark. Danach sind sie nur noch verschlüsselt gespeichert und **können nicht
mehr ausgelesen werden**, auch nicht von der Schulverwaltung. Bitte sofort in den
Passwortmanager der Schule übernehmen.

### Konten verwalten

Alles läuft über den Namen — die Adresse muss man sich nicht merken:

```sql
-- Übersicht: Name, Adresse, Rolle, letzte Anmeldung
select * from private.list_accounts();

-- Neues Passwort erzeugen (wird wieder einmalig angezeigt)
select * from private.reset_password('iPad 1');

-- Rolle wechseln
select private.set_account_role('iPad 1', 'admin');

-- Konto löschen (die Einträge dieser Person bleiben erhalten)
select private.delete_account('iPad 3');
```

> **Nach einer Rollen-Änderung** muss sich die betroffene Person **einmal ab- und wieder
> anmelden**. Die Rolle steckt im signierten Anmelde-Token und wird erst beim nächsten
> Login neu ausgestellt.

> **Wenn jemand versucht, sich selbst zu registrieren**, antwortet der Server mit einem
> Fehler und es entsteht kein Konto. Das ist gewollt — die Anmeldeseite ist nur für die
> Konten der Schule gedacht und bietet gar keine Registrierung an.

---

## 7. 🚀 Go-Live-Checkliste

1. **Echte Konten anlegen** — per SQL, siehe Abschnitt 6: mindestens ein `admin`-Konto
   für die Betreuung und je ein `editor`-Konto pro iPad. Die angezeigten Passwörter sofort
   in den Passwortmanager der Schule übernehmen — sie lassen sich später nicht mehr
   auslesen.
2. **Test-Konten entfernen**, falls noch welche existieren — `select * from private.list_accounts();`
   zeigt alle an, gelöscht wird per Name:
   ```sql
   select private.delete_account('Pruef Admin');
   ```
3. **Zusätzlich absichern (empfohlen):** Dashboard → **Authentication → Sign In / Providers**
   → Schalter **„Allow new users to sign up“ AUS**. Die Datenbanksperre aus Abschnitt 6
   greift auch ohne diesen Schalter — aber so bekommen Neugierige statt eines Serverfehlers
   eine saubere Absage, und der Server spart sich die Arbeit.
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

| Aktion | anonyme Besucher | Eintrag-Konto (`editor`) | Admin (`admin`) |
| --- | :---: | :---: | :---: |
| Einträge lesen | ✓ | ✓ | ✓ |
| Eintrag erstellen | ✗ | ✓ | ✓ |
| Eintrag bearbeiten | ✗ | ✗ | ✓ |
| Eintrag löschen | ✗ | ✗ | ✓ |
| Meilenstein anlegen | ✗ | ✗ | ✓ |
| Audio-Interview hochladen | ✗ | ✗ | ✓ |
| **Konto anlegen** | ✗ | ✗ | ✗ (nur per SQL im Dashboard) |

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
