# Social-Integrationen (Zernio: Analytics + Posting · SocialCrawl: Benchmark)

Stand: 2026-07-19 · Zernio-Doku: https://docs.zernio.com · OpenAPI: https://docs.zernio.com/api/openapi

Zernio ist eine Unified-Social-API (LinkedIn, Instagram, Threads, X/Twitter, Pinterest u. v. m.).
i7OS nutzt sie für **Audience → Analytics** (Performance-Dashboard) und **Erstellen →
Social Media Post** (Veröffentlichen/Planen/Entwürfe).

## Zwei Anbieter, zwei Fragen

**Zernio** liest die Accounts, die dieser Workspace **besitzt** — verbunden per
OAuth: eigene Analytics, eigene Kommentare, eigenes Posting. **SocialCrawl**
(https://www.socialcrawl.dev) liest **öffentliche** Profile beliebiger Accounts,
über 50 Plattformen in einem einheitlichen Schema. Das ist der einzige Weg zu
„wie stehen wir im Vergleich" — Zernio kann darüber nichts sagen, weil ihm
fremde Accounts nicht gehören.

Beide hängen in **derselben** Function `api/zernio.js`. Nicht aus Ordnungsliebe,
sondern wegen des Budgets: Vercel Hobby erlaubt 12 Node-Functions, wir stehen
bei 11, und eine eigene Datei für einen Proxy hätte den letzten Platz verbraucht.

## Architektur

```
Browser ──POST /api/zernio (Supabase-Bearer + mode)──▶ api/zernio.js ──Bearer ZERNIO_API_KEY──▶ zernio.com/api/v1
                                                        │
                                                        └── workspace_social (Supabase, server-only)
```

- **Der `ZERNIO_API_KEY` bleibt server-seitig.** Der Client spricht ausschließlich
  mit unserer Function `api/zernio.js` (eine einzige Multi-Mode-Function —
  Function-Budget: 11/12 Node).
- **Ein Zernio-"Profile" pro Workspace.** Zernio gruppiert Social-Accounts in
  Profiles. `api/zernio.js` legt beim ersten Zugriff pro Workspace ein Profile an
  (`<Org-Name> · i7OS`) und speichert die Zuordnung in der server-only Tabelle
  **`workspace_social`** (`org_id` PK → `zernio_profile_id`; RLS + revoke, Zugriff
  nur per Service-Key). Migration: `supabase/migrations/20260719100000_create_workspace_social.sql`.
- **Auth & Autorisierung:** Jeder Request braucht einen gültigen Supabase-Session-Token;
  `requireOrgMember` prüft die Workspace-Mitgliedschaft (Helfer aus `server/billing.js`
  wiederverwendet). `connect`/`disconnect` sind **admin-only**. Beim Posten wird
  server-seitig geprüft, dass jeder Ziel-Account wirklich zum Zernio-Profil DIESES
  Workspaces gehört (kein Cross-Workspace-Posting).

## Env-Var

| Variable | Wo | Zweck |
|---|---|---|
| `ZERNIO_API_KEY` | Vercel (alle Environments) + `.env.local` | Bearer-Key (`sk_…`) für alle Zernio-Aufrufe |
| `SOCIALCRAWL_API_KEY` | Vercel (alle Environments) + `.env.local` | `x-api-key` (`sc_…`) für SocialCrawl. Fehlt er, antwortet nur der `lookup`-Modus mit `503 { code: "socialcrawl_not_configured" }` |

Ohne Key antworten alle Modi mit `503 { code: "zernio_not_configured" }`; die UI
zeigt einen entsprechenden Hinweis.

## api/zernio.js — Modi

Alle Requests: `POST /api/zernio`, Header `Authorization: Bearer <supabase access_token>`,
Body `{ mode, orgId, … }`.

| Mode | Body | Antwort | Hinweise |
|---|---|---|---|
| `status` | – | `{ accounts: [{id, platform, username, displayName, profileUrl, isActive}], hasAnalyticsAccess }` | legt das Zernio-Profil lazy an |
| `connect` | `platform` (Zernio-Key, z. B. `twitter`) | `{ authUrl }` | admin-only. `redirect_url` = `PUBLIC_APP_URL/?zernio=connected`; nach OAuth hängt Zernio `connected={platform}&accountId=…` an |
| `disconnect` | `accountId` | `{ ok }` | admin-only, `DELETE /v1/accounts/{id}` |
| `analytics` | `platform?` | `{ top, followers, daily }` | 3 parallele Zernio-Calls; Teile, die das **Zernio Analytics-Add-on** brauchen (402/403), kommen als `{ __unavailable, status }` zurück statt zu failen |
| `comments` | `platform?`, `recent?` **oder** `postId` + `accountId` | `{ list }`, `{ list, recent }` bzw. `{ thread }` | Ohne `postId`: `GET /v1/inbox/comments?minComments=1&limit=25` — die Beiträge, unter denen etwas steht. Mit `recent: true` holt die Function zusätzlich die Verläufe der 6 neuesten Beiträge parallel, flacht sie samt Antworten ab und sortiert nach Datum: **`recent[]` = die letzten Kommentare**, was Zernio selbst nicht anbietet (dort ist es eine Liste von Posts plus ein Call je Post). Mit `postId`: `GET /v1/inbox/comments/{postId}?accountId=…` — nur dieser Verlauf. Alles soft-gefetcht wie `analytics`, weil Kommentare auf manchen Plänen am selben Add-on hängen |
| `lookup` | `platform`, `handle`, `enrich?`, `fresh?` | `{ profile, credits, cached, insights?, jobs? }` | **SocialCrawl**, nicht Zernio: das öffentliche Profil eines beliebigen Accounts (`GET /v1/{platform}/profile`), für Benchmark und für die eigene LinkedIn-Seite. Plan-pflichtig (`requirePaidSocial`), weil jeder Aufruf upstream einen Credit kostet. LinkedIn und Facebook nehmen eine **URL**, der Rest einen Handle; Pinterest fehlt, weil SocialCrawl dort kein Profil-Endpoint hat.<br>`enrich: true` (nur LinkedIn) hängt zwei parallele Calls an, die die numerische `company_id` aus dem Profil brauchen: `/linkedin/company/insights` (Views/Likes/Kommentare/Engagement) und `/linkedin/company/job-count`. Beide weich — fällt einer aus, fehlt nur seine Kachel.<br>`fresh: true` schickt `Cache-Control: no-cache`; ohne das antwortet SocialCrawl aus dem Cache, was zweimaliges Öffnen des Dashboards nicht zweimal kostet |
| `reactors` | `url`, `fresh?` | `{ reactors, total, credits }` | **SocialCrawl**: wer auf einen LinkedIn-Beitrag reagiert hat (`GET /v1/linkedin/post/reactions`). Zernio zählt Reaktionen, kann sie aber nicht benennen — eine Reaktion gehört nicht dem verbundenen Account. Plan-pflichtig. Die Item-Form ist in SocialCrawls Spec **nicht** festgelegt (`Search result item`), deshalb reicht die Function die Liste durch und die UI liest defensiv (`display_name`/`name`/`username`, `bio`/`headline`, `avatar_url`/`picture`) |
| `presign` | `filename, contentType, size` | `{ uploadUrl, publicUrl }` | Client PUTtet die Datei direkt zu Zernio-Storage (Bytes laufen nie durch unsere Function) |
| `post` | `content?, platforms:[{platform, accountId}], mediaItems?, scheduledFor?, timezone?, isDraft?` | `{ id, status, platforms:[{platform, status, url, error}] }` | `publishNow` wenn kein `scheduledFor`; `x-request-id` (UUID) für Zernio-Idempotenz; Zernio dedupt identische Inhalte 24 h (409) |

Genutzte Zernio-Endpoints: `POST /v1/profiles`, `GET /v1/accounts`, `GET /v1/connect/{platform}`,
`DELETE /v1/accounts/{id}`, `GET /v1/analytics` (sortBy=engagement), `GET /v1/accounts/follower-stats`,
`GET /v1/analytics/daily-metrics`, `POST /v1/media/presign`, `POST /v1/posts`,
`GET /v1/inbox/comments`, `GET /v1/inbox/comments/{postId}`.

## Plattform-Key-Mapping

i7OS verwendet in der UI den Key **`x`**, Zernio nennt die Plattform **`twitter`**.
Mapping in App.jsx: `zernioKeyFor(uiKey)` / `uiKeyFor(zernioKey)`. Alle übrigen Keys
(linkedin, instagram, threads, pinterest) sind identisch. Angebotene Plattformen:
`ZERNIO_UI_PLATFORMS` in App.jsx (aktuell die fünf oben genannten; Zernio kann mehr —
einfach den Array erweitern).

## User-Flows

**Verbinden (Audience → Analytics):**
1. Kein Account verbunden → Empty-State mit Plattform-Karten ("Verbinden").
2. Klick → `mode:"connect"` → `window.location.assign(authUrl)` → OAuth bei der Plattform.
3. Zernio redirectet zurück auf `/?zernio=connected&…` → App-Root-Effekt erkennt den
   Param, öffnet Audience mit Tab Analytics (`audienceInitialTab`), URL wird bereinigt.
4. Analytics lädt: KPI-Kacheln (Follower + Zuwachs, Impressionen, Interaktionen,
   Engagement-Rate), Wochen-Chart (aus daily-metrics gebuckets), Top-5-Posts nach
   Engagement (klickbar → Original-Post), verbundene Accounts (mit Trennen) und
   "Weitere verbinden".

**Posten (Erstellen → Social Media Post) — 3-Step-Wizard im Brand-Avatar-Stil**
(nummerierte Step-Tabs, graue Box; die Vorschau steht NUR auf dem letzten Step):

1. **01 Text** — Caption, großes Feld, Autofokus. Solange kein Kanal gewählt ist,
   zählt die Anzeige nur Zeichen, statt gegen ein Limit zu messen, das niemand
   gesetzt hat.
2. **02 Visual** — hochladen ODER aus den Assets nehmen (derselbe
   `ImageInsertModal`, den Dokumente und Canvas benutzen; die gewählte URL wird
   einmal geholt und ab da wie eine hochgeladene Datei behandelt). Danach das
   Mini-Creator-Tool: **Text-Overlays direkt auf der Grafik** (draggen,
   Größen-Slider, 5 Farben, Bold, mehrzeilig), Koordinaten relativ (0–1)
   gespeichert. Beim Posten wird die Komposition per `<canvas>` in **nativer
   Bildauflösung als JPEG gerendert** (`exportVisual()`; ohne Overlays geht das
   Original unverändert hoch). "Vorlagen — bald"-Platzhalter.
3. **03 Kanäle** — verbundene Accounts als Chips (Mehrfachauswahl); keine →
   Hinweis + Button zu Audience → Analytics. Hier steht auch die Vorschau
   (rechte Spalte), das Zeichenlimit (Minimum der gewählten Plattformen:
   X 280 · Threads/Pinterest 500 · Instagram 2200 · LinkedIn 3000) mit
   Link zurück in den Text, der optionale Zeitplan (datetime-local,
   Browser-Zeitzone) und Posten/Planen bzw. Entwurf (`isDraft:true`).
   Ablauf: ggf. `presign` + direkter PUT-Upload des gerenderten JPEGs, dann
   `mode:"post"`. Ergebnisbox zeigt Status pro Plattform mit Link
   ("Ansehen ↗") bzw. Fehler.

Warum drei und nicht vier: der erste Step hakte nur Kanäle an, und das ist kein
Schritt, sondern eine Frage. Die Kanäle gehören ans Ende, weil der Text
entscheidet, wohin er passt, und das Limit erst interessant ist, wenn Text da
ist. Die Vorschau stand vorher neben jedem Step und zeigte auf Step 1 einen
leeren Post.

Die Vorschau-Karte zeigt Caption + komponiertes Visual (Overlay-Skalierung über
CSS-Container-Queries, `cqw`-Einheiten — gleiche Relativkoordinaten wie Editor
und Canvas-Export).

## Wichtige Zernio-Eigenheiten

- **Analytics-Add-on:** `follower-stats` und `daily-metrics` brauchen das Add-on
  (bei Usage-Plänen inklusive). Fehlt es → UI-Hinweis, Rest funktioniert.
- **LinkedIn persönliche Profile:** Analytics nur für Posts, die ÜBER Zernio
  veröffentlicht wurden (LinkedIn-API-Limitierung). Company Pages: alle Posts.
- **Sync-Verzögerung:** Nach dem Verbinden synct Zernio die letzten ~12 Monate
  externer Posts; Top-Posts können anfangs leer sein.
- **Duplikat-Schutz:** identischer Inhalt an denselben Account innerhalb 24 h → 409.
- **Follower-Zahlen** werden 1×/Tag aktualisiert.

## Offen / Nächste Schritte

- [ ] `ZERNIO_API_KEY` in Vercel setzen (danach Deploy) und lokal in `.env.local`.
- [ ] Weitere Plattformen freischalten (TikTok, YouTube, Facebook … — nur `ZERNIO_UI_PLATFORMS` erweitern).
- [ ] Geplante Posts / Entwürfe in i7OS anzeigen (`GET /v1/posts?status=scheduled|draft`).
- [ ] Account-Health-Anzeige (`GET /v1/accounts/health`) + Reconnect-Flow.
- [ ] Bild aus i7OS-Dateien wählen (statt nur lokalem Upload).
- [ ] Template-System für den Visual-Step (ladbare Layouts mit vorplatzierten Text-Overlays; Platzhalter-Chip existiert schon).
- [ ] Webhooks für Post-Status statt Polling (Zernio unterstützt Webhooks).
- [ ] Weitere Social-Tool-Integration ist geplant (vom User angekündigt).

## SocialCrawl: die Formen, die die Doku nicht zeigt

Die Doku bebildert jeden Endpoint mit einem YouTube-Beispiel und sagt, das
unified schema gelte überall. Für LinkedIn stimmt das nur halb — an der
Live-API gemessen:

- **Profil** (`/linkedin/profile`, `/linkedin/company`): die Antwort ist
  `{ author, computed }`, nicht flach. `api/zernio.js` flacht sie im
  `lookup`-Mode ab; Leser bekommen `avatar_url`, `bio`, `followers`,
  `location`, `ext.is_top_voice`, `ext.is_premium` direkt.
- **Kommentar-Autor**: nur `username`, `display_name`, `avatar_url`,
  `verified` — und LinkedIn füllt davon **nur den Namen**. Kein Bild, kein
  Handle, kein Profil-Link. Wer mehr über die Person will, braucht einen
  Profil-Abruf, und dafür eine URL, die der Kommentar nicht mitliefert.
- **Reaktion**: `{ reaction_type, user: { name, description, url } }` — die
  Person liegt unter `user`. Das ist die einzige Stelle, an der eine
  Profil-URL zu einem Namen kommt, deshalb löst „Wer ist das?" einen
  Kommentator über die Reaktionsliste desselben Beitrags auf.
- **URN-Form**: SocialCrawl antwortet nur auf `urn:li:activity:…`. Zernios
  Permalink trägt `urn:li:share:…` und liefert dort **502**. Die Activity-ID
  ist keine Umrechnung der Share-ID, sondern eine andere Nummer — sie steckt
  in den Kommentar-IDs, die Zernio zurückgibt.
- **Fehler** sind Objekte (`{type, message, status}`). Als String verkettet
  ergeben sie „[object Object]" und machen jeden Fehlschlag unsichtbar.
- **Personenfoto**: kommt grundsätzlich an — `linkedin.com/in/williamhgates`
  rendert sein Bild in der Benchmark-Zeile. Bei manchen Profilen fehlt es
  trotzdem, und das ist dann deren Datensatz, nicht unser Mapping. Für Felix
  Sander durchgeprüft: verschleierte `/in/ACoAA…`-URL und Vanity-Slug
  `felix-sander` liefern beide Bio, Follower, Following und Ort, aber kein
  Bild — auch nicht mit erzwungenem Neu-Crawl und auch nicht unter einem
  anders benannten Feld (jedes Feld mit bild-artigem Namen und URL-Wert wird
  geprüft, `ext` eingeschlossen). Wahrscheinlichste Ursache: die
  Foto-Sichtbarkeit des Profils steht nicht auf „Public"; anonym ist LinkedIn
  nicht gegenzuprüfen, es antwortet auf Abrufe ohne Login mit HTTP 999.
- **Ort**: kommt als fertiger String und wiederholt sich darin
  („Hamburg, Hamburg, Germany, Germany"). `plainField` in App.jsx zieht
  Wiederholungen raus — auch aus Strings, nicht nur aus Objekten.
- **Größenband**: `ext.employee_count_range` ist `{start, end}`. Roh in JSX
  gesteckt ist das keine falsche Beschriftung, sondern eine weiße Seite
  (React #31).
- **Rate-Limit**: LinkedIn wird upstream zeitweise gedrosselt („momentarily
  rate-limited, retry after 30s, credits refunded"). Sichtbar wird das als
  „Unknown" beim Kommentar, weil der SocialCrawl-Aufruf scheitert und auf
  Zernio zurückfällt, das keinen Namen führt. Kein Fehler im Code — 30
  Sekunden warten.

## Kosten im Griff behalten

- **Alles läuft durch `scfetch`**, und das bedient sich 24 h aus
  `social_crawl_cache` (Service-Key, keine Policy). Nie eine Aufrufstelle daran
  vorbeibauen. `fresh` nur aus einem „Aktualisieren"-Knopf, den ein Mensch
  gedrückt hat.
- **Preise bei LinkedIn** (deren Doku): jedes Profil, jeder Post, jede
  Firmenseite 5 Credits; Personensuche, Firmen-Mitarbeitende, Firmen-Jobs,
  Jobsuche, **Post-Reaktionen** und Video-Transkripte 10. Nur die drei
  ID-Resolver (`search/location`, `search/schools`, `search/industry`) kosten 1.
  Es gibt bei LinkedIn keine 1-Credit-Inhaltsabfrage.
- **Profil-Unterressourcen sind kein Bündel.** Dreizehn Endpunkte teilen sich
  dieselbe Profil-URL; ein vollständiges Dossier zu einer Person sind dreizehn
  abgerechnete Aufrufe.
- **Debuggen ohne Credits**: die Rohantworten liegen in `social_crawl_cache`.
  Per SQL lesen statt neu abrufen.

## Warum ein Profilfoto fehlen kann

An Felix Sander durchgemessen, weil die Doku ein Bild verspricht: Im **selben**
Datensatz liefert `/linkedin/profile` sein `ext.cover_url` (Banner), aber
`avatar_url: null`. Der Crawl hat die Seite also gesehen. Gegenprobe an der
öffentlichen LinkedIn-Seite, anonym und ohne Login:

| Profil | `og:image` |
|---|---|
| `williamhgates` | `media.licdn.com/…/profile-displayphoto-shrink_200_200/…` |
| `felix-sander` | `static.licdn.com/aero-v1/sc/h/…` (Platzhalter) |

Das Banner kennt bei LinkedIn keine Sichtbarkeitseinstellung, das Profilfoto
schon. Fehlt `avatar_url`, ist das die Einstellung der Person — kein Mapping-
Fehler und mit keinem anderen Endpunkt zu umgehen.
