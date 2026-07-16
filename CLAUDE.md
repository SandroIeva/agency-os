# i7 OS (Agency OS) — Working Guide for AI Assistants

Multi-tenant workspace OS for creative agencies. React 19 + Vite SPA, Supabase (Postgres/Auth/Storage/Realtime), Vercel serverless functions. Deployed as Vercel project **`agency-os`** → **app.i7os.com**. UI language is German-first, bilingual de/en.

## Golden rules (violating these has caused real regressions)

1. **Almost everything lives in `src/App.jsx` (~32k lines).** This is intentional. Do NOT split it into files unless explicitly asked. Navigate by searching for component names (`function WhiteboardView`), not line numbers — they shift constantly.
2. **Verify before shipping:** `npx vite build` must end with `✓ built` (cold build takes ~8–9 min; warm cache can be seconds — both are normal). There are no tests; the build is the gate.
3. **Deploy = push:** committing to `main` and pushing triggers the Vercel deploy. Commit messages end with `Co-Authored-By: Claude <model> <noreply@anthropic.com>`.
4. **Language:** every user-visible string AND every AI-generated output must respect `appLanguage` (`de`/`en`), usually via the local `const de = appLanguage === "de"` or the `t(...)` translations helper (`src/translations.js`). Never hardcode German (or English) in new UI.
5. **Design system:**
   - No purple/lilac accents. Active/selected states use anthracite **`#15151c`** (dark pill, white text). Exception: in dark mode the main nav menu's selected pill is *inverted* (light bg `rgba(244,244,247,0.95)`, text `#15151c`).
   - Use the shared **`<Dropdown>`** component in App.jsx for any select/menu. Never a native `<select>`, never a one-off menu.
   - Primary action buttons belong in the **top-right header slot** of a view (some views expose a `headerSlotRef` portal target for embedded tabs).
   - Controls must never sit flush against a container edge — keep inner padding (esp. select chevrons).
   - Speech-to-text UI: a "Diktieren" link (mic icon + label) ABOVE the field, right-aligned; turns into red "Stopp" while recording.
   - Fonts: `FONT` constant (`'Geist', -apple-system, sans-serif`). Framer Motion for animation, `createPortal` for overlays.
6. **React StrictMode is ON** (`main.jsx`). One-shot effects must tolerate double-invocation; do NOT pair a cancel-on-cleanup guard with an "already tried" ref — in dev that combination silently drops the result.
7. **Framer Motion transform trap:** never put positioning transforms (`translateX(-50%)`) on a `motion.div` that also animates `x/y/scale` — Framer overwrites the whole `transform`. Put positioning on a plain wrapper div (see the sticker/emoji/asset pickers for the pattern).

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
docs/docs-skillz/*/SKILL.md ← content "skills" imported ?raw into the app
vercel.json              ← cleanUrls, SPA rewrite, /i/:slug → api/redirect (short links)
```

## App.jsx internal structure

Top-level function components, in file order (search by name): `createSoundEngine`, `DotGrid`, `AISphere`/`AISpeakingSphere` (Three.js orb), `Dropdown`, `ImageLightbox`, `ChatBubble`, `KanbanBoard`, `TimelineView` (+`TimelineItemModal`), `WhiteboardView` (Brainstorm), `CalendarView`, `FilesView`, `ChatView`, `NotesView`, `ProjectsView`, `PeopleTab`, `TouchpointsView`, `IdeasTab`, `AssetsView` (+`CreationsTab`, moodboards), `DocEditor` (BlockNote-based docs with comments/mentions), `BrandView` area, Settings, and the root `App` component (auth, org, nav, dashboard, voice orb) at the bottom.

Navigation is state-based (`currentView` string in `App`), not a router. The main menu is the "linear menu" (`LINEAR_MENU_ITEMS_DEF`, rendered via portal in `App`): left column categories, right column sub-items.

Brand structure: ONE shared `BrandView` scoped by `projectId` — `projects.is_brand` toggles a per-project brand workspace. Public brand sharing = `brand_shares` snapshot table + `?b=<token>` route; the snapshot is frozen until the user clicks "Aktualisieren".

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
- **Brand:** `brand_profile`, `brand_shares`
- **Misc:** `notifications`, `reminders`, `calendar_events`, `notes`, `push_subscriptions`, `short_links`, `os_visuals`

Storage buckets: `brand-assets` (also whiteboard image uploads under `whiteboards/<orgId>/…`), `user-files`, `chat-attachments`, `project-logos`, `os-visuals`.
RPCs: `accept_project_invitation`, `delete_organization`, `redeem_push_setup_token` (api/redirect also calls a click-count RPC).
Realtime channels: `wb-<boardId>` (whiteboard items), `chat-<convId>`, `team-calendar-<orgId>`.

## Serverless functions (`api/`)

`chat-multi` (unified Claude/OpenAI/Gemini chat), `chat` (legacy, server-side Anthropic key), `fetch-brand` (multi-mode: brand analysis / weather / …), `fetch-brand-pdf`, `fetch-brand-zip`, `google-fonts` (CORS proxy), `img-proxy` (CORS image proxy for PDF export), `drive-download`, `redirect` (short links `/i/:slug`), `refresh-token` (Google OAuth), `send-invite`, `send-project-invite`, `send-push-setup`.

Env vars (Vercel): `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `FISH_API_KEY`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, `PUBLIC_APP_URL`. Client-side: `VITE_GOOGLE_API_KEY`, `VITE_GOOGLE_APP_ID`.

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
- `whiteboards.updated_at` is only bumped by title edits, not item changes.
