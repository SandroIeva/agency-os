---
description: Integrations connect i7OS to the tools your team already works with.
---

# Platform integrations

You find all of them in **Settings → Account → Integrations**. Many can also be connected right where you need them, for example the first time you import something from Notion.

### Overview

| Integration                         | What you can do                                                            | Connected for |
| ----------------------------------- | -------------------------------------------------------------------------- | ------------- |
| Google Calendar & Drive             | Show and create events, bring in files and Google Docs, upload to Drive    | You           |
| Notion                              | Import pages as documents and tasks into Kanban                            | Workspace     |
| Figma                               | Paste frames into Artboards as editable elements                           | Workspace     |
| Pinterest                           | Turn boards and pins into moodboards                                       | Workspace     |
| Social channels                     | Analytics and publishing for Instagram, LinkedIn, Threads, X and Pinterest | Workspace     |
| Instagram, Threads, TikTok (direct) | Publish straight through the platform                                      | Workspace     |
| Slack                               | Notifications as direct messages, tasks and links from a chat              | You           |
| Telegram                            | Notifications, tasks and links through the i7OS bot                        | You           |
| AI providers                        | Claude, ChatGPT and Gemini for the assistant and creative workflows        | You           |

### Files and calendar

#### Google Calendar & Drive

Google Calendar and Google Drive are available when you sign in to i7OS with your Google account. In Settings the row then reads **Calendar & files synced**.

**Google Drive** lets you:

* import documents and Google Docs under **Documents → Create new → Import from Google Drive**
* bring images, videos and files into Media with **From Google Drive**
* pick individual files or connect a shared folder
* upload i7OS files to Drive
* keep files linked to the work they belong to

**Google Calendar** shows your events in the calendar and on the dashboard. A new appointment is also created as a Google Calendar event, so you get a reminder on your phone at the right time.

If the connection is lost, Settings shows **Connection lost**. Connect Google again there and everything runs as before.

### Content and design

#### Notion

Bring your existing Notion content into i7OS. The connection belongs to the workspace and only reads: i7OS never changes anything in Notion.

**Connect:** Click **Connect** next to Notion. Notion then asks which pages i7OS may see. Select the pages or teamspaces you want to import. A page you share also shares everything below it, so selecting a top-level page is usually enough. To share more pages later, open the page in Notion and add i7OS under **••• → Connections**.

**Import pages as documents:** Go to **Documents → Create new → Import from Notion**. Your pages appear in the same structure as in Notion, with folders you can open. Text, headings, lists, tables and images are carried over. Images are copied into your workspace, so they stay visible even after Notion's own links expire.

**Import tasks into Kanban:** In Kanban, open **New task → Import from Notion**. i7OS lists the entries from your Notion task databases. Pick the ones you want and they become cards on the board:

* title, status, priority and due date are carried over
* to-dos on the Notion page become checklist items on the card
* the rest of the page becomes the task description
* importing again only adds tasks that are not on the board yet

#### Figma

Bring designs from Figma into your Artboards as editable elements. The connection belongs to the workspace and only reads your files.

**How it works:**

1. In Figma, select a frame and copy the link to it (right click → **Copy link to selection**).
2. Open an Artboard in i7OS and paste the link with **⌘V** (Mac) or **Ctrl+V** (Windows).
3. The frame arrives as shapes, text, images and vectors that you can keep editing.

After the import, i7OS tells you how many elements arrived and whether anything had to be simplified, for example a blur effect or a gradient type the Artboard does not have.

**Good to know:** Figma limits how often its files can be read. With a Collab or View seat that is only about 20 reads per month. For regular imports, connect with an account that has a Full or Dev seat. Pasting the same link again is served from the cache and does not count.

#### Pinterest

Use Pinterest as a source for your moodboards. The connection belongs to the workspace.

In **Brand → Creations → Moodboards** you can:

* create a moodboard from a Pinterest board, including all its pins
* add individual pins to an existing moodboard
* sync a moodboard with its Pinterest board to add new pins

Syncing only adds. A pin you delete on Pinterest stays on the moodboard, because a moodboard often holds more than what came from Pinterest. Pins stay linked to Pinterest and use none of your storage.

### Social media

Connect your social accounts to see their performance and publish content from i7OS.&#x20;

**Supported channels:**

* Instagram
* LinkedIn
* Threads
* X (Twitter)
* Pinterest

Accounts are connected in **Audience** or directly in the post composer, and belong to the whole workspace. Only workspace administrators can connect or disconnect an account, which protects shared brand accounts. Which numbers are available depends on the platform and the account type.

See [The Social media layer](https://i7os.gitbook.io/i7os-docs/brand-workspace/the-social-media-layer) for planning, publishing and analytics.

#### Instagram, Threads and TikTok (direct)

Besides the social channels above, i7OS can also publish straight through the platform itself:

* **Instagram:** publish posts and read the account's numbers
* **Threads:** publish posts, text-only posts included
* **TikTok:** publish videos straight from i7OS

These direct connections are being rolled out step by step and are currently available for selected workspaces. Once they are enabled for your workspace, they appear in **Settings → Account → Integrations**.

### Messengers

Slack and Telegram bring i7OS to where your team already talks. Both connections belong to you, not to the workspace: every person connects their own.

#### Slack

After connecting, your i7OS notifications arrive as direct messages in Slack. Each message has buttons, so you can move a task to another column or hand it to someone without opening i7OS.

You can also write to the i7OS app in Slack:

* send a short text and i7OS turns it into a task, asking a few questions on the way
* send a link on its own and i7OS saves it to one of your link folders

If Slack asks for new permissions after an update, Settings tells you. Disconnect once and connect again.

#### Telegram

Telegram works through the i7OS bot. Connect once and it works for every workspace you belong to, later ones included.

* Everything that reaches the notification bell also reaches you in Telegram, with the same buttons as in Slack.
* Send a text to create a task, or a link to save it.
* In Settings you decide whether the bot sends anything at all, and which kinds of notifications you want.

**Connect:** Click **Connect** next to Telegram. Telegram opens. Press **START** there and the connection is done.

### AI providers

Connect Claude, ChatGPT or Gemini in **Settings → AI & Models**. You use your own API key, which is stored for your account and never shown again after saving. The selected provider then powers the i7OS assistant and supported creative workflows.

See [Connect AI Providers](https://i7os.gitbook.io/i7os-docs/connect-ai-providers) and [Brand Intelligence](https://i7os.gitbook.io/i7os-docs/brand-workspace/brand-intelligence) for guidance.

### Access and permissions

* **Workspace integrations** (Notion, Figma, Pinterest and the direct Instagram, Threads and TikTok connections) can be connected by any member of the workspace. Everyone in the workspace then uses the same connection.
* **Social channels** can only be connected or disconnected by a workspace administrator.
* **Personal integrations** (Google, Slack, Telegram and your AI keys) belong only to you. Nobody else in the workspace can see or use them.

### Troubleshooting

If an integration stops working:

1. Check the status in **Settings → Account → Integrations**. A connection that has expired or is missing permissions says so there.
2. Make sure you are signed in to the right external account.
3. Disconnect the service and connect it again.
4. Check that your role in the workspace allows the action.
5. Try the action again once the connection is back.

For Notion: if a page is missing from the import list, it was not shared with i7OS. Open it in Notion and add i7OS under **••• → Connections**.
