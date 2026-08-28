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
// What a button DOES lives in one place, shared with api/slack.js. Only the
// formatting below is Telegram's: HTML, and an inline_keyboard.
import {
  MOVE_COLUMNS, COLUMN_LABELS, ID_HINT, headLine,
  splitDraft, workspacesFor, projectsFor, createTask, DEFAULT_TYPES, typeWanted, attachedImage, linkify, createNote, addAssetFile, humanSize,
  moodboardsFor, addMoodboardImage,
  draftStep, draftDone, PRIORITY_CODES, dueDateFor, timezoneOf,
  replyTarget, describeTask, addChecklist, commentOnTask,
  mayTouchTask, orgIsReadOnly, handoverCandidates, resolveHint,
  taskFacts, moveTaskTo, handTaskTo,
} from "../server/messenger.js";

export const config = { runtime: "edge" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

// What Telegram offers when somebody types a slash. Making a task and writing
// a note are the two things people come here to DO, so they belong in the menu
// rather than being folklore. Telegram picks the list by the READER's Telegram
// language, so both exist and the handler answers to either name.
const COMMANDS = {
  de: [
    { command: "aufgabe", description: "Neue Aufgabe anlegen" },
    { command: "notiz", description: "Notiz aufschreiben" },
    { command: "status", description: "Verbindung anzeigen" },
    { command: "stop", description: "Verbindung trennen" },
    { command: "help", description: "Was der Bot kann" },
  ],
  en: [
    { command: "task", description: "Create a task" },
    { command: "note", description: "Write a note" },
    { command: "status", description: "Show the connection" },
    { command: "stop", description: "Disconnect" },
    { command: "help", description: "What this bot does" },
  ],
};

const T = {
  de: {
    lang: "de",
    linked: (name) => `✅ Verbunden. Du bekommst deine i7OS-Benachrichtigungen ab jetzt hier${name ? `, ${name}` : ""}.`,
    already: "Du bist bereits verbunden. /stop trennt die Verbindung.",
    expired: "Dieser Link ist abgelaufen. Öffne i7OS → Einstellungen → Konto und verbinde noch einmal.",
    stopped: "Verbindung getrennt. Du bekommst hier keine Benachrichtigungen mehr.",
    notLinked: "Hier ist nichts verbunden.",
    status: (n) => `Verbunden. Aktive Benachrichtigungen: ${n}.`,
    help: "Ich schicke dir Benachrichtigungen aus i7OS. Verbinden kannst du dich in der App unter Einstellungen → Konto. /stop trennt die Verbindung.",
    open: "In i7OS öffnen",
    btnPass: "Weitergeben",
    btnBack: "Zurück",
    pickWho: "An wen?",
    cbMoved: (col) => `Nach ${col} verschoben.`,
    cbAlreadyIn: (col) => `Steht schon unter ${col}.`,
    markMoved: (col) => `Über Telegram nach ${col} verschoben.`,
    newAsk: (title) => `<b>Neue Aufgabe</b>\n${title}\n\nWohin?`,
    newNoProject: "Allgemein",
    newNoWorkspace: "Du bist in keinem Workspace.",
    newMade: (title) => `Angelegt: ${title}`,
    markMade: "Über Telegram angelegt.",
    askProject: "Projekt?",
    askPriority: "Priorität?",
    askDue: "Frist?",
    askAssignee: "Für wen?",
    prio: { h: "Hoch", m: "Mittel", l: "Niedrig" },
    due: { "0": "Keine Frist", t: "Heute", m: "Morgen", f: "Freitag", w: "In einer Woche" },
    forMe: "Für mich",
    btnDescribe: "Beschreibung hinzufügen",
    btnChecklist: "Checkliste hinzufügen",
    btnComment: "Kommentieren",
    askComment: (title) => `Kommentar zu ${title}? Antworte einfach auf diese Nachricht.`,
    commented: "Kommentar gespeichert.",
    noteMade: "Notiz gespeichert.",
    noteEmpty: "Schreib dazu, was du dir merken willst: /notiz Preise anheben",
    newEmptyTask: "Schreib dazu, was zu tun ist: /aufgabe Angebot schreiben",
    noteAsk: (body) => `<b>Neue Notiz</b>\n${body}\n\nWohin?`,
    notePrivate: "Allgemein",
    fileAsk: (name) => `<b>${name}</b>\n\nWohin in den Assets?`,
    filePrivate: "Allgemein",
    fileSaved: (name, size) => `${name} liegt in den Assets (${size}).`,
    fileNoRoom: (used, limit) => `Der Speicher ist voll (${used} von ${limit}). Räum auf oder hol dir mehr Platz.`,
    fileTooBig: "Diese Datei ist zu groß für Telegram-Bots. Lad sie in der App hoch.",
    fileGone: "Diese Datei ist weg. Schick sie noch einmal.",
    fileWhat: (name) => `<b>${name}</b>\n\nWohin damit?`,
    fileToAssets: "In die Assets",
    fileToMood: "Auf ein Moodboard",
    fileNoBoards: "Es gibt noch kein Moodboard.",
    moodAsk: "Auf welches Moodboard?",
    moodSaved: (board, size) => `Auf "${board}" gelegt (${size}).`,
    cancel: "Abbrechen",
    cancelled: "Abgebrochen.",
    askChecklist: (title) => `Checkliste für ${title}? Eine Zeile pro Punkt, als Antwort auf diese Nachricht.`,
    listed: (n) => `${n} ${n === 1 ? "Punkt" : "Punkte"} hinzugefügt.`,
    askDescribe: (title) => `Beschreibung für ${title}? Antworte einfach auf diese Nachricht.`,
    described: "Beschreibung gespeichert.",
    describeGone: "Diese Aufgabe gibt es nicht mehr.",
    newDenied: "Auf diesen Workspace hast du keinen Zugriff.",
    newReadOnly: "Dieses Konto hat keinen aktiven Plan. Zum Anlegen wird einer gebraucht.",
    newFailed: "Konnte nicht angelegt werden. Versuch es in der App.",
    newGone: "Der Text zu dieser Aufgabe ist weg. Schick ihn noch einmal.",
    cbNoOne: "In diesem Workspace ist sonst niemand.",
    cbPassed: (name) => `An ${name} weitergegeben.`,
    markPassed: (name) => `Über Telegram an ${name} weitergegeben.`,
    cbGone: "Diese Aufgabe gibt es nicht mehr.",
    cbDenied: "Du hast auf diesen Workspace keinen Zugriff.",
    cbReadOnly: "Dieses Konto hat keinen aktiven Plan. Zum Ändern wird einer gebraucht.",
    cbFailed: "Hat nicht geklappt. Versuch es in der App.",

  },
  en: {
    lang: "en",
    linked: (name) => `✅ Connected. Your i7OS notifications arrive here from now on${name ? `, ${name}` : ""}.`,
    already: "You are already connected. /stop disconnects.",
    expired: "This link has expired. Open i7OS → Settings → Account and connect again.",
    stopped: "Disconnected. No more notifications here.",
    notLinked: "Nothing is connected here.",
    status: (n) => `Connected. Active notification types: ${n}.`,
    help: "I send you notifications from i7OS. Connect in the app under Settings → Account. /stop disconnects.",
    open: "Open in i7OS",
    btnPass: "Hand over",
    btnBack: "Back",
    pickWho: "To whom?",
    cbMoved: (col) => `Moved to ${col}.`,
    cbAlreadyIn: (col) => `Already in ${col}.`,
    markMoved: (col) => `Moved to ${col} from Telegram.`,
    newAsk: (title) => `<b>New task</b>\n${title}\n\nWhere?`,
    newNoProject: "General",
    newNoWorkspace: "You are not in any workspace.",
    newMade: (title) => `Created: ${title}`,
    markMade: "Created from Telegram.",
    askProject: "Project?",
    askPriority: "Priority?",
    askDue: "Due?",
    askAssignee: "For whom?",
    prio: { h: "High", m: "Medium", l: "Low" },
    due: { "0": "No date", t: "Today", m: "Tomorrow", f: "Friday", w: "In a week" },
    forMe: "For me",
    btnDescribe: "Add a description",
    btnChecklist: "Add a checklist",
    btnComment: "Comment",
    askComment: (title) => `A comment on ${title}? Just reply to this message.`,
    commented: "Comment saved.",
    noteMade: "Note saved.",
    noteEmpty: "Say what you want to remember: /note raise the prices",
    newEmptyTask: "Say what needs doing: /task write the proposal",
    noteAsk: (body) => `<b>New note</b>\n${body}\n\nWhere?`,
    notePrivate: "General",
    fileAsk: (name) => `<b>${name}</b>\n\nWhere in Assets?`,
    filePrivate: "General",
    fileSaved: (name, size) => `${name} is in Assets (${size}).`,
    fileNoRoom: (used, limit) => `Storage is full (${used} of ${limit}). Clear some space or get more.`,
    fileTooBig: "That file is too big for Telegram bots. Upload it in the app.",
    fileGone: "That file is gone. Send it again.",
    fileWhat: (name) => `<b>${name}</b>\n\nWhere to?`,
    fileToAssets: "Into Assets",
    fileToMood: "Onto a moodboard",
    fileNoBoards: "There is no moodboard yet.",
    moodAsk: "Which moodboard?",
    moodSaved: (board, size) => `Added to "${board}" (${size}).`,
    cancel: "Cancel",
    cancelled: "Cancelled.",
    askChecklist: (title) => `A checklist for ${title}? One line per item, as a reply to this message.`,
    listed: (n) => `${n} ${n === 1 ? "item" : "items"} added.`,
    askDescribe: (title) => `A description for ${title}? Just reply to this message.`,
    described: "Description saved.",
    describeGone: "That task is gone.",
    newDenied: "You do not have access to that workspace.",
    newReadOnly: "This account has no active plan. Creating needs one.",
    newFailed: "Could not create it. Try the app.",
    newGone: "The text for this task is gone. Send it again.",
    cbNoOne: "There is nobody else in this workspace.",
    cbPassed: (name) => `Handed to ${name}.`,
    markPassed: (name) => `Handed to ${name} from Telegram.`,
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
// esc, then linkify: the escaping is what makes the text safe, and the links
// are put back deliberately on top of it.
const link = (s) => linkify(esc(s), "telegram");

const notifText = (workspace, n, lang, extra) => {
  const { title, body } = notifLines(n, lang !== "en");
  return [
    workspace ? `<b>${esc(workspace)}</b>` : null,
    `<b>${esc(title)}</b>`,
    body ? link(body) : null,
    extra ? "\n" + extra : null,
  ].filter(Boolean).join("\n");
};

// Telegram's rendering of what the card says. The data comes from taskFacts in
// server/messenger.js, which Slack reads too; only the HTML is ours.
const taskBlock = async (db, taskId, lang) => {
  const f = await taskFacts(db, taskId, lang);
  if (!f) return { extra: "", project: "" };
  const blocks = [];
  if (f.description) blocks.push(link(f.description));
  if (f.facts.length) blocks.push(esc(f.facts.join(" · ")));
  if (f.checklist) {
    const c = f.checklist;
    // [x] and [ ], not a tick character: this is a surface where we cannot draw
    // an icon, and a tick is a coloured emoji on some clients and a thin glyph
    // on others.
    const rows = c.shown.map(i => `${i.checked ? "[x]" : "[ ]"} ${link(i.text)}`);
    if (c.more) rows.push(esc(c.moreLabel(c.more)));
    blocks.push(`<b>${esc(c.label)} ${c.done}/${c.total}</b>\n${rows.join("\n")}`);
  }
  return { extra: blocks.join("\n\n"), project: f.project };
};

// The exact text the fan-out produced, rebuilt: same head, same card, so a
// button press edits the message rather than reflowing it.
const rewritten = async (db, n, taskId, lang) => {
  const card = await taskBlock(db, taskId, lang);
  return notifText(headLine(await orgName(db, n.org_id), card.project), n, lang, card.extra);
};

const orgName = async (db, orgId) => {
  if (!orgId) return "";
  const { data } = await db.from("organizations").select("name").eq("id", orgId).maybeSingle();
  return data?.name || "";
};

// The keyboard a task notification carries. One definition, because the
// fan-out draws it, "back" restores it, a move redraws it, and all three have
// to agree. It stays on the message after a move, so the card can be walked
// across the board from the chat rather than in one direction only.
const taskKeyboard = (t, appUrl, n, hasTask) => [
  ...(hasTask ? [
    MOVE_COLUMNS.map(key => ({ text: COLUMN_LABELS[t.lang][key], callback_data: `c:${n.id}:${key}` })),
    // Commenting addresses the TASK, not the notification, so it carries the
    // task id rather than n.id, which for a real notification are different.
    [{ text: t.btnPass, callback_data: `f:${n.id}` },
     ...(n.metadata?.task_id ? [{ text: t.btnComment, callback_data: `z:${n.metadata.task_id}` }] : [])],
  ] : []),
  [{ text: t.open, url: deepLink(appUrl, n) }],
];
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
    const errAt = info?.result?.last_error_date;
    const errorAgeMin = errAt ? Math.round((Date.now() / 1000 - errAt) / 60) : null;
    return json({
      // Which commit is actually answering. Vercel sets this on every build, so
      // "is my fix live yet" stops being a guess: compare it with git log.
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
      bot: me?.ok ? me.result?.username || null : null,
      // Telegram treats an absent list as "the default set", and callback_query
      // is in that set. Present but missing it is the state where every button
      // silently does nothing.
      buttons_delivered: !allowed?.length || allowed.includes("callback_query"),
      webhook_points_here: (info?.result?.url || "") === `${appUrl}/api/telegram`,
      pending: info?.result?.pending_update_count ?? null,
      // Telegram keeps the last error forever, so its mere presence says
      // nothing about now: this called a webhook "failing" that had just
      // delivered its whole backlog. Anything older than a quarter of an hour
      // is history, and the age is reported so it can be read rather than
      // trusted.
      failing: errorAgeMin !== null && errorAgeMin < 15,
      last_error_minutes_ago: errorAgeMin,
      // Telegram's own words about OUR endpoint. I withheld this to keep the
      // check free of error strings, and then spent a round guessing at a 500
      // that Telegram had been describing the whole time. It says nothing
      // secret and it is the fastest thing in the response.
      last_error: info?.result?.last_error_message || null,
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
    // The command menu is refreshed every time, because it is a constant in
    // this file and keeping it current is exactly what this verb is for.
    const menu = (await api(botToken, "setMyCommands", { commands: COMMANDS.en }))?.ok
      && (await api(botToken, "setMyCommands", { language_code: "de", commands: COMMANDS.de }))?.ok;
    const before = await api(botToken, "getWebhookInfo", {});
    const allowed = before?.result?.allowed_updates;
    const pointsHere = (before?.result?.url || "") === `${appUrl}/api/telegram`;
    const takesButtons = !allowed?.length || allowed.includes("callback_query");
    if (pointsHere && takesButtons) {
      return json({ changed: false, reason: "already wired", buttons_delivered: true, menu: !!menu });
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
    brand.commands = (await api(botToken, "setMyCommands", { commands: COMMANDS.en }))?.ok || false;
    brand.commandsDe = (await api(botToken, "setMyCommands",
      { language_code: "de", commands: COMMANDS.de }))?.ok || false;

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

    if (!typeWanted(link, n.type)) return json({ ok: true, skipped: "type_off" });

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
    const card = taskId ? await taskBlock(db, taskId, link.lang) : { extra: "", project: "" };
    // A picture goes as a picture. Telegram fetches the url itself, which the
    // public chat-attachments bucket allows, and the message becomes the
    // caption. Captions cap at 1024 where a message caps at 4096, so anything
    // longer falls back to a plain message rather than being cut in half.
    const photo = attachedImage(n);
    const message = notifText(headLine(workspace, card.project), n, link.lang, card.extra);
    const keyboard = { inline_keyboard: taskKeyboard(t, appUrl, n, !!taskId) };
    const res = photo && message.length <= 1024
      ? await api(botToken, "sendPhoto", {
          chat_id: link.chat_id, photo: photo.url,
          caption: message, parse_mode: "HTML", reply_markup: keyboard,
        })
      : await api(botToken, "sendMessage", {
          chat_id: link.chat_id, text: message, parse_mode: "HTML",
          disable_web_page_preview: !photo, reply_markup: keyboard,
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
    // A new task's answers accumulate across the segments, so the whole thing
    // is split. The first three keep their old meaning, which is all the
    // column and handover buttons ever look at.
    const parts = String(cb.data || "").split(":");
    const action = parts.length > 1 ? parts[0] : "";
    const notifId = parts[1] || "";
    const hint = parts[2] || "";
    // c = move to a column, f = offer the list of people, p = hand it to one of
    // them, b = back out of that list. "d" was the single done button and "a"
    // was assign-to-me; messages already sitting in a chat still carry those,
    // so d is honoured as a move to done and anything else unknown is answered
    // with a shrug rather than left to spin.
    // n and w belong to a NEW task and carry a workspace id where the others
    // carry a notification id, so they are handled before anything tries to
    // load a notification that was never involved.
    if (!cbChat || !notifId || !["c", "d", "f", "p", "b", "n", "w", "x", "y", "z", "q", "v", "u", "s", "k", "m", "j"].includes(action)) return answer("");

    // The chat is the identity. A button is only ever pressed in the chat the
    // message was sent to, so nobody else can reach this task through it.
    const { data: link } = await db.from("messenger_links")
      .select("user_id, lang, active").eq("provider", "telegram").eq("chat_id", String(cbChat)).maybeSingle();
    const t = T[link?.lang === "en" ? "en" : "de"];
    if (!link?.active || !link.user_id) return answer(t.notLinked, true);

    if (action === "x" || action === "y" || action === "z") {
      const kind = action === "y" ? "list" : action === "z" ? "note" : "";
      // force_reply puts the keyboard straight into the reply box. The task
      // travels as a text_link on its own title: Telegram returns the message
      // being replied to, but only one level deep, so the question has to carry
      // the task itself, and a link is the one part of a message that survives
      // the round trip while also being useful.
      const taskId = parts.slice(1).join(":");
      const { data: task } = await db.from("tasks").select("id, title").eq("id", taskId).maybeSingle();
      if (!task) return answer(t.describeGone, true);
      await api(botToken, "sendMessage", {
        chat_id: cbChat,
        // list=1 rides in the link, which is how the reply that comes back
        // says which of the two questions it is answering.
        text: (kind === "list" ? t.askChecklist : kind === "note" ? t.askComment : t.askDescribe)(
          `<a href="${appUrl}/?task=${encodeURIComponent(task.id)}${kind ? `&${kind}=1` : ""}">${esc(task.title || "")}</a>`),
        parse_mode: "HTML",
        reply_markup: { force_reply: true, selective: true },
      });
      return answer("");
    }

    // Cancel, from any screen. Nothing has been written at any point before an
    // answer, so there is nothing to undo, only a question to take away.
    if (action === "k" && notifId === "x") {
      await api(botToken, "editMessageText", {
        chat_id: cbChat, message_id: cb.message.message_id,
        text: `<i>${esc(t.cancelled)}</i>`, parse_mode: "HTML",
      });
      return answer(t.cancelled);
    }

    if (action === "k" || action === "u" || action === "s" || action === "m" || action === "j") {
      // The picture is on the message this one replies to, so nothing had to be
      // held anywhere between the question and the answer.
      const src = cb.message?.reply_to_message;
      const doc = src?.document;
      const photo = Array.isArray(src?.photo) ? src.photo[src.photo.length - 1] : null;
      const file = doc && /^image\//i.test(doc.mime_type || "")
        ? { id: doc.file_id, name: doc.file_name || "bild.jpg", type: doc.mime_type }
        : photo ? { id: photo.file_id, name: `foto-${new Date().toISOString().slice(0, 10)}.jpg`, type: "image/jpeg" }
        : null;
      if (!file) return answer(t.fileGone, true);

      const orgs = await workspacesFor(db, link.user_id);
      if (!orgs.length) return answer(t.newNoWorkspace, true);
      const one = orgs.length === 1 ? orgs[0] : null;
      const cancelRow = [{ text: t.cancel, callback_data: "k:x" }];

      // "k" is the answer to the first question. From here the two paths part.
      if (action === "k") {
        const wantsMood = notifId === "m";
        if (!one) {
          return api(botToken, "editMessageReplyMarkup", {
            chat_id: cbChat, message_id: cb.message.message_id,
            reply_markup: { inline_keyboard: [
              ...orgs.map(o => [{ text: o.name.slice(0, 60), callback_data: `${wantsMood ? "j" : "s"}:${o.id.slice(0, ID_HINT)}` }]),
              cancelRow,
            ] },
          }).then(() => answer(""));
        }
        if (wantsMood) {
          const boards = await moodboardsFor(db, link.user_id, one.id);
          if (!boards.length) return answer(t.fileNoBoards, true);
          return api(botToken, "editMessageReplyMarkup", {
            chat_id: cbChat, message_id: cb.message.message_id,
            reply_markup: { inline_keyboard: [
              ...boards.map(b => [{ text: b.name.slice(0, 60), callback_data: `m:${one.id.slice(0, ID_HINT)}:${b.id.slice(0, ID_HINT)}` }]),
              cancelRow,
            ] },
          }).then(() => answer(t.moodAsk));
        }
        const projects = await projectsFor(db, link.user_id, one.id);
        return api(botToken, "editMessageReplyMarkup", {
          chat_id: cbChat, message_id: cb.message.message_id,
          reply_markup: { inline_keyboard: [
            [{ text: t.filePrivate, callback_data: `u:${one.id.slice(0, ID_HINT)}:-` }],
            ...projects.map(pr => [{ text: pr.name.slice(0, 60), callback_data: `u:${one.id.slice(0, ID_HINT)}:${pr.id.slice(0, ID_HINT)}` }]),
            cancelRow,
          ] },
        }).then(() => answer(t.fileAsk));
      }

      const org = resolveHint(orgs, notifId);
      if (!org) return answer(t.newDenied, true);
      const projects = await projectsFor(db, link.user_id, org.id);

      // The workspace is chosen; now which moodboard.
      if (action === "j") {
        const boards = await moodboardsFor(db, link.user_id, org.id);
        if (!boards.length) return answer(t.fileNoBoards, true);
        return api(botToken, "editMessageReplyMarkup", {
          chat_id: cbChat, message_id: cb.message.message_id,
          reply_markup: { inline_keyboard: [
            ...boards.map(b => [{ text: b.name.slice(0, 60), callback_data: `m:${org.id.slice(0, ID_HINT)}:${b.id.slice(0, ID_HINT)}` }]),
            cancelRow,
          ] },
        }).then(() => answer(t.moodAsk));
      }

      if (action === "s") {
        await api(botToken, "editMessageReplyMarkup", {
          chat_id: cbChat, message_id: cb.message.message_id,
          reply_markup: { inline_keyboard: [
            [{ text: t.filePrivate, callback_data: `u:${org.id.slice(0, ID_HINT)}:-` }],
            ...projects.map(pr => [{ text: pr.name.slice(0, 60), callback_data: `u:${org.id.slice(0, ID_HINT)}:${pr.id.slice(0, ID_HINT)}` }]),
          ] },
        });
        return answer("");
      }

      const project = hint && hint !== "-" ? resolveHint(projects, hint) : null;
      const board = action === "m" ? resolveHint(await moodboardsFor(db, link.user_id, org.id), hint) : null;
      if (action === "m" && !board) return answer(t.fileGone, true);
      // Telegram only hands a bot files up to 20 MB, and says so with an error
      // rather than a truncated download.
      const info = await api(botToken, "getFile", { file_id: file.id });
      if (!info?.ok || !info.result?.file_path) return answer(t.fileTooBig, true);
      const res = await fetch(`https://api.telegram.org/file/bot${botToken}/${info.result.file_path}`);
      if (!res.ok) return answer(t.fileGone, true);
      const bytes = new Uint8Array(await res.arrayBuffer());

      const saved = board
        ? await addMoodboardImage(db, { userId: link.user_id, orgId: org.id, boardId: board.id,
                                        name: file.name, contentType: file.type, bytes })
        : await addAssetFile(db, { userId: link.user_id, orgId: org.id, projectId: project?.id || null,
                                   name: file.name, contentType: file.type, bytes });
      if (!saved.ok) {
        return answer(saved.reason === "read_only" ? t.newReadOnly
          : saved.reason === "denied" ? t.newDenied
          : saved.reason === "no_room" ? t.fileNoRoom(humanSize(saved.room.used), humanSize(saved.room.limit))
          : t.newFailed, true);
      }
      await api(botToken, "editMessageText", {
        chat_id: cbChat, message_id: cb.message.message_id,
        text: board
          ? `<b>${esc(headLine(org.name, board.name))}</b>\n<i>${esc(t.moodSaved(board.name, humanSize(saved.size)))}</i>`
          : `<b>${esc(headLine(org.name, project?.name || t.filePrivate))}</b>\n<i>${esc(t.fileSaved(saved.file?.name || file.name, humanSize(saved.size)))}</i>`,
        parse_mode: "HTML",
      });
      return answer(board ? t.moodSaved(board.name, humanSize(saved.size))
                          : t.fileSaved(file.name, humanSize(saved.size)));
    }

    if (action === "q" || action === "v") {
      // The note's own text, from the message this one replies to, with the
      // command stripped the same way it was when the question was asked.
      const raw = (cb.message?.reply_to_message?.text || "").replace(/^\/(notiz|note)(@\S+)?\s*/i, "").trim();
      if (!raw) return answer(t.newGone, true);
      const orgs = await workspacesFor(db, link.user_id);
      const org = resolveHint(orgs, notifId);
      if (!org) return answer(t.newDenied, true);
      const projects = await projectsFor(db, link.user_id, org.id);

      if (action === "v") {
        await api(botToken, "editMessageReplyMarkup", {
          chat_id: cbChat, message_id: cb.message.message_id,
          reply_markup: { inline_keyboard: [
            [{ text: t.notePrivate, callback_data: `q:${org.id.slice(0, ID_HINT)}:-` }],
            ...projects.map(pr => [{ text: pr.name.slice(0, 60), callback_data: `q:${org.id.slice(0, ID_HINT)}:${pr.id.slice(0, ID_HINT)}` }]),
          ] },
        });
        return answer("");
      }

      const project = hint && hint !== "-" ? resolveHint(projects, hint) : null;
      if (hint && hint !== "-" && !project) return answer(t.newGone, true);
      const made = await createNote(db, {
        userId: link.user_id, orgId: org.id, content: raw, projectName: project?.name || null,
      });
      if (!made.ok) {
        return answer(made.reason === "read_only" ? t.newReadOnly
          : made.reason === "denied" ? t.newDenied : t.newFailed, true);
      }
      await api(botToken, "editMessageText", {
        chat_id: cbChat, message_id: cb.message.message_id,
        text: `<b>${esc(headLine(org.name, project?.name || t.notePrivate))}</b>\n${esc(raw)}\n\n<i>${esc(t.noteMade)}</i>`,
        parse_mode: "HTML",
      });
      return answer(t.noteMade);
    }

    if (action === "n" || action === "w") {
      // The text was never stored. It is the message this one replies to, which
      // Telegram hands back on every press, so a draft cannot go stale in a
      // table and cannot outlive the chat it was typed in. Every ANSWER rides
      // in the button that was pressed, so the flow keeps no state either.
      const draft = cb.message?.reply_to_message?.text || "";
      const { title, description } = splitDraft(draft);
      if (!title) return answer(t.newGone, true);

      const orgs = await workspacesFor(db, link.user_id);
      const org = resolveHint(orgs, notifId);
      if (!org) return answer(t.newDenied, true);

      const projects = await projectsFor(db, link.user_id, org.id);
      const project = hint && hint !== "-" ? resolveHint(projects, hint) : null;

      // What has been answered so far, over the question being asked, so the
      // message is the form rather than a trail of them.
      const chosen = [
        org.name,
        parts.length > 2 ? (project?.name || t.newNoProject) : null,
        parts.length > 3 ? t.prio[parts[3]] : null,
        parts.length > 4 ? t.due[parts[4]] : null,
      ].filter(Boolean).join(" · ");

      const ask = async (question, rows) => {
        await api(botToken, "editMessageText", {
          chat_id: cbChat, message_id: cb.message.message_id,
          text: `<b>${esc(chosen)}</b>\n${esc(title)}\n\n${esc(question)}`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: rows },
        });
        return answer("");
      };

      // "w" only picks the workspace; the project question follows.
      const here = `n:${org.id.slice(0, ID_HINT)}`;
      if (action === "w") {
        return ask(t.askProject, [
          [{ text: t.newNoProject, callback_data: `${here}:-` }],
          ...projects.map(pr => [{ text: pr.name.slice(0, 60), callback_data: `${here}:${pr.id.slice(0, ID_HINT)}` }]),
        ]);
      }

      const so_far = parts.slice(0, 6).join(":");
      if (!draftDone(parts)) {
        const step = draftStep(parts);
        if (step === "priority") {
          return ask(t.askPriority, [Object.keys(PRIORITY_CODES).map(k => (
            { text: t.prio[k], callback_data: `${so_far}:${k}` }))]);
        }
        if (step === "due") {
          return ask(t.askDue, [
            [{ text: t.due["0"], callback_data: `${so_far}:0` }],
            [{ text: t.due.t, callback_data: `${so_far}:t` }, { text: t.due.m, callback_data: `${so_far}:m` }],
            [{ text: t.due.f, callback_data: `${so_far}:f` }, { text: t.due.w, callback_data: `${so_far}:w` }],
          ]);
        }
        // assignee
        const people = await handoverCandidates(db, { org_id: org.id, project_id: null }, link.user_id);
        return ask(t.askAssignee, [
          [{ text: t.forMe, callback_data: `${so_far}:-` }],
          ...people.map(pr => [{ text: pr.name.slice(0, 60), callback_data: `${so_far}:${pr.id.slice(0, ID_HINT)}` }]),
        ]);
      }

      const asgHint = parts[5];
      let assigneeId = link.user_id;
      if (asgHint && asgHint !== "-") {
        const person = resolveHint(await handoverCandidates(db, { org_id: org.id, project_id: null }, link.user_id), asgHint);
        if (!person) return answer(t.newGone, true);
        assigneeId = person.id;
      }

      const made = await createTask(db, {
        userId: link.user_id, orgId: org.id,
        projectName: project?.name || null, title, description,
        priority: PRIORITY_CODES[parts[3]] || "medium",
        dueDate: dueDateFor(parts[4], await timezoneOf(db, link.user_id)),
        assigneeId,
      });
      if (!made.ok) {
        return answer(made.reason === "read_only" ? t.newReadOnly
          : made.reason === "denied" ? t.newDenied : t.newFailed, true);
      }
      await api(botToken, "editMessageText", {
        chat_id: cbChat, message_id: cb.message.message_id,
        text: `<b>${esc(headLine(org.name, project?.name))}</b>\n${esc(title)}\n\n<i>${esc(t.markMade)}</i>`,
        parse_mode: "HTML",
        // The same keyboard a notification carries, addressed to the task
        // itself. Assigning something to yourself produces no notification, so
        // without this the one message you get about it could not be acted on.
        reply_markup: { inline_keyboard: [
          // Only when the message did not already carry one. A description
          // typed as line two needs no second asking.
          ...(description ? [] : [[{ text: t.btnDescribe, callback_data: `x:${made.task.id}` }]]),
          [{ text: t.btnChecklist, callback_data: `y:${made.task.id}` },
           { text: t.btnComment, callback_data: `z:${made.task.id}` }],
          ...taskKeyboard(t, appUrl, { id: made.task.id, metadata: { task_id: made.task.id } }, true),
        ] },
      });
      return answer(t.newMade(title));
    }

    let { data: n } = await db.from("notifications")
      .select("id, user_id, org_id, type, title, body, metadata").eq("id", notifId).maybeSingle();
    // A task made here never produced a notification: nobody needed telling,
    // the person who made it was already looking. Its buttons therefore address
    // the TASK, and this turns that id back into the shape everything below
    // expects. notifLines has no entry for this type, so it falls back to the
    // title it is given, which is the task's own.
    if (!n) {
      const { data: tk } = await db.from("tasks").select("id, title, org_id").eq("id", notifId).maybeSingle();
      if (tk) n = { id: tk.id, org_id: tk.org_id, type: "task_created", title: tk.title, body: null,
                    metadata: { task_id: tk.id } };
    }
    const taskId = n?.metadata?.task_id;
    if (!taskId) return answer(t.cbGone, true);

    const { data: task } = await db.from("tasks")
      .select("id, title, org_id, project_id, column_key, creator_id").eq("id", taskId).maybeSingle();
    if (!task) return answer(t.cbGone, true);

    // Two gates that the database would normally apply and here does not. The
    // service key writes past RLS, and enforce_read_only returns early when
    // auth.uid() is null, which it is for every write from this function. Left
    // out, this button is a door around both the permission model and the
    // paywall: a workspace nobody may write to, or an account with no plan,
    // would still take the change.
    if (!(await mayTouchTask(db, link.user_id, task))) return answer(t.cbDenied, true);
    if (task.org_id) {
      if (await orgIsReadOnly(db, task.org_id)) return answer(t.cbReadOnly, true);
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

      // The write, and the notification that goes with it, are shared with
      // Slack. The insert trips the notifications trigger, so if the new
      // assignee uses a messenger too, this reaches them there a second later.
      if (!(await handTaskTo(db, task, target, link.user_id)).ok) return answer(t.cbFailed, true);

      await api(botToken, "editMessageText", {
        chat_id: cbChat,
        message_id: cb.message.message_id,
        text: `${await rewritten(db, n, task.id, link.lang)}\n\n<i>${esc(t.markPassed(target.name))}</i>`,
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
    const label = COLUMN_LABELS[t.lang][target];
    if (task.column_key === target) return answer(t.cbAlreadyIn(label));

    // The write, and the "somebody finished your task" notification that a move
    // into done carries, are shared with Slack.
    if (!(await moveTaskTo(db, task, target, link.user_id)).ok) return answer(t.cbFailed, true);

    // The message says where the card stands now, so the chat still reads
    // correctly tomorrow. The buttons stay: a card that went into review can go
    // back into progress, and the message is the remote control for it.
    await api(botToken, "editMessageText", {
      chat_id: cbChat,
      message_id: cb.message.message_id,
      text: `${await rewritten(db, n, task.id, link.lang)}\n\n<i>${esc(t.markMoved(label))}</i>`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: taskKeyboard(t, appUrl, n, true) },
    });
    return answer(t.cbMoved(label));
  }

  const msg = update?.message || update?.edited_message;
  const chatId = msg?.chat?.id;
  const text = (msg?.text || "").trim();
  // Everything else — edits to old messages, joins, stickers — is acknowledged
  // and ignored. Telegram retries anything that is not a 200.
  // The largest of the sizes Telegram offers, or a document that is an image.
  // A document keeps its own name; a photo has none, so it gets a dated one.
  const sent = (() => {
    const doc = msg?.document;
    if (doc && /^image\//i.test(doc.mime_type || "")) {
      return { id: doc.file_id, name: doc.file_name || "bild.jpg", type: doc.mime_type, size: doc.file_size };
    }
    const photo = Array.isArray(msg?.photo) ? msg.photo[msg.photo.length - 1] : null;
    if (photo) {
      return { id: photo.file_id, name: `foto-${new Date().toISOString().slice(0, 10)}.jpg`,
               type: "image/jpeg", size: photo.file_size };
    }
    return null;
  })();
  if (!chatId || (!text && !sent)) return json({ ok: true });

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
    // user_id included: the free-text handler below needs to know WHOSE
    // workspaces to offer, and this select was written when the only things
    // reading it were /stop and /status.
    .select("id, user_id, lang, types, active").eq("provider", "telegram").eq("chat_id", String(chatId)).maybeSingle();
  const t = T[link?.lang === "en" ? "en" : "de"];

  if (text.startsWith("/stop")) {
    if (!link) return reply(t.notLinked);
    // Deleted, not deactivated: "stop" from inside Telegram should leave nothing
    // of the person behind on our side either.
    await db.from("messenger_links").delete().eq("id", link.id);
    return reply(t.stopped);
  }

  // /notiz, or /note. A note needs no wizard: the RLS policies on notes are all
  // "own notes", so there is nobody to ask about and nothing to choose. That is
  // why this is a command and a task is a conversation.
  if (text.startsWith("/notiz") || text.startsWith("/note")) {
    if (!link?.user_id) return reply(t.notLinked);
    const body = text.replace(/^\/(notiz|note)(@\S+)?\s*/i, "");
    if (!body.trim()) return reply(t.noteEmpty);
    // A note belongs to a project or to nobody, exactly as on the board, so it
    // gets the same question a task gets. Nothing is written until it is
    // answered, and the text comes back with the reply rather than being stored.
    const orgs = await workspacesFor(db, link.user_id);
    if (!orgs.length) return reply(t.newNoWorkspace);
    const ask = async (org) => {
      const projects = org ? await projectsFor(db, link.user_id, org.id) : [];
      const rows = org
        ? [[{ text: t.notePrivate, callback_data: `q:${org.id.slice(0, ID_HINT)}:-` }],
           ...projects.map(pr => [{ text: pr.name.slice(0, 60), callback_data: `q:${org.id.slice(0, ID_HINT)}:${pr.id.slice(0, ID_HINT)}` }])]
        : orgs.map(o => [{ text: o.name.slice(0, 60), callback_data: `v:${o.id.slice(0, ID_HINT)}` }]);
      return api(botToken, "sendMessage", {
        chat_id: chatId, text: t.noteAsk(esc(body.trim())), parse_mode: "HTML",
        reply_to_message_id: msg.message_id, reply_markup: { inline_keyboard: rows },
      }).then(() => json({ ok: true }));
    };
    return ask(orgs.length === 1 ? orgs[0] : null);
  }

  if (text.startsWith("/status")) {
    if (!link || !link.active) return reply(t.notLinked);
    const wanted = { ...DEFAULT_TYPES, ...(link.types || {}) };
    return reply(t.status(Object.values(wanted).filter(Boolean).length));
  }

  // A reply to the bot's description question belongs to the task that
  // question linked to, and is not a new task.
  // A picture sent to the bot goes into Assets, and asks where first. The
  // file itself is not stored anywhere in the meantime: the question REPLIES to
  // the message carrying it, so Telegram hands it back with the answer.
  if (sent) {
    if (!link?.user_id) return reply(t.notLinked);
    const orgs = await workspacesFor(db, link.user_id);
    if (!orgs.length) return reply(t.newNoWorkspace);
    // Assets and a moodboard are two different places, and which one is meant
    // is the first thing to ask, not something to guess from the picture.
    return api(botToken, "sendMessage", {
      chat_id: chatId, text: t.fileWhat(esc(sent.name)), parse_mode: "HTML",
      reply_to_message_id: msg.message_id,
      reply_markup: { inline_keyboard: [
        [{ text: t.fileToAssets, callback_data: "k:a" }],
        [{ text: t.fileToMood, callback_data: "k:m" }],
        [{ text: t.cancel, callback_data: "k:x" }],
      ] },
    }).then(() => json({ ok: true }));
  }

  const answering = replyTarget(msg.reply_to_message);
  if (answering) {
    if (!link?.user_id) return reply(t.notLinked);
    const done = answering.kind === "checklist"
      ? await addChecklist(db, link.user_id, answering.taskId, text)
      : answering.kind === "comment"
      ? await commentOnTask(db, link.user_id, answering.taskId, text)
      : await describeTask(db, link.user_id, answering.taskId, text);
    return reply(done.ok
      ? (answering.kind === "checklist" ? t.listed(done.added)
         : answering.kind === "comment" ? t.commented : t.described)
      : done.reason === "read_only" ? t.newReadOnly
      : done.reason === "denied" ? t.newDenied
      : done.reason === "gone" ? t.describeGone : t.newFailed);
  }

  // ── Anything else is a new task ───────────────────────────────────────────
  // No command to remember: what you would type to a colleague is what you
  // type here. Nothing is written yet. The bot asks where it should go, and
  // only the button press creates it, so a message sent by mistake stays a
  // message.
  if (!link || !link.active) return reply(t.notLinked);

  // /aufgabe and /task are the menu's way of saying the same thing as plain
  // text. Both names, whatever the reader's Telegram language happens to be.
  const asTask = /^\/(aufgabe|task)(@\S+)?\s*/i.exec(text);

  // Anything else beginning with a slash is a command, and an unknown command
  // is a question, not a task. Without this /help became a task called "/help",
  // which is what free text quietly did to every command it did not recognise.
  if (!asTask && text.startsWith("/")) return reply(t.help);
  const draft = asTask ? text.slice(asTask[0].length) : text;
  const { title } = splitDraft(draft);
  if (!title) return reply(asTask ? t.newEmptyTask : t.help);

  const orgs = await workspacesFor(db, link.user_id);
  if (!orgs.length) return reply(t.newNoWorkspace);

  // The draft text is not stored anywhere and does not ride in callback_data,
  // which holds 64 bytes. The bot REPLIES to the message, so Telegram hands the
  // original back as reply_to_message when a button is pressed.
  const askProjects = async (org) => {
    const projects = await projectsFor(db, link.user_id, org.id);
    const rows = [
      [{ text: t.newNoProject, callback_data: `n:${org.id.slice(0, ID_HINT)}:` }],
      ...projects.map(pr => [{ text: pr.name.slice(0, 60), callback_data: `n:${org.id.slice(0, ID_HINT)}:${pr.id.slice(0, ID_HINT)}` }]),
    ];
    return api(botToken, "sendMessage", {
      chat_id: chatId,
      text: t.newAsk(esc(title)),
      parse_mode: "HTML",
      reply_to_message_id: msg.message_id,
      reply_markup: { inline_keyboard: rows },
    }).then(() => json({ ok: true }));
  };

  // One workspace is the normal case, and asking about it would be a question
  // with one answer.
  if (orgs.length === 1) return askProjects(orgs[0]);
  return api(botToken, "sendMessage", {
    chat_id: chatId,
    text: t.newAsk(esc(title)),
    parse_mode: "HTML",
    reply_to_message_id: msg.message_id,
    reply_markup: { inline_keyboard: orgs.map(o => [{ text: o.name.slice(0, 60), callback_data: `w:${o.id.slice(0, ID_HINT)}` }]) },
  }).then(() => json({ ok: true }));
}
