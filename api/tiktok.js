// TikTok, directly. The fourth direct channel after Instagram, Threads and
// Pinterest, and a file of its own for the same reason those are: its own
// client, its own scopes, its own review.
//
// Edge runtime → does NOT count against the Hobby 12-function Node limit, which
// stands at 11 of 12. A Node function here would break the deploy outright.
//
// ── Two things about TikTok that shape this whole file ───────────────────────
//
// 1. The access token lives 24 HOURS. Instagram's lives 60 days and Threads' 60
//    days, so those can refresh lazily; this one is stale by tomorrow. Every
//    call goes through usableToken, which renews from the refresh token (a
//    year) whenever less than an hour is left. Pinterest already works this way.
//
// 2. The bytes do NOT pass through here. TikTok's FILE_UPLOAD hands back an
//    upload url and the BROWSER puts the video there directly. Proxying a video
//    through an Edge function is a timeout waiting to happen, and Instagram
//    already taught that lesson: a carousel built in one request hit the limit
//    and came back as a platform error page rather than JSON.
//
//    PHOTOS are the other way round: TikTok PULLS them, and only from a domain
//    verified in its portal. Supabase storage is not one, so the images go over
//    as img-proxy urls on app.i7os.com, which is. Photos on TikTok are always
//    the carousel container, up to 35, never a single still in the feed.
//
// The word "video" is all over TikTok's own documentation because that is what
// the platform used to be. The product is the Content Posting API and it does
// both.
//
// Verbs. The first needs no secret and answers for itself:
//   GET  ?check=1                     → is it configured, and which commit is live
//   GET  ?mode=install&state=<token>  → send somebody to TikTok's consent screen
//   GET  ?mode=callback&code=…        → TikTok sends them back here
//   POST { mode: "status",      orgId } → which accounts are connected
//   POST { mode: "disconnect",  orgId, openId } → forget one account
//   POST { mode: "creator",     orgId } → what this creator is allowed to post
//   POST { mode: "publish-init", orgId, kind: "video", … } → reserve, get upload url
//   POST { mode: "publish-init", orgId, kind: "photo", images: [url] } → carousel
//   POST { mode: "publish-status", orgId, publishId } → how far along it is
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

const AUTH_HOST = "https://www.tiktok.com";
const API = "https://open.tiktokapis.com/v2";

// What the app actually does, and nothing beyond it. Asking for a permission we
// do not use is a named reason to fail a review, the same rule the Meta scopes
// follow. video.publish is the direct post; video.upload would only reach the
// creator's drafts, which is not what a composer means by "post".
//
// user.info.profile is deliberately NOT here. It is what carries the @handle,
// and basic already carries the display name, the avatar and the ids, which is
// enough to tell one connected account from another. A scope that is not
// switched on for the app makes the consent screen refuse the whole request,
// so asking for one nobody confirmed is a broken Connect button in exchange
// for a nicer label. It can be added the day the handle is worth it.
const SCOPES = ["user.info.basic", "video.publish"].join(",");

// A token good for another hour is good enough for the call about to be made.
// Below that it is renewed, because a request that starts valid and expires
// mid-flight fails in a way nobody can read.
const REFRESH_WHEN_MS_LEFT = 3600 * 1000;

// One allowlist for every direct channel. TIKTOK_DIRECT_ORGS if it is set,
// otherwise whatever Instagram was already cleared for, which is what Threads
// does too: the workspace is the same workspace, and setting the same id in
// three places is three chances to set it in two.
const enabledOrgs = () =>
  (process.env.TIKTOK_DIRECT_ORGS || process.env.INSTAGRAM_DIRECT_ORGS || "")
    .split(",").map(s => s.trim()).filter(Boolean);

const tk = async (token, path, { method = "GET", query = {}, body = null } = {}) => {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json; charset=UTF-8" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await res.json().catch(() => null);
  // TikTok answers 200 with an error object inside, so the status alone is not
  // the answer. error.code is "ok" when nothing went wrong.
  const errCode = j?.error?.code && j.error.code !== "ok" ? j.error.code : null;
  return { ok: res.ok && !errCode, status: res.status, body: j, errCode,
    message: j?.error?.message || null };
};

// The short token, renewed from the long one when it is nearly out. Writes the
// new pair back, so the next call starts from the fresh one rather than
// renewing again.
async function usableToken(db, row, clientKey, clientSecret) {
  const leftMs = row.token_expires_at ? new Date(row.token_expires_at).getTime() - Date.now() : 0;
  if (leftMs > REFRESH_WHEN_MS_LEFT) return row.access_token;
  if (!row.refresh_token) return null;
  if (row.refresh_expires_at && new Date(row.refresh_expires_at).getTime() < Date.now()) return null;

  const res = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey, client_secret: clientSecret,
      grant_type: "refresh_token", refresh_token: row.refresh_token,
    }).toString(),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) {
    // Written down rather than thrown away: the Settings row reads last_error
    // to say "connect again" instead of failing silently at the next post.
    await db.from("tiktok_connections")
      .update({ last_error: j?.error_description || j?.error || `refresh_failed_${res.status}` })
      .eq("org_id", row.org_id).eq("open_id", row.open_id);
    return null;
  }
  await db.from("tiktok_connections").update({
    access_token: j.access_token,
    token_expires_at: new Date(Date.now() + (j.expires_in ?? 86400) * 1000).toISOString(),
    refresh_token: j.refresh_token || row.refresh_token,
    refresh_expires_at: new Date(Date.now() + (j.refresh_expires_in ?? 31536000) * 1000).toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("org_id", row.org_id).eq("open_id", row.open_id);
  return j.access_token;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  const check = url.searchParams.get("check");

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const supaUrl = process.env.SUPABASE_URL;
  // Both names, because the variable actually set in Vercel is the second one
  // and every other function here already reads the pair. Only this file knew
  // the first name, so it reported itself unconfigured while Instagram and
  // Threads ran on the very same key.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const appUrl = (process.env.PUBLIC_APP_URL || "https://app.i7os.com").replace(/\/$/, "");
  const redirectUri = `${appUrl}/tiktok/callback`;

  // Names of what is missing, never values.
  const missing = [
    !clientKey && "TIKTOK_CLIENT_KEY",
    !clientSecret && "TIKTOK_CLIENT_SECRET",
    !supaUrl && "SUPABASE_URL",
    !serviceKey && "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY",
  ].filter(Boolean);
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null;
  if (missing.length) {
    if (check) return json({ configured: false, missing, redirect_uri: redirectUri, commit }, 200);
    return json({ error: "TikTok is not configured", code: "not_configured", missing }, 503);
  }

  const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // ── Health, needs no secret ───────────────────────────────────────────────
  if (check) {
    const { count } = await db.from("tiktok_connections")
      .select("org_id", { count: "exact", head: true });
    return json({
      configured: true,
      connections: count ?? 0,
      redirect_uri: redirectUri,
      scopes: SCOPES,
      auth_host: AUTH_HOST,
      api_host: API,
      enabled_orgs: enabledOrgs().length,
      commit,
    });
  }

  // ── Send somebody to TikTok's consent screen ──────────────────────────────
  // state is the same one-time token Telegram, Slack, Pinterest, Figma,
  // Instagram and Threads use, minted by create_messenger_link_token for the
  // signed-in person and carrying the workspace.
  if (mode === "install") {
    const state = url.searchParams.get("state") || "";
    if (!state) return json({ error: "Missing state" }, 400);
    const authorize = new URL(`${AUTH_HOST}/v2/auth/authorize/`);
    authorize.searchParams.set("client_key", clientKey);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", SCOPES);
    authorize.searchParams.set("state", state);
    return Response.redirect(authorize.toString(), 302);
  }

  // ── TikTok sends them back ────────────────────────────────────────────────
  if (mode === "callback") {
    const back = (status) => Response.redirect(`${appUrl}/?tiktok=${status}`, 302);
    const code = decodeURIComponent((url.searchParams.get("code") || "").replace(/\*$/, ""));
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

    const tokRes = await fetch(`${API}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey, client_secret: clientSecret,
        grant_type: "authorization_code", redirect_uri: redirectUri, code,
      }).toString(),
    });
    const t = await tokRes.json().catch(() => null);
    if (!tokRes.ok || !t?.access_token || !t?.open_id) {
      console.error("[tiktok] token exchange failed:", tokRes.status, t?.error_description || t?.error);
      return back("failed");
    }

    // Who it is. Not decorative: the Settings row and the composer both name
    // the account, and "connected" with no name beside it is a connection
    // nobody can tell apart from somebody else's.
    // Only the fields user.info.basic actually grants. Asking for username here
    // without the profile scope makes the whole call fail, and then a
    // connection that worked would be saved with no name on it.
    const me = await tk(t.access_token, "/user/info/", {
      query: { fields: "open_id,union_id,avatar_url,display_name" },
    });
    const u = me.body?.data?.user || {};

    const { error: saveErr } = await db.from("tiktok_connections").upsert({
      org_id: tok.org_id,
      open_id: t.open_id,
      union_id: t.union_id || u.union_id || null,
      username: u.username || null,
      display_name: u.display_name || null,
      avatar_url: u.avatar_url || null,
      access_token: t.access_token,
      token_expires_at: new Date(Date.now() + (t.expires_in ?? 86400) * 1000).toISOString(),
      refresh_token: t.refresh_token || null,
      refresh_expires_at: new Date(Date.now() + (t.refresh_expires_in ?? 31536000) * 1000).toISOString(),
      scopes: t.scope || SCOPES,
      connected_by: tok.user_id,
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,open_id" });
    if (saveErr) {
      console.error("[tiktok] connection not saved:", saveErr.message);
      return back("failed");
    }
    return back("connected");
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

  const { data: rows } = await db.from("tiktok_connections").select("*").eq("org_id", orgId);
  const accounts = rows || [];

  if (body.mode === "status") {
    return json({
      enabled: true,
      connected: accounts.length > 0,
      accounts: accounts.map(a => ({
        openId: a.open_id,
        username: a.username,
        displayName: a.display_name,
        avatarUrl: a.avatar_url,
        connectedAt: a.created_at,
        // The SHORT token expiring is routine and fixes itself. What actually
        // needs somebody is the refresh token running out, or an error written
        // down by a renewal that failed.
        needsReconnect: !!a.last_error
          || (!!a.refresh_expires_at && new Date(a.refresh_expires_at).getTime() <= Date.now()),
        lastError: a.last_error || null,
      })),
    });
  }

  if (body.mode === "disconnect") {
    const id = String(body.openId || "");
    if (!id) return json({ error: "openId is required" }, 400);
    await db.from("tiktok_connections").delete().eq("org_id", orgId).eq("open_id", id);
    return json({ ok: true });
  }

  const row = accounts.find(a => a.open_id === String(body.openId || ""))
    || (accounts.length === 1 ? accounts[0] : null);
  if (!row) return json({ error: "TikTok is not connected", code: "not_connected" }, 409);
  const token = await usableToken(db, row, clientKey, clientSecret);
  if (!token) return json({ error: "TikTok needs to be connected again", code: "reconnect_required" }, 401);

  // ── creator — what this account is ALLOWED to post ────────────────────────
  // Required before every post, and not merely as a courtesy: TikTok's own
  // rules say the composer must show the creator's permitted privacy levels
  // and must honour their comment, duet and stitch settings. A post built
  // without asking is a post built on assumptions about somebody else's
  // account, and it is one of the things the review checks.
  if (body.mode === "creator") {
    const r = await tk(token, "/post/publish/creator_info/query/", { method: "POST" });
    if (!r.ok) {
      return json({ error: r.message || "creator_info_failed", code: r.errCode || "failed" }, 502);
    }
    const d = r.body?.data || {};
    return json({
      nickname: d.creator_nickname ?? null,
      username: d.creator_username ?? null,
      avatarUrl: d.creator_avatar_url ?? null,
      privacyOptions: d.privacy_level_options || [],
      commentDisabled: !!d.comment_disabled,
      duetDisabled: !!d.duet_disabled,
      stitchDisabled: !!d.stitch_disabled,
      maxVideoSeconds: d.max_video_post_duration_sec ?? null,
    });
  }

  // ── publish-init — reserve the post ───────────────────────────────────────
  // Two shapes behind one verb, because TikTok has two and they differ in more
  // than a field name.
  //
  // A PHOTO post is a carousel, up to 35 of them, and TikTok PULLS the images
  // rather than taking an upload. It only pulls from a domain verified in its
  // own portal, and our media sits on Supabase storage, which is not one. The
  // way through is img-proxy: it already lives on app.i7os.com, which IS
  // verified, so a signed storage url handed to it comes back out under a host
  // TikTok will fetch. That is what the verification file bought.
  //
  // A single still is not a post here. TikTok has no such thing in the feed;
  // it is always the photo container, so one image is a carousel of one.
  if (body.mode === "publish-init" && String(body.kind || "video") === "photo") {
    const privacy = String(body.privacy || "");
    if (!privacy) return json({ error: "privacy is required", code: "no_privacy" }, 400);
    const images = (Array.isArray(body.images) ? body.images : []).filter(Boolean).slice(0, 35);
    if (!images.length) return json({ error: "images are required", code: "no_images" }, 400);

    const r = await tk(token, "/post/publish/content/init/", {
      method: "POST",
      body: {
        media_type: "PHOTO",
        post_mode: "DIRECT_POST",
        post_info: {
          title: String(body.title || "").slice(0, 90),
          description: String(body.caption || "").slice(0, 4000),
          privacy_level: privacy,
          disable_comment: !!body.disableComment,
          // A photo carousel on TikTok normally carries a track. Off by
          // request, on by default, because silent is the unusual one here.
          auto_add_music: body.autoAddMusic !== false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: Math.min(Math.max(0, Number(body.coverIndex) || 0), images.length - 1),
          photo_images: images,
        },
      },
    });
    if (!r.ok) return json({ error: r.message || "init_failed", code: r.errCode || "failed" }, 502);
    const d = r.body?.data || {};
    // No upload url: TikTok fetches the images itself, so the browser has
    // nothing to do but ask how it went.
    return json({ publishId: d.publish_id || null, uploadUrl: null, pulls: true });
  }

  // A VIDEO is uploaded, not pulled. The browser puts the bytes at upload_url
  // itself; nothing large passes through here, which is the whole reason this
  // is two calls and not one.
  if (body.mode === "publish-init") {
    const size = Number(body.size) || 0;
    if (!size) return json({ error: "size is required", code: "no_size" }, 400);

    const privacy = String(body.privacy || "");
    if (!privacy) return json({ error: "privacy is required", code: "no_privacy" }, 400);

    const r = await tk(token, "/post/publish/video/init/", {
      method: "POST",
      body: {
        post_info: {
          title: String(body.caption || "").slice(0, 2200),
          privacy_level: privacy,
          disable_comment: !!body.disableComment,
          disable_duet: !!body.disableDuet,
          disable_stitch: !!body.disableStitch,
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: size,
          // One part. Chunked upload exists for large files and is the next
          // thing to add if a real video ever refuses; a single part keeps the
          // browser's side to one request.
          chunk_size: size,
          total_chunk_count: 1,
        },
      },
    });
    if (!r.ok) {
      return json({ error: r.message || "init_failed", code: r.errCode || "failed" }, 502);
    }
    const d = r.body?.data || {};
    return json({ publishId: d.publish_id || null, uploadUrl: d.upload_url || null });
  }

  // ── publish-status — how far along it is ──────────────────────────────────
  // TikTok processes after the upload, so publishing is never finished at the
  // moment the bytes land. The browser asks here until it is.
  if (body.mode === "publish-status") {
    const publishId = String(body.publishId || "");
    if (!publishId) return json({ error: "publishId is required" }, 400);
    const r = await tk(token, "/post/publish/status/fetch/", {
      method: "POST", body: { publish_id: publishId },
    });
    if (!r.ok) {
      return json({ error: r.message || "status_failed", code: r.errCode || "failed" }, 502);
    }
    const d = r.body?.data || {};
    return json({
      status: d.status || null,
      failReason: d.fail_reason || null,
      publiclyAvailablePostId: d.publicaly_available_post_id || d.publicly_available_post_id || null,
      uploadedBytes: d.uploaded_bytes ?? null,
    });
  }

  return json({ error: "Unknown mode", code: "unknown_mode" }, 400);
}
