# i7 OS (Agency OS) — Working Guide for AI Assistants

Multi-tenant workspace OS for creative agencies. React 19 + Vite SPA, Supabase (Postgres/Auth/Storage/Realtime), Vercel serverless functions. Deployed as Vercel project **`agency-os`** → **app.i7os.com**. UI language is German-first, bilingual de/en.

## Golden rules (violating these has caused real regressions)

1. **Almost everything lives in `src/App.jsx` (~32k lines).** This is intentional. Do NOT split it into files unless explicitly asked. Navigate by searching for component names (`function WhiteboardView`), not line numbers — they shift constantly.
2. **NEVER claim a feature doesn't exist based on a search that found nothing.** In a 32k-line file, a miss usually means the pattern was wrong, not that the code is absent. This has already caused a real error: a single-line grep for `from("organizations").insert` missed `createWorkspace`, where the call is wrapped over three lines, and produced the confident, false claim that the app had no UI for creating a workspace. Before stating that something is missing: search again with a *short* fragment (`from("organizations")`, `createWorkspace`), search the UI strings (`"Neuer Workspace"`), and check the write-path index below. If it still looks absent, say "I could not find it" — not "it does not exist".
3. **Verify before shipping:** `npx vite build` must end with `✓ built` (cold build takes ~20–25 min on the current machine; warm cache can be seconds — both are normal). There are no tests; the build is the gate. The build only covers the browser bundle — it says nothing about whether the `api/` functions resolve their imports (see "Verifying a deploy").
4. **Deploy = push:** committing to `main` and pushing triggers the Vercel deploy. Commit messages end with `Co-Authored-By: Claude <model> <noreply@anthropic.com>`.
5. **Language:** every user-visible string AND every AI-generated output must respect `appLanguage` (`de`/`en`), usually via the local `const de = appLanguage === "de"` or the `t(...)` translations helper (`src/translations.js`). Never hardcode German (or English) in new UI.
   **No emoji in the UI.** Every icon is a drawn line glyph, white on anthracite
   `#15151c`, `viewBox="0 0 24 24"`, `strokeWidth="1.8"`, round caps. An emoji
   brings its own colours and is redrawn by every OS, so a row of them never
   reads as one set. Reuse the path App.jsx already draws for that thing, and
   where two places show the same symbol, define it ONCE at module scope
   (`OS_VISUAL_ICON` is the pattern: the dashboard cards and the OS Visuals
   dialog read the same map, after years of quietly disagreeing). The emoji
   picker, the stickers and whiteboard emoji elements are content, not chrome,
   and stay.
   **The product is written `i7OS`, closed up.** Never "i7 OS" with a space,
   in any user-visible string: UI, emails, push titles, the bot's messages, the
   PWA manifest, the page title. The owner asked for this on 2026-08-27 after
   seeing "i7 OS" in a Telegram message.
   **No em dashes in user-visible text.** Not in UI strings, not in AI output,
   not in labels. Write two sentences, or use a comma. The owner has asked for
   this twice and calls it "dieser komische Bindestrich". Code comments are
   exempt — nobody reads those in the product.
6. **Design system:**
   - No purple/lilac accents. Active/selected states use anthracite **`#15151c`** (dark pill, white text). Exception: in dark mode the main nav menu's selected pill is *inverted* (light bg `rgba(244,244,247,0.95)`, text `#15151c`).
   - Use the shared **`<Dropdown>`** component in App.jsx for any select/menu. Never a native `<select>`, never a one-off menu.
   - Primary action buttons belong in the **top-right header slot** of a view (some views expose a `headerSlotRef` portal target for embedded tabs).
   - Controls must never sit flush against a container edge — keep inner padding (esp. select chevrons).
   - Speech-to-text UI: a "Diktieren" link (mic icon + label) ABOVE the field, right-aligned; turns into red "Stopp" while recording.
   - Fonts: `FONT` constant (`'Geist', -apple-system, sans-serif`). Framer Motion for animation, `createPortal` for overlays.
7. **`de is not defined` — it will happen again.** In a 32k-line file, `const de = appLanguage === "de"` is declared ~44 times, mostly INSIDE nested functions. A sibling function cannot see them. New code that reaches for `de` compiles, builds green, and throws at runtime. This has now shipped **twice** (DocsTab, then CreationsTab). Two things do NOT catch it: the build, and any check that asks "is `de` declared in this component" — it resolves per FUNCTION, and two functions in one component share nothing. Before using `de` in a new function, either declare it at the component level or write `appLanguage === "de"` inline. A regex/indentation scope checker was tried and deleted: it passed its own negative control by mistaking the `"de"` in `appLanguage = "de"` for a parameter. Doing this properly needs a real JS parser.
8. **React StrictMode is ON** (`main.jsx`). One-shot effects must tolerate double-invocation; do NOT pair a cancel-on-cleanup guard with an "already tried" ref — in dev that combination silently drops the result.
9. **Framer Motion transform trap:** never put positioning transforms (`translateX(-50%)`) on a `motion.div` that also animates `x/y/scale` — Framer overwrites the whole `transform`. Put positioning on a plain wrapper div (see the sticker/emoji/asset pickers for the pattern).

## Repo map

```
src/App.jsx              ← the app: all views, all logic (~32k lines)
src/main.jsx             ← entry + routing: ?b=<token> → PublicBrandLanding, ?desktop → DesktopView, else App
src/DesktopView.jsx      ← marketing/desktop preview shell
src/PublicBrandLanding.jsx ← public brand share page (?b= deep link, brand_shares snapshot)
src/supabase.js          ← Supabase client (anon key committed on purpose; security = RLS)
src/translations.js      ← t() strings de/en
src/systemPrompt.js      ← AI assistant system prompt
src/googlePicker.js      ← Google Drive picker loader
api/*.js                 ← Vercel serverless functions (⚠ Hobby plan = max 12 functions;
                            that's why fetch-brand.js multiplexes several modes in one file)
src/skills/*/SKILL.md    ← content "skills" imported ?raw into the app (kept in src/,
                            NOT docs/, so the GitBook sync can't delete them)
vercel.json              ← cleanUrls, SPA rewrite, /i/:slug → api/redirect (short links)
```

## App.jsx internal structure

Top-level function components, in file order (search by name): `createSoundEngine`, `DotGrid`, `AISphere`/`AISpeakingSphere` (Three.js orb), `Dropdown`, `ImageLightbox`, `ChatBubble`, `KanbanBoard`, `TimelineView` (+`TimelineItemModal`), `WhiteboardView` (Brainstorm), `CalendarView`, `FilesView`, `ChatView`, `NotesView`, `ProjectsView`, `PeopleTab`, `TouchpointsView`, `IdeasTab`, `AssetsView` (+`CreationsTab`, moodboards), `DocEditor` (BlockNote-based docs with comments/mentions), `BrandView` area, Settings, and the root `App` component (auth, org, nav, dashboard, voice orb) at the bottom.

Navigation is state-based (`currentView` string in `App`), not a router. The main menu is the "linear menu" (`LINEAR_MENU_ITEMS_DEF`, rendered via portal in `App`): left column categories, right column sub-items.

Brand structure: ONE shared `BrandView` scoped by `projectId` — `projects.is_brand` toggles a per-project brand workspace. Public brand sharing = `brand_shares` snapshot table + `?b=<token>` route; the snapshot is frozen until the user clicks "Aktualisieren".

## Write-path index — where things are actually created

Look here FIRST before adding a gate, a limit, a validation or a "create X"
feature. Search by the function name, never by line number. This table exists
because a missed write path once led to the false claim that workspaces could
not be created from the UI at all.

| Thing | Function / place | File |
|---|---|---|
| **Workspace** | `createWorkspace` (Settings → workspace dropdown → "Neuer Workspace") **and** two more paths in the first-login onboarding screen (Enter key + button) | App.jsx |
| **Project** | `saveProject` (also handles edit) in `ProjectsView` | App.jsx |
| **Workspace invite** | inline in the Settings members panel — the "Einladen" button's `onClick`, a loop over `invitations` inserts. No named function. | App.jsx |
| **Project invite** | `sendInvite` in `ProjectsView` | App.jsx |
| **Invite acceptance** | onboarding: pending-invite tile + invite-code field (3 paths, all inserting `org_members`); project invites: `accept_project_invitation` RPC, called from the `?project-invite=` effect | App.jsx / Postgres |
| **Task** | `KanbanBoard` — created inline in the column composer — **and** `createDashboardTask` in the App root (the swipe-in task panel's "+" button) | App.jsx |
| **Whiteboard** | `createBoard` in `IdeasTab`, plus `openBrainstorm` in the App root (Erstellen → Brainstorm) | App.jsx |
| **Document** | `createDoc` | App.jsx |
| **Moodboard items (from Pinterest)** | `addPinsToBoard` in `AssetsView` — the Add menu inside an open board; picks a board, then pins, and skips any `metadata.pinId` already on the moodboard | App.jsx |
| **Moodboard (from Pinterest)** | `importPinterestBoard` in `AssetsView` — creates the board AND its items in one go; pins keep their `i.pinimg.com` url (`source: "pinterest"`) rather than being copied, so an import costs no storage | App.jsx |
| **Moodboard** | `createBoard` in the assets area (the moodboards tab of `AssetsView`, now rendered inside **Brand → Creations** via `soloTab="moodboards"`, not in the file manager) | App.jsx |
| **Note** | `createNote` | App.jsx |
| **Calendar event** | `createTeamEvent` | App.jsx |
| **Chat conversation** | `startConversation` (1:1) and the group-creation modal | App.jsx |
| **Public share link** | `createShare` in `AssetsView` (moodboard header, link icon) | App.jsx |
| **Link folder** | ONLY the `seed_link_folders` trigger on `organizations` (Skills / Tools / Inspirations / Resources, and the starter links from `link_defaults` inside them). There is deliberately no create-folder control in the UI; `LinksTab` can rename and delete folders, not add them, and a link itself can only be added or removed, never edited | Postgres |
| **Link (bookmark)** | `save` in `LinksTab` (file manager → Browse); it calls `linkRowPreview` → the shared `fetchLinkPreview(url, {icon:true})` → `api/fetch-brand?mode=preview&icon=1` first | App.jsx |
| **File upload** | always through `uploadTracked` — never call `supabase.storage.upload` directly, or the storage ledger drifts | App.jsx |

⚠ **Three things are created from MORE than one place**: workspaces (3),
whiteboards (2) and tasks (2). A gate applied to only one of them is a hole.
The two task writers must also agree on the ROW: same columns, same defaults,
or a card looks different depending on where somebody happened to be standing
when they made it.

## Billing, plans and limits

The paying entity is the **user who created a workspace**
(`organizations.created_by`), not the workspace. One plan covers every workspace
that owner has, with a pooled storage and seat allowance. Full detail lives in
`docs/stripe-billing-setup.md`; the essentials:

- **`src/entitlements.js` is the single source for every limit.** Imported by
  the browser bundle AND by the serverless functions (through
  `server/billing.js`). Keep it dependency-free — it loads in both runtimes.
- The numbers exist a **second** time in the `plan_limits` table, because the
  Postgres triggers cannot call JavaScript. Change a limit in **both**.
- **Postgres triggers are the real gate**; the client checks (`planAllows`,
  `limitMessage`, `planLimitError` in App.jsx) only explain a limit early. Every
  table involved is writable through the anon key, so the client can never be
  the boundary.
- `/api/billing-status` is the ONE endpoint that answers "what may this
  workspace do". The App root loads it once per workspace into the
  `entitlements` state plus a module-level mirror (`currentEntitlements`) for
  the upload guards outside the React tree — read those, never re-fetch.
  (`BillingSettings.jsx` calls the endpoint a second time on purpose: it polls
  after returning from Stripe Checkout. That is the only other caller.)
- Seats count PEOPLE across `org_members` **and** `project_members` — a project
  invite grants access without workspace membership.
- Read-only mode freezes writes for accounts with no plan via 30 triggers.
  DELETE and service-key writes (`auth.uid() is null`) pass through on purpose.
- `billing_accounts.plan_override` grants a plan outside Stripe; the webhook
  never writes it.

**What belongs behind a plan.** Cost decides, not perceived value. A feature
that costs us nothing per use — deterministic work done on our own servers, no
third-party call we are billed for — is available on every plan, including free.
A feature that bills us per use (Zernio social accounts, Pixazo image credits,
model calls we pay for) is gated. Stated by the owner on 2026-08-11.

Careful with the free plan specifically: free is **read-only** (see the 30
triggers above), so "free may use it" holds for reading and computing, and stops
at the moment the feature writes a row. A free-plan feature that saves its
result needs its table exempted from the read-only trigger, or it must work
without saving.
- `api/lifecycle-sweep.js` (daily cron, Edge) deletes abandoned workspaces in
  stages and **does nothing** unless `LIFECYCLE_PURGE_ENABLED=true`.

## Data model (Supabase)

Multi-tenant: nearly every row carries `org_id` (workspace) and often `project_id`. Security is Row-Level Security; the client uses the public anon key.

- **Org/auth:** `organizations`, `org_members`, `profiles`, `invitations`, `team_members`, `google_oauth_tokens`
- **Projects:** `projects`, `project_members`, `project_invitations`
- **Kanban:** `tasks`, `task_checklist_items`, `task_comments`, `task_attachments`
- **Timeline (sprints):** `timeline_items`, `timeline_item_tasks`, `timeline_item_assignees`, `timeline_item_checklist`, `sprint_groups`
- **Docs:** `brand_documents`, `document_folders`, `document_comments`, `document_shares`, `document_activity`
- **Files/Assets:** `user_files`, `user_folders`, `user_drive_files`, `file_metadata`, `moodboards`, `moodboard_items`
- **Whiteboard:** `whiteboards`, `whiteboard_items`, `whiteboard_shares`
- **Chat:** `chat_conversations`, `chat_participants`, `chat_messages`
- **Public links:** `public_shares` (token → one thing in a workspace, today only `kind: moodboard`; one live link per thing, revoked not deleted; NO public read policy, the endpoint reads it with the service key so a token cannot be used to enumerate a workspace's other links)
- **Brand:** `brand_profile`, `brand_shares`, `brand_canvases` (ONE jsonb doc
  per canvas — see the pitfall below), `brand_canvas_versions` (the previous
  doc on every change, 20 deep, written by a `before update` trigger;
  readable through RLS by whoever may read the canvas, never writable from
  the browser)
- **Misc:** `notifications`, `reminders`, `calendar_events`, `notes`, `push_subscriptions`, `short_links`, `os_visuals`, `workspace_links` (the Browse tab of the file manager: url, title, note and a `folder_id` into **`link_folders`** (its own table so a folder can be empty and still exist; every workspace is seeded with Skills / Tools / Inspirations / Resources by an `after insert` trigger on `organizations`). `category` is the free-text grouping folders replaced, kept for one release and no longer written, and `note` is the hand-typed note the page's own `description` replaced. Neither `description` nor `note` is displayed any more: the page's own description ran to several lines on most sites, so a row is the title and the host. `description` is still fetched and stored. `visibility` is `workspace` (the default) or `private`, and private is enforced by the SELECT/UPDATE/DELETE policies, not by the client - `docs/link-visibility-rls-check.sql` proves it against production and rolls itself back. Org- and project-scoped like everything else. Saving a link also stores what the page says about itself: `favicon` is a **data: URL** fetched server-side and kept inline, so drawing the list makes no request to the linked site; `image_url` is the og:image, kept remote on purpose and to be rendered through `api/img-proxy`; `site` is og:site_name. Rows saved before this fill themselves in on load, 8 at a time, and a row counts as already asked once ANY of favicon/image_url/description/site is set - some sites have no icon at all, and without `site` in that test their rows are re-fetched forever.

  **Starter links.** `link_defaults` (url unique, RLS on with zero policies) holds the set every workspace begins with, folder name and all, favicons inlined so a new workspace draws its Browse tab without a single outbound request. `seed_link_folders()` copies them in. It must clear `request.jwt.claims` around that insert and restore it straight after: `workspace_links` carries `enforce_read_only`, most new workspaces have no plan yet, and leaving the claim in place makes creating a workspace fail outright with `i7os_read_only` - measured, not assumed. To change what new workspaces get, edit `link_defaults`; existing workspaces are never re-seeded)
- **Messenger bridge:** `messenger_links` (a link belongs to a PERSON, not a
  workspace — `provider` is `telegram` or `slack`; the Slack rows also carry
  `slack_team_id` and `slack_user_id`, and `chat_id` is the DM channel),
  `slack_installations` (bot token per Slack workspace, service key only), `messenger_link_tokens` (one-time,
  10 min, minted by the `create_messenger_link_token` RPC). An `after insert`
  trigger on `notifications` calls `/api/telegram` through **pg_net**, with the
  shared secret read from **Vault** (`telegram_hook_secret`). No secret, no call —
  which is what makes the trigger safe to ship before the bot exists.

Storage buckets: `brand-assets` (also whiteboard image uploads under `whiteboards/<orgId>/…`), `user-files`, `chat-attachments`, `project-logos`, `os-visuals`.
RPCs: `accept_project_invitation`, `delete_organization`, `redeem_push_setup_token`, `remove_org_member` (an admin removes somebody from a workspace: org_members AND their project_members in that org AND any pending invite — the browser cannot do the second, since project_members may only be deleted by the project's owner; refuses self, refuses the workspace owner) (api/redirect also calls a click-count RPC).
Realtime channels: `wb-<boardId>` (whiteboard items), `chat-<convId>`, `team-calendar-<orgId>`, `canvas-<canvasId>` (Artboards: cursors AND the
document itself — `brand_canvases` is deliberately NOT in the realtime
publication, so canvas collaboration rides entirely on broadcast).

## Serverless functions (`api/`)

`chat-multi` (unified Claude/OpenAI/Gemini chat), `fetch-brand` (multi-mode POST/GET: brand analysis / weather / preview / **`mode:"pdf"`** brand-book PDF parse / **`mode:"zip"`** brand-package ZIP inspect), `send` (multi-mode POST, dispatched by `mode`: `"invite"` / `"project-invite"` / `"push-setup"` email via Resend, `"push"` web-push via VAPID), `google-fonts` (CORS proxy, **edge**), `img-proxy` (CORS image proxy for PDF export, **edge**), `drive-download` (**edge**), `workspace-delete` (**edge**: admin-only; wipes ALL of a workspace's storage assets via the service key — using the `org_storage_objects` RPC — then deletes the org so nothing is left on the server), `redirect` (short links `/i/:slug`), `share` (**edge**: `/s/<token>` public link, rewritten in vercel.json. Answers the SAME url as html, `?format=json` or `?format=md`, and embeds the json inside the html. This exists because the app's own share route is the SPA: fetched without a browser, `?b=<token>` is 1439 bytes of empty shell, so a link handed to an agent carried nothing. Reads `public_shares` with the service key), `refresh-token` (Google OAuth), `tts`,
`slack` (**edge**: the second messenger, sharing `server/messenger.js` with
Telegram. Verbs: `?mode=install&state=<one-time token>` sends somebody to
Slack's consent screen, `/slack/callback` (rewritten in vercel.json) brings them
back, `?check=1` says whether it is configured, POST with `x-i7-hook-secret` is
the notifications trigger and POST with `x-slack-signature` is a button press.
Unlike Telegram, Slack hands out a bot token PER workspace, stored in
`slack_installations` — service key only, RLS on with zero policies. Needs
`SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`),
`telegram` (**edge**: one bot for the whole product; the Telegram webhook and
the notifications fan-out in one file, told apart by their auth header. Four
GET verbs, and **you can run the first two yourself, they need no secret**:
`?check=1` reports the wiring as booleans, `?wire=1` repairs it and does nothing
when nothing is wrong, `?setup=<TELEGRAM_HOOK_SECRET>` forces the full
registration including the bot's name and descriptions. Buttons under a
notification only arrive when `callback_query` is in `allowed_updates`, which is
what `?check=1` answers. The bot's profile PICTURE cannot be set by the API at
all, only in BotFather; `public/i7os-bot-avatar.png` is the file for it), `pinterest` (**edge**: both directions, one connection per WORKSPACE in `pinterest_connections` (service key only, RLS on with zero policies). `?check=1` reports the wiring and needs no secret, `?mode=install&state=<one-time token>` sends somebody to Pinterest's consent screen and `/pinterest/callback` (rewritten in vercel.json) brings them back; the state is the same `create_messenger_link_token` token Telegram and Slack use, which already carries an `org_id`. POST modes: `status` / `disconnect` / `boards` / `pins` / `create-pin`, each behind a bearer token that has to resolve to a member of that workspace - an `orgId` in a body proves nothing, it is in every share link. `create-pin` takes either a public `imageUrl` that Pinterest fetches itself or `imageBase64` bytes, which is what the private `user-files` bucket needs. Access tokens last 30 days and refresh tokens 60, renewing themselves, so `usableToken` refreshes a day early and writes `last_error` when it cannot. Creating a pin needs **`boards:write`** as well as `pins:write` - the scope table does not say so and Pinterest answers 401 `Missing: ['boards:write']` at the moment the pin is posted; `boards:write_secret` likewise for a secret board. A token keeps the scopes it was issued with, so widening the list strands every existing connection: `scopesBehind` compares them and `status` returns `scopes_missing`, which the Settings row turns into "disconnect and connect again". **Reading production works on Trial access; creating pins does not** - Pinterest answers 403 `Apps with Trial access may not create Pins in production`, and only Standard access (their review) changes that, so `create-pin` maps it to `code: "trial_access"` rather than letting it look like a bug in the composer. Needs `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`), `zernio` (multi-mode POST, social integration via Zernio: `status`/`connect`/`disconnect`/`analytics`/`presign`/`post` — see `docs/zernio-integration.md`). Plus billing (Stripe): `billing-status`, `create-checkout-session`, `create-customer-portal-session`, `stripe-webhook`.

Also `lifecycle-sweep` (**edge**, daily Vercel Cron via `vercel.json`): warns, then purges storage, then deletes rows of workspaces whose owner has had no plan for 30/90 days (60/180 if they ever paid). Disarmed unless `LIFECYCLE_PURGE_ENABLED=true`.

**🚨 Function budget — the cap is REACHED.** Vercel Hobby allows **12 Serverless (Node)** functions and the last production deploy reported exactly `nodejs: 12`. **A new Node function will break the deploy.** **Edge** functions (`export const config = { runtime: "edge" }`) don't count — there are 5. To add an endpoint you must either add a `mode` to an existing multi-mode file (`fetch-brand`, `send`, `zernio`) or write it as Edge. Verify with:

```bash
for f in api/*.js; do grep -q 'runtime:\s*"edge"' "$f" || echo "$f"; done | wc -l
```

`stripe-webhook` needs the raw body — keep it standalone, never fold it into a bundle. Edge functions can't use the Node Stripe SDK's webhook verification, so that one has to stay Node.

Env vars (Vercel): `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `FISH_API_KEY`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, `PUBLIC_APP_URL`, `CRON_SECRET` (lifecycle sweep; Vercel sends it as the cron `Authorization` header automatically), `LIFECYCLE_PURGE_ENABLED`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, six `STRIPE_PRICE_…`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (Telegram → us, set via setWebhook's `secret_token`), `TELEGRAM_HOOK_SECRET` (the DB trigger → us; the same value lives in Vault as `telegram_hook_secret`). Client-side: `VITE_GOOGLE_API_KEY`, `VITE_GOOGLE_APP_ID`, `VITE_TELEGRAM_BOT` (bot username; the whole Telegram section stays hidden while it is unset).

## Verifying a deploy

`npx vite build` proves nothing about the `api/` functions — Vercel bundles those separately with its own dependency tracing. An import chain like `api/billing-status.js → server/billing.js → src/entitlements.js` can pass the local build and still fail in production.

After a deploy, smoke-test the endpoints unauthenticated and read the shape of the error, not just the status:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://app.i7os.com/api/billing-status -H "Content-Type: application/json" -d '{"orgId":"00000000-0000-0000-0000-000000000000"}'
```

**Do NOT check whether a push is live by comparing the bundle filename.** A
local `npx vite build` and Vercel's build of the SAME commit produce different
`dist/assets/index-<hash>.js` names, so waiting for the local hash to appear on
app.i7os.com waits forever. This cost three false "not deployed yet" readings in
one session, and led to a hunt through the Vercel API for a broken alias that was
never broken. Check the CONTENT instead, with a string only the new code has:

```bash
curl -s https://app.i7os.com/assets/$(curl -s https://app.i7os.com/ | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -1) | grep -c "SOME_NEW_STRING"
```

Minification inlines module constants, so grep for a **string literal**
(`"BILD WIRD ERSTELLT"`, a localStorage key), never for an identifier. A
function name is renamed by the minifier and greps as absent even when it
shipped, which has now produced two false "not deployed" readings.

A change with no user-visible string has no literal to grep. Ask a function
instead: `api/pinterest?check=1` and `api/slack?check=1` both report
`VERCEL_GIT_COMMIT_SHA`, so the deployment says which commit it is, and
`git merge-base --is-ancestor <commit> <live>` answers whether it contains
yours. That is a fact rather than an inference from a bundle.

The Vercel CLI's token is at `~/Library/Application Support/com.vercel.cli/auth.json`
and answers what actually happened, no browser needed. Project
`prj_280CqRlcOd8N2WiRQ6l3E9XxWZbE`, team `team_WwuqpIITCDIiqLcDCVmEkU73`;
`/v6/deployments?projectId=…` lists state per commit and
`/v3/deployments/<id>/events` is the full build log.

**401 = good** (the function loaded and rejected the request). **500 = the module failed to resolve.** The same trick reveals missing env vars: `lifecycle-sweep` answers 503 when `CRON_SECRET` is absent and 401 when it is set.

## Local development

- `npm run dev` → Vite only, **http://localhost:5173** (no `api/` functions).
- `npm run dev:vercel` → `vercel dev`, **http://localhost:3000** (app + serverless functions).
- Both origins (5173 AND 3000) must stay registered in any origin/referrer allowlists (Google OAuth, Supabase auth redirects).
- "Port 3000 startet nicht" usually means a stale `vercel dev` still holds the port: `lsof -ti:3000 | xargs kill`.
- The app requires Supabase login — you cannot browse past the login screen without credentials, so verify UI changes via the production deploy or ask the user.

## Whiteboard (Brainstorm) — the most intricate view

FigJam-style infinite canvas (`WhiteboardView`), reachable via Erstellen → Brainstorm (`openBrainstorm`) or `?wb=<boardId>` deep link.

**Collab model:** one DB row per element (`whiteboard_items`: `id`, `board_id`, `type`, `data` jsonb). Optimistic local updates with client-generated `crypto.randomUUID()` ids; realtime echoes deduped by id; last-write-wins. Realtime UPDATEs are skipped for elements currently in a local drag (`dragRef.current.id` OR a key of `dragRef.current.bases` for group drags) or being edited (`editingRef`).

**Item types:** `sticky`, `rect`/`ellipse`/`diamond`/`triangle` (shapes), `text`, `draw` (pen paths with `ox/oy` offset), `arrow` (x1/y1/x2/y2), `image`, `sticker`, `emoji`, `comment` (pin with @-mentions → notifications), `link` (mind-map connector: stores only `fromId`/`toId`, endpoints derived live from both nodes' bboxes in `renderLink`/`bboxOf`).

**Text nodes — hard-won invariants (do not regress):**
- Display div uses `white-space: pre` + `overflow: visible` + `wordBreak: normal`. NEVER `pre-wrap` on an auto-fitted text node — a 1px-too-narrow box reflows the last word onto a hidden second line ("words disappear" bug).
- Box auto-fits via `wbFitTextBox` → `wbMeasureLines`, which measures with a **hidden DOM mirror element** (`wbGetMirror`), NOT canvas `measureText()` (different rendering path; disagrees by px, especially before the Geist font loads). Width = fractional `getBoundingClientRect().width` rounded UP + safety buffer.
- The edit `<textarea>` uses `wrap="off"`; `onInput` live-refits but never below the textarea's own `scrollWidth`; `commitText` recomputes the box from the final text (never trusts the last onInput patch — they race).
- Enter inserts a newline (plain text field); editing ends on blur/Escape only. `flushEdit` saves before the editor unmounts (React doesn't reliably fire onBlur on unmount).
- Mind-map is **opt-in**: branch "+" handles appear only when `data.mindmap` is truthy or the node already has links. The toolbar mind-map button toggles the flag. First branch bumps the root one size tier; branches are uniform size. Dragging any connected node moves the whole group (`mindmapGroup` BFS over links); hovering shows a dashed group frame.
- Deleting a node cascades to its attached `link` rows.

**Selection:** `sel` (single) + `selIds` (multi, marquee). ⚠ The Delete key deletes every id in `selIds` straight from the DB — any code path that switches boards MUST clear `selIds` (see `openBoard`/`createBoard`).

**Canvas:** camera `{x, y, s}`; wheel = pan, ctrl/cmd+wheel = zoom around cursor. The dot grid lives on its own layer (first child of the canvas div) and fades out at the bottom via CSS `maskImage` — do not switch back to a colored overlay gradient (reads as a hard edge) and do not give it a z-index (it would cover items/UI). No `setPointerCapture` on item pointerdowns — capture retargets compatibility mouse events and kills double-click-to-edit (double-click is detected manually: two pointerdowns on the same item within 400 ms).

**Images:** toolbar image button opens a 2-option menu — upload (→ `brand-assets` storage) or "Aus Assets" (org's `user_files` images, server-side filtered `mime_type like image/%`). Both funnel through `addImageFromUrl` (natural aspect, max 420px wide, viewport-centered).

## Known pitfalls checklist (quick reference)

- `pre-wrap` + auto-fit text box → clipped words. Use `pre` + `overflow: visible`.
- Canvas `measureText()` vs DOM rendering → use the DOM mirror.
- Framer Motion clobbers your positioning `transform` → plain wrapper div.
- StrictMode double-run + cancel-guard + tried-ref → dropped results in dev.
- Stale `selIds` across board switches → cross-board DB deletes.
- Group drags have no `dragRef.id` → check `dragRef.bases` too when guarding realtime.
- Vercel Hobby: max 12 serverless functions → extend `fetch-brand.js` modes instead of adding files.
- **Never sync an Artboard document live between clients.** A canvas is ONE
  jsonb doc, so the only thing a peer can send is the whole of it, and a
  window that has been open a while holds an OLD whole. Absence of an
  element in a snapshot is indistinguishable from deletion: this shipped on
  2026-08-26, read a stale peer's doc as "they deleted everything", and
  saved it. Cursors over `canvas-<id>` are fine. Real co-editing needs one
  row per element like `whiteboard_items`. The tell in a damaged row: board
  name and bg survive, `items` is `[]` — check `brand_canvas_versions`.
- `whiteboards.updated_at` is only bumped by title edits, not item changes.
- Lists that mix saved DB rows with unsaved local rows (`_localId` pattern, e.g. the Kanban new-task checklist) must never compare raw `item.id` — `undefined === undefined` matches every unsaved row. Use an identity helper (`id ?? _localId`) and skip DB calls for unsaved rows.
- Deep-link props like `openTaskId` stay set while the view is open — effects that auto-open something from them must guard with a "handled" ref or they re-fire on every dependent state change.
- supabase-js builders are LAZY: `supabase.from(...).update(...).eq(...)` without `await` or `.then()` never sends the request. Fire-and-forget calls must end in `.then(() => {})` (this silently broke Timeline drag persistence).
- Modals that seed their state from props via `useState` initializers (e.g. `TimelineItemModal`) need a subject-derived `key` — swapping the subject without unmounting keeps the old state.
- Views that scope data client-side for non-admins (e.g. Timeline project scoping) must apply the same scoping in every refetch path, not just the initial load.
- **Cutting a block out of App.jsx by two markers: search the END marker FROM the start index, and assert the slice is non-empty.** `s.index(end)` searches from 0 and readily finds an earlier copy — the slice comes out empty, `replace("", new)` inserts at position 0, and the block lands at the top of the file outside every component. It builds green (the syntax is fine) and dies at load with a ReferenceError on whatever local it referenced. This has now happened twice, most recently cutting the rectangle's corner-radius panel with `{isText && (<>` as the end marker, which also appears earlier in the floating toolbar.
- **A multi-line supabase-js chain defeats a single-line grep.** `supabase.from("organizations")\n  .insert({…})` will NOT match `from("organizations").insert`. Grep the table name alone, then read the hits. This produced a wrong "that feature doesn't exist" claim (golden rule 2).
- **Neither are CHECK constraints.** `moodboard_items.source` is a whitelist (`upload/file/ai/url/web/pinterest`) and so is `type`; writing a new value fails at INSERT with `violates check constraint`, long after the code looks right. Read `pg_get_constraintdef` before inventing a value for an existing column, the same way you read `information_schema.columns` before naming one.
- **`brandProfile` in the App root is a CACHE, not the brand.** It is loaded once per workspace for the AI context and handed to `CreationsView` as a prop, while Brand, Touchpoints and Assets each load their own copy. Change the brand and only Creations keeps showing the old one until a reload. It is re-read on the way out of the brand view; anything else that consumes the prop inherits that timing.
- **Column names are not guessable.** `tasks` uses `creator_id`, not `created_by`; `task_comments` stores `text`, not `content`. Read `information_schema.columns` before writing a query or a test — a wrong column name inside a plpgsql `EXCEPTION` block looks exactly like the trigger you were trying to test.
- **A `position: fixed` overlay inside a view whose root is an animating `motion.div` is NOT full-screen.** Framer leaves a `transform` on the element, and a transformed ancestor becomes the containing block for fixed-position descendants — the backdrop then covers only that view's box. Measured: 900×460 viewport, the same overlay comes out 900×460 without a transformed ancestor and 400×300 with one. Portal such overlays to `document.body` (with `AnimatePresence` INSIDE the portal, never around it).
- **Never wrap `createPortal` in `<AnimatePresence>`.** AnimatePresence tracks its children and drops the ones it cannot, and a portal is one of those — the overlay is built and then discarded before it reaches the DOM, so the trigger looks like a dead button. Proven in an isolated repro against this React/Framer pair: wrapped → absent, direct → present. Every working overlay in the app (`ChannelPreview`, `ImageInsertModal`, the canvas editor, the whiteboard's context menu) portals directly.
- New overlays must clear the app's real z-index ceiling: overlays reach **100002**, and the workspace-create modal alone sits at 9999. A modal placed at 4000 renders behind the very dialog that opened it (the upgrade dialog now uses 100003, the canvas editor 100004). **`ImageInsertModal` sits at 100010 on purpose** — it is opened FROM those overlays, so it has to clear all of them. It was at 100000 and opened invisibly behind the channel preview; the click worked, the modal rendered, nobody could see it.
- Anything `position: fixed` at the top of the viewport collides with the dashboard's top-right bar (bell/weather, `top: 16`). The read-only banner shifts that bar to `top: 52` while visible.
- **A share link that only a browser can read is not a share link.** The SPA renders `?b=` client-side; `curl` gets the shell. Anything meant for an agent, a crawler or a chat preview has to be answered by a function, not by the app.
- Vercel Cron only fires on **production** deployments, and Hobby allows one run per day. A cron entry in `vercel.json` does nothing on Preview.
- Trigger logic can be tested safely against production: wrap test inserts in a plpgsql `BEGIN … EXCEPTION` block that ends with `raise exception 'undo'` — the savepoint rolls everything back. To make `auth.uid()` return a user inside such a test, `perform set_config('request.jwt.claims', json_build_object('sub', <uuid>)::text, true)`.
