// Instagram, directly through Meta. Next to Zernio, not instead of it.
//
// Zernio keeps every other network and keeps Instagram for everybody who is not
// on the allowlist below. This path exists because the Meta app has to be built,
// tested and demonstrated on a WORKING product before Meta will review it, and
// review is what a customer who is not a tester needs. So the order is forced:
// build here, run it on our own account in Development Mode, then submit.
//
// What works today, with no App Review and no Business Verification: Instagram
// accounts that hold a role on the Meta app (Admin, Developer, Tester) and have
// accepted the tester invite. Everybody else gets `not_enabled` and stays on
// Zernio until Advanced Access is granted.
//
// Edge runtime → does NOT count against the Hobby 12-function Node limit, which
// stands at 11 of 12. Nothing here needs Node.
//
// Verbs. The first needs no secret and answers for itself:
//   GET  ?check=1                     → is it configured, and which commit is live
//   GET  ?mode=install&state=<token>  → send somebody to Instagram's consent screen
//   GET  ?mode=callback&code=…        → Instagram sends them back here (/instagram/callback)
//   POST ?mode=deauthorize            → Meta calls this when somebody removes the app
//   POST ?mode=delete                 → Meta's data deletion request callback
//   GET  ?mode=delete-status&id=…     → the page that callback's url points at
//   POST { mode: "status",     orgId } → which accounts are connected, and as whom
//   POST { mode: "disconnect", orgId, igUserId } → forget one account
//   POST { mode: "publish",    orgId, igUserId, … } → one post, container flow
//   POST { mode: "publish-finish", orgId, igUserId, containerId } → finish a slow one
//   POST { mode: "overview",   orgId, igUserId, days } → the dashboard's numbers
//   POST { mode: "insights",   orgId, igUserId, … } → one raw insights call
//   POST { mode: "limit",      orgId, igUserId }    → posts left in the 24h window
//
// Every POST from the app carries the caller's Supabase JWT and has to resolve
// to a member of that workspace: an orgId in a body proves nothing, it is in
// every share link.
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

// One constant to bump when Meta retires a version. Pinned rather than left off:
// an unversioned call is served by the OLDEST version still alive, so it breaks
// on Meta's schedule instead of ours.
const V = process.env.INSTAGRAM_API_VERSION || "v23.0";
const GRAPH = `https://graph.instagram.com/${V}`;
// The token endpoints are NOT versioned and do not live on the graph host.
const OAUTH_TOKEN = "https://api.instagram.com/oauth/access_token";
const GRAPH_ROOT = "https://graph.instagram.com";

// Read the account, publish to it, read its numbers. Comments and messaging are
// deliberately absent: a token keeps the scopes it was issued with, so widening
// the list later strands every connection made before the change, but asking
// for a permission we do not use yet is the surest way to have a review
// rejected. Pinterest taught the first half of that in this codebase.
const SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
].join(",");

// Long-lived tokens last 60 days and there is no refresh token: a live token is
// traded for a fresh one, so it has to happen BEFORE the old one lapses. Ten
// days of margin, because a workspace nobody opens for a week must not lose its
// connection. Instagram refuses to refresh a token under 24 hours old, which is
// why a brand-new row is left alone.
const REFRESH_WHEN_DAYS_LEFT = 10;
const MIN_AGE_MS = 25 * 3600 * 1000;

const enabledOrgs = () =>
  (process.env.INSTAGRAM_DIRECT_ORGS || "")
    .split(",").map(s => s.trim()).filter(Boolean);

async function usableToken(db, row) {
  const msLeft = new Date(row.token_expires_at).getTime() - Date.now();
  if (msLeft <= 0) return null;
  const old = Date.now() - new Date(row.created_at).getTime() > MIN_AGE_MS;
  if (msLeft > REFRESH_WHEN_DAYS_LEFT * 86400000 || !old) return row.access_token;

  const url = new URL(`${GRAPH_ROOT}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", row.access_token);
  const res = await fetch(url.toString());
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) {
    // Written down rather than thrown away, so the UI can say what is wrong
    // instead of just "not connected".
    await db.from("instagram_connections")
      .update({ last_error: `refresh failed (${res.status})`, updated_at: new Date().toISOString() })
      .eq("org_id", row.org_id).eq("ig_user_id", row.ig_user_id);
    // The old token is still valid until it lapses, so this is not fatal yet.
    return row.access_token;
  }
  await db.from("instagram_connections").update({
    access_token: j.access_token,
    token_expires_at: new Date(Date.now() + (j.expires_in ?? 5184000) * 1000).toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("org_id", row.org_id).eq("ig_user_id", row.ig_user_id);
  return j.access_token;
}

const ig = async (token, path, params = {}, init = {}) => {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString(), init);
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

  const clientId = process.env.INSTAGRAM_APP_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;
  const supaUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const appUrl = (process.env.PUBLIC_APP_URL || "https://app.i7os.com").replace(/\/$/, "");
  const redirectUri = `${appUrl}/instagram/callback`;

  // Names of what is missing, never values.
  const missing = [
    !clientId && "INSTAGRAM_APP_ID",
    !clientSecret && "INSTAGRAM_APP_SECRET",
    !supaUrl && "SUPABASE_URL",
    !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null;
  if (missing.length) {
    // check=1 has to answer even when nothing is set up: that is the question it
    // exists to answer. The commit belongs in THIS answer too - an unconfigured
    // deployment is exactly the moment somebody needs to know which version is
    // talking, and leaving it out made the deploy check wait forever.
    if (check) return json({ configured: false, missing, redirect_uri: redirectUri, commit }, 200);
    return json({ error: "Instagram is not configured", code: "not_configured", missing }, 503);
  }

  const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // ── Health, needs no secret ───────────────────────────────────────────────
  if (check) {
    const { count } = await db.from("instagram_connections")
      .select("org_id", { count: "exact", head: true });
    return json({
      configured: true,
      connections: count ?? 0,
      redirect_uri: redirectUri,
      deauthorize_url: `${appUrl}/instagram/deauthorize`,
      delete_url: `${appUrl}/instagram/delete`,
      scopes: SCOPES,
      api_version: V,
      // How many workspaces may use the direct path at all. Zero means nobody,
      // which is the safe default while the app is in Development Mode.
      enabled_orgs: enabledOrgs().length,
      // Which commit is answering, so "is my fix live" stops being a guess.
      commit,
    });
  }

  // ── Send somebody to Instagram's consent screen ───────────────────────────
  // state is the same one-time token Telegram, Slack, Pinterest and Figma use,
  // minted by create_messenger_link_token for the signed-in person and carrying
  // the workspace. It is what tells the callback WHICH workspace came back, and
  // it cannot be guessed or replayed.
  if (mode === "install") {
    const state = url.searchParams.get("state") || "";
    if (!state) return json({ error: "Missing state" }, 400);
    const authorize = new URL("https://www.instagram.com/oauth/authorize");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", SCOPES);
    authorize.searchParams.set("state", state);
    return Response.redirect(authorize.toString(), 302);
  }

  // ── Instagram sends them back ─────────────────────────────────────────────
  if (mode === "callback") {
    const back = (status) => Response.redirect(`${appUrl}/?instagram=${status}`, 302);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (url.searchParams.get("error") || !code || !state) return back("cancelled");

    const { data: tok } = await db.from("messenger_link_tokens")
      .select("token, user_id, org_id, expires_at, used_at").eq("token", state).maybeSingle();
    if (!tok || tok.used_at || !tok.org_id || new Date(tok.expires_at).getTime() < Date.now()) return back("expired");
    // Claimed BEFORE anything is written: a link opened twice must connect once.
    const { data: claimed } = await db.from("messenger_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", state).is("used_at", null).select("token").maybeSingle();
    if (!claimed) return back("expired");

    // The token said which workspace, and the token is now spent. Ask the
    // membership table again anyway: minting and returning are two moments and
    // somebody can be removed from a workspace in between.
    const { data: stillAMember } = await db.from("org_members").select("user_id")
      .eq("org_id", tok.org_id).eq("user_id", tok.user_id).maybeSingle();
    if (!stillAMember) return back("forbidden");
    if (!enabledOrgs().includes(tok.org_id)) return back("not_enabled");

    // Authorization code → short-lived token. Form-encoded, and on the api host
    // rather than the graph one.
    const shortRes = await fetch(OAUTH_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        grant_type: "authorization_code", redirect_uri: redirectUri, code,
      }).toString(),
    });
    const shortJ = await shortRes.json().catch(() => null);
    if (!shortRes.ok || !shortJ?.access_token) return back("failed");

    // Short-lived (1 hour) → long-lived (60 days). Two calls, because Instagram
    // has no single step that hands out a usable token.
    const longUrl = new URL(`${GRAPH_ROOT}/access_token`);
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", clientSecret);
    longUrl.searchParams.set("access_token", shortJ.access_token);
    const longRes = await fetch(longUrl.toString());
    const longJ = await longRes.json().catch(() => null);
    if (!longRes.ok || !longJ?.access_token) return back("failed");

    // Who was just connected, so the UI can say the account by name rather than
    // "connected" and leave somebody guessing which of their accounts it was.
    const me = await ig(longJ.access_token, "/me", { fields: "user_id,username,account_type" });
    const igUserId = String(me.body?.user_id || shortJ.user_id || "");
    if (!igUserId) return back("failed");

    const { error: saveErr } = await db.from("instagram_connections").upsert({
      org_id: tok.org_id,
      ig_user_id: igUserId,
      username: me.body?.username || null,
      account_type: me.body?.account_type || null,
      access_token: longJ.access_token,
      token_expires_at: new Date(Date.now() + (longJ.expires_in ?? 5184000) * 1000).toISOString(),
      scopes: Array.isArray(shortJ.permissions) ? shortJ.permissions.join(",") : SCOPES,
      connected_by: tok.user_id,
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,ig_user_id" });
    // Checked, not awaited and ignored: that combination meant the UI said
    // connected while nothing had been stored, and the code was already spent.
    if (saveErr) {
      console.error("[instagram] connection not saved:", saveErr.message);
      return back("save_failed");
    }
    return back("connected");
  }

  // ── Where a deletion request can be read back ─────────────────────────────
  //
  // Meta requires the deletion callback to hand back a url a person can open to
  // see what happened, and it checks that url. Without a route of its own the
  // SPA catch-all swallows this path and answers 1439 bytes of empty shell: a
  // reviewer, and anybody who actually asked to have their data removed, would
  // see a blank page. Answered by the function instead, in both languages,
  // because there is no session here to ask which one.
  if (mode === "delete-status") {
    const id = (url.searchParams.get("id") || "").replace(/[^\w-]/g, "").slice(0, 64);
    const { count } = await db.from("instagram_connections")
      .select("ig_user_id", { count: "exact", head: true }).eq("ig_user_id", id);
    const gone = !count;
    const html = `<!doctype html><html lang="de"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>i7OS</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#f4f4f7;color:#15151c;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
main{max-width:34rem;padding:40px 24px}h1{font-size:19px;margin:0 0 14px}
p{margin:0 0 10px}code{font-size:13px;color:#6b6b76}</style>
<main><h1>Instagram-Daten</h1>
<p>${gone
  ? "Die Verbindung dieses Instagram-Kontos zu i7OS wurde gelöscht. Wir haben keine Zugangsdaten und keine Kontodaten mehr dazu gespeichert."
  : "Die Löschung dieses Instagram-Kontos ist bei uns eingegangen und wird bearbeitet."}</p>
<p>${gone
  ? "This Instagram account's connection to i7OS has been deleted. We no longer hold any access token or account data for it."
  : "The deletion request for this Instagram account has reached us and is being processed."}</p>
<p><code>${id || "-"}</code></p></main></html>`;
    return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // ── Meta's own callbacks ──────────────────────────────────────────────────
  // Both arrive as a form POST carrying a signed_request, not as a call from
  // our app, so neither has a Supabase session to check. The signature is the
  // proof, and it is verified against the app secret.
  if (mode === "deauthorize" || mode === "delete") {
    const form = await req.formData().catch(() => null);
    const claim = await readSignedRequest(form?.get("signed_request"), clientSecret);
    if (!claim?.user_id) return json({ error: "Bad signature" }, 400);
    await db.from("instagram_connections").delete().eq("ig_user_id", String(claim.user_id));
    if (mode === "deauthorize") return json({ ok: true });
    // Meta requires a status url and a code it can quote back at us.
    const confirmation = String(claim.user_id);
    return json({ url: `${appUrl}/instagram/delete-status?id=${confirmation}`, confirmation_code: confirmation });
  }

  // ── Everything else is a POST from the app ────────────────────────────────
  //
  // Signed in, and a member of the workspace being asked about. An orgId is not
  // a secret: it is in the url of every share link and in every row the browser
  // already holds, so a body that only carries one is a body anybody can write.
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

  // The allowlist is the whole gate while the Meta app is in Development Mode.
  // A workspace that is not on it sees nothing and keeps posting through Zernio,
  // which is exactly what should happen until Advanced Access is granted.
  if (!enabledOrgs().includes(orgId)) {
    return json({ enabled: false, connected: false, accounts: [], code: "not_enabled" });
  }

  const { data: rows } = await db.from("instagram_connections").select("*").eq("org_id", orgId);
  const accounts = rows || [];

  if (body.mode === "status") {
    // Never the tokens. This endpoint answers "connected, and as whom".
    return json({
      enabled: true,
      connected: accounts.length > 0,
      accounts: accounts.map(a => ({
        igUserId: a.ig_user_id,
        username: a.username,
        accountType: a.account_type,
        connectedAt: a.created_at,
        expiresAt: a.token_expires_at,
        // A lapsed token cannot be refreshed, only re-authorised, so this is
        // the one state the UI has to act on rather than merely display.
        needsReconnect: new Date(a.token_expires_at).getTime() <= Date.now() || !!a.last_error,
        lastError: a.last_error || null,
      })),
    });
  }

  if (body.mode === "disconnect") {
    const igUserId = String(body.igUserId || "");
    if (!igUserId) return json({ error: "igUserId is required" }, 400);
    await db.from("instagram_connections").delete().eq("org_id", orgId).eq("ig_user_id", igUserId);
    return json({ ok: true });
  }

  // From here on a specific account is being acted on.
  const row = accounts.find(a => a.ig_user_id === String(body.igUserId || ""))
    || (accounts.length === 1 ? accounts[0] : null);
  if (!row) return json({ error: "Instagram is not connected", code: "not_connected" }, 409);
  const token = await usableToken(db, row);
  if (!token) return json({ error: "Instagram needs to be connected again", code: "reconnect_required" }, 401);

  if (body.mode === "limit") {
    const r = await ig(token, `/${row.ig_user_id}/content_publishing_limit`,
      { fields: "config,quota_usage" });
    if (!r.ok) return json({ error: r.body?.error?.message || "Instagram rejected the request", code: "instagram_error" }, 502);
    const d = r.body?.data?.[0] || {};
    return json({ used: d.quota_usage ?? null, limit: d.config?.quota_total ?? 100 });
  }

  // ── overview — the numbers a dashboard shows, in one round trip ───────────
  //
  // Soft in three places, because the three answers fail for different reasons
  // and independently: a metric Instagram has retired takes the whole insights
  // call down with it, the quota endpoint needs the publishing permission, and
  // the profile needs none of that. One failing part must not blank the card.
  if (body.mode === "overview") {
    const days = Math.min(90, Math.max(1, Number(body.days) || 28));
    const until = Math.floor(Date.now() / 1000);
    const since = until - days * 86400;

    // Instagram refuses the WHOLE call when one metric in the list is not
    // supported for this account, and the message names it. So the list is
    // narrowed and retried rather than guessed at once: whatever survives is
    // shown, and what did not is named instead of silently missing.
    const wanted = ["reach", "views", "total_interactions", "likes", "comments", "shares", "saves", "accounts_engaged"];
    let metrics = [...wanted];
    let insights = null, dropped = [];
    for (let attempt = 0; attempt < wanted.length && metrics.length; attempt++) {
      const r = await ig(token, `/${row.ig_user_id}/insights`, {
        metric: metrics.join(","), period: "day", metric_type: "total_value", since, until,
      });
      if (r.ok) { insights = r.body?.data || []; break; }
      const msg = r.body?.error?.message || "";
      const bad = metrics.find(m => msg.includes(m));
      if (!bad) break;
      dropped.push(bad);
      metrics = metrics.filter(m => m !== bad);
    }

    const profile = await ig(token, "/me",
      { fields: "user_id,username,account_type,followers_count,follows_count,media_count" });
    const quota = await ig(token, `/${row.ig_user_id}/content_publishing_limit`, { fields: "config,quota_usage" });
    const q = quota.ok ? (quota.body?.data?.[0] || {}) : null;

    return json({
      account: {
        igUserId: row.ig_user_id,
        username: profile.body?.username || row.username,
        followers: profile.body?.followers_count ?? null,
        following: profile.body?.follows_count ?? null,
        posts: profile.body?.media_count ?? null,
      },
      days,
      // name → number, which is all a tile needs. The raw shape nests the value
      // one level deeper than anybody rendering it cares about.
      metrics: Object.fromEntries((insights || []).map(m => [m.name, m.total_value?.value ?? null])),
      unavailable: dropped.length ? dropped : undefined,
      quota: q ? { used: q.quota_usage ?? 0, total: q.config?.quota_total ?? 100 } : null,
      tokenExpiresAt: row.token_expires_at,
    });
  }

  if (body.mode === "insights") {
    const metric = String(body.metric || "reach,views,total_interactions,likes,comments,shares,saves");
    const r = await ig(token, `/${row.ig_user_id}/insights`, {
      metric,
      period: body.period || "day",
      metric_type: body.metricType || "total_value",
      since: body.since, until: body.until,
    });
    if (!r.ok) return json({ error: r.body?.error?.message || "Instagram rejected the request", code: "instagram_error" }, 502);
    return json({ data: r.body?.data || [] });
  }

  // ── container / container-status / publish-finish ────────────────────────
  //
  // One request does ONE thing. A carousel used to be built entirely inside a
  // single call - a container per slide, a wait on each, the parent over them,
  // then the publish - and that is more than an Edge function is allowed to
  // take. It came back as a platform error page rather than an answer, which
  // is all "Failed: Instagram" ever was.
  //
  // The browser drives it now. Every step below returns immediately, so no
  // number of slides can run anything out of time.
  const publicUrl = async (m) => {
    if (m?.url) return String(m.url);
    if (!m?.bucket || !m?.path) return null;
    // Instagram fetches the picture itself and will not take bytes, so a file
    // in our private bucket goes over as a signed url.
    const { data } = await db.storage.from(m.bucket).createSignedUrl(m.path, 3600);
    return data?.signedUrl || null;
  };

  if (body.mode === "container") {
    const kind = String(body.kind || "IMAGE").toUpperCase();
    const caption = body.caption ? String(body.caption).slice(0, 2200) : undefined;
    let params;

    if (kind === "CAROUSEL") {
      const children = Array.isArray(body.children) ? body.children.filter(Boolean) : [];
      if (children.length < 2) return json({ error: "A carousel needs at least two items", code: "invalid_media" }, 400);
      params = { media_type: "CAROUSEL", children: children.slice(0, 10).join(","), caption };
    } else {
      const m = Array.isArray(body.media) ? body.media[0] : body.media;
      const u = await publicUrl(m);
      if (!u) return json({ error: "Media could not be resolved to a url", code: "invalid_media" }, 400);
      const isVideo = String(m.kind || "").toUpperCase() === "VIDEO" || kind === "REELS";
      params = kind === "REELS" || kind === "STORIES"
        ? { media_type: kind, ...(isVideo ? { video_url: u } : { image_url: u }), ...(kind === "REELS" ? { caption } : {}) }
        : {
            ...(isVideo ? { video_url: u, media_type: "VIDEO" } : { image_url: u }),
            ...(body.isCarouselItem ? { is_carousel_item: true } : { caption }),
            ...(m?.altText ? { alt_text: m.altText } : {}),
          };
    }

    const res = await fetch(`${GRAPH}/${row.ig_user_id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, access_token: token }),
    });
    const j2 = await res.json().catch(() => null);
    if (!res.ok || !j2?.id) {
      const { access_token, ...asked } = { ...params };
      const msg = j2?.error?.error_user_msg || j2?.error?.message || "Instagram refused the media";
      console.error("[instagram] container failed", res.status, JSON.stringify(asked), msg);
      return json({ error: msg, code: "instagram_error" }, 502);
    }
    return json({ containerId: j2.id });
  }

  // Is it ready? One question, one answer, no sleeping.
  if (body.mode === "container-status") {
    const containerId = String(body.containerId || "");
    if (!/^\d+$/.test(containerId)) return json({ error: "containerId is required", code: "invalid_container" }, 400);
    const r = await ig(token, `/${containerId}`, { fields: "status_code,status" });
    const st = r.body?.status_code;
    if (st === "ERROR" || st === "EXPIRED") {
      return json({ status: "error", error: r.body?.status || st }, 200);
    }
    return json({ status: st === "FINISHED" ? "ready" : "processing" });
  }

  // ── publish-finish — the second half, for media that was still processing ──
  //
  // The same check and the same publish, with no container built: a caller that
  // polls must never be able to create a second post by asking again.
  if (body.mode === "publish-finish") {
    const containerId = String(body.containerId || "");
    if (!/^\d+$/.test(containerId)) return json({ error: "containerId is required", code: "invalid_container" }, 400);
    const r = await ig(token, `/${containerId}`, { fields: "status_code,status" });
    const st = r.body?.status_code;
    if (st === "ERROR" || st === "EXPIRED") return json({ error: r.body?.status || st, code: "media_failed" }, 502);
    if (st !== "FINISHED") return json({ status: "processing", containerId }, 202);
    return publishContainer(containerId);
  }

  return json({ error: "Unknown mode" }, 400);

  // Shared by both halves, declared last because it is the tail of the story
  // rather than the start of it. A function declaration, so both callers above
  // can reach it.
  async function publishContainer(creationId) {
    const pub = await fetch(`${GRAPH}/${row.ig_user_id}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: creationId, access_token: token }),
    });
    const pubJ = await pub.json().catch(() => null);
    if (!pub.ok || !pubJ?.id) {
      // The 24h ceiling reads like any other error otherwise, and it is the one
      // a person can do something about: wait, or post from the app.
      const msg = pubJ?.error?.error_user_msg || pubJ?.error?.message || "Instagram refused to publish";
      console.error("[instagram] publish failed", pub.status, creationId, msg);
      const limited = /limit/i.test(msg);
      return json({ error: msg, code: limited ? "rate_limited" : "instagram_error" }, 502);
    }

    const perma = await ig(token, `/${pubJ.id}`, { fields: "permalink" });
    return json({ id: pubJ.id, url: perma.body?.permalink || null, status: "published" });
  }
}
