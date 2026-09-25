// Slack bridge. Everything a button DOES lives in server/messenger.js, shared
// with api/telegram.js; what is here is Slack's half: OAuth, request signing,
// and Block Kit.
//
// The one real difference from Telegram, and the reason Telegram came first:
// Telegram is ONE bot for the whole product and a person just connects to it.
// Slack hands out a bot token PER workspace, so somebody has to install the app
// into their Slack, and the token has to be stored (slack_installations).
//
// Edge runtime → does NOT count against the Hobby 12-function Node limit. HMAC
// for the signature check comes from Web Crypto, which the edge runtime has.
//
// Verbs, and the first is the only one anybody has to remember:
//   GET  ?mode=install&state=<token>  → send someone to Slack's consent screen
//   GET  ?mode=callback&code=…        → Slack sends them back here
//   GET  ?check=1                     → is anything installed at all
//   POST x-i7-hook-secret             → the notifications trigger, through pg_net
//   POST x-slack-signature            → a button was pressed
import { createClient } from "@supabase/supabase-js";
import { notifLines } from "../src/notificationText.js";
import {
  MOVE_COLUMNS, COLUMN_LABELS, ID_HINT, headLine,
  splitDraft, workspacesFor, projectsFor, createTask, describeTask, addChecklist, commentOnTask,
  typeWanted, attachedImage, linkify, createNote, addAssetFile, humanSize,
  asLinkRequest, linkFoldersFor, createWorkspaceLink,
  moodboardsFor, addMoodboardImage,
  socialTargetsFor, queueSocialPost, putDraft, takeDraft,
  nextQuestion, PRIORITY_CODES, dueDateFor, timezoneOf,
  mayTouchTask, orgIsReadOnly, handoverCandidates, resolveHint,
  taskFacts, moveTaskTo, handTaskTo,
} from "../server/messenger.js";

export const config = { runtime: "edge" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

// Only what a bot needs to write a direct message to somebody. No users:read,
// no channel history, nothing that reads. A Slack admin looks at this list
// before approving an install, and a short list is the difference between
// approved and ignored.
// commands is what a slash command needs. Reading direct messages instead
// would mean im:history, and an app that asks to read every DM sent to it is
// an app a Slack admin declines.
// files:read is the narrowest way to receive a picture at all. The alternative
// is im:history, which asks to read every direct message sent to the app, and
// that is the permission a Slack admin declines.
const SCOPES = "chat:write,im:write,commands,files:read";

const T = {
  de: {
    lang: "de",
    open: "In i7OS öffnen",
    btnPass: "Weitergeben",
    btnBack: "Zurück",
    pickWho: "An wen?",
    cbMoved: (col) => `Nach ${col} verschoben.`,
    cbAlreadyIn: (col) => `Steht schon unter ${col}.`,
    markMoved: (col) => `Über Slack nach ${col} verschoben.`,
    markPassed: (name) => `Über Slack an ${name} weitergegeben.`,
    cbPassed: (name) => `An ${name} weitergegeben.`,
    cbNoOne: "In diesem Workspace ist sonst niemand.",
    cbGone: "Diese Aufgabe gibt es nicht mehr.",
    cbDenied: "Du hast auf diesen Workspace keinen Zugriff.",
    cbReadOnly: "Dieses Konto hat keinen aktiven Plan. Zum Ändern wird einer gebraucht.",
    cbFailed: "Hat nicht geklappt. Versuch es in der App.",
    connected: "Verbunden. Deine i7OS-Benachrichtigungen kommen ab jetzt hier an.",
    askProject: "Projekt?",
    askWorkspace: "Workspace?",
    askPriority: "Priorität?",
    askDue: "Frist?",
    askAssignee: "Für wen?",
    prio: { h: "Hoch", m: "Mittel", l: "Niedrig" },
    dueLabels: { "0": "Keine Frist", t: "Heute", m: "Morgen", f: "Freitag", w: "In einer Woche" },
    noProject: "Allgemein",
    forMe: "Für mich",
    newTask: "Neue Aufgabe",
    newNoWorkspace: "Du bist in keinem Workspace.",
    newEmpty: "Schreib dazu, was zu tun ist: /i7os Angebot schreiben",
    noteMade: "Notiz gespeichert.",
    noteEmpty: "Schreib dazu, was du dir merken willst: /i7os notiz Preise anheben",
    noteTitle: "Neue Notiz",
    noteLabel: "Notiz",
    linkTitle: "Link speichern",
    askFolder: "In welchen Ordner?",
    linkNoFolder: "Ohne Ordner",
    linkSaved: "Link gespeichert.",
    notePrivate: "Allgemein",
    fileTitle: "Neues Bild",
    fileAsk: "Wohin in den Assets?",
    filePrivate: "Allgemein",
    fileSaved: (name, size) => `${name} liegt in den Assets (${size}).`,
    fileNoRoom: (used, limit) => `Der Speicher ist voll (${used} von ${limit}).`,
    fileGone: "Diese Datei ist weg. Schick sie noch einmal.",
    fileWhat: "Wohin damit?",
    fileToAssets: "In die Assets",
    fileToMood: "Auf ein Moodboard",
    fileToSocial: "Als Social Post",
    socialNoChannel: "In diesem Workspace ist weder Instagram noch Threads verbunden.",
    socialWhich: "Auf welchen Kanal?",
    socialBoth: "Beide",
    socialWhen: "Wann soll es raus?",
    socialNow: "Jetzt posten",
    socialIn1h: "In einer Stunde",
    socialTonight: "Heute 18:00",
    socialTomorrow: "Morgen 9:00",
    socialSending: "Wird veröffentlicht…",
    socialWorking: "Wird noch verarbeitet. Sobald es durch ist, steht es im Kanal.",
    socialDone: (who) => `Veröffentlicht auf ${who}.`,
    socialQueued: (who, when) => `Geht an ${who}, ${when}.`,
    socialFailed: (why) => `Hat nicht geklappt${why ? `: ${why}` : "."}`,
    socialAskText: "Möchtest du einen Text dazuschreiben?",
    socialWriteText: "Text schreiben",
    socialSkipText: "Ohne Text",
    socialTextTitle: "Beitragstext",
    socialTextLabel: "Was soll unter dem Bild stehen?",
    postTextOnly: "Beitrag ohne Bild",
    postLabel: "Was soll im Beitrag stehen?",
    statusOn: "Verbunden. Deine Workspaces:",
    slashHelp: "*Was ich kann*\n• `/post` Beitrag auf Threads oder Instagram\n• `/aufgabe` Neue Aufgabe anlegen\n• `/notiz` Notiz aufschreiben\n• `/status` Verbindung anzeigen\n\nEin Bild an mich geschickt landet in den Assets, auf einem Moodboard oder als Social Post. Eine Adresse allein wird ein Lesezeichen.",
    fileNoBoards: "Es gibt noch kein Moodboard.",
    moodAsk: "Auf welches Moodboard?",
    moodSaved: (board, size) => `Auf "${board}" gelegt (${size}).`,
    cancel: "Abbrechen",
    cancelled: "Abgebrochen.",
    newMade: "Angelegt.",
    newDenied: "Auf diesen Workspace hast du keinen Zugriff.",
    newReadOnly: "Dieses Konto hat keinen aktiven Plan. Zum Anlegen wird einer gebraucht.",
    newFailed: "Konnte nicht angelegt werden. Versuch es in der App.",
    notConnected: "Verbinde Slack zuerst in i7OS unter Einstellungen, Workspace, Integrationen.",
    btnDescribe: "Beschreibung hinzufügen",
    askDescribe: "Noch eine Beschreibung?",
    btnWrite: "Schreiben",
    btnSkip: "Ohne",
    describeTitle: "Beschreibung",
    describeLabel: "Was ist zu tun?",
    checklistLabel: "Checkliste, eine Zeile pro Punkt",
    btnComment: "Kommentieren",
    commentTitle: "Kommentar",
    commentLabel: "Dein Kommentar",
    described: "Beschreibung gespeichert.",
  },
  en: {
    lang: "en",
    open: "Open in i7OS",
    btnPass: "Hand over",
    btnBack: "Back",
    pickWho: "To whom?",
    cbMoved: (col) => `Moved to ${col}.`,
    cbAlreadyIn: (col) => `Already in ${col}.`,
    markMoved: (col) => `Moved to ${col} from Slack.`,
    markPassed: (name) => `Handed to ${name} from Slack.`,
    cbPassed: (name) => `Handed to ${name}.`,
    cbNoOne: "There is nobody else in this workspace.",
    cbGone: "That task is gone.",
    cbDenied: "You do not have access to that workspace.",
    cbReadOnly: "This account has no active plan. Changes need one.",
    cbFailed: "That did not work. Try it in the app.",
    connected: "Connected. Your i7OS notifications arrive here from now on.",
    askProject: "Project?",
    askWorkspace: "Workspace?",
    askPriority: "Priority?",
    askDue: "Due?",
    askAssignee: "For whom?",
    prio: { h: "High", m: "Medium", l: "Low" },
    dueLabels: { "0": "No date", t: "Today", m: "Tomorrow", f: "Friday", w: "In a week" },
    noProject: "General",
    forMe: "For me",
    newTask: "New task",
    newNoWorkspace: "You are not in any workspace.",
    newEmpty: "Say what needs doing: /i7os write the proposal",
    noteMade: "Note saved.",
    noteEmpty: "Say what you want to remember: /i7os note raise the prices",
    noteTitle: "New note",
    noteLabel: "Note",
    linkTitle: "Save link",
    askFolder: "Which folder?",
    linkNoFolder: "No folder",
    linkSaved: "Link saved.",
    notePrivate: "General",
    fileTitle: "New picture",
    fileAsk: "Where in Assets?",
    filePrivate: "General",
    fileSaved: (name, size) => `${name} is in Assets (${size}).`,
    fileNoRoom: (used, limit) => `Storage is full (${used} of ${limit}).`,
    fileGone: "That file is gone. Send it again.",
    fileWhat: "Where to?",
    fileToAssets: "Into Assets",
    fileToMood: "Onto a moodboard",
    fileToSocial: "As a social post",
    socialNoChannel: "Neither Instagram nor Threads is connected in this workspace.",
    socialWhich: "Which channel?",
    socialBoth: "Both",
    socialWhen: "When should it go out?",
    socialNow: "Post now",
    socialIn1h: "In an hour",
    socialTonight: "Today 18:00",
    socialTomorrow: "Tomorrow 9:00",
    socialSending: "Publishing…",
    socialWorking: "Still processing. It appears in the channel once it is through.",
    socialDone: (who) => `Published on ${who}.`,
    socialQueued: (who, when) => `Going to ${who}, ${when}.`,
    socialFailed: (why) => `That did not work${why ? `: ${why}` : "."}`,
    socialAskText: "Do you want to add some text?",
    socialWriteText: "Write the text",
    socialSkipText: "No text",
    socialTextTitle: "Post text",
    socialTextLabel: "What should appear under the picture?",
    postTextOnly: "Post without a picture",
    postLabel: "What should the post say?",
    statusOn: "Connected. Your workspaces:",
    slashHelp: "*What I can do*\n• `/post` post to Threads or Instagram\n• `/task` create a task\n• `/note` write a note\n• `/status` show the connection\n\nSend me a picture and it goes to Assets, to a moodboard, or out as a social post. A bare url becomes a bookmark.",
    fileNoBoards: "There is no moodboard yet.",
    moodAsk: "Which moodboard?",
    moodSaved: (board, size) => `Added to "${board}" (${size}).`,
    cancel: "Cancel",
    cancelled: "Cancelled.",
    newMade: "Created.",
    newDenied: "You do not have access to that workspace.",
    newReadOnly: "This account has no active plan. Creating needs one.",
    newFailed: "Could not create it. Try the app.",
    notConnected: "Connect Slack first in i7OS under Settings, Workspace, Integrations.",
    btnDescribe: "Add a description",
    askDescribe: "Add a description?",
    btnWrite: "Write one",
    btnSkip: "Skip",
    describeTitle: "Description",
    describeLabel: "What needs doing?",
    checklistLabel: "Checklist, one line per item",
    btnComment: "Comment",
    commentTitle: "Comment",
    commentLabel: "Your comment",
    described: "Description saved.",
  },
};

// Slack's mrkdwn needs the same three characters escaped as HTML does, and no
// others. Everything else in a task title is safe to send as it stands.
const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The older Web API methods do not read a JSON body and answer
// invalid_arguments to one. files.info is one of them, which is what made a
// picture in Slack do nothing at all: the event arrived, the lookup was
// refused, and refusing quietly looks exactly like never being called.
const slackForm = (token, method, params) =>
  fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
               Authorization: `Bearer ${token}` },
    body: new URLSearchParams(params).toString(),
  }).then(r => r.json().catch(() => ({ ok: false })));

const slack = (token, method, body) =>
  fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then(r => r.json().catch(() => ({ ok: false })));

const deepLink = (appUrl, n) => {
  const m = n?.metadata || {};
  if (m.task_id) return `${appUrl}/?task=${encodeURIComponent(m.task_id)}`;
  if (m.document_id) return `${appUrl}/?doc=${encodeURIComponent(m.document_id)}`;
  if (m.board_id || m.whiteboard_id) return `${appUrl}/?wb=${encodeURIComponent(m.board_id || m.whiteboard_id)}`;
  return appUrl;
};

// ── Is this really Slack? ───────────────────────────────────────────────────
// v0:timestamp:body, HMAC-SHA256, hex, compared in constant time. Without this
// the interaction endpoint is a public "move any task you can name" button.
const verifySlack = async (signingSecret, sig, ts, raw) => {
  if (!sig || !ts) return false;
  // Five minutes. A replayed request older than that is somebody's recording,
  // not somebody's click.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`v0:${ts}:${raw}`));
  const mine = "v0=" + [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
  if (mine.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < mine.length; i++) diff |= mine.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
};

// ── Block Kit ───────────────────────────────────────────────────────────────
// The same message Telegram builds, in Slack's shape. Both read notifLines and
// taskFacts, so the two can say different things only by being given different
// data, never by disagreeing about the words.
// esc, then linkify: the escaping is what makes the text safe, and the links
// are put back deliberately on top of it.
const link = (s) => linkify(esc(s), "slack");

const buildBlocks = async (db, workspace, n, lang, appUrl, taskId, footer) => {
  const { title, body } = notifLines(n, lang !== "en");
  // The card is read FIRST: its project belongs in the line above the title,
  // beside the workspace, and that line cannot be built before we have it.
  const f = taskId ? await taskFacts(db, taskId, lang) : null;
  const where = headLine(workspace, f?.project);
  const head = [
    where ? `*${esc(where)}*` : null,
    `*${esc(title)}*`,
    body ? link(body) : null,
  ].filter(Boolean).join("\n");

  const blocks = [{ type: "section", text: { type: "mrkdwn", text: head } }];
  if (f?.description) blocks.push({ type: "section", text: { type: "mrkdwn", text: link(f.description) } });
  if (f?.facts.length) blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: esc(f.facts.join("  ·  ")) }] });
  if (f?.checklist) {
    const c = f.checklist;
    const rows = c.shown.map(i => `${i.checked ? "[x]" : "[ ]"} ${link(i.text)}`);
    if (c.more) rows.push(esc(c.moreLabel(c.more)));
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*${esc(c.label)} ${c.done}/${c.total}*\n${rows.join("\n")}` } });
  }
  // A picture in a chat message shows as a picture. alt_text is required and
  // must not be empty, so the file's name stands in when it has none.
  const photo = attachedImage(n);
  if (photo) blocks.push({ type: "image", image_url: photo.url,
    alt_text: (photo.name || "Bild").slice(0, 2000) });

  if (footer) blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `_${esc(footer)}_` }] });

  const t = T[lang === "en" ? "en" : "de"];
  blocks.push({
    type: "actions",
    elements: [
      ...(taskId ? MOVE_COLUMNS.map(key => ({
        type: "button", action_id: `col_${key}`,
        text: { type: "plain_text", text: COLUMN_LABELS[t.lang][key] },
        value: `${n.id}:${key}`,
      })) : []),
      ...(taskId ? [{
        type: "button", action_id: "hand_over",
        text: { type: "plain_text", text: t.btnPass }, value: `${n.id}`,
      }, {
        // Addresses the TASK, not the notification, which for a real
        // notification are two different ids.
        type: "button", action_id: "comment",
        text: { type: "plain_text", text: t.btnComment }, value: taskId,
      }] : []),
      { type: "button", action_id: "open_app", url: deepLink(appUrl, n), text: { type: "plain_text", text: t.open } },
    ],
  });
  // The fallback line is what a push notification and a screen reader get.
  return { blocks, text: `${title}${body ? ": " + body : ""}` };
};

// The wizard, as one ephemeral message that replaces itself. The whole state
// travels in each button's value: Slack allows 2000 characters there, so unlike
// Telegram it can simply carry the text instead of reaching back for it.
const draftBlocks = (t, st, question, options, title) => ([
  { type: "section", text: { type: "mrkdwn",
    text: `*${esc(title || t.newTask)}*\n${esc(st.t)}${st.chosen ? `\n\n_${esc(st.chosen)}_` : ""}` } },
  { type: "section", text: { type: "mrkdwn", text: `*${esc(question)}*` } },
  // Slack allows 25 elements in an actions block and wraps them itself.
  // action_id has to be unique within the block. Built from the field alone it
  // was the same on every button of a step, which makes the block invalid and
  // is what Slack reports as invalid_command_response. The handler only looks
  // at the "draft_" prefix, so the index costs nothing.
  { type: "actions", elements: options.slice(0, 25).map((o, i) => ({
    type: "button", action_id: `draft_${o.key}_${i}`,
    text: { type: "plain_text", text: String(o.label).slice(0, 75) },
    value: JSON.stringify({ ...st, chosen: undefined, ...o.set }).slice(0, 1990),
  })) },
]);

// Finishing a draft: resolve what the hints point at, write the task, and send
// the message that can actually be acted on. Two callers reach here now, the
// last wizard button and the description modal coming back, and a task created
// two slightly different ways would be the worst kind of bug to chase.
const finishTask = async (db, botToken, link, t, appUrl, st, fallbackChannel) => {
  const orgs = await workspacesFor(db, link.user_id);
  const org = resolveHint(orgs, st.o);
  if (!org) return { ok: false, msg: t.newDenied };
  const projects = await projectsFor(db, link.user_id, org.id);
  const project = st.p && st.p !== "-" ? resolveHint(projects, st.p) : null;

  let assigneeId = link.user_id;
  if (st.a && st.a !== "-") {
    const person = resolveHint(
      await handoverCandidates(db, { org_id: org.id, project_id: null }, link.user_id), st.a);
    if (!person) return { ok: false, msg: t.cbGone };
    assigneeId = person.id;
  }

  const made = await createTask(db, {
    userId: link.user_id, orgId: org.id, projectName: project?.name || null,
    title: st.t, description: st.d && st.d !== "-" ? st.d : null,
    priority: PRIORITY_CODES[st.r] || "medium",
    dueDate: dueDateFor(st.u, await timezoneOf(db, link.user_id)),
    assigneeId,
  });
  if (!made.ok) {
    return { ok: false, msg: made.reason === "read_only" ? t.newReadOnly
      : made.reason === "denied" ? t.newDenied : t.newFailed };
  }

  // Straight after the task, so the message built below already counts them.
  if (st.c) await addChecklist(db, link.user_id, made.task.id, st.c);

  // A real message, not the ephemeral form: only a real one can be edited
  // later, which is what makes its buttons work like every other card's.
  const asTask = { id: made.task.id, org_id: org.id, type: "task_created",
                   title: st.t, body: null, metadata: { task_id: made.task.id } };
  // org.name alone: buildBlocks reads the card and adds the project itself.
  const built = await buildBlocks(db, org.name, asTask, link.lang, appUrl, made.task.id, null);
  // The result is READ. Discarding it is how a message that never arrived
  // looked like a missing button.
  const sent = await slack(botToken, "chat.postMessage",
    { channel: link.chat_id || fallbackChannel, ...built });
  if (!sent?.ok) {
    console.error("[Slack] chat.postMessage failed:", sent?.error);
    await db.from("messenger_links")
      .update({ last_error: String(sent?.error || "post failed").slice(0, 200) })
      .eq("provider", "slack").eq("user_id", link.user_id);
  }
  return { ok: true, task: made.task };
};

export default async function handler(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  const check = url.searchParams.get("check");
  if (req.method !== "POST" && !mode && !check) return json({ error: "Method not allowed" }, 405);

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  const supaUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const appUrl = (process.env.PUBLIC_APP_URL || "https://app.i7os.com").replace(/\/$/, "");
  const redirectUri = `${appUrl}/slack/callback`;

  // Names of what is missing, never values.
  const missing = [
    !clientId && "SLACK_CLIENT_ID",
    !clientSecret && "SLACK_CLIENT_SECRET",
    !signingSecret && "SLACK_SIGNING_SECRET",
    !supaUrl && "SUPABASE_URL",
    !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  if (missing.length) return json({ error: "Slack is not configured", code: "not_configured", missing }, 503);

  const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // ── Health, needs no secret ───────────────────────────────────────────────
  if (check) {
    const { count } = await db.from("slack_installations").select("team_id", { count: "exact", head: true });
    const { count: links } = await db.from("messenger_links")
      .select("id", { count: "exact", head: true }).eq("provider", "slack");
    // Whether the stored bot token still works. Reinstalling from Slack's own
    // UI issues a NEW token and never touches our OAuth callback, so the row
    // here goes stale silently: the wizard keeps working, because it answers
    // through response_url, and only the message at the end fails. auth.test
    // needs no scope and reveals nothing.
    const { data: inst } = await db.from("slack_installations")
      .select("team_id, bot_token, scopes").limit(1).maybeSingle();
    let tokenOk = null;
    if (inst?.bot_token) {
      const who = await slack(inst.bot_token, "auth.test", {});
      tokenOk = !!who?.ok;
    }
    // A reinstall from Slack's own dashboard never passes through our OAuth
    // callback, so the token we hold keeps the scopes it was issued with. It
    // still works, which is the trap: auth.test passes and files.info does not.
    // Reconnecting from inside i7OS is what fetches a token with the new ones.
    const held = (inst?.scopes || "").split(",").map(x => x.trim()).filter(Boolean);
    const stale = SCOPES.split(",").filter(x => !held.includes(x));
    return json({
      scopes_current: inst ? stale.length === 0 : null,
      scopes_missing: stale.length ? stale : undefined,
      bot_token_valid: tokenOk,
      // Which commit is actually answering. Vercel sets this on every build, so
      // "is my fix live yet" stops being a guess: compare it with git log.
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
      configured: true, installations: count ?? 0, connected_people: links ?? 0, redirect_uri: redirectUri,
    });
  }

  // ── Send somebody to Slack's consent screen ───────────────────────────────
  // state is a one-time token minted by the app for the signed-in person, the
  // same one Telegram uses. It is what tells the callback WHICH i7OS user came
  // back, and it cannot be guessed or reused.
  if (mode === "install") {
    const state = url.searchParams.get("state") || "";
    if (!state) return json({ error: "Missing state" }, 400);
    const authorize = new URL("https://slack.com/oauth/v2/authorize");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("scope", SCOPES);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("state", state);
    return Response.redirect(authorize.toString(), 302);
  }

  // ── Slack sends them back ─────────────────────────────────────────────────
  if (mode === "callback") {
    const back = (status) => Response.redirect(`${appUrl}/?slack=${status}`, 302);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (url.searchParams.get("error") || !code || !state) return back("cancelled");

    const { data: tok } = await db.from("messenger_link_tokens")
      .select("token, user_id, lang, expires_at, used_at").eq("token", state).maybeSingle();
    if (!tok || tok.used_at || new Date(tok.expires_at).getTime() < Date.now()) return back("expired");
    // Marked BEFORE anything is written: a link opened twice must connect once.
    const { data: claimed } = await db.from("messenger_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", state).is("used_at", null).select("token").maybeSingle();
    if (!claimed) return back("expired");

    const form = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri });
    const oauth = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    }).then(r => r.json().catch(() => ({ ok: false })));
    if (!oauth?.ok || !oauth.access_token) return back("failed");

    const teamId = oauth.team?.id;
    const botToken = oauth.access_token;
    await db.from("slack_installations").upsert({
      team_id: teamId,
      team_name: oauth.team?.name || null,
      bot_token: botToken,
      bot_user_id: oauth.bot_user_id || null,
      installed_by: tok.user_id,
      scopes: oauth.scope || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "team_id" });

    // The DM channel, not the person: chat.postMessage wants a channel, and for
    // a direct message that channel has to be opened once and kept.
    const slackUserId = oauth.authed_user?.id;
    if (!slackUserId) return back("failed");
    const im = await slack(botToken, "conversations.open", { users: slackUserId });
    const channel = im?.channel?.id;
    if (!channel) return back("failed");

    const lang = tok.lang === "en" ? "en" : "de";
    await db.from("messenger_links").upsert({
      provider: "slack",
      user_id: tok.user_id,
      chat_id: channel,
      kind: "user",
      slack_team_id: teamId,
      slack_user_id: slackUserId,
      lang,
      active: true,
      last_error: null,
    }, { onConflict: "provider,chat_id" });

    await slack(botToken, "chat.postMessage", { channel, text: T[lang].connected });
    return back("connected");
  }

  const hookSecret = req.headers.get("x-i7-hook-secret");

  // ── The notifications trigger ─────────────────────────────────────────────
  if (hookSecret) {
    if (!process.env.TELEGRAM_HOOK_SECRET || hookSecret !== process.env.TELEGRAM_HOOK_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }
    let body; try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
    if (!body?.id) return json({ error: "Bad request" }, 400);

    const { data: n } = await db.from("notifications")
      .select("id, user_id, org_id, type, title, body, metadata").eq("id", body.id).maybeSingle();
    if (!n) return json({ ok: true, skipped: "gone" });

    const { data: link } = await db.from("messenger_links")
      .select("chat_id, slack_team_id, types, muted_orgs, lang, active, enabled")
      .eq("provider", "slack").eq("user_id", n.user_id).maybeSingle();
    if (!link) return json({ ok: true, skipped: "no_link" });
    if (link.enabled === false) return json({ ok: true, skipped: "disabled" });
    if (!link.active) return json({ ok: true, skipped: "inactive" });
    if (n.org_id && (link.muted_orgs || []).includes(n.org_id)) return json({ ok: true, skipped: "muted" });
    // Through the SHARED rule. This read the row alone and ignored the
    // defaults, so a type switched off by default reached Slack and not
    // Telegram, and the settings panel showed it off for both.
    if (!typeWanted(link, n.type)) return json({ ok: true, skipped: "type_off" });

    const { data: inst } = await db.from("slack_installations")
      .select("bot_token").eq("team_id", link.slack_team_id).maybeSingle();
    if (!inst?.bot_token) return json({ ok: true, skipped: "uninstalled" });

    let workspace = "";
    if (n.org_id) {
      const { data: org } = await db.from("organizations").select("name").eq("id", n.org_id).maybeSingle();
      workspace = org?.name || "";
    }
    const { blocks, text } = await buildBlocks(db, workspace, n, link.lang, appUrl, n.metadata?.task_id, null);
    const res = await slack(inst.bot_token, "chat.postMessage", { channel: link.chat_id, text, blocks });

    if (res?.ok) {
      await db.from("messenger_links").update({ last_sent_at: new Date().toISOString(), last_error: null })
        .eq("provider", "slack").eq("chat_id", link.chat_id);
    } else {
      // account_inactive and channel_not_found are permanent. Retrying those
      // forever is how a bridge turns into a spammer shouting at a closed door.
      const dead = ["account_inactive", "channel_not_found", "token_revoked", "invalid_auth"].includes(res?.error);
      await db.from("messenger_links")
        .update({ last_error: String(res?.error || "send failed").slice(0, 200), ...(dead ? { active: false } : {}) })
        .eq("provider", "slack").eq("chat_id", link.chat_id);
    }
    return json({ ok: true, sent: !!res?.ok, error: res?.ok ? undefined : res?.error });
  }

  // ── Somebody pressed a button ─────────────────────────────────────────────
  const raw = await req.text();
  const okSig = await verifySlack(signingSecret,
    req.headers.get("x-slack-signature"), req.headers.get("x-slack-request-timestamp"), raw);
  if (!okSig) return json({ error: "Unauthorized" }, 401);

  // ── Slack's Events API ────────────────────────────────────────────────────
  // Events arrive as JSON, not as a form, so they are recognised before the
  // form parsing below. Slack expects an answer within three seconds and
  // retries anything else, so this acknowledges first and works after.
  if (raw.startsWith("{")) {
    let evt; try { evt = JSON.parse(raw); } catch { evt = null; }
    if (evt?.type === "url_verification") return new Response(evt.challenge, { status: 200 });
    // Every way out of this branch says why. It answered 200 and did nothing,
    // which from outside is indistinguishable from not having been called.
    const drop = (why, extra) => { console.error("[Slack] file_shared skipped:", why, extra || ""); return json({ ok: true }); };
    if (evt?.type === "event_callback" && evt.event?.type === "file_shared") {
      console.error("[Slack] file_shared:", JSON.stringify({
        user_id: evt.event?.user_id, file_id: evt.event?.file_id,
        channel: evt.event?.channel_id, team: evt.team_id,
      }));
      const teamId = evt.team_id;
      const { data: link } = await db.from("messenger_links")
        .select("user_id, lang, chat_id").eq("provider", "slack")
        .eq("slack_team_id", teamId).eq("slack_user_id", evt.event.user_id).maybeSingle();
      const { data: inst } = await db.from("slack_installations")
        .select("bot_token").eq("team_id", teamId).maybeSingle();
      if (!link?.user_id) return drop("no link for that slack user", evt.event?.user_id);
      if (!inst?.bot_token) return drop("no installation for that team", evt.team_id);
      const t = T[link.lang === "en" ? "en" : "de"];

      const info = await slackForm(inst.bot_token, "files.info", { file: evt.event.file_id });
      const f = info?.ok ? info.file : null;
      // Only pictures. Everything else is a link in Slack already and would be
      // a silent, quota-consuming surprise in Assets.
      if (!info?.ok) return drop("files.info failed", info?.error);
      if (!f) return drop("files.info returned no file");
      if (!/^image\//i.test(f.mimetype || "")) return drop("not an image", f.mimetype);

      const orgs = await workspacesFor(db, link.user_id);
      if (!orgs.length) return drop("no workspaces", link.user_id);

      // Slack delivers file_shared more than once: it retries anything it
      // considers slow, and it sends duplicates of its own accord. Both name
      // the same FILE, which is why the file is the key and the event id is
      // not. The row is written before the question, so the second delivery
      // finds it there and says nothing.
      const once = await db.from("messenger_events")
        .insert({ key: `slack:file:${evt.event.file_id}` }).select("key").maybeSingle();
      if (once.error) {
        if (once.error.code === "23505") return drop("already asked about this file", evt.event.file_id);
        console.error("[Slack] dedupe insert failed, asking anyway:", once.error.message);
      }
      // Old keys are of no interest to anybody: a file nobody answered about
      // within a week is not going to be answered about now.
      db.from("messenger_events").delete()
        .lt("created_at", new Date(Date.now() - 7 * 864e5).toISOString()).then(() => {});

      const one = orgs.length === 1;
      // Assets and a moodboard are two different places, and which one is meant
      // is the first thing to ask rather than something to guess.
      const st = { f: f.id, n: f.name || "bild", ...(one ? { o: orgs[0].id.slice(0, ID_HINT) } : {}) };
      const options = [
        { key: "d", label: t.fileToAssets, set: { d: "a" } },
        { key: "d", label: t.fileToMood, set: { d: "m" } },
        { key: "d", label: t.fileToSocial, set: { d: "s" } },
        { key: "x", label: t.cancel, set: { x: 1 } },
      ];
      // The question goes to the person's own chat with the bot, because that
      // is where a file they sent it belongs.
      const blocks = draftBlocks(t, { t: f.name || "", ...st, chosen: one ? orgs[0].name : "" }, t.fileWhat, options, t.fileTitle)
        .map(b => (b.type === "actions"
          ? { ...b, elements: b.elements.map(e => ({ ...e, action_id: e.action_id.replace("draft_", "asset_") })) }
          : b));
      const asked = await slack(inst.bot_token, "chat.postMessage",
        { channel: link.chat_id, text: t.fileAsk, blocks });
      if (!asked?.ok) return drop("chat.postMessage failed", asked?.error);
      return json({ ok: true });
    }
    if (evt?.type === "event_callback") return drop("event type we do not handle", evt.event?.type);
    return json({ ok: true });
  }

  const params = new URLSearchParams(raw);

  // ── /i7os <what needs doing> ──────────────────────────────────────────────
  // A slash command, not a message: the intent is explicit and we never ask to
  // read anybody's direct messages. Slack wants an answer within three seconds,
  // so the reply IS the response body.
  if (params.get("command")) {
    const teamId = params.get("team_id");
    const slackUserId = params.get("user_id");
    const { data: link } = await db.from("messenger_links")
      .select("user_id, lang").eq("provider", "slack")
      .eq("slack_team_id", teamId).eq("slack_user_id", slackUserId).maybeSingle();
    const t = T[link?.lang === "en" ? "en" : "de"];
    const ephemeral = (text, blocks) =>
      json({ response_type: "ephemeral", text, ...(blocks ? { blocks } : {}) });
    if (!link?.user_id) return ephemeral(t.notConnected);

    // Ein eigener Slash-Befehl ist dasselbe wie "/i7os <befehl> …": der Name
    // wird dem Text vorangestellt, und die Erkennung darunter bleibt, wie sie
    // ist. /i7os bleibt gueltig, damit niemandem etwas wegbricht.
    //
    // Slack kann Befehlsnamen und Beschreibungen NICHT uebersetzen, es gibt nur
    // einen Satz pro App. Deshalb sind die deutschen und die englischen Namen
    // beide angemeldet und landen hier auf demselben Weg. Die ANTWORTEN sind
    // weiterhin in der Sprache der Person, die steht an messenger_links.lang.
    const cmdName = (params.get("command") || "").replace(/^\//, "").toLowerCase();
    const rawSaid = params.get("text") || "";
    const AS_SUB = { post: "post", beitrag: "post", notiz: "notiz", note: "notiz" };
    const said = AS_SUB[cmdName] ? `${AS_SUB[cmdName]} ${rawSaid}` : rawSaid;

    // /help und /status brauchen keinen Text und kommen deshalb vor allem
    // anderen: sonst wuerde ein leerer Befehl zu einer leeren Aufgabe.
    if (cmdName === "help" || /^\s*(help|hilfe)\b/i.test(rawSaid)) {
      return ephemeral(t.slashHelp);
    }
    if (cmdName === "status") {
      const orgs = await workspacesFor(db, link.user_id);
      return ephemeral(orgs.length
        ? `${t.statusOn}\n${orgs.map(o => `• ${o.name}`).join("\n")}`
        : t.newNoWorkspace);
    }

    // "notiz …" or "note …" as the first word. A subcommand rather than a
    // second slash command, which would mean a new manifest, a new scope
    // prompt, and every existing install having to approve it again.
    // "post …" oder "beitrag …": ein Beitrag ohne Bild. Threads nimmt reinen
    // Text, Instagram nicht, und deshalb steht Instagram spaeter gar nicht erst
    // zur Wahl. Unterbefehl aus demselben Grund wie die Notiz: ein zweiter
    // Slash-Befehl hiesse neues Manifest und eine neue Freigabe fuer jede
    // bestehende Installation.
    const asPost = /^\s*(post|beitrag)\b\s*/i.exec(said);
    if (asPost) {
      const body = said.slice(asPost[0].length).trim();
      const { data: instP } = await db.from("slack_installations")
        .select("bot_token").eq("team_id", teamId).maybeSingle();
      if (!instP?.bot_token) return ephemeral(t.newFailed);
      if (!body) {
        // Fragen statt die Schreibweise erklaeren, genau wie bei der Notiz.
        await slack(instP.bot_token, "views.open", {
          trigger_id: params.get("trigger_id"),
          view: {
            type: "modal", callback_id: "social_post_text",
            private_metadata: JSON.stringify({ ch: params.get("channel_id") || "" }),
            title: { type: "plain_text", text: t.socialTextTitle.slice(0, 24) },
            submit: { type: "plain_text", text: "OK" },
            blocks: [{
              type: "input", block_id: "s",
              label: { type: "plain_text", text: t.postLabel.slice(0, 2000) },
              element: { type: "plain_text_input", action_id: "v", multiline: true },
            }],
          },
        });
        return json({ response_type: "ephemeral", text: "" });
      }
      const orgs = await workspacesFor(db, link.user_id);
      if (!orgs.length) return ephemeral(t.newNoWorkspace);
      const short = crypto.randomUUID().slice(0, 8);
      await putDraft(db, `slack:${short}`, link.user_id, { caption: body });
      const one = orgs.length === 1;
      const st = { d: "s", m: short, n: t.postTextOnly, t: body.slice(0, 140),
        ...(one ? { o: orgs[0].id.slice(0, ID_HINT) } : {}) };
      const question = one ? t.socialWhich : t.askWorkspace;
      const options = one
        ? [{ key: "c", label: "Threads", set: { c: "t" } }, { key: "x", label: t.cancel, set: { x: 1 } }]
        : [...orgs.map(o => ({ key: "o", label: o.name, set: { o: o.id.slice(0, ID_HINT) } })),
           { key: "x", label: t.cancel, set: { x: 1 } }];
      // Die Antwort auf einen Slash-Befehl IST die Nachricht, und ein Knopf
      // darin traegt seine response_url mit: replace_original ersetzt sie
      // spaeter, genau wie im Datei-Ablauf.
      const blocks = draftBlocks(t, { ...st, chosen: one ? orgs[0].name : "" }, question, options, t.postTextOnly)
        .map(b => (b.type === "actions"
          ? { ...b, elements: b.elements.map(e => ({ ...e, action_id: e.action_id.replace("draft_", "asset_") })) }
          : b));
      return ephemeral(question, blocks);
    }

    const asNote = /^\s*(notiz|note)\b\s*/i.exec(said);
    if (asNote) {
      const body = said.slice(asNote[0].length);
      if (!body.trim()) {
        // Ask for the text instead of printing the syntax and stopping. A
        // slash command with nothing after it used to answer with an example
        // and keep nothing, so the next thing typed was a fresh command and
        // became a TASK, with a priority, a deadline and an owner to answer
        // for. A modal is Slack's version of Telegram's forced reply: the
        // question is on screen and the answer comes back to it.
        const { data: inst0 } = await db.from("slack_installations")
          .select("bot_token").eq("team_id", teamId).maybeSingle();
        if (!inst0?.bot_token) return ephemeral(t.noteEmpty);
        await slack(inst0.bot_token, "views.open", {
          trigger_id: params.get("trigger_id"),
          view: {
            type: "modal", callback_id: "new_note",
            // The channel, so the question after the modal lands where the
            // person is standing. A submission carries no response_url.
            private_metadata: JSON.stringify({ ch: params.get("channel_id") || "" }),
            title: { type: "plain_text", text: t.noteTitle.slice(0, 24) },
            submit: { type: "plain_text", text: "OK" },
            blocks: [{
              type: "input", block_id: "n",
              label: { type: "plain_text", text: t.noteLabel.slice(0, 2000) },
              element: { type: "plain_text_input", action_id: "v", multiline: true },
            }],
          },
        });
        return new Response("", { status: 200 });
      }
      // Same question the board answers with its filter: a project, or
      // nobody. Nothing is written until it is answered.
      const orgs = await workspacesFor(db, link.user_id);
      if (!orgs.length) return ephemeral(t.newNoWorkspace);
      if (orgs.length > 1) {
        return ephemeral(t.noteTitle, draftBlocks(t, { t: body.trim(), note: 1 }, t.askWorkspace,
          orgs.map(o => ({ key: "o", label: o.name, set: { o: o.id.slice(0, ID_HINT) } })), t.noteTitle));
      }
      const org = orgs[0];
      const projects = await projectsFor(db, link.user_id, org.id);
      return ephemeral(t.noteTitle, draftBlocks(t,
        { t: body.trim(), note: 1, o: org.id.slice(0, ID_HINT), chosen: org.name }, t.askProject, [
          { key: "p", label: t.notePrivate, set: { p: "-" } },
          ...projects.map(pr => ({ key: "p", label: pr.name, set: { p: pr.id.slice(0, ID_HINT) } })),
        ], t.noteTitle));
    }

    // A message that is nothing but a url. Checked before the task wizard,
    // because free text becomes a task and a pasted link is not free text.
    const asLink = asLinkRequest(said);
    if (asLink) {
      const orgs = await workspacesFor(db, link.user_id);
      if (!orgs.length) return ephemeral(t.newNoWorkspace);
      const state = { t: asLink.url, ln: 1, lt: asLink.title || "" };
      if (orgs.length > 1) {
        return ephemeral(t.linkTitle, draftBlocks(t, state, t.askWorkspace,
          orgs.map(o => ({ key: "o", label: o.name, set: { o: o.id.slice(0, ID_HINT) } })), t.linkTitle));
      }
      const org = orgs[0];
      const folders = await linkFoldersFor(db, org.id);
      return ephemeral(t.linkTitle, draftBlocks(t,
        { ...state, o: org.id.slice(0, ID_HINT), chosen: org.name }, t.askFolder, [
          ...folders.map(f => ({ key: "d", label: f.name, set: { d: f.id.slice(0, ID_HINT) } })),
          { key: "d", label: t.linkNoFolder, set: { d: "-" } },
        ], t.linkTitle));
    }

    const { title } = splitDraft(said);
    if (!title) return ephemeral(t.newEmpty);

    const orgs = await workspacesFor(db, link.user_id);
    if (!orgs.length) return ephemeral(t.newNoWorkspace);

    // One workspace is the normal case, and asking about it would be a question
    // with one answer.
    if (orgs.length > 1) {
      return ephemeral(t.newTask, draftBlocks(t, { t: title }, t.askWorkspace,
        orgs.map(o => ({ key: "o", label: o.name, set: { o: o.id.slice(0, ID_HINT) } }))));
    }
    const org = orgs[0];
    const projects = await projectsFor(db, link.user_id, org.id);
    const st = { t: title, o: org.id.slice(0, ID_HINT), chosen: org.name };
    return ephemeral(t.newTask, draftBlocks(t, st, t.askProject, [
      { key: "p", label: t.noProject, set: { p: "-" } },
      ...projects.map(pr => ({ key: "p", label: pr.name, set: { p: pr.id.slice(0, ID_HINT) } })),
    ]));
  }

  // Slack pings a new Request URL once with a url_verification challenge.
  if (!params.get("payload")) {
    try {
      const probe = JSON.parse(raw);
      if (probe?.type === "url_verification") return new Response(probe.challenge, { status: 200 });
    } catch (_) { /* not JSON, not a challenge */ }
    return json({ ok: true });
  }

  let p; try { p = JSON.parse(params.get("payload")); } catch { return json({ ok: true }); }

  // ── The description modal came back ───────────────────────────────────────
  // private_metadata is Slack's own way to carry an id through a modal, so no
  // trick is needed here: the task travels with the view.
  if (p?.type === "view_submission") {
    const { data: mlink } = await db.from("messenger_links")
      .select("user_id, lang, chat_id").eq("provider", "slack")
      .eq("slack_team_id", p.team?.id).eq("slack_user_id", p.user?.id).maybeSingle();
    const mt = T[mlink?.lang === "en" ? "en" : "de"];
    // By block_id, not by position: the modal has two fields now, and reading
    // "the first one" would silently swap them the day a third is added.
    const values = p.view?.state?.values || {};
    const fieldOf = (id) => Object.values(values[id] || {})[0]?.value || "";
    const typed = fieldOf("d");
    const listed = fieldOf("c");
    const blockId = Object.keys(values)[0] || "d";
    // An empty response closes the modal. An error string puts the message
    // under the field instead, which is where somebody is already looking.
    const fail = (msg) => json({ response_action: "errors", errors: { [blockId]: msg } });
    if (!mlink?.user_id) return fail(mt.notConnected);

    // Two modals arrive here. One finishes a draft, and carries it; the other
    // describes a task that already exists, and carries its id.
    if (p.view?.callback_id === "new_task") {
      let st; try { st = JSON.parse(p.view.private_metadata || "{}"); } catch { return fail(mt.newFailed); }
      const { data: inst2 } = await db.from("slack_installations")
        .select("bot_token").eq("team_id", p.team?.id).maybeSingle();
      if (!inst2?.bot_token) return fail(mt.newFailed);
      const done = await finishTask(db, inst2.bot_token, mlink, mt, appUrl,
        { ...st, d: typed || "-", c: listed || "" }, null);
      return done.ok ? new Response("", { status: 200 }) : fail(done.msg);
    }

    // "/i7os post" ohne Text: das Fenster kommt mit dem Beitragstext zurueck,
    // und ab hier ist es derselbe Ablauf wie mit Text hinter dem Befehl.
    if (p.view?.callback_id === "social_post_text") {
      const said2 = fieldOf("s").trim();
      if (!said2) return fail(mt.postLabel);
      const { data: instQ } = await db.from("slack_installations")
        .select("bot_token").eq("team_id", p.team?.id).maybeSingle();
      if (!instQ?.bot_token) return fail(mt.newFailed);
      const orgs2 = await workspacesFor(db, mlink.user_id);
      if (!orgs2.length) return fail(mt.newNoWorkspace);
      const short2 = crypto.randomUUID().slice(0, 8);
      await putDraft(db, `slack:${short2}`, mlink.user_id, { caption: said2 });
      const one2 = orgs2.length === 1;
      const st2 = { d: "s", m: short2, n: mt.postTextOnly, t: said2.slice(0, 140),
        ...(one2 ? { o: orgs2[0].id.slice(0, ID_HINT) } : {}) };
      const q2 = one2 ? mt.socialWhich : mt.askWorkspace;
      const opts2 = one2
        ? [{ key: "c", label: "Threads", set: { c: "t" } }, { key: "x", label: mt.cancel, set: { x: 1 } }]
        : [...orgs2.map(o => ({ key: "o", label: o.name, set: { o: o.id.slice(0, ID_HINT) } })),
           { key: "x", label: mt.cancel, set: { x: 1 } }];
      const blocks2 = draftBlocks(mt, { ...st2, chosen: one2 ? orgs2[0].name : "" }, q2, opts2, mt.postTextOnly)
        .map(b => (b.type === "actions"
          ? { ...b, elements: b.elements.map(e => ({ ...e, action_id: e.action_id.replace("draft_", "asset_") })) }
          : b));
      let meta2 = {}; try { meta2 = JSON.parse(p.view.private_metadata || "{}"); } catch { /* der Direktkanal ist die Rueckfallebene */ }
      await slack(instQ.bot_token, "chat.postMessage",
        { channel: meta2.ch || mlink.chat_id, text: q2, blocks: blocks2 });
      return new Response("", { status: 200 });
    }

    // Das Eingabefenster fuer den Beitragstext kam zurueck. Der Text kann lang
    // sein, ein Knopfwert fasst nur knapp 2000 Zeichen: also wandert er in
    // messenger_drafts und im Knopf steht nur ein kurzer Schluessel.
    if (p.view?.callback_id === "social_text") {
      const said = fieldOf("s").trim();
      if (!said) return fail(mt.socialTextLabel);
      let st; try { st = JSON.parse(p.view.private_metadata || "{}"); } catch { return fail(mt.newFailed); }
      const { data: instS } = await db.from("slack_installations")
        .select("bot_token").eq("team_id", p.team?.id).maybeSingle();
      if (!instS?.bot_token) return fail(mt.newFailed);
      const short = crypto.randomUUID().slice(0, 8);
      await putDraft(db, `slack:${short}`, mlink.user_id, { caption: said });
      const next = { ...st, m: short };
      // Das Fenster hat die urspruengliche Nachricht nicht ersetzt, also geht
      // die Wann-Frage als neue Nachricht in denselben Verlauf.
      const blocks = draftBlocks(mt, next, mt.socialWhen, [
        { key: "w", label: mt.socialNow, set: { w: "n" } },
        { key: "w", label: mt.socialIn1h, set: { w: "1" } },
        { key: "w", label: mt.socialTonight, set: { w: "e" } },
        { key: "w", label: mt.socialTomorrow, set: { w: "m" } },
        { key: "x", label: mt.cancel, set: { x: 1 } },
      ], mt.fileTitle).map(b => (b.type === "actions"
        ? { ...b, elements: b.elements.map(e => ({ ...e, action_id: e.action_id.replace("draft_", "asset_") })) }
        : b));
      await slack(instS.bot_token, "chat.postMessage",
        { channel: mlink.chat_id, text: mt.socialWhen, blocks });
      return new Response("", { status: 200 });
    }

    // The note modal came back. It carries only the text: where the note goes
    // is the same question the slash command asks, answered by the same
    // buttons, so nothing about the note flow exists twice.
    if (p.view?.callback_id === "new_note") {
      const said = fieldOf("n").trim();
      if (!said) return fail(mt.noteEmpty);
      let meta = {}; try { meta = JSON.parse(p.view.private_metadata || "{}"); } catch { /* the DM is the fallback */ }
      const { data: inst3 } = await db.from("slack_installations")
        .select("bot_token").eq("team_id", p.team?.id).maybeSingle();
      if (!inst3?.bot_token) return fail(mt.newFailed);
      const orgs = await workspacesFor(db, mlink.user_id);
      if (!orgs.length) return fail(mt.newNoWorkspace);
      const one = orgs.length === 1 ? orgs[0] : null;
      const projects = one ? await projectsFor(db, mlink.user_id, one.id) : [];
      const blocks = one
        ? draftBlocks(mt, { t: said, note: 1, o: one.id.slice(0, ID_HINT), chosen: one.name },
            mt.askProject, [
              { key: "p", label: mt.notePrivate, set: { p: "-" } },
              ...projects.map(pr => ({ key: "p", label: pr.name, set: { p: pr.id.slice(0, ID_HINT) } })),
            ], mt.noteTitle)
        : draftBlocks(mt, { t: said, note: 1 }, mt.askWorkspace,
            orgs.map(o => ({ key: "o", label: o.name, set: { o: o.id.slice(0, ID_HINT) } })), mt.noteTitle);
      await slack(inst3.bot_token, "chat.postEphemeral", {
        channel: meta.ch || mlink.chat_id, user: p.user?.id, text: mt.noteTitle, blocks,
      });
      return new Response("", { status: 200 });
    }

    const taskId = p.view?.private_metadata;
    if (p.view?.callback_id === "comment_task") {
      const said = await commentOnTask(db, mlink.user_id, taskId, fieldOf("n"));
      return said.ok ? new Response("", { status: 200 })
        : fail(said.reason === "read_only" ? mt.newReadOnly
          : said.reason === "denied" ? mt.newDenied : mt.newFailed);
    }
    const done = typed
      ? await describeTask(db, mlink.user_id, taskId, typed)
      : { ok: true };
    if (done.ok && listed) {
      const list = await addChecklist(db, mlink.user_id, taskId, listed);
      if (!list.ok) return fail(list.reason === "read_only" ? mt.newReadOnly
        : list.reason === "denied" ? mt.newDenied : mt.newFailed);
    }
    if (done.ok) return new Response("", { status: 200 });
    return fail(done.reason === "read_only" ? mt.newReadOnly
      : done.reason === "denied" ? mt.newDenied : mt.newFailed);
  }

  const action = p?.actions?.[0];
  if (!action || action.action_id === "open_app") return json({ ok: true });

  const teamId = p.team?.id;
  const slackUserId = p.user?.id;
  const channel = p.channel?.id || p.container?.channel_id;
  const ts = p.message?.ts || p.container?.message_ts;

  const { data: link } = await db.from("messenger_links")
    .select("user_id, lang, chat_id").eq("provider", "slack")
    .eq("slack_team_id", teamId).eq("slack_user_id", slackUserId).maybeSingle();
  const t = T[link?.lang === "en" ? "en" : "de"];
  const { data: inst } = await db.from("slack_installations").select("bot_token").eq("team_id", teamId).maybeSingle();
  if (!link?.user_id || !inst?.bot_token) return json({ ok: true });

  // Ephemeral: only the person who pressed sees it, and it does not clutter the
  // channel the way a second message would.
  const say = (msg) => slack(inst.bot_token, "chat.postEphemeral", { channel, user: slackUserId, text: msg })
    .then(() => json({ ok: true }));

  // ── Where a picture should go in Assets ───────────────────────────────────
  if (action.action_id.startsWith("asset_")) {
    let st; try { st = JSON.parse(action.value); } catch { return json({ ok: true }); }
    const replace = (text, blocks) => fetch(p.response_url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replace_original: true, text, ...(blocks ? { blocks } : {}) }),
    }).then(() => json({ ok: true }));

    // Nothing has been written at any point before an answer, so cancelling is
    // only a question being taken away.
    if (st.x) return replace(t.cancelled);

    const orgs = await workspacesFor(db, link.user_id);
    if (!orgs.length) return replace(t.newNoWorkspace);
    const asAsset = (blocks) => blocks.map(b => b.type === "actions"
      ? { ...b, elements: b.elements.map(e => ({ ...e, action_id: e.action_id.replace("draft_", "asset_") })) } : b);
    const cancel = { key: "x", label: t.cancel, set: { x: 1 } };

    // Which workspace, when there is more than one.
    if (!st.o) {
      return replace(t.fileWhat, asAsset(draftBlocks(t, st, t.askWorkspace,
        [...orgs.map(o => ({ key: "o", label: o.name, set: { o: o.id.slice(0, ID_HINT) } })), cancel], t.fileTitle)));
    }
    const org = resolveHint(orgs, st.o);
    if (!org) return replace(t.newDenied);
    const projects = await projectsFor(db, link.user_id, org.id);

    // Assets or a moodboard, then the list for whichever was chosen.
    if (!st.d) {
      return replace(t.fileWhat, asAsset(draftBlocks(t, { ...st, chosen: org.name }, t.fileWhat, [
        { key: "d", label: t.fileToAssets, set: { d: "a" } },
        { key: "d", label: t.fileToMood, set: { d: "m" } },
        { key: "d", label: t.fileToSocial, set: { d: "s" } },
        cancel,
      ], t.fileTitle)));
    }
    // ── Social Post: Kanal, Zeitpunkt, fertig ──────────────────────────────
    //
    // Wie bei Telegram spricht der Bot nicht selbst mit Meta. Er legt eine Zeile
    // in scheduled_posts, und der Takt veroeffentlicht sie. "Jetzt" ist ein
    // publish_at von jetzt plus ein Anstoss, damit es nicht bis zum naechsten
    // Durchgang dauert.
    if (st.d === "s") {
      const found = await socialTargetsFor(db, org.id);
      if (!found.length) return replace(t.socialNoChannel);
      // Ohne Datei ist es ein reiner Textbeitrag, und den nimmt Instagram
      // nicht. Statt ihn anzubieten und spaeter abzulehnen, steht er gar nicht
      // erst zur Wahl.
      const isText = !st.f;
      const hasIg = !isText && found.some(x => x.provider === "instagram");
      const hasTh = found.some(x => x.provider === "threads");
      if (!hasIg && !hasTh) return replace(t.socialNoChannel);

      if (!st.c) {
        const choices = [];
        if (hasIg) choices.push({ key: "c", label: "Instagram", set: { c: "i" } });
        if (hasTh) choices.push({ key: "c", label: "Threads", set: { c: "t" } });
        if (hasIg && hasTh) choices.push({ key: "c", label: t.socialBoth, set: { c: "b" } });
        return replace(t.socialWhich, asAsset(draftBlocks(t, { ...st, chosen: org.name },
          t.socialWhich, [...choices, cancel], t.fileTitle)));
      }
      // Kommt ein Bild ohne Kommentar, wird gefragt statt stillschweigend ohne
      // Text zu posten. `a` haelt die Antwort fest: "w" schreiben, "0" ohne.
      if (!st.w && !isText && st.a === undefined) {
        const peek = await slackForm(inst.bot_token, "files.info", { file: st.f });
        const cap = String(peek?.file?.initial_comment?.comment || peek?.file?.title || "").trim();
        if (!cap) {
          return replace(t.socialAskText, asAsset(draftBlocks(t, { ...st, chosen: org.name }, t.socialAskText, [
            { key: "a", label: t.socialWriteText, set: { a: "w" } },
            { key: "a", label: t.socialSkipText, set: { a: "0" } },
            cancel,
          ], t.fileTitle)));
        }
      }
      // "Text schreiben": Slacks eigenes Eingabefenster. private_metadata
      // traegt den Stand mit, dafuer ist es da, also braucht es hier keinen
      // Umweg ueber einen Schluessel.
      if (st.a === "w" && !st.m && !isText) {
        await slack(inst.bot_token, "views.open", {
          trigger_id: p.trigger_id,
          view: {
            type: "modal", callback_id: "social_text",
            private_metadata: JSON.stringify({ ...st, chosen: undefined }).slice(0, 2900),
            title: { type: "plain_text", text: t.socialTextTitle.slice(0, 24) },
            submit: { type: "plain_text", text: "OK" },
            blocks: [{
              type: "input", block_id: "s",
              label: { type: "plain_text", text: t.socialTextLabel.slice(0, 2000) },
              element: { type: "plain_text_input", action_id: "v", multiline: true },
            }],
          },
        });
        return json({ ok: true });
      }
      if (!st.w) {
        return replace(t.socialWhen, asAsset(draftBlocks(t, { ...st, chosen: org.name }, t.socialWhen, [
          { key: "w", label: t.socialNow, set: { w: "n" } },
          { key: "w", label: t.socialIn1h, set: { w: "1" } },
          { key: "w", label: t.socialTonight, set: { w: "e" } },
          { key: "w", label: t.socialTomorrow, set: { w: "m" } },
          cancel,
        ], t.fileTitle)));
      }

      const targets = found.filter(x => st.c === "b"
        || (st.c === "i" && x.provider === "instagram")
        || (st.c === "t" && x.provider === "threads"));
      if (!targets.length) return replace(t.socialNoChannel);

      // Feste Zeiten aus Knoepfen statt getippter Datumsangaben, gerechnet in
      // Berliner Zeit. Ein Zeitpunkt, der heute schon vorbei ist, rutscht auf
      // morgen, statt in der Vergangenheit zu stehen und sofort rauszugehen.
      const berlinNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
      const at = new Date();
      if (st.w === "1") at.setTime(at.getTime() + 3600000);
      else if (st.w === "e" || st.w === "m") {
        const target = new Date(berlinNow);
        if (st.w === "m") { target.setDate(target.getDate() + 1); target.setHours(9, 0, 0, 0); }
        else target.setHours(18, 0, 0, 0);
        if (target <= berlinNow) target.setDate(target.getDate() + 1);
        at.setTime(at.getTime() + (target.getTime() - berlinNow.getTime()));
      }

      let info2 = null, bytes2 = null;
      if (!isText) {
        info2 = await slackForm(inst.bot_token, "files.info", { file: st.f });
        const url2 = info2?.ok ? info2.file?.url_private_download || info2.file?.url_private : null;
        if (!url2) return replace(t.fileGone);
        const res2 = await fetch(url2, { headers: { Authorization: `Bearer ${inst.bot_token}` } });
        if (!res2.ok) return replace(t.fileGone);
        bytes2 = new Uint8Array(await res2.arrayBuffer());
      }
      // Der Kommentar, den jemand beim Hochladen mitschickt, IST der
      // Beitragstext. Genau wie die Bildunterschrift bei Telegram: dort, wo er
      // ohnehin getippt wird.
      const typedText = st.m ? await takeDraft(db, `slack:${st.m}`, link.user_id) : null;
      const caption = typedText?.caption
        ? String(typedText.caption)
        : String(info2?.file?.initial_comment?.comment || info2?.file?.title || "").trim();

      const queued = await queueSocialPost(db, {
        userId: link.user_id, orgId: org.id, name: st.n,
        contentType: info2?.file?.mimetype || "image/jpeg",
        bytes: bytes2, caption, targets, publishAt: at.getTime(),
      });
      if (!queued.ok) {
        return replace(queued.reason === "read_only" ? t.newReadOnly
          : queued.reason === "denied" ? t.newDenied
          : queued.reason === "no_room" ? t.fileNoRoom(humanSize(queued.room.used), humanSize(queued.room.limit))
          : t.newFailed);
      }

      const who = targets.map(x => x.provider === "instagram" ? "Instagram" : "Threads").join(" + ");
      if (st.w !== "n") {
        const whenText = new Intl.DateTimeFormat(link?.lang === "en" ? "en-GB" : "de-DE",
          { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(at);
        return replace(`${headLine(org.name, who)}\n${t.socialQueued(who, whenText)}`);
      }

      const publishSecret = process.env.PUBLISH_SECRET;
      if (appUrl && publishSecret) {
        await fetch(`${appUrl}/api/publish-due`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-i7-hook-secret": publishSecret },
          body: JSON.stringify({}),
        }).catch(() => {});
      }
      // Das Ergebnis steht in der Zeile, die der Takt gerade geschrieben hat,
      // samt Permalink. Gefragt wird sie danach, statt es zu vermuten.
      const { data: done } = await db.from("scheduled_posts")
        .select("status, result").eq("id", queued.post?.id).maybeSingle();
      const plats = Array.isArray(done?.result?.platforms) ? done.result.platforms : [];
      const links = plats.filter(x => x.url)
        .map(x => `<${x.url}|${x.platform === "instagram" ? "Instagram" : "Threads"}>`);
      const failed = plats.filter(x => x.status === "failed");
      const line = links.length ? `${t.socialDone(who)}\n${links.join("  ·  ")}`
        : failed.length ? t.socialFailed(failed[0].error || "")
        : t.socialWorking;
      return replace(`${headLine(org.name, who)}\n${line}`);
    }

    if (st.d === "m" && !st.b) {
      const boards = await moodboardsFor(db, link.user_id, org.id);
      if (!boards.length) return replace(t.fileNoBoards);
      return replace(t.moodAsk, asAsset(draftBlocks(t, { ...st, chosen: org.name }, t.moodAsk,
        [...boards.map(b => ({ key: "b", label: b.name, set: { b: b.id.slice(0, ID_HINT) } })), cancel], t.fileTitle)));
    }

    if (st.d === "a" && st.p === undefined) {
      return replace(t.fileAsk, asAsset(draftBlocks(t, { ...st, chosen: org.name }, t.fileAsk, [
        { key: "p", label: t.filePrivate, set: { p: "-" } },
        ...projects.map(pr => ({ key: "p", label: pr.name, set: { p: pr.id.slice(0, ID_HINT) } })),
        cancel,
      ], t.fileTitle)));
    }

    const project = st.p && st.p !== "-" ? resolveHint(projects, st.p) : null;
    const board = st.b ? resolveHint(await moodboardsFor(db, link.user_id, org.id), st.b) : null;
    if (st.d === "m" && !board) return replace(t.fileGone);
    const info = await slackForm(inst.bot_token, "files.info", { file: st.f });
    const url = info?.ok ? info.file?.url_private_download || info.file?.url_private : null;
    if (!url) return replace(t.fileGone);
    // A private Slack url needs the bot token as a bearer, which is the whole
    // reason files:read had to be asked for.
    const res = await fetch(url, { headers: { Authorization: `Bearer ${inst.bot_token}` } });
    if (!res.ok) return replace(t.fileGone);
    const bytes = new Uint8Array(await res.arrayBuffer());

    const saved = board
      ? await addMoodboardImage(db, { userId: link.user_id, orgId: org.id, boardId: board.id,
                                      name: st.n, contentType: info.file?.mimetype || "image/jpeg", bytes })
      : await addAssetFile(db, { userId: link.user_id, orgId: org.id, projectId: project?.id || null,
                                 name: st.n, contentType: info.file?.mimetype || "image/jpeg", bytes });
    if (!saved.ok) {
      return replace(saved.reason === "read_only" ? t.newReadOnly
        : saved.reason === "denied" ? t.newDenied
        : saved.reason === "no_room" ? t.fileNoRoom(humanSize(saved.room.used), humanSize(saved.room.limit))
        : t.newFailed);
    }
    return replace(board
      ? `${headLine(org.name, board.name)}\n${t.moodSaved(board.name, humanSize(saved.size))}`
      : `${headLine(org.name, project?.name || t.filePrivate)}\n${t.fileSaved(saved.file?.name || st.n, humanSize(saved.size))}`);
  }

  // ── A step of the new-task wizard ─────────────────────────────────────────
  if (action.action_id.startsWith("draft_")) {
    let st; try { st = JSON.parse(action.value); } catch { return json({ ok: true }); }
    // The ephemeral message can only be changed through the url Slack sends
    // with the press; chat.update does not reach one.
    const replace = (text, blocks) => fetch(p.response_url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replace_original: true, text, ...(blocks ? { blocks } : {}) }),
    }).then(() => json({ ok: true }));

    const orgs = await workspacesFor(db, link.user_id);
    const org = resolveHint(orgs, st.o);
    if (!org) return replace(t.newDenied);
    const projects = await projectsFor(db, link.user_id, org.id);
    const project = st.p && st.p !== "-" ? resolveHint(projects, st.p) : null;

    // A link asks one question too: which folder.
    if (st.ln) {
      const folders = await linkFoldersFor(db, org.id);
      if (st.d === undefined) {
        return replace(t.linkTitle, draftBlocks(t, { ...st, chosen: org.name }, t.askFolder, [
          ...folders.map(f => ({ key: "d", label: f.name, set: { d: f.id.slice(0, ID_HINT) } })),
          { key: "d", label: t.linkNoFolder, set: { d: "-" } },
        ], t.linkTitle));
      }
      const folder = st.d && st.d !== "-" ? resolveHint(folders, st.d) : null;
      const made = await createWorkspaceLink(db, {
        userId: link.user_id, orgId: org.id, folderId: folder?.id || null,
        url: st.t, title: st.lt || null, appUrl,
      });
      return replace(made.ok
        ? `${headLine(org.name, folder?.name || t.linkNoFolder)}\n${made.link?.title || made.host}\n${t.linkSaved}`
        : made.reason === "read_only" ? t.newReadOnly
        : made.reason === "denied" ? t.newDenied : t.newFailed);
    }

    // A note asks one question and is done. It has no owner to pick and no
    // deadline, which is the whole reason it is not a five-step wizard.
    if (st.note) {
      if (st.p === undefined) {
        return replace(t.noteTitle, draftBlocks(t, { ...st, chosen: org.name }, t.askProject, [
          { key: "p", label: t.notePrivate, set: { p: "-" } },
          ...projects.map(pr => ({ key: "p", label: pr.name, set: { p: pr.id.slice(0, ID_HINT) } })),
        ], t.noteTitle));
      }
      const made = await createNote(db, {
        userId: link.user_id, orgId: org.id, content: st.t, projectName: project?.name || null,
      });
      return replace(made.ok ? `${headLine(org.name, project?.name || t.notePrivate)}\n${t.noteMade}`
        : made.reason === "read_only" ? t.newReadOnly
        : made.reason === "denied" ? t.newDenied : t.newFailed);
    }

    st.chosen = [org.name, st.p === undefined ? null : (project?.name || t.noProject),
                 t.prio[st.r], t.dueLabels[st.u]].filter(Boolean).join(" · ");

    const step = nextQuestion(st);
    if (step === "project") {
      return replace(t.newTask, draftBlocks(t, st, t.askProject, [
        { key: "p", label: t.noProject, set: { p: "-" } },
        ...projects.map(pr => ({ key: "p", label: pr.name, set: { p: pr.id.slice(0, ID_HINT) } })),
      ]));
    }
    if (step === "priority") {
      return replace(t.newTask, draftBlocks(t, st, t.askPriority,
        Object.keys(PRIORITY_CODES).map(k => ({ key: "r", label: t.prio[k], set: { r: k } }))));
    }
    if (step === "due") {
      return replace(t.newTask, draftBlocks(t, st, t.askDue,
        Object.keys(t.dueLabels).map(k => ({ key: "u", label: t.dueLabels[k], set: { u: k } }))));
    }
    if (step === "assignee") {
      const people = await handoverCandidates(db, { org_id: org.id, project_id: null }, link.user_id);
      return replace(t.newTask, draftBlocks(t, st, t.askAssignee, [
        { key: "a", label: t.forMe, set: { a: "-" } },
        ...people.map(pr => ({ key: "a", label: pr.name, set: { a: pr.id.slice(0, ID_HINT) } })),
      ]));
    }

    // The description is asked HERE, not after the task exists. Sending people
    // to the bot's own chat to type one means leaving the channel they are
    // already standing in, which is the wrong shape for a thing you are in the
    // middle of. A modal opens over whatever is on screen.
    if (st.d === undefined) {
      return replace(t.newTask, draftBlocks(t, st, t.askDescribe, [
        { key: "d", label: t.btnWrite, set: { d: "!" } },
        { key: "d", label: t.btnSkip, set: { d: "-" } },
      ]));
    }
    if (st.d === "!") {
      // The whole draft rides in private_metadata, which Slack hands back with
      // the submission. Nothing is written until it comes back.
      await slack(inst.bot_token, "views.open", {
        trigger_id: p.trigger_id,
        view: {
          type: "modal", callback_id: "new_task",
          private_metadata: JSON.stringify({ ...st, d: undefined }).slice(0, 2900),
          title: { type: "plain_text", text: t.describeTitle.slice(0, 24) },
          submit: { type: "plain_text", text: "OK" },
          // Two fields, both optional: the modal is already open, and a
          // checklist is the same gesture as a description, so asking for it
          // separately would be a step for nothing.
          blocks: [
            { type: "input", block_id: "d", optional: true,
              label: { type: "plain_text", text: t.describeLabel.slice(0, 2000) },
              element: { type: "plain_text_input", action_id: "v", multiline: true } },
            { type: "input", block_id: "c", optional: true,
              label: { type: "plain_text", text: t.checklistLabel.slice(0, 2000) },
              element: { type: "plain_text_input", action_id: "v", multiline: true } },
          ],
        },
      });
      return json({ ok: true });
    }

    const done = await finishTask(db, inst.bot_token, link, t, appUrl, st, channel);
    return replace(done.ok ? t.newMade : done.msg);
  }

  // ── The description button on a created task ──────────────────────────────
  if (action.action_id === "comment") {
    await slack(inst.bot_token, "views.open", {
      trigger_id: p.trigger_id,
      view: {
        type: "modal", callback_id: "comment_task", private_metadata: action.value,
        title: { type: "plain_text", text: t.commentTitle.slice(0, 24) },
        submit: { type: "plain_text", text: "OK" },
        blocks: [{
          type: "input", block_id: "n",
          label: { type: "plain_text", text: t.commentLabel.slice(0, 2000) },
          element: { type: "plain_text_input", action_id: "v", multiline: true },
        }],
      },
    });
    return json({ ok: true });
  }

  if (action.action_id === "describe") {
    await slack(inst.bot_token, "views.open", {
      trigger_id: p.trigger_id,
      view: {
        type: "modal", private_metadata: action.value,
        title: { type: "plain_text", text: t.describeTitle.slice(0, 24) },
        submit: { type: "plain_text", text: "OK" },
        blocks: [{
          type: "input", block_id: "d",
          label: { type: "plain_text", text: t.describeLabel.slice(0, 2000) },
          element: { type: "plain_text_input", action_id: "v", multiline: true },
        }],
      },
    });
    return json({ ok: true });
  }

  const [notifId, arg] = String(action.value || "").split(":");
  const { data: n } = await db.from("notifications")
    .select("id, user_id, org_id, type, title, body, metadata").eq("id", notifId).maybeSingle();
  const taskId = n?.metadata?.task_id;
  if (!taskId) return say(t.cbGone);

  const { data: task } = await db.from("tasks")
    .select("id, title, org_id, project_id, column_key, creator_id").eq("id", taskId).maybeSingle();
  if (!task) return say(t.cbGone);

  // The two gates a service-key write has to rebuild by hand. Shared with
  // Telegram, for exactly the reason that they must never differ.
  if (!(await mayTouchTask(db, link.user_id, task))) return say(t.cbDenied);
  if (await orgIsReadOnly(db, task.org_id)) return say(t.cbReadOnly);

  const rewrite = async (footer) => {
    let workspace = "";
    if (n.org_id) {
      const { data: org } = await db.from("organizations").select("name").eq("id", n.org_id).maybeSingle();
      workspace = org?.name || "";
    }
    const { blocks, text } = await buildBlocks(db, workspace, n, link.lang, appUrl, taskId, footer);
    await slack(inst.bot_token, "chat.update", { channel, ts, text, blocks });
  };

  if (action.action_id === "hand_over" || action.action_id === "hand_back") {
    if (action.action_id === "hand_back") { await rewrite(null); return json({ ok: true }); }
    const people = await handoverCandidates(db, task, link.user_id);
    if (!people.length) return say(t.cbNoOne);
    // The list replaces the buttons on the message itself, so it cannot be
    // answered by somebody else's stale copy.
    const { blocks } = await buildBlocks(db, "", n, link.lang, appUrl, taskId, null);
    blocks[blocks.length - 1] = {
      type: "actions",
      elements: [
        // Indexed, like every other list here: two people whose ids share
        // eight characters would otherwise produce two buttons with the same
        // action_id, which makes the whole block invalid.
        ...people.slice(0, 8).map((pr, i) => ({
          type: "button", action_id: `pick_${i}_${pr.id.slice(0, ID_HINT)}`,
          text: { type: "plain_text", text: pr.name.slice(0, 70) },
          value: `${n.id}:${pr.id.slice(0, ID_HINT)}`,
        })),
        { type: "button", action_id: "hand_back", text: { type: "plain_text", text: t.btnBack }, value: `${n.id}` },
      ],
    };
    let workspace = "";
    if (n.org_id) {
      const { data: org } = await db.from("organizations").select("name").eq("id", n.org_id).maybeSingle();
      workspace = org?.name || "";
    }
    const full = await buildBlocks(db, workspace, n, link.lang, appUrl, taskId, t.pickWho);
    full.blocks[full.blocks.length - 1] = blocks[blocks.length - 1];
    await slack(inst.bot_token, "chat.update", { channel, ts, text: full.text, blocks: full.blocks });
    return json({ ok: true });
  }

  if (action.action_id.startsWith("pick_")) {
    const target = resolveHint(await handoverCandidates(db, task, link.user_id), arg);
    if (!target) return say(t.cbGone);
    if (!(await handTaskTo(db, task, target, link.user_id)).ok) return say(t.cbFailed);
    await rewrite(t.markPassed(target.name));
    return say(t.cbPassed(target.name));
  }

  if (action.action_id.startsWith("col_")) {
    const target = arg;
    if (!MOVE_COLUMNS.includes(target)) return json({ ok: true });
    const label = COLUMN_LABELS[t.lang][target];
    if (task.column_key === target) return say(t.cbAlreadyIn(label));
    if (!(await moveTaskTo(db, task, target, link.user_id)).ok) return say(t.cbFailed);
    await rewrite(t.markMoved(label));
    return say(t.cbMoved(label));
  }

  return json({ ok: true });
}
