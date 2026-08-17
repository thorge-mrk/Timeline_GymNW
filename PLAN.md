# Zeitstrahl · Gymnasium Neu Wulmstorf — Projektplan (Stand: umgesetzt, August 2026)

## Kontext

Die Schule (Gymnasium Neu Wulmstorf, gegründet 1971) möchte ein „Gedächtnis der Zeit": eine öffentliche, interaktive Zeitstrahl-Website. Darauf stehen Meilensteine der Schulgeschichte (große Karten mit Bildern, nur vom Admin gepflegt) und Erinnerungen von Schülern, Lehrern und Ehemaligen. Am Aktionstag melden sich ~3 „Eintrag-Accounts" auf Schul-iPads an; neue Einträge erscheinen **live ohne Reload** bei allen Besuchern. Rein deutsch, jeder darf lesen — schreiben dürfen nur 1 Admin + ~3 Eintrag-Accounts, abgesichert über Row Level Security.

**Architektur:** Rein statische Website (Cloudflare Pages, kostenlos, unbegrenzte Aufrufe) + Supabase als Backend (Auth, Postgres + RLS, Realtime, Storage). Design nach Vorbild von www.gym-nw.de.

## Abgestimmte Entscheidungen

| Thema | Entscheidung |
|---|---|
| Bilder | Supabase Storage, Komprimierung im Browser (max. 1600 px → WebP, Fallback JPEG) |
| Interviews | Sind **Audio** (kein Video), schon in v1 — hochladen kann **nur der Admin** |
| Videos | Nicht in v1 (Spalte `video_url` liegt schlafend bereit, kein UI) |
| Freigabe | Einträge **sofort live** (Realtime-Effekt am Aktionstag); Admin korrigiert/löscht bei Bedarf |
| Rechte | Eintrag-Accounts: **nur erstellen**; Update/Delete + Meilensteine + Audio: nur Admin |
| Zeitraum | Dynamisch vom frühesten Eintrag (~1971) bis heute |

## Design (von www.gym-nw.de extrahiert)

Aus Custom-CSS und Fuchs-Logo der Schulwebsite:

```
--paper:      #F8F5EF  (Hintergrund, warmes Papier-Weiß statt Weiß)
--paper-card: #FCFAF6  (Karten)   --paper-line: #E8E2D6 (Linien)
--coal:       #27272A  (Text — exakt die Überschriftenfarbe der Schulseite)
--coal-soft:  #55555A  (Sekundärtext)
--navy:       #0B1338  (Schul-Navy: Header, Zeitachse)  --navy-deep: #0A1241
--orange:     #F6921E  (Schul-Orange: Akzente, Meilenstein-Marker, Buttons)
```

Schrift **Open Sans** via `next/font` (selbst gehostet → kein Google-Request, DSGVO-sauber). Stil: ruhiges, modernes Dashboard; Zeitstrahl mittig als Hauptelement; Karten mit weichen Schatten auf Papiergrund; Orange sparsam.

## Vorhandene Infrastruktur

- **Repo** `thorge-mrk/Timeline_GymNW`: leer (nur README). Arbeits-/Push-Branch: `claude/interactive-timeline-school-app-xkt84s`.
- **Supabase-Projekt existiert**: „Timeline_GymNW", ref `cudjqqnnnahswtwswicj`, `eu-central-1`, Postgres 17, DB leer. URL `https://cudjqqnnnahswtwswicj.supabase.co`; moderner **Publishable Key** (`sb_publishable_…`) vorhanden — nur diese zwei Werte kommen ins Frontend (Legacy-JWT-Keys laufen Ende 2026 aus, werden nicht benutzt; `sb_secret_…` wird nirgends gebraucht).
- Cloudflare-Konto/Domain (`zeitstrahl.gym-nw.de`): richtet der Nutzer später ein; README bekommt die Schritt-für-Schritt-Anleitung.

## Tech-Stack

- **Next.js 15** (App Router, TypeScript), `output: 'export'`, `images.unoptimized`, `trailingSlash: true` → statisches `out/` für Cloudflare Pages. Kein SSR, keine API-Routes.
- **Tailwind CSS v4** (Tokens via `@theme`).
- **@supabase/supabase-js v2**, plain `createClient`-Singleton (bewusst nicht `@supabase/ssr` — ohne Server nur Nachteile); Session in localStorage, Auth-Schutz der Eintragsseite rein clientseitig (echter Schutz ist ausschließlich RLS).
- **d3-zoom + d3-selection + d3-scale** (nur diese 3 Module): robustes Pinch/Wheel/Drag inkl. iPad-Edge-Cases. d3 liefert nur die Transform `{x, k}`; gerendert wird semantisch in React (scaleLinear → absolute Positionen, kein CSS-Scale ⇒ Text bleibt scharf).
- Sonst keine Laufzeit-Dependencies (Datums-Parser, Bild-Komprimierung, Toast: Eigenbau, jeweils wenige Zeilen).

## Datenmodell (Migrationen `supabase/migrations/000N_*.sql`, per MCP `apply_migration`)

**Keine `profiles`-Tabelle.** Rollen liegen als `app_role` (`admin` | `editor`) in `auth.users.raw_app_meta_data` — vom Nutzer nicht änderbar, landet im JWT, kein Tabellen-Lookup pro Zeile, keine RLS-Rekursionsfalle. Einmalig per SQL gesetzt (bewusst `app_role`, nicht `role` — der Claim `role` ist für die Postgres-Rolle reserviert):

```sql
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"app_role":"admin"}'::jsonb
 where email = 'admin@…';
```

```sql
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 3000),
  category text not null check (category in ('schule','schueler','lehrer','ehemalige','sonstiges')),
  class_name text check (char_length(class_name) <= 30),      -- „8a", „Abi 1996"
  author_name text check (char_length(author_name) <= 80),    -- optional
  year int not null check (year between 1900 and 2100),
  month int check (month between 1 and 12),
  day int check (day between 1 and 31),
  check (day is null or month is not null),                    -- Tag nur mit Monat
  sort_date date generated always as                           -- validiert echte Daten (31.02. fliegt)
    (make_date(year, coalesce(month,1), coalesce(day,1))) stored,
  is_milestone boolean not null default false,                 -- große Karte; nur Admin
  image_path text,                                             -- Pfad in entry-images
  audio_path text,                                             -- Pfad in entry-audio; nur Admin
  video_url text check (video_url ~* '^https://'),             -- Phase 2, kein UI
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()                -- moddatetime-Trigger
);
create index entries_sort_date_idx on public.entries (sort_date);
create index entries_category_idx  on public.entries (category);
alter table public.entries enable row level security;
```

Kategorien als CHECK statt Tabelle (fest kuratiert, deutsche Labels + Farben zentral in `src/lib/categories.ts`). „Meilenstein" ist bewusst **orthogonal** als Flag: Filter-Chips = Kategorien, Meilensteine = Darstellungsebene.

### RLS-Policies (Muster: `TO <role>` + `(select …)`-Wrapping für initPlan-Caching)

Helper in **nicht exponiertem** Schema `private`: `private.jwt_role()` liest `auth.jwt() -> 'app_metadata' ->> 'app_role'`; darauf `is_admin()` / `is_contributor()`.

- **SELECT**: `to anon, authenticated using (true)` — öffentlich lesbar.
- **INSERT** `to authenticated with check`: `is_contributor()` ∧ `created_by = (select auth.uid())` ∧ (`not is_milestone` ∨ `is_admin()`) ∧ (`audio_path is null` ∨ `is_admin()`).
- **UPDATE/DELETE**: nur `is_admin()` (Eintrag-Accounts dürfen laut Nutzer-Entscheidung nur erstellen).

### Storage

- Bucket **`entry-images`**: public read, `file_size_limit` 2 MB, MIME nur `image/webp`,`image/jpeg` (Client encodiert eh neu). INSERT nur Contributor in eigenen Ordner (`(storage.foldername(name))[1] = auth.uid()::text`, Pfad `{uid}/{uuid}.webp`); UPDATE/DELETE nur Admin.
- Bucket **`entry-audio`**: public read, 25 MB, MIME mp3/m4a/aac/wav/webm; INSERT/UPDATE/DELETE **nur Admin**.
- Public Buckets liefern über CDN-URL (`getPublicUrl()`); in der DB nur Pfade speichern.

### Realtime — „Broadcast from Database" (2026 empfohlen; `postgres_changes` ist Legacy)

Trigger auf `entries` ruft `realtime.send(jsonb_build_object('op', TG_OP, 'id', coalesce(new.id, old.id)), lower(TG_OP), 'timeline', false)` — **öffentlicher** Channel, damit anonyme Besucher ohne JWT empfangen (Realtime-Setting „Allow public access" bleibt an; Trigger-Funktion `security definer, set search_path = ''`). Client: `channel('timeline').on('broadcast', …)`.

**Sicherheitsmuster:** Broadcasts sind nur *Hinweise* — der Client **refetcht die Zeile per RLS-geprüftem `select`** (bei `delete`: Zeile weg → entfernen). Gefälschte Events auf dem öffentlichen Channel laufen damit ins Leere. Kein `REPLICA IDENTITY FULL`, keine Publication nötig. Free-Tier-Limits (200 gleichzeitige Verbindungen, 100 msg/s) im README dokumentieren; ohne Realtime funktioniert die Seite per Reload weiter.

## Frontend

```
src/app/layout.tsx, globals.css        Tokens, Open Sans, Header/Footer
src/app/page.tsx                       „/"  Zeitstrahl
src/app/login/page.tsx                 „/login"
src/app/eintragen/page.tsx             „/eintragen" (Create; Admin: ?id=… zum Bearbeiten)
src/app/impressum/ + datenschutz/      Platzhalterseiten (Pflicht für Schulseite)
src/lib/supabase.ts                    createClient-Singleton (NEXT_PUBLIC_-Env-Vars)
src/lib/categories.ts                  Kategorien: id, Label, Farbe (Single Source)
src/lib/dateParser.ts                  „1996" | „3.1996" | „12.3.1996" → {year,month?,day?}
src/lib/timelinePosition.ts            Datum→x, Lane-Layout, Clustering
src/lib/compressImage.ts               createImageBitmap → Canvas → WebP 0.82 (Fallback JPEG)
src/lib/database.types.ts              generiert via MCP generate_typescript_types
src/hooks/useAuth.ts                   Session + app_role aus JWT
src/hooks/useEntries.ts                Initial-Fetch (chunked .range(), PostgREST-Limit 1000)
src/hooks/useRealtimeEntries.ts        Broadcast-Channel + Refetch-on-Notify + 3-s-Logik
src/components/Timeline.tsx            d3-zoom auf Container, scaleExtent ~[0.5, 200]
src/components/TimelineAxis.tsx        Ticks: k<4 Dekaden, 4–40 Jahre, >40 Monate
src/components/EntryCard.tsx / MilestoneCard.tsx / EntryDetailModal.tsx (mit Audio-Player)
src/components/FilterBar.tsx           Kategorie-Chips; bei „Schüler" zusätzlich Klassen-Filter
src/components/SmartDateInput.tsx      Live-Interpretation („→ März 1996")
src/components/ImageUpload.tsx         Drop/Kamera + Kompression;  AudioUpload nur für Admin
src/components/EntryForm.tsx, RealtimeToast.tsx
public/_headers                        CSP & Co. für Cloudflare Pages
supabase/migrations/…                  0001_schema, 0002_policies, 0003_storage, 0004_realtime
PLAN.md, README.md                     Plan-Kopie; Setup/Accounts/Deploy/Härtung
```

**Timeline-UX:** Position `x = scale(year + ((month ?? 6,5) − 0,5)/12 + (day ? (day−0,5)/365 : 0))` — nur-Jahr landet in der Jahresmitte; `precision` steuert die Anzeige („1996" / „März 1996" / „12. März 1996"). Greedy-Lane-Stapeln oberhalb der Achse, ab ~5 Spuren Cluster-Badge („+7", Klick zoomt hinein); Meilensteine als große Bildkarten in eigener Spur unter der Achse. Filter wirken clientseitig auf den kompletten Datensatz.

**Realtime-Regel:** `lastInteractionRef` (Pointer/Wheel/Touch). Neuer Eintrag → Interaktion < 3 s her: nur dezenter Toast („Neuer Eintrag: … — anzeigen"); sonst animierter Kameraflug (`transition().call(zoom.transform, …)`) + Puls-Highlight.

## Sicherheit

1. RLS auf allen Tabellen + Storage-Policies wie oben; Schreibrechte nur über `app_role`-Claims.
2. Frontend enthält nur URL + Publishable Key; `sb_secret_…` existiert nirgends im Repo/Bundle.
3. **Registrierung deaktivieren** (Dashboard → Auth → „Allow new users to sign up" aus; das MCP hat dafür kein Tool → dokumentierter Pflichtschritt vor Go-Live). Accounts nur manuell.
4. Passwort-Mindestlänge ≥ 12 (Dashboard); eingebaute Auth-Rate-Limits reichen für 4 Accounts. Leaked-Password-Protection ist Pro-only → als akzeptierter Advisor-Hinweis dokumentiert. Optional nach MVP: Cloudflare **Turnstile** (Supabase-Captcha-Integration funktioniert mit statischer Site; Widget per Script-Tag + `captchaToken` bei `signInWithPassword`).
5. `public/_headers`: CSP (connect/img/media nur self + `*.supabase.co` inkl. `wss:`), `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
6. Längen-CHECKs serverseitig; MIME + Größe bucketseitig erzwungen; `private`-Schema nicht in „Exposed schemas".

## Umsetzungs-Reihenfolge

1. **Scaffold**: Next.js (static export) + Tailwind v4 + Tokens + Open Sans; PLAN.md + README ins Repo.
2. **Supabase**: Migrationen 0001–0004 per MCP einspielen; **Dev-Accounts** (1× admin, 1× editor, Wegwerf-Passwörter) für Entwicklung: signUp per Skript solange Registrierung offen ist, `email_confirmed_at` + `app_role` per SQL setzen. Echte Accounts legt der Nutzer später im Dashboard an (Passwörter laufen nie durch Chat/Repo); Rollen-SQL-Snippet liegt im README, Dev-Accounts werden dabei gelöscht + Signups deaktiviert.
3. **Typen** generieren; **Timeline read-only**: Fetch, Zoom/Pan, Achse, Karten, Cluster, Detail-Modal, Filter.
4. **Formulare**: Login; `/eintragen` mit SmartDateInput, ImageUpload (Kompression), AudioUpload (nur Admin), Admin-Bearbeiten/Löschen im Detail-Modal.
5. **Realtime**: Trigger + Hook, 3-s-Idle-Logik, Kameraflug, Toast.
6. **Politur**: Responsive (iPad/Handy), Leere-Zustände, Impressum/Datenschutz-Platzhalter, `_headers`.
7. **Sicherheits-Pass + Verifikation** (unten); README: Cloudflare-Pages-Anleitung (Build `npx next build`, Output `out`, Env-Vars, später Custom-Domain), Account-/Härtungs-Checkliste.
8. Commit + Push auf `claude/interactive-timeline-school-app-xkt84s` (kein PR, außer ausdrücklich gewünscht).

## Verifikation

- `npm run build` → fehlerfreier statischer Export; Grep über `out/`: kein `sb_secret_`.
- **RLS-Simulation** per `execute_sql` (Transaktion + Rollback): als `anon` (`set local role anon`) INSERT/UPDATE/DELETE → muss scheitern, SELECT ok. Als Editor-JWT (`set local request.jwt.claims` mit `app_metadata.app_role='editor'`): INSERT ok; `is_milestone=true`, `audio_path`, fremdes `created_by`, UPDATE/DELETE → scheitern. Als Admin: alles ok.
- **Storage-Negativtests**: anonymer Upload → 403; 3-MB-Bild → abgelehnt; Editor-Upload in fremden Ordner → abgelehnt.
- **E2E-Smoke** (vorinstalliertes Chromium/Playwright gegen `npm run dev`): Timeline lädt; Login Dev-Editor; Eintrag anlegen → erscheint; **zweites anonymes Browserfenster empfängt ihn live per Realtime**; Screenshots als Beleg.
- `get_advisors` (security + performance) nach jeder Migration; einziger akzeptierter offener Punkt: „leaked password protection disabled" (Pro-Feature).
- Manuell: Pinch-Zoom (Touch), Filter inkl. Klassen-Filter, Audio-Player, Datums-Parser-Randfälle, Papier/Coal/Navy/Orange-Look.

## Bewusst offen / Phase 2

- Nutzer: Cloudflare-Konto + Domain, echte Accounts + Passwörter, Impressum-/Datenschutztexte, echte Meilenstein-Inhalte (Registrierung erst nach Account-Anlage deaktivieren!).
- Optional später: Turnstile-Captcha, Video-Embeds (`video_url` liegt bereit), Cloudflare-Cache vor Storage (falls > 5 GB Traffic/Monat), Kategorien-Verwaltung.
