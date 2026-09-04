// Figma → Artboards. Designs come IN; nothing goes back out.
//
// A Figma connection belongs to the WORKSPACE, like Pinterest and unlike the
// messenger links: the files a team imports from are the team's, and a second
// person on the same board should not have to connect again to pull the design
// somebody else already brought in.
//
// Edge runtime → does NOT count against the Hobby 12-function Node limit, which
// is already at 11 of 12. Nothing here needs Node.
//
// Verbs. The first needs no secret and answers for itself:
//   GET  ?check=1                     → is it configured, and which commit is live
//   GET  ?mode=install&state=<token>  → send somebody to Figma's consent screen
//   GET  ?mode=callback&code=…        → Figma sends them back here (/figma/callback)
//   POST { mode: "status",     orgId } → connected, and as whom
//   POST { mode: "disconnect", orgId } → forget the account
//   POST { mode: "import", orgId, url } → one Figma frame, as artboard items
//
// Every POST carries the caller's Supabase JWT and has to resolve to a member
// of that workspace: an orgId in a body proves nothing, it is in every share
// link.
import { createClient } from "@supabase/supabase-js";
// The conversion itself is pure and lives in server/, so it can be exercised
// against a captured node tree without deploying anything.
import { figmaToItems, parseFigmaUrl } from "../server/figma.js";

export const config = { runtime: "edge" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

const API = "https://api.figma.com/v1";

// What the importer actually needs, and nothing else: a scope list is read by
// the person clicking Allow.
//
// file_content:read is the current scope for reading nodes; `files:read` is the
// deprecated blanket one and is deliberately not used. file_metadata:read is
// here so the import can name the file it is about to pull, which is worth
// asking for NOW rather than later: a token keeps the scopes it was issued
// with, so widening the list strands every connection made before the change.
// That is not a guess, it is what happened to Pinterest in this codebase.
//
// file_variables:read is Enterprise-only and therefore not requested at all:
// asking for it would put a permission most accounts cannot grant on the
// consent screen.
const SCOPES = ["file_content:read", "file_metadata:read"];

const basic = (id, secret) => "Basic " + btoa(`${id}:${secret}`);

// A token that is good for the next call. Figma's access tokens last 90 days
// and the refresh token renews them, so this renews a day EARLY: a token that
// expires between the check and the request is a failure nobody can explain.
// The same shape as Pinterest's usableToken, for the same reason.
async function usableToken(db, row, clientId, clientSecret) {
  const dayLeft = new Date(row.access_expires_at).getTime() - Date.now() > 86400000;
  if (dayLeft) return row.access_token;
  if (!row.refresh_token) return null;

  const res = await fetch(`${API}/oauth/refresh`, {
    method: "POST",
    headers: { Authorization: basic(clientId, clientSecret), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: row.refresh_token }).toString(),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) {
    // Written down rather than thrown away, so the Settings row can say what is
    // wrong instead of just "not connected".
    await db.from("figma_connections")
      .update({ last_error: `refresh failed (${res.status})`, updated_at: new Date().toISOString() })
      .eq("org_id", row.org_id);
    return null;
  }
  await db.from("figma_connections").update({
    access_token: j.access_token,
    access_expires_at: new Date(Date.now() + (j.expires_in ?? 7776000) * 1000).toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("org_id", row.org_id);
  return j.access_token;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  const check = url.searchParams.get("check");
  if (req.method !== "POST" && !mode && !check) return json({ error: "Method not allowed" }, 405);

  const clientId = process.env.FIGMA_CLIENT_ID;
  const clientSecret = process.env.FIGMA_CLIENT_SECRET;
  const supaUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const appUrl = (process.env.PUBLIC_APP_URL || "https://app.i7os.com").replace(/\/$/, "");
  const redirectUri = `${appUrl}/figma/callback`;

  // Names of what is missing, never values.
  const missing = [
    !clientId && "FIGMA_CLIENT_ID",
    !clientSecret && "FIGMA_CLIENT_SECRET",
    !supaUrl && "SUPABASE_URL",
    !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);

  // ── Health. Answers even when nothing is set up: that is the question it
  //    exists to answer, and it is how a deploy is checked without a secret and
  //    without anybody being asked to run something.
  if (check) {
    let connections = null;
    if (!missing.length) {
      const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
      const { count } = await db.from("figma_connections").select("org_id", { count: "exact", head: true });
      connections = count ?? 0;
    }
    return json({
      configured: missing.length === 0,
      missing: missing.length ? missing : undefined,
      connections,
      scopes: SCOPES.join(","),
      redirect_uri: redirectUri,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    });
  }

  if (missing.length) {
    return json({ error: "Figma is not configured", code: "not_configured", missing }, 503);
  }

  const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // ── Off to Figma ──────────────────────────────────────────────────────────
  // The state is the same one-time token Telegram, Slack and Pinterest mint
  // through create_messenger_link_token: it already carries a user and an org,
  // expires in ten minutes, and can only be spent once.
  if (mode === "install") {
    const state = url.searchParams.get("state") || "";
    if (!state) return json({ error: "Missing state" }, 400);
    const authorize = new URL("https://www.figma.com/oauth");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", SCOPES.join(","));
    authorize.searchParams.set("state", state);
    return Response.redirect(authorize.toString(), 302);
  }

  // ── Figma sends them back ─────────────────────────────────────────────────
  if (mode === "callback") {
    const back = (status) => Response.redirect(`${appUrl}/?figma=${status}`, 302);
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

    // Figma gives 30 seconds from the grant to spend the code, so nothing slow
    // belongs between the redirect and here.
    const res = await fetch(`${API}/oauth/token`, {
      method: "POST",
      headers: { Authorization: basic(clientId, clientSecret), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }).toString(),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.access_token) return back("failed");

    // Who was just connected, so the Settings row can say the account by name
    // rather than "connected" and leave somebody guessing which of theirs it is.
    const me = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${j.access_token}` } })
      .then(r => (r.ok ? r.json() : null)).catch(() => null);

    await db.from("figma_connections").upsert({
      org_id: tok.org_id,
      // The token response calls it user_id_string, not user_id.
      figma_user_id: j.user_id_string || me?.id || null,
      handle: me?.handle || null,
      email: me?.email || null,
      access_token: j.access_token,
      refresh_token: j.refresh_token || null,
      // 90 days is the documented default; the response is still believed over
      // the constant when it sends one.
      access_expires_at: new Date(Date.now() + (j.expires_in ?? 7776000) * 1000).toISOString(),
      scopes: SCOPES.join(","),
      connected_by: tok.user_id,
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id" });

    return back("connected");
  }

  // ── Everything else is a POST from the app ────────────────────────────────
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => null);
  if (!body?.orgId) return json({ error: "Missing orgId" }, 400);

  // An orgId proves nothing on its own: it is in every share link. The bearer
  // token has to resolve to a member of that workspace.
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "Not signed in" }, 401);
  const { data: who } = await createClient(supaUrl, serviceKey, { auth: { persistSession: false } })
    .auth.getUser(bearer);
  const uid = who?.user?.id;
  if (!uid) return json({ error: "Not signed in" }, 401);
  const { data: member } = await db.from("org_members")
    .select("user_id").eq("org_id", body.orgId).eq("user_id", uid).maybeSingle();
  if (!member) return json({ error: "Not a member of that workspace" }, 403);

  const { data: row } = await db.from("figma_connections")
    .select("*").eq("org_id", body.orgId).maybeSingle();

  if (body.mode === "status") {
    if (!row) return json({ connected: false });
    return json({
      connected: true,
      handle: row.handle,
      email: row.email,
      scopes: row.scopes,
      last_error: row.last_error || undefined,
    });
  }

  if (body.mode === "disconnect") {
    await db.from("figma_connections").delete().eq("org_id", body.orgId);
    return json({ ok: true });
  }

  if (!row) return json({ error: "Figma is not connected", code: "not_connected" }, 409);
  const token = await usableToken(db, row, clientId, clientSecret);
  if (!token) return json({ error: "Figma needs reconnecting", code: "reauth" }, 409);

  if (body.mode === "import") {
    const link = parseFigmaUrl(body.url);
    if (!link) return json({ error: "That is not a Figma link", code: "bad_url" }, 400);
    // Without a node id we would have to pull the entire file and guess which
    // frame was meant. Asking is better than guessing wrong on a 200-frame file.
    if (!link.nodeId) {
      return json({ error: "Pick a frame in Figma and copy the link to it", code: "no_node" }, 400);
    }

    const fig = (path) => fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const res = await fig(`/files/${link.key}/nodes?ids=${encodeURIComponent(link.nodeId)}`);
    if (res.status === 403 || res.status === 401) {
      return json({ error: "Figma refused that file", code: "forbidden" }, 403);
    }
    if (!res.ok) return json({ error: `Figma answered ${res.status}`, code: "upstream" }, 502);
    const j = await res.json().catch(() => null);
    const doc = j?.nodes?.[link.nodeId]?.document;
    if (!doc) return json({ error: "That frame is not in the file", code: "not_found" }, 404);

    const out = figmaToItems(doc);

    // The refs are opaque until this call maps them to URLs. One request for the
    // whole file rather than one per image.
    if (out.images.length) {
      const im = await fig(`/files/${link.key}/images`).then(r => (r.ok ? r.json() : null)).catch(() => null);
      const map = im?.meta?.images || {};
      out.images = out.images
        .map(({ id, imageRef }) => ({ id, url: map[imageRef] || null }))
        .filter(i => i.url);
    }

    return json({
      name: out.name,
      size: out.size,
      items: out.items,
      // Figma's own URLs, short-lived and without CORS. The browser pulls them
      // through api/img-proxy and uploads the bytes itself, so the import lands
      // in storage through uploadTracked like every other file and the ledger
      // stays right.
      images: out.images,
      warnings: out.warnings,
      root: out.root,
    });
  }

  return json({ error: "Not implemented yet", code: "todo", mode: body.mode }, 501);
}
