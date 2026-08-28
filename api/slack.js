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
const SCOPES = "chat:write,im:write,commands";

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
const buildBlocks = async (db, workspace, n, lang, appUrl, taskId, footer) => {
  const { title, body } = notifLines(n, lang !== "en");
  // The card is read FIRST: its project belongs in the line above the title,
  // beside the workspace, and that line cannot be built before we have it.
  const f = taskId ? await taskFacts(db, taskId, lang) : null;
  const where = headLine(workspace, f?.project);
  const head = [
    where ? `*${esc(where)}*` : null,
    `*${esc(title)}*`,
    body ? esc(body) : null,
  ].filter(Boolean).join("\n");

  const blocks = [{ type: "section", text: { type: "mrkdwn", text: head } }];
  if (f?.description) blocks.push({ type: "section", text: { type: "mrkdwn", text: esc(f.description) } });
  if (f?.facts.length) blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: esc(f.facts.join("  ·  ")) }] });
  if (f?.checklist) {
    const c = f.checklist;
    const rows = c.shown.map(i => `${i.checked ? "[x]" : "[ ]"} ${esc(i.text)}`);
    if (c.more) rows.push(esc(c.moreLabel(c.more)));
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*${esc(c.label)} ${c.done}/${c.total}*\n${rows.join("\n")}` } });
  }
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
  return { blocks, text: `${title}${body ? " — " + body : ""}` };
};

// The wizard, as one ephemeral message that replaces itself. The whole state
// travels in each button's value: Slack allows 2000 characters there, so unlike
// Telegram it can simply carry the text instead of reaching back for it.
const draftBlocks = (t, st, question, options) => ([
  { type: "section", text: { type: "mrkdwn",
    text: `*${esc(t.newTask)}*\n${esc(st.t)}${st.chosen ? `\n\n_${esc(st.chosen)}_` : ""}` } },
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
      .select("team_id, bot_token").limit(1).maybeSingle();
    let tokenOk = null;
    if (inst?.bot_token) {
      const who = await slack(inst.bot_token, "auth.test", {});
      tokenOk = !!who?.ok;
    }
    return json({
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
    // An unknown type is worth sending: a notification the app starts writing
    // should reach people, not be dropped until somebody updates a table.
    if ((link.types || {})[n.type] === false) return json({ ok: true, skipped: "type_off" });

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

    const { title } = splitDraft(params.get("text") || "");
    if (!title) return ephemeral(t.newEmpty);

    const orgs = await workspacesFor(db, link.user_id);
    if (!orgs.length) return ephemeral(t.newNoWorkspace);

    // One workspace is the normal case, and asking about it would be a question
    // with one answer.
    if (orgs.length > 1) {
      return ephemeral(t.newTask, draftBlocks(t, { t: title }, t.askProject,
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
