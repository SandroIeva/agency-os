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

// The owner's own accounts, for "whoami" and nothing else: they may replay the
// onboarding tour. By confirmed email rather than id, because the test account
// is deleted and signed up again to walk through onboarding from scratch, and
// comes back with a new id every time. This grants NO data: everything below
// stays behind ADMIN_USER_IDS.
// googlemail.com and gmail.com are one mailbox; Google reports this account
// as googlemail.com, and both are listed so a change on their side cannot lock
// the owner out of his own button.
const TOUR_OPERATOR_EMAILS = ["sandro.ieva@googlemail.com", "sandro.ieva@gmail.com", "sandro@minddraft.com"];

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

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

  // "Am I the operator?", for the few controls in the app that only the
  // operator should see (replaying the onboarding tour). It answers for the
  // caller's own session and nothing else, and reads no data.
  const body = await req.json().catch(() => ({}));
  if (body?.mode === "whoami") {
    const u = userData.user;
    const email = u.email_confirmed_at ? (u.email || "").toLowerCase() : "";
    return json({ admin: admins.includes(u.id) || TOUR_OPERATOR_EMAILS.includes(email) });
  }

  // Deliberately the same 403 and wording for "logged in but not an admin" as a
  // stranger would get — no hint that the page exists or who may use it.
  if (!admins.includes(userData.user.id)) return json({ error: "Forbidden", code: "forbidden" }, 403);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Einen Workspace fuer den direkten Weg zu Meta freischalten, oder ihn wieder
  // zunehmen. Steht hier und nicht in einer Umgebungsvariablen, weil ein Tester
  // sonst einen Deploy kostet.
  //
  // Der Schalter oeffnet genau zwei Dinge: Instagram und Threads direkt
  // verbinden, deren Zahlen lesen, darauf veroeffentlichen. Er ist kein Plan
  // und schaltet nichts anderes frei. Das darf er auch, weil dieser Weg uns pro
  // Nutzung nichts kostet, anders als Zernio.
  if (body?.mode === "social-direct") {
    const orgId = String(body.orgId || "");
    if (!/^[0-9a-f-]{36}$/i.test(orgId)) return json({ error: "Bad workspace id" }, 400);
    const on = body.on === true;
    const { error } = await admin.from("organizations")
      .update({ social_direct: on }).eq("id", orgId);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, orgId, social_direct: on });
  }

  const [summary, workspaces, users, website] = await Promise.all([
    admin.from("admin_summary").select("*").maybeSingle(),
    admin.from("admin_workspaces").select("*").order("angelegt", { ascending: false }),
    admin.from("admin_users").select("*").order("registriert", { ascending: false }),
    admin.rpc("admin_website_stats"),
  ]);

  const firstError = summary.error || workspaces.error || users.error;
  if (firstError) return json({ error: "Query failed", detail: firstError.message }, 500);

  return json({
    summary: summary.data || {},
    workspaces: workspaces.data || [],
    users: users.data || [],
    website: website.error ? { error: "unavailable" } : website.data,
    generatedAt: new Date().toISOString(),
  });
}
