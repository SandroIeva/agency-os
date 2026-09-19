// Notion, read-only: find a page somebody shared with i7OS and bring it in as
// a document.
//
// Like Pinterest, a Notion connection belongs to the WORKSPACE: one row per org
// in notion_connections, service key only. What it can see is decided on
// Notion's own consent screen, where the person connecting picks the pages;
// nothing here can reach a page they did not pick.
//
// Edge runtime, so it does not count against the Hobby cap of 12 Node
// functions.
//
// Verbs. The first two need no secret:
//   GET  ?check=1                     → is it configured, and which commit answers
//   GET  ?mode=install&state=<token>  → send somebody to Notion's consent screen
//   GET  ?mode=callback&code=…        → Notion sends them back here (/notion/callback)
//   POST { mode: "status",     orgId } → connected, and to which Notion workspace
//   POST { mode: "disconnect", orgId } → forget the connection
//   POST { mode: "search",     orgId, query?, cursor? } → pages it can see, newest first
//   POST { mode: "tree",       orgId } → every page and database it can see, with parents, for the picker's tree
//   POST { mode: "page",       orgId, pageId } → { title, html } ready for the document import
import { createClient } from "@supabase/supabase-js";
import { blocksToHtml, pageTitle, plain } from "../server/notion.js";

export const config = { runtime: "edge" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

const API = "https://api.notion.com/v1";
// The version this was written against. 2026-03-11 renamed `archived` to
// `in_trash` and `transcription` to `meeting_notes`; both are read below.
const NOTION_VERSION = "2026-03-11";

// Notion wants the client id and secret as HTTP Basic on the token calls.
const basic = (id, secret) => "Basic " + btoa(`${id}:${secret}`);

// Notion does not document how long an access token lives, but it does hand
// out a refresh token. So a token is used until Notion answers 401, then
// refreshed once and the call repeated.
async function refreshToken(db, row, clientId, clientSecret) {
  if (!row.refresh_token) return null;
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { Authorization: basic(clientId, clientSecret), "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", refresh_token: row.refresh_token }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) {
    // On the row, so Settings can say "connect again" instead of showing an
    // empty list.
    await db.from("notion_connections")
      .update({ last_error: `refresh failed: ${j?.message || j?.error || res.status}`, updated_at: new Date().toISOString() })
      .eq("org_id", row.org_id);
    return null;
  }
  await db.from("notion_connections").update({
    access_token: j.access_token,
    // Keep the old refresh token if a refresh does not send a new one.
    refresh_token: j.refresh_token || row.refresh_token,
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("org_id", row.org_id);
  row.access_token = j.access_token;
  row.refresh_token = j.refresh_token || row.refresh_token;
  return j.access_token;
}

class Reconnect extends Error {}

// One call to Notion, with the refresh-on-401 and one polite retry on 429
// (Notion allows about three requests a second).
async function notion(ctx, path, init = {}) {
  const call = () => fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ctx.row.access_token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
  });
  let r = await call();
  if (r.status === 401) {
    const t = await refreshToken(ctx.db, ctx.row, ctx.clientId, ctx.clientSecret);
    if (!t) throw new Reconnect("reconnect");
    r = await call();
    if (r.status === 401) throw new Reconnect("reconnect");
  }
  if (r.status === 429) {
    const wait = Math.min(3, Number(r.headers.get("retry-after")) || 1);
    await new Promise(res => setTimeout(res, wait * 1000));
    r = await call();
  }
  return r;
}

// A page's blocks, children included, within a budget of calls. An Edge
// function has to start answering within 25 seconds, and Notion allows about
// three requests a second, so a very long page comes back cut short (and says
// so) rather than not at all.
async function readBlocks(ctx, id, depth, budget) {
  const out = [];
  let cursor = null;
  do {
    if (budget.calls <= 0) { budget.truncated = true; break; }
    budget.calls--;
    const q = new URLSearchParams({ page_size: "100" });
    if (cursor) q.set("start_cursor", cursor);
    const r = await notion(ctx, `/blocks/${encodeURIComponent(id)}/children?${q}`);
    if (!r.ok) {
      if (depth === 0) {
        const j = await r.json().catch(() => null);
        const e = new Error(j?.message || `HTTP ${r.status}`);
        e.status = r.status; e.code = j?.code;
        throw e;
      }
      break; // a nested block that will not open costs its children, not the page
    }
    const j = await r.json();
    for (const b of j.results || []) {
      if (b.in_trash || b.archived) continue;
      // Sub-pages and databases are their own documents; only their title is
      // carried over, never their whole content.
      if (b.has_children && depth < 4 && b.type !== "child_page" && b.type !== "child_database") {
        b._children = await readBlocks(ctx, b.id, depth + 1, budget);
      }
      out.push(b);
    }
    cursor = j.has_more ? j.next_cursor : null;
  } while (cursor);
  return out;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  const check = url.searchParams.get("check");
  if (req.method !== "POST" && !mode && !check) return json({ error: "Method not allowed" }, 405);

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const supaUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const appUrl = (process.env.PUBLIC_APP_URL || "https://app.i7os.com").replace(/\/$/, "");
  const redirectUri = `${appUrl}/notion/callback`;
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null;

  // Names of what is missing, never values.
  const missing = [
    !clientId && "NOTION_CLIENT_ID",
    !clientSecret && "NOTION_CLIENT_SECRET",
    !supaUrl && "SUPABASE_URL",
    !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  if (missing.length) {
    if (check) return json({ configured: false, missing, redirect_uri: redirectUri, commit }, 200);
    return json({ error: "Notion is not configured", code: "not_configured", missing }, 503);
  }

  const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // ── Health, needs no secret ───────────────────────────────────────────────
  if (check) {
    const { count } = await db.from("notion_connections").select("org_id", { count: "exact", head: true });
    return json({ configured: true, connections: count ?? 0, redirect_uri: redirectUri, notion_version: NOTION_VERSION, commit });
  }

  // ── Send somebody to Notion's consent screen ──────────────────────────────
  // state is the one-time token create_messenger_link_token mints for the
  // signed-in person, carrying the workspace, exactly as for Pinterest.
  if (mode === "install") {
    const state = url.searchParams.get("state") || "";
    if (!state) return json({ error: "Missing state" }, 400);
    const authorize = new URL(`${API}/oauth/authorize`);
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("owner", "user");
    authorize.searchParams.set("state", state);
    return Response.redirect(authorize.toString(), 302);
  }

  // ── Notion sends them back ────────────────────────────────────────────────
  if (mode === "callback") {
    const back = (status) => Response.redirect(`${appUrl}/?notion=${status}`, 302);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (url.searchParams.get("error") || !code || !state) return back("cancelled");

    const { data: tok } = await db.from("messenger_link_tokens")
      .select("token, user_id, org_id, kind, expires_at, used_at").eq("token", state).maybeSingle();
    if (!tok || tok.used_at || !tok.org_id || tok.kind !== "notion" || new Date(tok.expires_at).getTime() < Date.now()) return back("expired");
    // Claimed BEFORE anything is written: a link opened twice connects once.
    const { data: claimed } = await db.from("messenger_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", state).is("used_at", null).select("token").maybeSingle();
    if (!claimed) return back("expired");

    // Minting and returning are two moments; somebody can be removed from the
    // workspace in between.
    const { data: stillAMember } = await db.from("org_members").select("user_id")
      .eq("org_id", tok.org_id).eq("user_id", tok.user_id).maybeSingle();
    if (!stillAMember) return back("forbidden");

    const res = await fetch(`${API}/oauth/token`, {
      method: "POST",
      headers: { Authorization: basic(clientId, clientSecret), "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.access_token) {
      console.error("[notion] token exchange failed:", res.status, j?.error || j?.message || "");
      return back("failed");
    }

    const { error: saveErr } = await db.from("notion_connections").upsert({
      org_id: tok.org_id,
      notion_workspace_id: j.workspace_id || null,
      workspace_name: j.workspace_name || null,
      workspace_icon: j.workspace_icon || null,
      bot_id: j.bot_id || null,
      access_token: j.access_token,
      refresh_token: j.refresh_token || null,
      connected_by: tok.user_id,
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id" });
    if (saveErr) {
      console.error("[notion] connection not saved:", saveErr.message);
      return back("save_failed");
    }
    return back("connected");
  }

  // ── Everything else is a POST from the app ────────────────────────────────
  // Signed in, and a member of the workspace asked about. An orgId alone proves
  // nothing: it is in every share link.
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

  const { data: row } = await db.from("notion_connections").select("*").eq("org_id", orgId).maybeSingle();

  if (body.mode === "status") {
    // Never the tokens.
    return json({
      connected: !!row,
      workspace_name: row?.workspace_name || null,
      connected_at: row?.created_at || null,
      needs_reconnect: !!row?.last_error,
      last_error: row?.last_error || null,
    });
  }

  if (body.mode === "disconnect") {
    await db.from("notion_connections").delete().eq("org_id", orgId);
    return json({ ok: true });
  }

  if (!row) return json({ error: "Notion is not connected", code: "not_connected" }, 409);
  const ctx = { db, row, clientId, clientSecret };

  try {
    if (body.mode === "search") {
      const payload = {
        filter: { property: "object", value: "page" },
        sort: { direction: "descending", timestamp: "last_edited_time" },
        page_size: 30,
      };
      const q = String(body.query || "").trim().slice(0, 200);
      if (q) payload.query = q;
      if (body.cursor) payload.start_cursor = String(body.cursor);
      const r = await notion(ctx, "/search", { method: "POST", body: JSON.stringify(payload) });
      const j = await r.json().catch(() => null);
      if (!r.ok) return json({ error: j?.message || `HTTP ${r.status}`, code: "notion_error" }, 502);
      return json({
        pages: (j.results || [])
          .filter(p => p.object === "page" && !p.in_trash && !p.archived)
          .map(p => ({ id: p.id, title: pageTitle(p), lastEdited: p.last_edited_time || null, url: p.url || null })),
        cursor: j.has_more ? j.next_cursor : null,
      });
    }

    // Everything the connection can see, pages AND databases, each with its
    // parent, so the picker can draw it the way Notion's sidebar does instead
    // of as one long list. Notion has no "give me the tree" call; search is
    // the only way to list what was shared, so it is paged through here, up to
    // ten pages of a hundred, newest first. More than that and the oldest are
    // left out, and the answer says so.
    if (body.mode === "tree") {
      const ref = (p) => (p ? {
        type: p.type || null,
        id: p.page_id || p.data_source_id || p.database_id || p.block_id || null,
        databaseId: p.database_id || null,
      } : null);
      const items = [];
      let cursor = null, calls = 0;
      do {
        const payload = { page_size: 100, sort: { direction: "descending", timestamp: "last_edited_time" } };
        if (cursor) payload.start_cursor = cursor;
        const r = await notion(ctx, "/search", { method: "POST", body: JSON.stringify(payload) });
        const j = await r.json().catch(() => null);
        if (!r.ok) return json({ error: j?.message || `HTTP ${r.status}`, code: "notion_error" }, 502);
        for (const o of j.results || []) {
          if (o.in_trash || o.archived) continue;
          if (o.object === "page") {
            items.push({ id: o.id, kind: "page", title: pageTitle(o), lastEdited: o.last_edited_time || null, parent: ref(o.parent) });
          } else if (o.object === "data_source") {
            // A database's content. Its own parent is the database; where the
            // database sits is database_parent.
            items.push({ id: o.id, kind: "db", title: plain(o.title).trim(), databaseId: o.parent?.database_id || null,
              lastEdited: o.last_edited_time || null, parent: ref(o.database_parent) });
          } else if (o.object === "database") {
            items.push({ id: o.id, kind: "db", title: plain(o.title).trim(), databaseId: o.id,
              lastEdited: o.last_edited_time || null, parent: ref(o.parent) });
          }
        }
        cursor = j.has_more ? j.next_cursor : null;
        calls++;
      } while (cursor && calls < 10);
      return json({ items, truncated: !!cursor });
    }

    if (body.mode === "page") {
      const pageId = String(body.pageId || "");
      if (!/^[0-9a-f-]{32,36}$/i.test(pageId)) return json({ error: "pageId is required" }, 400);
      const pr = await notion(ctx, `/pages/${encodeURIComponent(pageId)}`);
      const page = await pr.json().catch(() => null);
      if (!pr.ok) {
        const notShared = pr.status === 404 || page?.code === "object_not_found";
        return json({ error: page?.message || `HTTP ${pr.status}`, code: notShared ? "not_shared" : "notion_error" }, notShared ? 404 : 502);
      }
      const budget = { calls: 45, truncated: false };
      const blocks = await readBlocks(ctx, pageId, 0, budget);
      return json({ title: pageTitle(page), html: blocksToHtml(blocks), truncated: budget.truncated, url: page.url || null });
    }
  } catch (e) {
    if (e instanceof Reconnect) return json({ error: "Notion needs to be reconnected", code: "reconnect_required" }, 401);
    console.error("[notion]", body.mode, e?.message || e);
    return json({ error: e?.message || "Notion request failed", code: e?.code || "notion_error" }, 502);
  }

  return json({ error: "Unknown mode" }, 400);
}
