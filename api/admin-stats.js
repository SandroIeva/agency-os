// Operator overview: signups, workspaces, who belongs to which. Backs the
// /?admin page.
//
// Edge runtime → does NOT count against the Hobby 12-function Node limit, which
// is already full.
//
// ⚠ THIS RETURNS EVERY USER'S EMAIL ACROSS ALL WORKSPACES. Two gates, both
// required:
//   1. a valid Supabase session, and
//   2. that user's id listed in ADMIN_USER_IDS.
// Without the env var the endpoint refuses outright rather than defaulting to
// open — a misconfiguration must fail closed, not expose the user table.
//
// The data comes from the admin_* views, which are revoked from anon and
// authenticated and granted only to service_role, so there is no path to them
// from the browser client even with a stolen anon key.
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admins = (process.env.ADMIN_USER_IDS || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  if (!admins.length) {
    return json({ error: "Admin access is not configured", code: "not_configured" }, 503);
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey || !serviceKey) return json({ error: "Server not configured" }, 503);

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json({ error: "Authentication required", code: "unauthorized" }, 401);

  const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Invalid session", code: "unauthorized" }, 401);

  // Deliberately the same 403 and wording for "logged in but not an admin" as a
  // stranger would get — no hint that the page exists or who may use it.
  if (!admins.includes(userData.user.id)) return json({ error: "Forbidden", code: "forbidden" }, 403);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const [summary, workspaces, users] = await Promise.all([
    admin.from("admin_summary").select("*").maybeSingle(),
    admin.from("admin_workspaces").select("*").order("angelegt", { ascending: false }),
    admin.from("admin_users").select("*").order("registriert", { ascending: false }),
  ]);

  const firstError = summary.error || workspaces.error || users.error;
  if (firstError) return json({ error: "Query failed", detail: firstError.message }, 500);

  return json({
    summary: summary.data || {},
    workspaces: workspaces.data || [],
    users: users.data || [],
    generatedAt: new Date().toISOString(),
  });
}
