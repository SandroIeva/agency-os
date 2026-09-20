// Threads, directly through Meta. The third of the three, and a separate one.
//
// "The Meta API" is not one thing: Instagram, Facebook Pages and Threads are
// three integrations with three sets of scopes and three App Reviews. Threads
// is its own app USE CASE with its own app id and secret, which is why this is
// a file of its own and not a mode on api/instagram.js. A workspace can have
// one without the other.
//
// What Threads does that Instagram does not: a post with no picture at all.
// Text is a first-class post here, and the composer has to know that.
//
// Edge runtime → does NOT count against the Hobby 12-function Node limit, which
// stands at 11 of 12.
//
// Verbs. The first needs no secret and answers for itself:
//   GET  ?check=1                     → is it configured, and which commit is live
//   GET  ?mode=install&state=<token>  → send somebody to Threads' consent screen
//   GET  ?mode=callback&code=…        → Threads sends them back here
//   POST ?mode=deauthorize            → Meta calls this when somebody removes the app
//   POST ?mode=delete                 → Meta's data deletion request callback
//   GET  ?mode=delete-status&id=…     → the page that callback's url points at
//   POST { mode: "status",     orgId } → which accounts are connected, and as whom
//   POST { mode: "disconnect", orgId, threadsUserId } → forget one account
//   POST { mode: "publish",    orgId, … } → one post, container flow
//   POST { mode: "publish-finish", orgId, containerId } → finish a slow one
//   POST { mode: "overview",   orgId } → profile and the 24h window, one trip
//   POST { mode: "limit",      orgId } → posts left in the 24h window
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

// Threads is moving from threads.net to threads.com and Meta's own pages cite
// both. Constants rather than literals scattered about, so the day one of them
// stops answering is a one-line day.
const AUTH_HOST = process.env.THREADS_AUTH_HOST || "https://threads.net";
const GRAPH_ROOT = process.env.THREADS_GRAPH_HOST || "https://graph.threads.net";
const V = process.env.THREADS_API_VERSION || "v1.0";
const GRAPH = `${GRAPH_ROOT}/${V}`;

// Read the profile, publish to it, read its numbers, read the answers under
// its posts. A token keeps the scopes it was issued with, so widening this list
// strands every connection made before the change: it belongs in the same App
// Review as the rest, not in a later one. Asking for a permission we do not use
// is the surest way to have a review rejected, so the list is exactly what the
// code calls.
//
// threads_read_replies is the GET half. threads_manage_replies (answering,
// hiding, approving) is deliberately NOT asked for: nothing in i7OS answers a
// reply, it only shows them, the same way the Instagram panel does.
// threads_profile_discovery was here for the Benchmark card, which is gone. A
// connection made while it was asked for still carries it, which is harmless.
const SCOPES = ["threads_basic", "threads_content_publish", "threads_manage_insights", "threads_read_replies"].join(",");

// 60-day tokens with no refresh token: a live one is traded for a fresh one, so
// it must happen before the old one lapses. Threads refuses to refresh a token
// under 24 hours old, which is why a brand-new row is left alone.
const REFRESH_WHEN_DAYS_LEFT = 10;
const MIN_AGE_MS = 25 * 3600 * 1000;

// One allowlist for the direct Meta path. THREADS_DIRECT_ORGS if it is set,
// otherwise whatever Instagram was already cleared for, so turning Threads on
// for a workspace that already posts to Instagram directly is nothing to set up
// twice.
const enabledOrgs = () =>
  (process.env.THREADS_DIRECT_ORGS || process.env.INSTAGRAM_DIRECT_ORGS || "")
    .split(",").map(s => s.trim()).filter(Boolean);

async function usableToken(db, row) {
  const msLeft = new Date(row.token_expires_at).getTime() - Date.now();
  if (msLeft <= 0) return null;
  const old = Date.now() - new Date(row.created_at).getTime() > MIN_AGE_MS;
  if (msLeft > REFRESH_WHEN_DAYS_LEFT * 86400000 || !old) return row.access_token;

  const url = new URL(`${GRAPH_ROOT}/refresh_access_token`);
  url.searchParams.set("grant_type", "th_refresh_token");
  url.searchParams.set("access_token", row.access_token);
  const res = await fetch(url.toString());
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) {
    await db.from("threads_connections")
      .update({ last_error: `refresh failed (${res.status})`, updated_at: new Date().toISOString() })
      .eq("org_id", row.org_id).eq("threads_user_id", row.threads_user_id);
    // The old token is still valid until it lapses, so this is not fatal yet.
    return row.access_token;
  }
  await db.from("threads_connections").update({
    access_token: j.access_token,
    token_expires_at: new Date(Date.now() + (j.expires_in ?? 5184000) * 1000).toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("org_id", row.org_id).eq("threads_user_id", row.threads_user_id);
  return j.access_token;
}

const th = async (token, path, params = {}) => {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
};

// Meta's signed_request: base64url payload with an HMAC-SHA256 of it, keyed on
// the app secret. Verified rather than trusted, or anybody who knows the
// callback url could delete a workspace's connection.
async function readSignedRequest(signed, secret) {
  const [sig, payload] = String(signed || "").split(".");
  if (!sig || !payload) return null;
  const b64 = (s) => atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4));
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  const given = Uint8Array.from(b64(sig), c => c.charCodeAt(0));
  if (mac.length !== given.length || !mac.every((b, i) => b === given[i])) return null;
  try { return JSON.parse(b64(payload)); } catch { return null; }
}

export default async function handler(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  const check = url.searchParams.get("check");
  if (req.method !== "POST" && !mode && !check) return json({ error: "Method not allowed" }, 405);

  const clientId = process.env.THREADS_APP_ID;
  const clientSecret = process.env.THREADS_APP_SECRET;
  const supaUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const appUrl = (process.env.PUBLIC_APP_URL || "https://app.i7os.com").replace(/\/$/, "");
  const redirectUri = `${appUrl}/threads/callback`;

  // Names of what is missing, never values.
  const missing = [
    !clientId && "THREADS_APP_ID",
    !clientSecret && "THREADS_APP_SECRET",
    !supaUrl && "SUPABASE_URL",
    !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null;
  if (missing.length) {
    if (check) return json({ configured: false, missing, redirect_uri: redirectUri, commit }, 200);
    return json({ error: "Threads is not configured", code: "not_configured", missing }, 503);
  }

  const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // ── Health, needs no secret ───────────────────────────────────────────────
  if (check) {
    const { count } = await db.from("threads_connections")
      .select("org_id", { count: "exact", head: true });
    return json({
      configured: true,
      connections: count ?? 0,
      redirect_uri: redirectUri,
      deauthorize_url: `${appUrl}/threads/deauthorize`,
      delete_url: `${appUrl}/threads/delete`,
      scopes: SCOPES,
      auth_host: AUTH_HOST,
      graph_host: GRAPH_ROOT,
      api_version: V,
      enabled_orgs: enabledOrgs().length,
      commit,
    });
  }

  // ── Send somebody to Threads' consent screen ──────────────────────────────
  // state is the same one-time token Telegram, Slack, Pinterest, Figma and
  // Instagram use, minted by create_messenger_link_token for the signed-in
  // person and carrying the workspace.
  if (mode === "install") {
    const state = url.searchParams.get("state") || "";
    if (!state) return json({ error: "Missing state" }, 400);
    const authorize = new URL(`${AUTH_HOST}/oauth/authorize`);
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", SCOPES);
    authorize.searchParams.set("state", state);
    return Response.redirect(authorize.toString(), 302);
  }

  // ── Threads sends them back ───────────────────────────────────────────────
  if (mode === "callback") {
    const back = (status) => Response.redirect(`${appUrl}/?threads=${status}`, 302);
    const code = (url.searchParams.get("code") || "").replace(/#_$/, "");
    const state = url.searchParams.get("state");
    if (url.searchParams.get("error") || !code || !state) return back("cancelled");

    const { data: tok } = await db.from("messenger_link_tokens")
      .select("token, user_id, org_id, expires_at, used_at").eq("token", state).maybeSingle();
    if (!tok || tok.used_at || !tok.org_id || new Date(tok.expires_at).getTime() < Date.now()) return back("expired");
    const { data: claimed } = await db.from("messenger_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", state).is("used_at", null).select("token").maybeSingle();
    if (!claimed) return back("expired");

    const { data: stillAMember } = await db.from("org_members").select("user_id")
      .eq("org_id", tok.org_id).eq("user_id", tok.user_id).maybeSingle();
    if (!stillAMember) return back("forbidden");
    if (!enabledOrgs().includes(tok.org_id)) return back("not_enabled");

    // Authorization code → short-lived token. Form-encoded, on the graph host.
    const shortRes = await fetch(`${GRAPH_ROOT}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        grant_type: "authorization_code", redirect_uri: redirectUri, code,
      }).toString(),
    });
    const shortJ = await shortRes.json().catch(() => null);
    if (!shortRes.ok || !shortJ?.access_token) return back("failed");

    // Short-lived (1 hour) → long-lived (60 days).
    const longUrl = new URL(`${GRAPH_ROOT}/access_token`);
    longUrl.searchParams.set("grant_type", "th_exchange_token");
    longUrl.searchParams.set("client_secret", clientSecret);
    longUrl.searchParams.set("access_token", shortJ.access_token);
    const longRes = await fetch(longUrl.toString());
    const longJ = await longRes.json().catch(() => null);
    if (!longRes.ok || !longJ?.access_token) return back("failed");

    const me = await th(longJ.access_token, "/me", { fields: "id,username" });
    const threadsUserId = String(me.body?.id || shortJ.user_id || "");
    if (!threadsUserId) return back("failed");

    const { error: saveErr } = await db.from("threads_connections").upsert({
      org_id: tok.org_id,
      threads_user_id: threadsUserId,
      username: me.body?.username || null,
      access_token: longJ.access_token,
      token_expires_at: new Date(Date.now() + (longJ.expires_in ?? 5184000) * 1000).toISOString(),
      scopes: SCOPES,
      connected_by: tok.user_id,
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,threads_user_id" });
    if (saveErr) {
      console.error("[threads] connection not saved:", saveErr.message);
      return back("save_failed");
    }
    return back("connected");
  }

  // ── Where a deletion request can be read back ─────────────────────────────
  if (mode === "delete-status") {
    const id = (url.searchParams.get("id") || "").replace(/[^\w-]/g, "").slice(0, 64);
    const { count } = await db.from("threads_connections")
      .select("threads_user_id", { count: "exact", head: true }).eq("threads_user_id", id);
    const gone = !count;
    const html = `<!doctype html><html lang="de"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>i7OS</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#f4f4f7;color:#15151c;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
main{max-width:34rem;padding:40px 24px}h1{font-size:19px;margin:0 0 14px}
p{margin:0 0 10px}code{font-size:13px;color:#6b6b76}</style>
<main><h1>Threads-Daten</h1>
<p>${gone
  ? "Die Verbindung dieses Threads-Kontos zu i7OS wurde gelöscht. Wir haben keine Zugangsdaten und keine Kontodaten mehr dazu gespeichert."
  : "Die Löschung dieses Threads-Kontos ist bei uns eingegangen und wird bearbeitet."}</p>
<p>${gone
  ? "This Threads account's connection to i7OS has been deleted. We no longer hold any access token or account data for it."
  : "The deletion request for this Threads account has reached us and is being processed."}</p>
<p><code>${id || "-"}</code></p></main></html>`;
    return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // ── Meta's own callbacks ──────────────────────────────────────────────────
  if (mode === "deauthorize" || mode === "delete") {
    const form = await req.formData().catch(() => null);
    const claim = await readSignedRequest(form?.get("signed_request"), clientSecret);
    if (!claim?.user_id) return json({ error: "Bad signature" }, 400);
    await db.from("threads_connections").delete().eq("threads_user_id", String(claim.user_id));
    if (mode === "deauthorize") return json({ ok: true });
    const confirmation = String(claim.user_id);
    return json({ url: `${appUrl}/threads/delete-status?id=${confirmation}`, confirmation_code: confirmation });
  }

  // ── Everything else is a POST from the app ────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const orgId = body.orgId;
  if (!orgId) return json({ error: "orgId is required" }, 400);

  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "Not signed in", code: "unauthenticated" }, 401);
  const { data: who } = await db.auth.getUser(bearer);
  const userId = who?.user?.id;
  if (!userId) return json({ error: "Not signed in", code: "unauthenticated" }, 401);
  const { data: member } = await db.from("org_members")
    .select("user_id").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  if (!member) return json({ error: "Not a member of this workspace", code: "forbidden" }, 403);

  if (!enabledOrgs().includes(orgId)) {
    return json({ enabled: false, connected: false, accounts: [], code: "not_enabled" });
  }

  const { data: rows } = await db.from("threads_connections").select("*").eq("org_id", orgId);
  const accounts = rows || [];

  if (body.mode === "status") {
    return json({
      enabled: true,
      connected: accounts.length > 0,
      accounts: accounts.map(a => ({
        threadsUserId: a.threads_user_id,
        username: a.username,
        connectedAt: a.created_at,
        expiresAt: a.token_expires_at,
        needsReconnect: new Date(a.token_expires_at).getTime() <= Date.now() || !!a.last_error,
        lastError: a.last_error || null,
        // What this connection was granted is what it can do. A token from
        // before the replies were added reads the profile and the numbers fine
        // and is refused on the replies, so the UI can ask for one reconnect
        // instead of showing an empty box. Same as Instagram's.
        missingScopes: SCOPES.split(",").filter(sc => !String(a.scopes || "").split(",").includes(sc)),
      })),
    });
  }

  if (body.mode === "disconnect") {
    const id = String(body.threadsUserId || "");
    if (!id) return json({ error: "threadsUserId is required" }, 400);
    await db.from("threads_connections").delete().eq("org_id", orgId).eq("threads_user_id", id);
    return json({ ok: true });
  }

  const row = accounts.find(a => a.threads_user_id === String(body.threadsUserId || ""))
    || (accounts.length === 1 ? accounts[0] : null);
  if (!row) return json({ error: "Threads is not connected", code: "not_connected" }, 409);
  const token = await usableToken(db, row);
  if (!token) return json({ error: "Threads needs to be connected again", code: "reconnect_required" }, 401);

  // ── overview — the numbers a dashboard shows, in one round trip ───────────
  //
  // It also does something Meta asks for before a permission can be submitted:
  // each permission needs at least one successful API call against it. Reading
  // the profile exercises threads_basic and the publishing limit exercises
  // threads_content_publish, so opening the panel is a real call on both rather
  // than something that has to be staged by hand.
  if (body.mode === "overview") {
    const days = Math.min(90, Math.max(1, Number(body.days) || 28));
    const until = Math.floor(Date.now() / 1000);
    // Threads keeps no insight older than this; asking past it fails the call.
    const since = Math.max(1712991600, until - days * 86400);

    const profile = await th(token, "/me", { fields: "id,username" });
    const quota = await th(token, `/${row.threads_user_id}/threads_publishing_limit`,
      { fields: "quota_usage,config" });

    // Same narrowing as Instagram: one metric Threads does not serve takes the
    // whole call down with it and names itself in the error, so the list is cut
    // and retried until what is left works.
    const wanted = ["views", "likes", "replies", "reposts", "quotes", "clicks", "followers_count"];
    let metrics = [...wanted];
    let insights = null;
    const dropped = [];
    for (let attempt = 0; attempt < wanted.length && metrics.length; attempt++) {
      const r = await th(token, `/${row.threads_user_id}/threads_insights`,
        { metric: metrics.join(","), since, until });
      if (r.ok) { insights = r.body?.data || []; break; }
      const msg = r.body?.error?.message || "";
      const bad = metrics.find(m => msg.includes(m));
      if (!bad) break;
      dropped.push(bad);
      metrics = metrics.filter(m => m !== bad);
    }

    // Where the followers are. Its own call because it takes a breakdown and
    // refuses since/until, and because Threads serves it only from 100
    // followers up - which is a state to show, not an error.
    const demo = await th(token, `/${row.threads_user_id}/threads_insights`,
      { metric: "follower_demographics", breakdown: body.breakdown || "country" });

    const q = quota.ok ? (quota.body?.data?.[0] || {}) : null;
    // A metric is either a running total or a series; take whichever came back.
    const value = (m) => m?.total_value?.value
      ?? (Array.isArray(m?.values) ? m.values.reduce((sum, v) => sum + (v.value || 0), 0) : null);
    return json({
      account: { threadsUserId: row.threads_user_id, username: profile.body?.username || row.username },
      days,
      metrics: Object.fromEntries((insights || []).map(m => [m.name, value(m)])),
      followers: value((insights || []).find(m => m.name === "followers_count")),
      demographics: demo.ok
        ? ((demo.body?.data?.[0]?.total_value?.breakdowns?.[0]?.results || [])
            .map(r => ({ key: (r.dimension_values || [])[0], value: r.value }))
            .sort((a, b) => b.value - a.value).slice(0, 6))
        : null,
      quota: q ? { used: q.quota_usage ?? 0, total: q.config?.quota_total ?? 250 } : null,
      // Named rather than swallowed: whichever call failed is exactly the
      // permission whose call count stays at zero in Meta's console.
      unavailable: [
        !profile.ok && "threads_basic",
        !quota.ok && "threads_content_publish",
        !insights && "threads_manage_insights",
        ...dropped,
      ].filter(Boolean),
      tokenExpiresAt: row.token_expires_at,
    });
  }

  // The posts themselves, so Threads can stand in the same Top Posts list as
  // everything else. Unlike Instagram's media edge, the list carries no counts
  // at all, so every post needs its own insights call and the cap is what keeps
  // this inside the Edge time limit: the most recent handful, ranked after the
  // numbers are in rather than before.
  if (body.mode === "posts") {
    const days = Math.min(90, Math.max(1, Number(body.days) || 28));
    const limit = Math.min(10, Math.max(1, Number(body.limit) || 5));
    const since = Math.floor(Date.now() / 1000) - days * 86400;

    const list = await th(token, `/${row.threads_user_id}/threads`, {
      // With the picture, so the post can be shown and not only counted. A
      // text post simply has neither field.
      fields: "id,text,permalink,timestamp,media_type,media_url,thumbnail_url",
      limit: 25,
    });
    if (!list.ok) return json({ error: list.body?.error?.message || "threads_failed" }, 502);

    const cutoff = since * 1000;
    const recent = (list.body?.data || [])
      // A reply is not a post of yours in the sense this list means.
      .filter(m => m.media_type !== "REPOST_FACADE")
      .filter(m => !m.timestamp || new Date(m.timestamp).getTime() >= cutoff);

    const heads = recent.slice(0, 12);
    const stats = await Promise.all(heads.map(m =>
      th(token, `/${m.id}/insights`, { metric: "views,likes,replies,reposts,quotes" })
        .then(r => {
          if (!r.ok) return {};
          const out = {};
          for (const d of (r.body?.data || [])) {
            out[d.name] = d.values?.[0]?.value ?? d.total_value?.value ?? 0;
          }
          return out;
        })
        .catch(() => ({}))));

    const posts = heads.map((m, i) => ({
      id: m.id,
      image: m.thumbnail_url || m.media_url || null,
      text: m.text || "",
      url: m.permalink || null,
      publishedAt: m.timestamp || null,
      views: stats[i].views ?? null,
      likes: stats[i].likes ?? 0,
      replies: stats[i].replies ?? 0,
      reposts: (stats[i].reposts ?? 0) + (stats[i].quotes ?? 0),
    }));
    posts.sort((x, y) => (y.likes + y.replies + y.reposts) - (x.likes + x.replies + x.reposts));

    return json({ days, postCount: recent.length, posts: posts.slice(0, limit) });
  }

  // ── replies — who is answering under the account's own posts ─────────────
  //
  // The mirror of Instagram's comments panel, and read-only for the same
  // reason: i7OS shows the answers, it does not write them.
  if (body.mode === "replies") {
    const days = Math.min(90, Math.max(1, Number(body.days) || 28));
    const cutoff = Date.now() - days * 86400000;
    const list = await th(token, `/${row.threads_user_id}/threads`, {
      fields: "id,text,permalink,timestamp,media_type", limit: 25,
    });
    if (!list.ok) return json({ error: list.body?.error?.message || "threads_failed" }, 502);
    // A repost is not a post of yours, and nobody answers under it here.
    const media = (list.body?.data || []).filter(m => m.media_type !== "REPOST_FACADE");
    const posts = media
      .filter(m => !m.timestamp || new Date(m.timestamp).getTime() >= cutoff)
      .slice(0, 10);
    // The newest post is asked ALWAYS, even outside the window and even with
    // nothing under it: an account nobody answers would otherwise never make
    // the call Meta counts before a permission can be reviewed. Instagram's
    // comments sat at zero calls for exactly that reason.
    if (media[0] && !posts.some(m => m.id === media[0].id)) posts.unshift(media[0]);

    // profile_picture_url hangs on the reply itself: Threads returns only `id`
    // unless every field is asked for by name, which is why the panel had
    // initials where it could have had faces.
    const FIELDS = "id,text,username,profile_picture_url,timestamp,permalink,is_reply_owned_by_me,hide_status";
    const PLAIN = "id,text,username,profile_picture_url,timestamp,permalink";
    let refused = null;
    const perPost = await Promise.all(posts.map(async (m) => {
      let r = await th(token, `/${m.id}/replies`, { fields: FIELDS, limit: 25 });
      // An unknown field comes back as a 400 naming it. The same request
      // without the extras is the answer, not an error.
      if (!r.ok && r.status === 400 && /field/i.test(JSON.stringify(r.body?.error || ""))) {
        r = await th(token, `/${m.id}/replies`, { fields: PLAIN, limit: 25 });
      }
      if (!r.ok) { refused = refused || r.body?.error || { message: "replies_failed" }; return []; }
      const base = { platform: "threads", postId: m.id, postPermalink: m.permalink || null,
        postContent: (m.text || "").slice(0, 140) };
      return (r.body?.data || [])
        .filter(c => c.hide_status !== "HIDDEN")
        .map(c => ({
          ...base,
          id: c.id,
          message: c.text || "",
          createdTime: c.timestamp || null,
          // Threads does not put a like count on a reply, and a hard 0 would
          // read as "nobody liked it" rather than "not said".
          likeCount: null,
          url: c.permalink || null,
          from: {
            id: null,
            username: c.username || null,
            name: c.username || null,
            // The panel draws this when it is there and an initial when it is
            // not: a private profile simply has no picture to give.
            picture: c.profile_picture_url || null,
            isOwner: c.is_reply_owned_by_me === true || (!!c.username && c.username === row.username),
          },
        }));
    }));
    const flat = perPost.flat();
    // Every post refused and nothing came back is a permission answer, not an
    // account nobody talks to. Said as one, so the panel can ask for the
    // single reconnect that fixes it.
    if (!flat.length && refused && posts.length) {
      const scopeMissing = String(row.scopes || "").split(",").indexOf("threads_read_replies") === -1;
      return json({ error: refused.message || "replies_failed",
        code: scopeMissing ? "scope_missing" : "threads_error" }, scopeMissing ? 403 : 502);
    }
    flat.sort((a2, b2) => String(b2.createdTime || "").localeCompare(String(a2.createdTime || "")));
    return json({ recent: flat.slice(0, 60) });
  }

  if (body.mode === "limit") {
    const r = await th(token, `/${row.threads_user_id}/threads_publishing_limit`,
      { fields: "quota_usage,config" });
    if (!r.ok) return json({ error: r.body?.error?.message || "Threads rejected the request", code: "threads_error" }, 502);
    const d = r.body?.data?.[0] || {};
    return json({ used: d.quota_usage ?? null, limit: d.config?.quota_total ?? 250 });
  }

  // ── publish ───────────────────────────────────────────────────────────────
  //
  // Container, then publish, and Meta's own advice is to leave about thirty
  // seconds in between for processing. Text alone is a post here, which is the
  // one thing Threads does that Instagram does not.
  const makeContainer = async (params) => {
    const res = await fetch(`${GRAPH}/${row.threads_user_id}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, access_token: token }),
    });
    const j = await res.json().catch(() => null);
    // Written down with what was asked for, minus the token. A carousel fails
    // in one of four places and the message alone does not say which, so the
    // log says what the call was.
    if (!res.ok || !j?.id) {
      const { access_token, ...asked } = { ...params };
      console.error("[threads] container failed", res.status, JSON.stringify(asked),
        j?.error?.message || "", j?.error?.error_user_msg || "");
    }
    return { ok: res.ok, id: j?.id, error: j?.error?.error_user_msg || j?.error?.message || null };
  };
  const publishContainer = async (creationId) => {
    const res = await fetch(`${GRAPH}/${row.threads_user_id}/threads_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: creationId, access_token: token }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.id) {
      const msg = j?.error?.error_user_msg || j?.error?.message || "Threads refused to publish";
      console.error("[threads] publish failed", res.status, creationId, msg);
      return json({ error: msg, code: /limit/i.test(msg) ? "rate_limited" : "threads_error" }, 502);
    }
    const perma = await th(token, `/${j.id}`, { fields: "permalink" });
    return json({ id: j.id, url: perma.body?.permalink || null, status: "published" });
  };

  if (body.mode === "publish-finish") {
    const containerId = String(body.containerId || "");
    if (!/^\d+$/.test(containerId)) return json({ error: "containerId is required", code: "invalid_container" }, 400);
    const r = await th(token, `/${containerId}`, { fields: "status,error_message" });
    const st = r.body?.status;
    if (st === "ERROR" || st === "EXPIRED") return json({ error: r.body?.error_message || st, code: "media_failed" }, 502);
    if (st && st !== "FINISHED" && st !== "PUBLISHED") return json({ status: "processing", containerId }, 202);
    return publishContainer(containerId);
  }

  if (body.mode === "publish") {
    // 500 characters, and Threads counts emoji as their UTF-8 bytes. Cut here
    // rather than letting the API refuse the whole post over the tail of a
    // sentence.
    const text = body.text ? String(body.text).slice(0, 500) : undefined;

    // A url Threads can fetch itself. Same as Instagram: it will not take bytes,
    // so a file in our private bucket goes over as a signed url.
    const publicUrl = async (m) => {
      if (m?.url) return String(m.url);
      if (!m?.bucket || !m?.path) return null;
      const { data } = await db.storage.from(m.bucket).createSignedUrl(m.path, 3600);
      return data?.signedUrl || null;
    };

    const media = Array.isArray(body.media) ? body.media : (body.media ? [body.media] : []);
    if (!text && !media.length) return json({ error: "A post needs text or media", code: "invalid_content" }, 400);

    // A child container is not usable the moment it is created: Threads has to
    // fetch the picture first. Asked once a second, which is plenty for a photo
    // and is what was missing - a CAROUSEL built over children that were still
    // being fetched is refused, so only single pictures ever went through.
    const waitReady = async (containerId, budgetMs = 20000) => {
      const until = Date.now() + budgetMs;
      for (;;) {
        const r = await th(token, `/${containerId}`, { fields: "status,error_message" });
        const st = r.body?.status;
        if (st === "FINISHED" || st === "PUBLISHED" || !st) return { ok: true };
        if (st === "ERROR" || st === "EXPIRED") return { ok: false, error: r.body?.error_message || st };
        if (Date.now() >= until) return { ok: false, pending: true };
        await new Promise(done => setTimeout(done, 1000));
      }
    };

    let creationId = null;
    if (media.length > 1) {
      const children = [];
      for (const m of media.slice(0, 20)) {
        const u = await publicUrl(m);
        if (!u) return json({ error: "Media could not be resolved to a url", code: "invalid_media" }, 400);
        const isVideo = String(m.kind || "").toUpperCase() === "VIDEO";
        const made = await makeContainer(isVideo
          ? { media_type: "VIDEO", video_url: u, is_carousel_item: true }
          : { media_type: "IMAGE", image_url: u, is_carousel_item: true });
        if (!made.ok || !made.id) return json({ error: made.error || "Container failed", code: "threads_error" }, 502);
        const ready = await waitReady(made.id);
        if (!ready.ok) return json({
          error: ready.error || (ready.pending ? "Threads is still fetching a slide" : "Media was not accepted"),
          code: "media_failed",
        }, 502);
        children.push(made.id);
      }
      // Meta's own guidance is to leave a moment between the last child being
      // ready and the parent being made. Cheap insurance next to a whole post
      // that fails.
      await new Promise(done => setTimeout(done, 1500));
      const parent = await makeContainer({ media_type: "CAROUSEL", children: children.join(","), text });
      if (!parent.ok || !parent.id) return json({ error: parent.error || "Container failed", code: "threads_error" }, 502);
      creationId = parent.id;
    } else if (media.length === 1) {
      const u = await publicUrl(media[0]);
      if (!u) return json({ error: "Media could not be resolved to a url", code: "invalid_media" }, 400);
      const isVideo = String(media[0].kind || "").toUpperCase() === "VIDEO";
      const made = await makeContainer(isVideo
        ? { media_type: "VIDEO", video_url: u, text }
        : { media_type: "IMAGE", image_url: u, text });
      if (!made.ok || !made.id) return json({ error: made.error || "Container failed", code: "threads_error" }, 502);
      creationId = made.id;
    } else {
      // Text on its own. No media, no waiting: nothing has to be fetched.
      const made = await makeContainer({ media_type: "TEXT", text });
      if (!made.ok || !made.id) return json({ error: made.error || "Container failed", code: "threads_error" }, 502);
      return publishContainer(made.id);
    }

    // The container itself, which for a video is the slow one. Still working
    // after the budget is handed back to the caller rather than failed: an Edge
    // function cannot sit out a transcode.
    const ready = await waitReady(creationId, 12000);
    if (!ready.ok && ready.pending) return json({ status: "processing", containerId: creationId }, 202);
    if (!ready.ok) return json({ error: ready.error || "Media was not accepted", code: "media_failed" }, 502);
    return publishContainer(creationId);
  }

  return json({ error: "Unknown mode" }, 400);
}
