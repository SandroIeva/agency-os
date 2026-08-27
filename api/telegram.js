// Telegram bridge. ONE bot serves the whole product — there is no per-workspace
// installation, which is the entire reason Telegram comes before Slack. A link
// belongs to a PERSON, so joining another workspace later needs no second setup;
// the message says which workspace it came from.
//
// Edge runtime → does NOT count against the Hobby 12-function Node limit, and
// everything here is a plain fetch to api.telegram.org.
//
// Two callers, told apart by their header, and nothing else is answered:
//   x-telegram-bot-api-secret-token  → Telegram's webhook (set via setWebhook)
//   x-i7-hook-secret                 → the notifications trigger, through pg_net
import { createClient } from "@supabase/supabase-js";
// The SAME renderer the app's bell uses. A notification row holds data, and
// this turns it into a sentence for whoever is reading it — here, in the
// language of the chat it is being sent to. Two copies of this table would
// drift, and the drift would be a German sentence under English buttons.
import { notifLines } from "../src/notificationText.js";

export const config = { runtime: "edge" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

// Which notifications are worth a phone buzzing. Chat messages are off by
// default on purpose: one Telegram message per chat line is unbearable after a
// day, and image_ready fires while you are already looking at the app.
const DEFAULT_TYPES = {
  task_assigned: true,
  comment_mention: true,
  comment_added: true,
  project_added: true,
  member_joined: true,
  storage_warning: true,
  chat_message: false,
  image_ready: false,
};

const T = {
  de: {
    linked: (name) => `✅ Verbunden. Du bekommst deine i7OS-Benachrichtigungen ab jetzt hier${name ? `, ${name}` : ""}.`,
    already: "Du bist bereits verbunden. /stop trennt die Verbindung.",
    expired: "Dieser Link ist abgelaufen. Öffne i7OS → Einstellungen → Konto und verbinde noch einmal.",
    stopped: "Verbindung getrennt. Du bekommst hier keine Benachrichtigungen mehr.",
    notLinked: "Hier ist nichts verbunden.",
    status: (n) => `Verbunden. Aktive Benachrichtigungen: ${n}.`,
    help: "Ich schicke dir Benachrichtigungen aus i7OS. Verbinden kannst du dich in der App unter Einstellungen → Konto. /stop trennt die Verbindung.",
    open: "In i7OS öffnen",
    cols: { progress: "In Arbeit", review: "Review", done: "Erledigt" },
    btnPass: "Weitergeben",
    btnBack: "Zurück",
    pickWho: "An wen?",
    cbMoved: (col) => `Nach ${col} verschoben.`,
    cbAlreadyIn: (col) => `Steht schon unter ${col}.`,
    markMoved: (col) => `Über Telegram nach ${col} verschoben.`,
    cbNoOne: "In diesem Workspace ist sonst niemand.",
    cbPassed: (name) => `An ${name} weitergegeben.`,
    markPassed: (name) => `Über Telegram an ${name} weitergegeben.`,
    passedTitle: "Aufgabe weitergegeben",
    passedBody: (from, title) => `${from} hat dir "${title}" weitergegeben`,
    cbGone: "Diese Aufgabe gibt es nicht mehr.",
    cbDenied: "Du hast auf diesen Workspace keinen Zugriff.",
    cbReadOnly: "Dieses Konto hat keinen aktiven Plan. Zum Ändern wird einer gebraucht.",
    cbFailed: "Hat nicht geklappt. Versuch es in der App.",

  },
  en: {
    linked: (name) => `✅ Connected. Your i7OS notifications arrive here from now on${name ? `, ${name}` : ""}.`,
    already: "You are already connected. /stop disconnects.",
    expired: "This link has expired. Open i7OS → Settings → Account and connect again.",
    stopped: "Disconnected. No more notifications here.",
    notLinked: "Nothing is connected here.",
    status: (n) => `Connected. Active notification types: ${n}.`,
    help: "I send you notifications from i7OS. Connect in the app under Settings → Account. /stop disconnects.",
    open: "Open in i7OS",
    cols: { progress: "In progress", review: "Review", done: "Done" },
    btnPass: "Hand over",
    btnBack: "Back",
    pickWho: "To whom?",
    cbMoved: (col) => `Moved to ${col}.`,
    cbAlreadyIn: (col) => `Already in ${col}.`,
    markMoved: (col) => `Moved to ${col} from Telegram.`,
    cbNoOne: "There is nobody else in this workspace.",
    cbPassed: (name) => `Handed to ${name}.`,
    markPassed: (name) => `Handed to ${name} from Telegram.`,
    passedTitle: "Task handed to you",
    passedBody: (from, title) => `${from} handed you "${title}"`,
    cbGone: "That task is gone.",
    cbDenied: "You do not have access to that workspace.",
    cbReadOnly: "This account has no active plan. Changes need one.",
    cbFailed: "That did not work. Try it in the app.",

  },
};

// HTML, not MarkdownV2: MarkdownV2 demands a backslash in front of eighteen
// different characters and one missed underscore in somebody's task title is a
// 400 from Telegram and a message nobody ever sees.
const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const api = (botToken, method, body) =>
  fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(r => r.json().catch(() => ({ ok: false })));

// Where "open" should land. Only two deep links exist in the app today (?doc=
// and ?wb=), so everything else goes to the front door rather than to a URL
// that quietly does nothing.
const deepLink = (appUrl, n) => {
  const m = n?.metadata || {};
  if (m.task_id) return `${appUrl}/?task=${encodeURIComponent(m.task_id)}`;
  if (m.document_id) return `${appUrl}/?doc=${encodeURIComponent(m.document_id)}`;
  if (m.board_id || m.whiteboard_id) return `${appUrl}/?wb=${encodeURIComponent(m.board_id || m.whiteboard_id)}`;
  return appUrl;
};

// The workspace name over the title, the title, the body, then whatever the
// task itself says. Built in one place because a button press rewrites the very
// message the fan-out sent, and the two have to produce the same lines or the
// edit reflows the card.
//
// The description is the point of the last block: the notification body only
// ever says who assigned what, so a task whose whole content is in its
// description arrived here as a title and nothing else.
// `extra` is already-escaped HTML built by taskBlock. It is NOT escaped again
// here, which is the whole reason it is built in one place.
const notifText = (workspace, n, lang, extra) => {
  const { title, body } = notifLines(n, lang !== "en");
  return [
    workspace ? `<b>${esc(workspace)}</b>` : null,
    `<b>${esc(title)}</b>`,
    body ? esc(body) : null,
    extra ? "\n" + extra : null,
  ].filter(Boolean).join("\n");
};

const DETAIL_MAX = 600;
const CHECKLIST_MAX = 8;
const PRIORITY = {
  de: { high: "Hoch", medium: "Mittel", low: "Niedrig" },
  en: { high: "High", medium: "Medium", low: "Low" },
};

// What the card itself says, under the notification. The body only ever names
// who assigned what, so everything that decides what you DO about the message —
// how urgent it is, when it is due, how big it is — was missing from the chat.
//
// Fetched fresh on every send AND on every button press, so a message that gets
// rewritten shows the checklist as it stands now, not as it stood when the
// notification was written.
const taskBlock = async (db, taskId, lang) => {
  const de = lang !== "en";
  const { data: task } = await db.from("tasks")
    .select("description, priority, due_date").eq("id", taskId).maybeSingle();
  if (!task) return "";
  const blocks = [];

  const d = String(task.description || "").trim();
  if (d) blocks.push(esc(d.length > DETAIL_MAX ? d.slice(0, DETAIL_MAX).trimEnd() + "…" : d));

  const facts = [];
  const prio = PRIORITY[de ? "de" : "en"][task.priority];
  if (prio) facts.push(`${de ? "Priorität" : "Priority"}: ${prio}`);
  if (task.due_date) {
    // The app writes a date-only field through new Date("YYYY-MM-DD"), which
    // parses as UTC midnight, and every stored due_date is 00:00 UTC. Reading
    // it back in UTC is therefore exact, and needs no timezone and no Intl,
    // which the edge runtime does not always carry in full.
    const t = new Date(task.due_date);
    const dd = String(t.getUTCDate()).padStart(2, "0");
    const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
    const yy = t.getUTCFullYear();
    facts.push(`${de ? "Frist" : "Due"}: ${de ? `${dd}.${mm}.${yy}` : `${yy}-${mm}-${dd}`}`);
  }
  if (facts.length) blocks.push(esc(facts.join(" · ")));

  const { data: items } = await db.from("task_checklist_items")
    .select("text, checked").eq("task_id", taskId).order("position", { ascending: true });
  if (items?.length) {
    const done = items.filter(i => i.checked).length;
    // [x] and [ ], not a tick character: this is the one surface where we
    // cannot draw an icon, and a tick is a coloured emoji on some clients and
    // a thin glyph on others.
    const rows = items.slice(0, CHECKLIST_MAX)
      .map(i => `${i.checked ? "[x]" : "[ ]"} ${esc(i.text || "")}`);
    if (items.length > CHECKLIST_MAX) {
      rows.push(de ? `und ${items.length - CHECKLIST_MAX} weitere`
                   : `and ${items.length - CHECKLIST_MAX} more`);
    }
    blocks.push(`<b>${de ? "Checkliste" : "Checklist"} ${done}/${items.length}</b>\n${rows.join("\n")}`);
  }
  return blocks.join("\n\n");
};

const orgName = async (db, orgId) => {
  if (!orgId) return "";
  const { data } = await db.from("organizations").select("name").eq("id", orgId).maybeSingle();
  return data?.name || "";
};

// Whether this person may still write to this task. The service key writes
// past RLS, so the check RLS would have done has to happen here instead:
// membership of the task's workspace, or of the one project it belongs to,
// because a project invite grants access without workspace membership.
const mayTouchTask = async (db, userId, task) => {
  if (task.org_id) {
    const { data } = await db.from("org_members").select("id")
      .eq("org_id", task.org_id).eq("user_id", userId).maybeSingle();
    if (data) return true;
  }
  if (task.project_id) {
    const { data } = await db.from("project_members").select("id")
      .eq("project_id", task.project_id).eq("user_id", userId).maybeSingle();
    if (data) return true;
  }
  return false;
};

// Everybody who could take this task over, minus whoever is asking. Workspace
// members, or the project's members when the task belongs to no workspace.
// Sorted by name so the row a button sits in does not move between the moment
// the list is drawn and the moment somebody presses it.
const handoverCandidates = async (db, task, exceptUserId) => {
  let ids = [];
  if (task.org_id) {
    const { data } = await db.from("org_members").select("user_id").eq("org_id", task.org_id);
    ids = (data || []).map(r => r.user_id);
  } else if (task.project_id) {
    const { data } = await db.from("project_members").select("user_id").eq("project_id", task.project_id);
    ids = (data || []).map(r => r.user_id);
  }
  ids = [...new Set(ids)].filter(id => id && id !== exceptUserId);
  if (!ids.length) return [];
  const { data: profiles } = await db.from("profiles").select("id, display_name, email").in("id", ids);
  return (profiles || [])
    .map(pr => ({ id: pr.id, name: pr.display_name || (pr.email || "").split("@")[0] || "?" }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 20); // a keyboard, not a directory
};

// callback_data is capped at 64 bytes and two uuids do not fit in it. The
// target therefore travels as the first 8 characters of its id and is resolved
// against the live list on the way back, which also re-checks membership for
// free. Eight hex characters collide once in four billion; an actual collision
// is refused rather than guessed at.
const ID_HINT = 8;

// The columns a task can be pushed into from a chat. "todo" is missing on
// purpose: nothing that arrives as a notification needs a button to put it back
// where it already was. These keys are the board's own (DEFAULT_COLUMNS in
// App.jsx) and the values in the column_key text field, verified against
// production, which holds todo, progress, review and done and no other spelling.
const MOVE_COLUMNS = ["progress", "review", "done"];

// The keyboard a task notification carries. One definition, because the
// fan-out draws it, "back" restores it, a move redraws it, and all three have
// to agree. It stays on the message after a move, so the card can be walked
// across the board from the chat rather than in one direction only.
const taskKeyboard = (t, appUrl, n, hasTask) => [
  ...(hasTask ? [
    MOVE_COLUMNS.map(key => ({ text: t.cols[key], callback_data: `c:${n.id}:${key}` })),
    [{ text: t.btnPass, callback_data: `f:${n.id}` }],
  ] : []),
  [{ text: t.open, url: deepLink(appUrl, n) }],
];
const resolveHint = (candidates, hint) => {
  const hits = candidates.filter(c => c.id.slice(0, ID_HINT) === hint);
  return hits.length === 1 ? hits[0] : null;
};

export default async function handler(req) {
  const reqUrl = new URL(req.url);
  const setup = reqUrl.searchParams.get("setup");
  const check = reqUrl.searchParams.get("check");
  const wire = reqUrl.searchParams.get("wire");
  if (req.method !== "POST" && !setup && !check && !wire) return json({ error: "Method not allowed" }, 405);

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const appUrl = (process.env.PUBLIC_APP_URL || "https://app.i7os.com").replace(/\/$/, "");
  // Names of what is missing, never values. "Not configured" on its own sends
  // you hunting through four variables; this says which one to look at.
  const missing = [
    !botToken && "TELEGRAM_BOT_TOKEN",
    !url && "SUPABASE_URL",
    !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
    !process.env.TELEGRAM_WEBHOOK_SECRET && "TELEGRAM_WEBHOOK_SECRET",
    !process.env.TELEGRAM_HOOK_SECRET && "TELEGRAM_HOOK_SECRET",
  ].filter(Boolean);
  if (!botToken || !url || !serviceKey) {
    return json({ error: "Telegram is not configured", code: "not_configured", missing }, 503);
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // ── Is the wiring alive? ───────────────────────────────────────────────────
  // Deliberately needs no secret, so checking never has to be handed to
  // whoever holds one. It answers booleans and the bot's public username:
  // no token, no secret, no chat ids, no error strings.
  if (check) {
    const me = await api(botToken, "getMe", {});
    const info = await api(botToken, "getWebhookInfo", {});
    const allowed = info?.result?.allowed_updates;
    return json({
      bot: me?.ok ? me.result?.username || null : null,
      // Telegram treats an absent list as "the default set", and callback_query
      // is in that set. Present but missing it is the state where every button
      // silently does nothing.
      buttons_delivered: !allowed?.length || allowed.includes("callback_query"),
      webhook_points_here: (info?.result?.url || "") === `${appUrl}/api/telegram`,
      pending: info?.result?.pending_update_count ?? null,
      failing: !!info?.result?.last_error_message,
    });
  }

  // ── Repair the wiring, without holding a secret ────────────────────────────
  // Unauthenticated on purpose, and safe because it has no inputs. Every value
  // it writes is a constant in this file: the webhook can only ever be pointed
  // at this deployment's own URL, with the secret this deployment already
  // holds. A stranger calling it gains nothing they could not get by waiting.
  //
  // It also does nothing when nothing is wrong, which is what keeps it from
  // being a way to burn Telegram's rate limit. drop_pending_updates is false
  // here, unlike ?setup=: a repair must not throw away messages queued while
  // the thing was broken. ?setup= stays secret-guarded for the forced,
  // everything-including-the-name version.
  if (wire) {
    if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
      return json({ error: "TELEGRAM_WEBHOOK_SECRET is not set on this deployment", code: "not_configured" }, 503);
    }
    const before = await api(botToken, "getWebhookInfo", {});
    const allowed = before?.result?.allowed_updates;
    const pointsHere = (before?.result?.url || "") === `${appUrl}/api/telegram`;
    const takesButtons = !allowed?.length || allowed.includes("callback_query");
    if (pointsHere && takesButtons) {
      return json({ changed: false, reason: "already wired", buttons_delivered: true });
    }
    const set = await api(botToken, "setWebhook", {
      url: `${appUrl}/api/telegram`,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message", "edited_message", "callback_query"],
      drop_pending_updates: false,
    });
    const after = await api(botToken, "getWebhookInfo", {});
    const now = after?.result?.allowed_updates;
    return json({
      changed: !!set?.ok,
      was: { webhook_points_here: pointsHere, buttons_delivered: takesButtons },
      buttons_delivered: !now?.length || now.includes("callback_query"),
      webhook_points_here: (after?.result?.url || "") === `${appUrl}/api/telegram`,
      error: set?.ok ? undefined : set?.description,
    });
  }

  // ── One-time wiring ───────────────────────────────────────────────────────
  // Registering the webhook by hand means pasting a bot token into a terminal,
  // which is the one step most likely to go wrong and the one place the token
  // is most likely to end up somewhere it should not. The function already HAS
  // the token, so it can do it itself and then report what Telegram thinks the
  // wiring looks like. Guarded by the hook secret; it can only ever point the
  // webhook at this very deployment, so there is nothing here to steal.
  if (setup) {
    // Told apart on purpose. These two used to answer identically, and a bare
    // "Unauthorized" cannot distinguish "the variable is missing on this
    // deployment" from "you pasted the wrong string" — which matters, because
    // there are two similarly named secrets and one of them is the other one's
    // neighbour in the Vercel list.
    if (!process.env.TELEGRAM_HOOK_SECRET) {
      return json({
        error: "TELEGRAM_HOOK_SECRET is not set on this deployment",
        code: "not_configured",
        hint: "Set it in Vercel, then REDEPLOY: env vars only reach builds made after they are saved.",
      }, 503);
    }
    if (setup !== process.env.TELEGRAM_HOOK_SECRET) {
      // The received length is the caller's own input, so saying it back costs
      // nothing. Whether it matches is one bit, and it is the bit that says
      // "you sent the wrong secret entirely" rather than "it got mangled".
      const same = setup.length === process.env.TELEGRAM_HOOK_SECRET.length;
      return json({
        error: "Unauthorized",
        code: "bad_secret",
        received_length: setup.length,
        hint: same
          ? "Right length, wrong value. Check for a stray character, or a copy of an older secret."
          : "Wrong length. This is probably TELEGRAM_WEBHOOK_SECRET, which is a different variable, or the value got cut off.",
      }, 401);
    }
    if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
      return json({ error: "TELEGRAM_WEBHOOK_SECRET is not set", code: "not_configured" }, 503);
    }
    const set = await api(botToken, "setWebhook", {
      url: `${appUrl}/api/telegram`,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      // callback_query is what a button press arrives as. Leave it out of this
      // list and Telegram silently never delivers one, which looks exactly like
      // a broken handler. Adding a button means re-running this setup call.
      allowed_updates: ["message", "edited_message", "callback_query"],
      drop_pending_updates: true,
    });
    // Everything about the bot's public face that the API is allowed to set.
    // Its PICTURE is not on that list: a bot's profile photo can only be set in
    // BotFather (/setuserpic), there is no method for it. Name, both
    // descriptions and the command menu are set here so they cannot drift from
    // what the product actually does.
    const brand = {};
    brand.name = (await api(botToken, "setMyName", { name: "i7OS" }))?.ok || false;
    brand.short = (await api(botToken, "setMyShortDescription", {
      short_description: "Notifications from your i7OS workspace, and a button that closes a task without opening the app.",
    }))?.ok || false;
    brand.shortDe = (await api(botToken, "setMyShortDescription", {
      language_code: "de",
      short_description: "Benachrichtigungen aus deinem i7OS Workspace, plus ein Knopf, der Aufgaben ohne Umweg erledigt.",
    }))?.ok || false;
    // Shown on the empty chat screen, before anyone has pressed Start.
    brand.about = (await api(botToken, "setMyDescription", {
      description: "i7OS is the workspace OS for creative agencies. Connect this bot in the app under Settings, Account, and your notifications arrive here. Tasks can be marked done straight from the chat.",
    }))?.ok || false;
    brand.aboutDe = (await api(botToken, "setMyDescription", {
      language_code: "de",
      description: "i7OS ist das Workspace-Betriebssystem für Kreativagenturen. Verbinde diesen Bot in der App unter Einstellungen, Konto, dann kommen deine Benachrichtigungen hier an. Aufgaben lassen sich direkt aus dem Chat erledigen.",
    }))?.ok || false;
    const cmds = (list) => [
      { command: "status", description: list[0] },
      { command: "stop", description: list[1] },
      { command: "help", description: list[2] },
    ];
    brand.commands = (await api(botToken, "setMyCommands", {
      commands: cmds(["Show the connection", "Disconnect", "What this bot does"]),
    }))?.ok || false;
    brand.commandsDe = (await api(botToken, "setMyCommands", {
      language_code: "de",
      commands: cmds(["Verbindung anzeigen", "Verbindung trennen", "Was der Bot kann"]),
    }))?.ok || false;

    const info = await api(botToken, "getWebhookInfo", {});
    const me = await api(botToken, "getMe", {});
    // Deliberately narrow: the bot's public identity and what Telegram says
    // about the hook. No token, no secret.
    return json({
      set: !!set?.ok,
      set_error: set?.ok ? undefined : set?.description,
      brand,
      // The one piece of branding no endpoint can do for you.
      avatar: "set the profile picture in BotFather: /setuserpic",
      bot: me?.ok ? { username: me.result?.username, name: me.result?.first_name } : null,
      webhook: info?.ok ? {
        url: info.result?.url,
        pending: info.result?.pending_update_count,
        last_error: info.result?.last_error_message || null,
      } : null,
    });
  }

  const tgSecret = req.headers.get("x-telegram-bot-api-secret-token");
  const hookSecret = req.headers.get("x-i7-hook-secret");

  // ── The notifications trigger ──────────────────────────────────────────────
  if (hookSecret) {
    if (!process.env.TELEGRAM_HOOK_SECRET || hookSecret !== process.env.TELEGRAM_HOOK_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }
    let body; try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
    const id = body?.id;
    if (!id) return json({ error: "Bad request" }, 400);

    const { data: n } = await db.from("notifications")
      .select("id, user_id, org_id, type, title, body, metadata").eq("id", id).maybeSingle();
    if (!n) return json({ ok: true, skipped: "gone" });

    const { data: link } = await db.from("messenger_links")
      .select("chat_id, types, muted_orgs, lang, active, enabled")
      .eq("provider", "telegram").eq("kind", "user").eq("user_id", n.user_id).maybeSingle();
    if (!link) return json({ ok: true, skipped: "no_link" });
    // Two gates that mean different things: the person turned it off, or
    // Telegram refuses to deliver. Reported apart so the settings panel can say
    // which of the two it is.
    if (!link.enabled) return json({ ok: true, skipped: "disabled" });
    if (!link.active) return json({ ok: true, skipped: "inactive" });
    if (n.org_id && (link.muted_orgs || []).includes(n.org_id)) return json({ ok: true, skipped: "muted" });

    const wanted = { ...DEFAULT_TYPES, ...(link.types || {}) };
    // An unknown type is worth sending: a new notification the app starts
    // writing should reach people, not be silently dropped until someone
    // remembers to add it to the table above.
    if (wanted[n.type] === false) return json({ ok: true, skipped: "type_off" });

    const workspace = await orgName(db, n.org_id);
    const t = T[link.lang === "en" ? "en" : "de"];

    // A notification about a task can be acted on without opening anything, and
    // brings the task's own description with it. There is no "assign to me":
    // the only person this message reaches is the assignee, so the button asked
    // them to do the thing that had just been done to them.
    //
    // The callback carries the NOTIFICATION id, not the task id: the handler
    // needs the notification anyway to rebuild this exact message, and one uuid
    // fits Telegram's 64-byte callback_data where two would not.
    const taskId = n.metadata?.task_id;
    const extra = taskId ? await taskBlock(db, taskId, link.lang) : "";
    const res = await api(botToken, "sendMessage", {
      chat_id: link.chat_id,
      text: notifText(workspace, n, link.lang, extra),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: taskKeyboard(t, appUrl, n, !!taskId) },
    });

    if (res?.ok) {
      await db.from("messenger_links").update({ last_sent_at: new Date().toISOString(), last_error: null })
        .eq("provider", "telegram").eq("chat_id", link.chat_id);
    } else {
      // 403 is "the person blocked the bot" and 400 "chat not found" — both are
      // permanent. Retrying those forever is how a bridge turns into a spammer
      // shouting at a closed door, so the link is retired instead.
      const code = res?.error_code;
      const dead = code === 403 || code === 400;
      await db.from("messenger_links")
        .update({ last_error: String(res?.description || "send failed").slice(0, 200), ...(dead ? { active: false } : {}) })
        .eq("provider", "telegram").eq("chat_id", link.chat_id);
    }
    return json({ ok: true, sent: !!res?.ok });
  }

  // ── Telegram's webhook ─────────────────────────────────────────────────────
  // The secret travels in a header Telegram sets itself (setWebhook's
  // secret_token). Without this check the endpoint is a public "send yourself a
  // message" button.
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || tgSecret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  let update; try { update = await req.json(); } catch { return json({ ok: true }); }

  // ── A button under a notification ─────────────────────────────────────────
  // Telegram delivers these as callback_query, never as a message, and only
  // when "callback_query" is in setWebhook's allowed_updates. Answered within
  // a few seconds or the button spins forever on the pressing phone, so every
  // path below ends in answerCallbackQuery.
  const cb = update?.callback_query;
  if (cb) {
    const cbChat = cb.message?.chat?.id;
    const answer = (body, alert = false) =>
      api(botToken, "answerCallbackQuery", { callback_query_id: cb.id, text: body, show_alert: alert })
        .then(() => json({ ok: true }));

    // p carries a third field, so the id is read up to the NEXT colon rather
    // than to the end of the string. All three parts are derived here, from the
    // colons rather than from arithmetic on the id's length: computed that way
    // a string with no colon at all still produced a stray "hint".
    const cut = String(cb.data || "").indexOf(":");
    const action = cut > 0 ? cb.data.slice(0, cut) : "";
    const rest = cut > 0 ? cb.data.slice(cut + 1) : "";
    const second = rest.indexOf(":");
    const notifId = second > 0 ? rest.slice(0, second) : rest;
    const hint = second > 0 ? rest.slice(second + 1) : "";
    // c = move to a column, f = offer the list of people, p = hand it to one of
    // them, b = back out of that list. "d" was the single done button and "a"
    // was assign-to-me; messages already sitting in a chat still carry those,
    // so d is honoured as a move to done and anything else unknown is answered
    // with a shrug rather than left to spin.
    if (!cbChat || !notifId || !["c", "d", "f", "p", "b"].includes(action)) return answer("");

    // The chat is the identity. A button is only ever pressed in the chat the
    // message was sent to, so nobody else can reach this task through it.
    const { data: link } = await db.from("messenger_links")
      .select("user_id, lang, active").eq("provider", "telegram").eq("chat_id", String(cbChat)).maybeSingle();
    const t = T[link?.lang === "en" ? "en" : "de"];
    if (!link?.active || !link.user_id) return answer(t.notLinked, true);

    const { data: n } = await db.from("notifications")
      .select("id, user_id, org_id, type, title, body, metadata").eq("id", notifId).maybeSingle();
    const taskId = n?.metadata?.task_id;
    if (!taskId) return answer(t.cbGone, true);

    const { data: task } = await db.from("tasks")
      .select("id, org_id, project_id, column_key").eq("id", taskId).maybeSingle();
    if (!task) return answer(t.cbGone, true);

    // Two gates that the database would normally apply and here does not. The
    // service key writes past RLS, and enforce_read_only returns early when
    // auth.uid() is null, which it is for every write from this function. Left
    // out, this button is a door around both the permission model and the
    // paywall: a workspace nobody may write to, or an account with no plan,
    // would still take the change.
    if (!(await mayTouchTask(db, link.user_id, task))) return answer(t.cbDenied, true);
    if (task.org_id) {
      const { data: readOnly } = await db.rpc("org_is_read_only", { p_org: task.org_id });
      if (readOnly) return answer(t.cbReadOnly, true);
    }

    const editKeyboard = (rows) => api(botToken, "editMessageReplyMarkup", {
      chat_id: cbChat, message_id: cb.message.message_id, reply_markup: { inline_keyboard: rows },
    });

    // Only the keyboard changes here. Rewriting the text as well would make
    // opening and closing a list of names look like the message itself keeps
    // changing, which it has not.
    if (action === "b") {
      await editKeyboard(taskKeyboard(t, appUrl, n, true));
      return answer("");
    }

    if (action === "f") {
      const people = await handoverCandidates(db, task, link.user_id);
      if (!people.length) return answer(t.cbNoOne, true);
      await editKeyboard([
        ...people.map(pr => [{ text: pr.name, callback_data: `p:${n.id}:${pr.id.slice(0, ID_HINT)}` }]),
        [{ text: t.btnBack, callback_data: `b:${n.id}` }],
      ]);
      return answer(t.pickWho);
    }

    if (action === "p") {
      // Resolved against the list as it is NOW, which re-checks membership on
      // the way back: somebody removed from the workspace since the buttons
      // were drawn simply is not there any more.
      const target = resolveHint(await handoverCandidates(db, task, link.user_id), hint);
      if (!target) return answer(t.cbGone, true);

      const { error: passErr } = await db.from("tasks")
        .update({ assignee_id: target.id, updated_at: new Date().toISOString() }).eq("id", task.id);
      if (passErr) return answer(t.cbFailed, true);

      // The new assignee is told the same way the app tells them. The insert
      // trips the notifications trigger, so if they use Telegram too, this
      // lands in their chat with its own buttons a second later.
      const { data: me } = await db.from("profiles").select("display_name, email").eq("id", link.user_id).maybeSingle();
      const fromName = me?.display_name || (me?.email || "").split("@")[0] || "?";
      const { data: full } = await db.from("tasks").select("title").eq("id", task.id).maybeSingle();
      // Written the way the app writes one: title and body for anything still
      // reading them, actor and subject for everything that renders. The person
      // receiving this may well read English.
      await db.from("notifications").insert({
        user_id: target.id,
        org_id: task.org_id,
        type: "task_assigned",
        title: t.passedTitle,
        body: t.passedBody(fromName, full?.title || ""),
        metadata: { task_id: task.id, actor: fromName, subject: full?.title || "" },
      });

      await api(botToken, "editMessageText", {
        chat_id: cbChat,
        message_id: cb.message.message_id,
        text: `${notifText(await orgName(db, n.org_id), n, link.lang, await taskBlock(db, task.id, link.lang))}\n\n<i>${esc(t.markPassed(target.name))}</i>`,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: taskKeyboard(t, appUrl, n, true) },
      });
      return answer(t.cbPassed(target.name));
    }

    // Everything left is a column move. "d" is the old single done button,
    // still sitting in chats that were sent before this existed.
    const target = action === "d" ? "done" : hint;
    if (!MOVE_COLUMNS.includes(target)) return answer("");
    if (task.column_key === target) return answer(t.cbAlreadyIn(t.cols[target]));

    const { error: upErr } = await db.from("tasks")
      .update({ column_key: target, updated_at: new Date().toISOString() }).eq("id", task.id);
    if (upErr) return answer(t.cbFailed, true);

    // The message says where the card stands now, so the chat still reads
    // correctly tomorrow. The buttons stay: a card that went into review can go
    // back into progress, and the message is the remote control for it.
    await api(botToken, "editMessageText", {
      chat_id: cbChat,
      message_id: cb.message.message_id,
      text: `${notifText(await orgName(db, n.org_id), n, link.lang, await taskBlock(db, task.id, link.lang))}\n\n<i>${esc(t.markMoved(t.cols[target]))}</i>`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: taskKeyboard(t, appUrl, n, true) },
    });
    return answer(t.cbMoved(t.cols[target]));
  }

  const msg = update?.message || update?.edited_message;
  const chatId = msg?.chat?.id;
  const text = (msg?.text || "").trim();
  // Everything else — edits to old messages, joins, stickers — is acknowledged
  // and ignored. Telegram retries anything that is not a 200.
  if (!chatId || !text) return json({ ok: true });

  const firstName = msg?.from?.first_name || "";
  const reply = (body, lang = "de") => api(botToken, "sendMessage", {
    chat_id: chatId, text: body, parse_mode: "HTML", disable_web_page_preview: true,
  }).then(() => json({ ok: true }));

  // /start <code> — the deep link from the app's connect button.
  if (text.startsWith("/start")) {
    const code = text.slice(6).trim();
    if (!code) {
      const { data: existing } = await db.from("messenger_links")
        .select("lang").eq("provider", "telegram").eq("chat_id", String(chatId)).maybeSingle();
      const t = T[existing?.lang === "en" ? "en" : "de"];
      return reply(existing ? t.already : t.help);
    }

    const { data: tok } = await db.from("messenger_link_tokens")
      .select("token, user_id, org_id, kind, lang, expires_at, used_at")
      .eq("token", code).maybeSingle();
    const expired = !tok || tok.used_at || new Date(tok.expires_at).getTime() < Date.now();
    if (expired) return reply(T.de.expired + "\n\n" + T.en.expired);

    const t = T[tok.lang === "en" ? "en" : "de"];
    // Single-use, and marked BEFORE the link is written: a forwarded link that
    // two people press must connect at most one of them.
    const { data: claimed } = await db.from("messenger_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", code).is("used_at", null).select("token").maybeSingle();
    if (!claimed) return reply(t.expired);

    // upsert on chat_id: reconnecting from the same chat replaces the old row
    // rather than colliding with the unique index on it.
    await db.from("messenger_links").upsert({
      provider: "telegram",
      user_id: tok.user_id,
      chat_id: String(chatId),
      kind: tok.kind === "group" ? "group" : "user",
      org_id: tok.kind === "group" ? tok.org_id : null,
      display_name: firstName || null,
      lang: tok.lang === "en" ? "en" : "de",
      active: true,
      last_error: null,
    }, { onConflict: "provider,chat_id" });

    return reply(t.linked(firstName));
  }

  const { data: link } = await db.from("messenger_links")
    .select("id, lang, types, active").eq("provider", "telegram").eq("chat_id", String(chatId)).maybeSingle();
  const t = T[link?.lang === "en" ? "en" : "de"];

  if (text.startsWith("/stop")) {
    if (!link) return reply(t.notLinked);
    // Deleted, not deactivated: "stop" from inside Telegram should leave nothing
    // of the person behind on our side either.
    await db.from("messenger_links").delete().eq("id", link.id);
    return reply(t.stopped);
  }

  if (text.startsWith("/status")) {
    if (!link || !link.active) return reply(t.notLinked);
    const wanted = { ...DEFAULT_TYPES, ...(link.types || {}) };
    return reply(t.status(Object.values(wanted).filter(Boolean).length));
  }

  return reply(t.help);
}
