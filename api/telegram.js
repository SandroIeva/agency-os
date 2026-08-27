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
    linked: (name) => `✅ Verbunden. Du bekommst deine i7 OS-Benachrichtigungen ab jetzt hier${name ? `, ${name}` : ""}.`,
    already: "Du bist bereits verbunden. /stop trennt die Verbindung.",
    expired: "Dieser Link ist abgelaufen. Öffne i7 OS → Einstellungen → Konto und verbinde noch einmal.",
    stopped: "Verbindung getrennt. Du bekommst hier keine Benachrichtigungen mehr.",
    notLinked: "Hier ist nichts verbunden.",
    status: (n) => `Verbunden. Aktive Benachrichtigungen: ${n}.`,
    help: "Ich schicke dir Benachrichtigungen aus i7 OS. Verbinden kannst du dich in der App unter Einstellungen → Konto. /stop trennt die Verbindung.",
    open: "In i7 OS öffnen",
    btnDone: "Erledigt",
    cbDone: "Erledigt.",
    cbAlready: "War schon erledigt.",
    cbGone: "Diese Aufgabe gibt es nicht mehr.",
    cbDenied: "Du hast auf diesen Workspace keinen Zugriff.",
    cbReadOnly: "Dieses Konto hat keinen aktiven Plan. Zum Ändern wird einer gebraucht.",
    cbFailed: "Hat nicht geklappt. Versuch es in der App.",
    markDone: "Erledigt über Telegram.",
  },
  en: {
    linked: (name) => `✅ Connected. Your i7 OS notifications arrive here from now on${name ? `, ${name}` : ""}.`,
    already: "You are already connected. /stop disconnects.",
    expired: "This link has expired. Open i7 OS → Settings → Account and connect again.",
    stopped: "Disconnected. No more notifications here.",
    notLinked: "Nothing is connected here.",
    status: (n) => `Connected. Active notification types: ${n}.`,
    help: "I send you notifications from i7 OS. Connect in the app under Settings → Account. /stop disconnects.",
    open: "Open in i7 OS",
    btnDone: "Done",
    cbDone: "Marked done.",
    cbAlready: "Already done.",
    cbGone: "That task is gone.",
    cbDenied: "You do not have access to that workspace.",
    cbReadOnly: "This account has no active plan. Changes need one.",
    cbFailed: "That did not work. Try it in the app.",
    markDone: "Marked done from Telegram.",
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
const DETAIL_MAX = 600;
const notifText = (workspace, n, detail) => {
  const d = String(detail || "").trim();
  return [
    workspace ? `<b>${esc(workspace)}</b>` : null,
    `<b>${esc(n.title)}</b>`,
    n.body ? esc(n.body) : null,
    d ? "\n" + esc(d.length > DETAIL_MAX ? d.slice(0, DETAIL_MAX).trimEnd() + "…" : d) : null,
  ].filter(Boolean).join("\n");
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

export default async function handler(req) {
  const reqUrl = new URL(req.url);
  const setup = reqUrl.searchParams.get("setup");
  if (req.method !== "POST" && !setup) return json({ error: "Method not allowed" }, 405);

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

  // ── One-time wiring ───────────────────────────────────────────────────────
  // Registering the webhook by hand means pasting a bot token into a terminal,
  // which is the one step most likely to go wrong and the one place the token
  // is most likely to end up somewhere it should not. The function already HAS
  // the token, so it can do it itself and then report what Telegram thinks the
  // wiring looks like. Guarded by the hook secret; it can only ever point the
  // webhook at this very deployment, so there is nothing here to steal.
  if (setup) {
    if (!process.env.TELEGRAM_HOOK_SECRET || setup !== process.env.TELEGRAM_HOOK_SECRET) {
      return json({ error: "Unauthorized" }, 401);
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
    brand.name = (await api(botToken, "setMyName", { name: "i7 OS" }))?.ok || false;
    brand.short = (await api(botToken, "setMyShortDescription", {
      short_description: "Notifications from your i7 OS workspace, and a button that closes a task without opening the app.",
    }))?.ok || false;
    brand.shortDe = (await api(botToken, "setMyShortDescription", {
      language_code: "de",
      short_description: "Benachrichtigungen aus deinem i7 OS Workspace, plus ein Knopf, der Aufgaben ohne Umweg erledigt.",
    }))?.ok || false;
    // Shown on the empty chat screen, before anyone has pressed Start.
    brand.about = (await api(botToken, "setMyDescription", {
      description: "i7 OS is the workspace OS for creative agencies. Connect this bot in the app under Settings, Account, and your notifications arrive here. Tasks can be marked done straight from the chat.",
    }))?.ok || false;
    brand.aboutDe = (await api(botToken, "setMyDescription", {
      language_code: "de",
      description: "i7 OS ist das Workspace-Betriebssystem für Kreativagenturen. Verbinde diesen Bot in der App unter Einstellungen, Konto, dann kommen deine Benachrichtigungen hier an. Aufgaben lassen sich direkt aus dem Chat erledigen.",
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
    let detail = "";
    if (taskId) {
      const { data: task } = await db.from("tasks").select("description").eq("id", taskId).maybeSingle();
      detail = task?.description || "";
    }
    const keyboard = [
      ...(taskId ? [[{ text: t.btnDone, callback_data: `d:${n.id}` }]] : []),
      [{ text: t.open, url: deepLink(appUrl, n) }],
    ];

    const res = await api(botToken, "sendMessage", {
      chat_id: link.chat_id,
      text: notifText(workspace, n, detail),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: keyboard },
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

    const cut = String(cb.data || "").indexOf(":");
    const action = cut > 0 ? cb.data.slice(0, cut) : "";
    const notifId = cut > 0 ? cb.data.slice(cut + 1) : "";
    // "a" was assign-to-me and no longer exists. Messages already in someone's
    // chat still carry that button, so it is accepted and answered with the
    // shrug rather than left to spin.
    if (!cbChat || !notifId || action !== "d") return answer("");

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
      .select("id, org_id, project_id, column_key, description").eq("id", taskId).maybeSingle();
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

    if (task.column_key === "done") return answer(t.cbAlready);

    const { error: upErr } = await db.from("tasks")
      .update({ column_key: "done", updated_at: new Date().toISOString() }).eq("id", task.id);
    if (upErr) return answer(t.cbFailed, true);

    // The message says what happened to it, so the chat still reads correctly
    // tomorrow. The action buttons go with it: pressing "done" twice is not a
    // thing anyone means to do.
    await api(botToken, "editMessageText", {
      chat_id: cbChat,
      message_id: cb.message.message_id,
      text: `${notifText(await orgName(db, n.org_id), n, task.description)}\n\n<i>${esc(t.markDone)}</i>`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: t.open, url: deepLink(appUrl, n) }]] },
    });
    return answer(t.cbDone);
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
