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
const SCOPES = "chat:write,im:write";

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
      }] : []),
      { type: "button", action_id: "open_app", url: deepLink(appUrl, n), text: { type: "plain_text", text: t.open } },
    ],
  });
  // The fallback line is what a push notification and a screen reader get.
  return { blocks, text: `${title}${body ? " — " + body : ""}` };
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
    return json({ configured: true, installations: count ?? 0, connected_people: links ?? 0, redirect_uri: redirectUri });
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
  // Slack pings a new Request URL once with a url_verification challenge.
  if (!params.get("payload")) {
    try {
      const probe = JSON.parse(raw);
      if (probe?.type === "url_verification") return new Response(probe.challenge, { status: 200 });
    } catch (_) { /* not JSON, not a challenge */ }
    return json({ ok: true });
  }

  let p; try { p = JSON.parse(params.get("payload")); } catch { return json({ ok: true }); }
  const action = p?.actions?.[0];
  if (!action || action.action_id === "open_app") return json({ ok: true });

  const teamId = p.team?.id;
  const slackUserId = p.user?.id;
  const channel = p.channel?.id || p.container?.channel_id;
  const ts = p.message?.ts || p.container?.message_ts;

  const { data: link } = await db.from("messenger_links")
    .select("user_id, lang").eq("provider", "slack")
    .eq("slack_team_id", teamId).eq("slack_user_id", slackUserId).maybeSingle();
  const t = T[link?.lang === "en" ? "en" : "de"];
  const { data: inst } = await db.from("slack_installations").select("bot_token").eq("team_id", teamId).maybeSingle();
  if (!link?.user_id || !inst?.bot_token) return json({ ok: true });

  // Ephemeral: only the person who pressed sees it, and it does not clutter the
  // channel the way a second message would.
  const say = (msg) => slack(inst.bot_token, "chat.postEphemeral", { channel, user: slackUserId, text: msg })
    .then(() => json({ ok: true }));

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
        ...people.slice(0, 8).map(pr => ({
          type: "button", action_id: `pick_${pr.id.slice(0, ID_HINT)}`,
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
