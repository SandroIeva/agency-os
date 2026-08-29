// Pinterest, in both directions: boards and pins come IN as inspiration, and a
// picture from the workspace goes OUT as a pin.
//
// Unlike the messenger links, which belong to a person, a Pinterest account
// here belongs to the WORKSPACE — its boards are what a team pulls from and
// posts to. One row per org in pinterest_connections, service key only.
//
// Edge runtime → does NOT count against the Hobby 12-function Node limit, which
// is already at 11 of 12. Nothing here needs Node: fetch, base64 and the
// Supabase client all work on the edge.
//
// Verbs. The first two need no secret and answer for themselves:
//   GET  ?check=1                     → is it configured, and does the token still work
//   GET  ?mode=install&state=<token>  → send somebody to Pinterest's consent screen
//   GET  ?mode=callback&code=…        → Pinterest sends them back here (/pinterest/callback)
//   POST { mode: "status",     orgId } → connected, and as whom
//   POST { mode: "disconnect", orgId } → forget the account
//   POST { mode: "boards",     orgId } → the boards this account can see
//   POST { mode: "pins",       orgId, boardId, bookmark? } → a page of pins from one board
//   POST { mode: "create-pin", orgId, boardId, imageUrl, title?, description?, link? }
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

const API = "https://api.pinterest.com/v5";

// Read what the account has, write pins into it, and know whose account it is.
// The _secret variants are what make a private board visible at all, and a
// design team's inspiration boards are usually secret. No ads, no catalogs, no
// billing: a scope list is read by the person clicking Allow.
const SCOPES = [
  "user_accounts:read",
  "boards:read", "boards:read_secret",
  "pins:read", "pins:read_secret",
  "pins:write",
].join(",");

// Pinterest wants the client id and secret as HTTP Basic on the token calls.
const basic = (id, secret) => "Basic " + btoa(`${id}:${secret}`);

// One access token lasts 30 days and the refresh token 60, renewing itself
// every time it is used. Refreshed a day early: a token that expires between
// the check and the call is a token that expired during the call.
async function usableToken(db, row, clientId, clientSecret) {
  const soon = Date.now() + 24 * 60 * 60 * 1000;
  if (new Date(row.access_expires_at).getTime() > soon) return row.access_token;

  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { Authorization: basic(clientId, clientSecret), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: row.refresh_token }).toString(),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) {
    // Say so on the row rather than only in a log: the UI can then tell
    // somebody to reconnect instead of showing an empty list of boards.
    await db.from("pinterest_connections")
      .update({ last_error: `refresh failed: ${j?.message || res.status}`, updated_at: new Date().toISOString() })
      .eq("org_id", row.org_id);
    return null;
  }
  const now = Date.now();
  await db.from("pinterest_connections").update({
    access_token: j.access_token,
    // A refresh does not always hand back a new refresh token; keep the old one
    // when it does not, or the next refresh has nothing to present.
    refresh_token: j.refresh_token || row.refresh_token,
    access_expires_at: new Date(now + (j.expires_in ?? 2592000) * 1000).toISOString(),
    refresh_expires_at: new Date(now + (j.refresh_token_expires_in ?? 5184000) * 1000).toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("org_id", row.org_id);
  return j.access_token;
}

const pin = (token, path, init = {}) =>
  fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });

export default async function handler(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  const check = url.searchParams.get("check");
  if (req.method !== "POST" && !mode && !check) return json({ error: "Method not allowed" }, 405);

  const clientId = process.env.PINTEREST_APP_ID;
  const clientSecret = process.env.PINTEREST_APP_SECRET;
  const supaUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const appUrl = (process.env.PUBLIC_APP_URL || "https://app.i7os.com").replace(/\/$/, "");
  const redirectUri = `${appUrl}/pinterest/callback`;

  // Names of what is missing, never values.
  const missing = [
    !clientId && "PINTEREST_APP_ID",
    !clientSecret && "PINTEREST_APP_SECRET",
    !supaUrl && "SUPABASE_URL",
    !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  if (missing.length) {
    // check=1 has to answer even when nothing is set up: that is the question
    // it exists to answer.
    if (check) return json({ configured: false, missing, redirect_uri: redirectUri }, 200);
    return json({ error: "Pinterest is not configured", code: "not_configured", missing }, 503);
  }

  const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // ── Health, needs no secret ───────────────────────────────────────────────
  if (check) {
    const { count } = await db.from("pinterest_connections").select("org_id", { count: "exact", head: true });
    return json({
      configured: true,
      connections: count ?? 0,
      redirect_uri: redirectUri,
      scopes: SCOPES,
      // Which commit is answering, so "is my fix live" stops being a guess.
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
    });
  }

  // ── Send somebody to Pinterest's consent screen ───────────────────────────
  // state is the same one-time token Telegram and Slack use, minted by
  // create_messenger_link_token for the signed-in person and carrying the
  // workspace. It is what tells the callback WHICH workspace came back, and it
  // cannot be guessed or replayed.
  if (mode === "install") {
    const state = url.searchParams.get("state") || "";
    if (!state) return json({ error: "Missing state" }, 400);
    const authorize = new URL("https://www.pinterest.com/oauth/");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", SCOPES);
    authorize.searchParams.set("state", state);
    return Response.redirect(authorize.toString(), 302);
  }

  // ── Pinterest sends them back ─────────────────────────────────────────────
  if (mode === "callback") {
    const back = (status) => Response.redirect(`${appUrl}/?pinterest=${status}`, 302);
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

    const res = await fetch(`${API}/oauth/token`, {
      method: "POST",
      headers: { Authorization: basic(clientId, clientSecret), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }).toString(),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.access_token) return back("failed");

    // Who was just connected, so the UI can say the account by name rather than
    // "connected" and leave somebody guessing which of their accounts it was.
    const me = await pin(j.access_token, "/user_account").then(r => r.ok ? r.json() : null).catch(() => null);

    const now = Date.now();
    await db.from("pinterest_connections").upsert({
      org_id: tok.org_id,
      pinterest_user_id: me?.id || null,
      username: me?.username || null,
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      access_expires_at: new Date(now + (j.expires_in ?? 2592000) * 1000).toISOString(),
      refresh_expires_at: new Date(now + (j.refresh_token_expires_in ?? 5184000) * 1000).toISOString(),
      scopes: j.scope || SCOPES,
      connected_by: tok.user_id,
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id" });

    return back("connected");
  }

  // ── Everything else is a POST from the app ────────────────────────────────
  //
  // Signed in, and a member of the workspace being asked about. An orgId is not
  // a secret: it is in the url of every share link and in every row the browser
  // already holds, so a body that only carries one is a body anybody can write.
  // Without this, knowing a workspace's id would be enough to list its private
  // Pinterest boards, or to publish a pin from its account.
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

  const { data: row } = await db.from("pinterest_connections").select("*").eq("org_id", orgId).maybeSingle();

  if (body.mode === "status") {
    // Never the tokens. This endpoint answers "connected, and as whom".
    return json({
      connected: !!row,
      username: row?.username || null,
      scopes: row?.scopes || null,
      connected_at: row?.created_at || null,
      needs_reconnect: !!row?.last_error,
      last_error: row?.last_error || null,
    });
  }

  if (body.mode === "disconnect") {
    await db.from("pinterest_connections").delete().eq("org_id", orgId);
    return json({ ok: true });
  }

  if (!row) return json({ error: "Pinterest is not connected", code: "not_connected" }, 409);
  const token = await usableToken(db, row, clientId, clientSecret);
  if (!token) return json({ error: "Pinterest needs to be reconnected", code: "reconnect_required" }, 401);

  if (body.mode === "boards") {
    const q = new URLSearchParams({ page_size: "100" });
    if (body.bookmark) q.set("bookmark", body.bookmark);
    const r = await pin(token, `/boards?${q}`);
    const j = await r.json().catch(() => null);
    if (!r.ok) return json({ error: j?.message || `HTTP ${r.status}`, code: "pinterest_error" }, 502);
    return json({
      boards: (j.items || []).map(b => ({
        id: b.id,
        name: b.name,
        description: b.description || null,
        privacy: b.privacy || null,
        pinCount: b.pin_count ?? null,
        image: b.media?.image_cover_url || null,
      })),
      bookmark: j.bookmark || null,
    });
  }

  if (body.mode === "pins") {
    if (!body.boardId) return json({ error: "boardId is required" }, 400);
    const q = new URLSearchParams({ page_size: "50" });
    if (body.bookmark) q.set("bookmark", body.bookmark);
    const r = await pin(token, `/boards/${encodeURIComponent(body.boardId)}/pins?${q}`);
    const j = await r.json().catch(() => null);
    if (!r.ok) return json({ error: j?.message || `HTTP ${r.status}`, code: "pinterest_error" }, 502);
    return json({
      pins: (j.items || []).map(p => {
        // The image comes back as a map of sizes whose keys differ by pin type.
        // Take the widest rather than naming one, or a pin that happens not to
        // have "1200x" comes through with no picture at all.
        const sizes = Object.values(p.media?.images || {});
        const best = sizes.sort((a, b) => (b.width || 0) - (a.width || 0))[0] || null;
        return {
          id: p.id,
          title: p.title || null,
          description: p.description || null,
          link: p.link || null,
          url: best?.url || null,
          width: best?.width || null,
          height: best?.height || null,
        };
      }).filter(p => p.url),
      bookmark: j.bookmark || null,
    });
  }

  if (body.mode === "create-pin") {
    const { boardId, imageUrl } = body;
    if (!boardId || !imageUrl) return json({ error: "boardId and imageUrl are required" }, 400);
    const r = await pin(token, "/pins", {
      method: "POST",
      body: JSON.stringify({
        board_id: boardId,
        title: (body.title || "").slice(0, 100) || undefined,
        description: (body.description || "").slice(0, 800) || undefined,
        link: body.link || undefined,
        // Pinterest fetches the image itself, so it has to be a url it can
        // reach: a Supabase public url works, a signed one expires.
        media_source: { source_type: "image_url", url: imageUrl },
      }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) return json({ error: j?.message || `HTTP ${r.status}`, code: "pinterest_error" }, 502);
    return json({ ok: true, id: j.id, url: j.id ? `https://www.pinterest.com/pin/${j.id}/` : null });
  }

  return json({ error: "Unknown mode" }, 400);
}
