// Workspace deletion that leaves NOTHING behind — DB rows AND every storage asset
// (including files uploaded by other members). A single user session can't do this
// (storage RLS only lets you remove your own objects), so this runs server-side
// with the service key. Edge runtime → does NOT count against the Hobby 12-function
// Node limit.
//
// POST /api/workspace-delete  { orgId }  + Supabase Bearer token.
// Flow: verify the caller is an ADMIN of the org → list every storage object for
// the org (org_storage_objects RPC: ledger + org-prefixed paths + moodboards) →
// remove them from Storage → delete the organization (DB cascade wipes all rows).
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !serviceKey || !anonKey) return json({ error: "Server not configured", code: "not_configured" }, 503);

  let orgId;
  try { ({ orgId } = await req.json()); } catch { return json({ error: "Bad request" }, 400); }
  if (!orgId || !/^[0-9a-f-]{36}$/i.test(orgId)) return json({ error: "Invalid orgId" }, 400);

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Authentication required", code: "unauthorized" }, 401);

  const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1) Authenticate + authorize: caller must be an admin of this workspace.
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Invalid session", code: "unauthorized" }, 401);
  const uid = userData.user.id;

  const { data: mem, error: memErr } = await admin
    .from("org_members").select("role").eq("org_id", orgId).eq("user_id", uid).maybeSingle();
  if (memErr) return json({ error: "Lookup failed" }, 500);
  if (!mem) return json({ error: "You do not belong to this workspace", code: "forbidden" }, 403);
  if (mem.role !== "admin") return json({ error: "Only admins can delete a workspace", code: "admin_required" }, 403);

  // 2) Enumerate every storage object for the org and remove it (any owner).
  let removed = 0;
  try {
    const { data: objects, error: objErr } = await admin.rpc("org_storage_objects", { p_org: orgId });
    if (objErr) throw objErr;
    const byBucket = {};
    for (const o of objects || []) { if (o?.bucket && o?.name) (byBucket[o.bucket] ||= []).push(o.name); }
    for (const [bucket, names] of Object.entries(byBucket)) {
      for (let i = 0; i < names.length; i += 100) {
        const batch = names.slice(i, i + 100);
        const { error: rmErr } = await admin.storage.from(bucket).remove(batch);
        if (rmErr) console.warn("[workspace-delete] remove failed", bucket, rmErr.message);
        else removed += batch.length;
      }
    }
  } catch (e) {
    // Storage cleanup is best-effort — do NOT abandon the DB deletion because of it.
    console.warn("[workspace-delete] storage cleanup error:", e?.message);
  }

  // 3) Delete the organization — DB cascade removes all its rows (projects, tasks,
  //    files, brand, whiteboards, members, ledger, …).
  const { error: delErr } = await admin.from("organizations").delete().eq("id", orgId);
  if (delErr) { console.error("[workspace-delete] org delete failed:", delErr); return json({ error: "Deletion failed" }, 500); }

  return json({ ok: true, removed });
}
