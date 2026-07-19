# Zernio-Integration (Social Media: Analytics + Posting)

Stand: 2026-07-19 · Zernio-Doku: https://docs.zernio.com · OpenAPI: https://docs.zernio.com/api/openapi

Zernio ist eine Unified-Social-API (LinkedIn, Instagram, Threads, X/Twitter, Pinterest u. v. m.).
i7OS nutzt sie für **Audience → Analytics** (Performance-Dashboard) und **Erstellen →
Social Media Post** (Veröffentlichen/Planen/Entwürfe).

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
| `presign` | `filename, contentType, size` | `{ uploadUrl, publicUrl }` | Client PUTtet die Datei direkt zu Zernio-Storage (Bytes laufen nie durch unsere Function) |
| `post` | `content?, platforms:[{platform, accountId}], mediaItems?, scheduledFor?, timezone?, isDraft?` | `{ id, status, platforms:[{platform, status, url, error}] }` | `publishNow` wenn kein `scheduledFor`; `x-request-id` (UUID) für Zernio-Idempotenz; Zernio dedupt identische Inhalte 24 h (409) |

Genutzte Zernio-Endpoints: `POST /v1/profiles`, `GET /v1/accounts`, `GET /v1/connect/{platform}`,
`DELETE /v1/accounts/{id}`, `GET /v1/analytics` (sortBy=engagement), `GET /v1/accounts/follower-stats`,
`GET /v1/analytics/daily-metrics`, `POST /v1/media/presign`, `POST /v1/posts`.

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

**Posten (Erstellen → Social Media Post):**
1. Lädt die verbundenen Accounts (`mode:"status"`); keine → Hinweis + Button zu
   Audience → Analytics.
2. Accounts als Chips (Mehrfachauswahl), Text mit Zeichenlimit (Minimum der gewählten
   Plattformen: X 280 · Threads/Pinterest 500 · Instagram 2200 · LinkedIn 3000),
   optional Bild, optional Zeitplan (datetime-local, Browser-Zeitzone).
3. "Posten"/"Planen": erst ggf. `presign` + direkter PUT-Upload, dann `mode:"post"`.
   Ergebnisbox zeigt Status pro Plattform mit Link ("Ansehen ↗") bzw. Fehlermeldung.
4. "Entwurf speichern" → `isDraft:true` (liegt dann in Zernio als Draft).

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
- [ ] Webhooks für Post-Status statt Polling (Zernio unterstützt Webhooks).
- [ ] Weitere Social-Tool-Integration ist geplant (vom User angekündigt).
