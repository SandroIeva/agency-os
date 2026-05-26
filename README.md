# i7 OS — Agency Operating System

Workspace-aware operating system for creative agencies. Multi-tenant, real-time, Google-integrated.

Built with React 19, Vite, Supabase, Framer Motion, Three.js, and the Web Audio / Web Speech APIs.

## Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + Framer Motion |
| Auth & DB | Supabase (Postgres + RLS) |
| Storage | Supabase Storage + Google Drive (drive.file scope) |
| Calendar | Google Calendar API |
| 3D / Visuals | Three.js with custom GLSL shaders |
| Speech | Web Speech API (de-DE / en-US) |
| Build | Vite |
| Hosting | Vercel |

## Views

| View | What it does |
|------|--------------|
| **Dashboard** | Circular scroll-to-navigate hub with 6 categories × 6 sub-items |
| **Chat** | Team, channels, AI assistant |
| **Plan → Kanban** | Project boards with tasks, subtasks, checklists, assignees, priorities |
| **Plan → Timeline** | Sprint planning gantt with project bands, sprint groups, cascade-shift, quick-create tasks |
| **Plan → Calendar** | Google Calendar integration + team events + tasks-as-events |
| **Brand** | Identity, design tokens, audience, channels, strategy |
| **Files** | Dual storage (Supabase + Google Drive folder picker), virtual folders |
| **Docs / Notes** | Markdown notes per workspace |
| **Settings** | Workspace logo, team invites, members, integrations, LLM keys |

## Timeline — Sprint Planning

Per-project sprint bands with auto-lane stacking. Drag bars to reschedule, drag the grips to resize. Status is derived live from the date range (planned / active / done).

- **Sprint groups** — a single sprint can belong to a named group (e.g. "App Building"). Moving one sprint in a group cascade-shifts all later sprints in the same group.
- **Quick-create tasks** — inline `+ Task erstellen` field in the sprint modal; pending tasks are buffered and created together with the sprint on save, then auto-linked.
- **Linked Kanban tasks** — pick existing tasks from the workspace; arrow icon jumps straight into the Kanban detail.
- **Checklists** — per-sprint to-do list, independent of linked Kanban tasks.
- **Folge-Sprint button** — `+` next to the sprint title chains a follow-up sprint with same project, same group, dates pre-filled.
- **Holiday overlay** — toggle in timeline settings; weekends and German national holidays are tinted in the grid.
- **Dictation** — mic icon on the description textarea for speech-to-text (Chrome / Safari).

Card title shows `Sprint Title` with a small `↩ Group name` underneath. Status dot: gray = planned, light blue = active, green = done.

## Workspace

Each user belongs to one or more `organizations` (workspaces). Switcher in Settings.

- **Logo** — upload in Settings → Workspace card. Shown in sidebar header and workspace switcher.
- **Team** — invite by email, role-based (Admin / Member).
- **Project members** — separate `project_members` join table determines who shows up in each project's team strip.
- **Org-level Drive folder** — admin connects a shared Google Drive folder for `Files` uploads.

## Auth & Data Model

- Google OAuth (Supabase). `drive.file` scope only — no CASA audit needed; per-file access via Google Picker.
- All workspace data lives behind RLS policies scoped to `org_members`.
- Real-time subscriptions for chat, calendar, tasks.

## Key Tables

```
organizations         (id, name, slug, logo_url, drive_folder_*)
org_members           (org_id, user_id, role)
projects              (id, org_id, name, color, logo_url)
project_members       (project_id, user_id)
tasks                 (id, org_id, project_id, column_key, …)
task_checklist_items  (task_id, text, done, position)
timeline_items        (id, org_id, project_id, group_id, start_date, end_date, …)
sprint_groups         (id, org_id, name, project_id)
timeline_item_*       (assignees, tasks, checklist) — join tables
calendar_events       (id, org_id, …)
user_folders          (virtual folders inside Supabase Storage)
```

## Getting Started

```bash
# 1. Copy .env.example → .env.local and fill in
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_API_KEY=     # for Drive Picker
VITE_GOOGLE_APP_ID=      # optional

# 2. Install & run
npm install
npm run dev

# 3. Build
npm run build
```

Supabase project ID for this app: `oidbemeetiawiahpweyg`.

## Project Context

This is the production codebase for **i7 OS**, the operating system for creative agencies. The original circular menu lives on as the Dashboard view; the rest of the app has grown into a full workspace platform.

Marketing site lives in a separate repo (`i7os-marketing`) deployed independently on Vercel.

## Author

**Sandro Ieva** — [sandroieva.com](https://sandroieva.com)

## License

Private — All rights reserved.
