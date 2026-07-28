// Daily account-lifecycle sweep: warn, then reclaim storage, then delete the
// rows of workspaces whose owner has had no plan for a long time.
//
// Called by Vercel Cron once a day (see vercel.json). Edge runtime → does NOT
// count against the Hobby 12-function Node limit.
//
// Schedule (from …_account_lifecycle.sql; doubled for accounts that ever paid):
//   day 16  warning email          (14 days before the storage purge)
//   day 30  storage objects purged
//   day 90  workspace rows purged
//
// THIS IS THE ONLY CODE IN THE PRODUCT THAT DELETES DATA NOBODY ASKED IT TO.
// Three guards, on purpose:
//   1. It refuses to run without CRON_SECRET, so it is not publicly callable.
//   2. It reports instead of deleting unless LIFECYCLE_PURGE_ENABLED === "true".
//      Deploying it does nothing until that is switched on deliberately.
//   3. MAX_PER_RUN caps the blast radius of a bad query to a handful of
//      accounts per day rather than the whole table.
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const MAX_PER_RUN = 25;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

async function purgeOrgStorage(admin, orgId) {
  let removed = 0;
  const { data: objects, error } = await admin.rpc("org_storage_objects", { p_org: orgId });
  if (error) throw error;
  const byBucket = {};
  for (const o of objects || []) { if (o?.bucket && o?.name) (byBucket[o.bucket] ||= []).push(o.name); }
  for (const [bucket, names] of Object.entries(byBucket)) {
    for (let i = 0; i < names.length; i += 100) {
      const batch = names.slice(i, i + 100);
      const { error: rmErr } = await admin.storage.from(bucket).remove(batch);
      if (rmErr) console.warn("[lifecycle] remove failed", bucket, rmErr.message);
      else removed += batch.length;
    }
  }
  return removed;
}

export default async function handler(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: "CRON_SECRET is not configured", code: "not_configured" }, 503);

  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) return json({ error: "Unauthorized" }, 401);

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return json({ error: "Server not configured" }, 503);

  // Opt-in switch. Without it the sweep still runs, still logs what it WOULD
  // do, and touches nothing — which is how you verify the selection is right
  // before trusting it with real deletions.
  const armed = process.env.LIFECYCLE_PURGE_ENABLED === "true";
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Start the clock for accounts that just lost access — and, more importantly,
  // stop it for anyone who got access back.
  const { error: refreshErr } = await admin.rpc("refresh_access_ended");
  if (refreshErr) return json({ error: "refresh failed", detail: refreshErr.message }, 500);

  const { data: due, error: dueErr } = await admin
    .from("account_lifecycle_due")
    .select("*")
    .in("due_action", ["warn", "purge_storage", "purge"])
    .order("access_ended_at", { ascending: true })
    .limit(MAX_PER_RUN);
  if (dueErr) return json({ error: "lookup failed", detail: dueErr.message }, 500);

  const result = { armed, warned: 0, storagePurged: 0, purged: 0, failed: 0, considered: (due || []).length };

  for (const row of due || []) {
    const owner = row.owner_user_id;
    const detail = {
      days_without_access: row.days_without_access,
      ever_paid: row.ever_paid,
      action: row.due_action,
    };

    if (!armed) {
      await admin.from("account_lifecycle_log").insert({ owner_user_id: owner, action: "dry_run", detail });
      continue;
    }

    try {
      const { data: orgs, error: orgErr } = await admin
        .from("organizations").select("id, name").eq("created_by", owner);
      if (orgErr) throw orgErr;
      const orgIds = (orgs || []).map(o => o.id);

      if (row.due_action === "warn") {
        const { data: profile } = await admin
          .from("profiles").select("email").eq("id", owner).maybeSingle();
        if (profile?.email) {
          // Best-effort: a bounced warning must not stop the schedule, but it
          // is recorded so nobody is deleted without a traceable notice.
          try {
            await fetch(`${process.env.PUBLIC_APP_URL || ""}/api/send`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mode: "lifecycle-warning",
                email: profile.email,
                daysLeft: Math.max(0, row.storage_purge_after_days - row.days_without_access),
                workspaces: (orgs || []).map(o => o.name),
              }),
            });
          } catch (e) { console.warn("[lifecycle] warning email failed:", e?.message); }
        }
        await admin.from("billing_accounts")
          .update({ purge_warned_at: new Date().toISOString() }).eq("owner_user_id", owner);
        await admin.from("account_lifecycle_log")
          .insert({ owner_user_id: owner, action: "warned", detail: { ...detail, email: Boolean(profile?.email) } });
        result.warned += 1;
        continue;
      }

      if (row.due_action === "purge_storage") {
        let removed = 0;
        for (const orgId of orgIds) removed += await purgeOrgStorage(admin, orgId);
        // Ledger rows go too, so usage reporting matches what is actually stored.
        if (orgIds.length) await admin.from("workspace_files").delete().in("org_id", orgIds);
        await admin.from("billing_accounts")
          .update({ storage_purged_at: new Date().toISOString() }).eq("owner_user_id", owner);
        await admin.from("account_lifecycle_log")
          .insert({ owner_user_id: owner, action: "storage_purged", detail: { ...detail, removed, orgs: orgIds.length } });
        result.storagePurged += 1;
        continue;
      }

      if (row.due_action === "purge") {
        // Any storage that outlived the earlier stage (or was uploaded in
        // between) goes now, before the rows that point at it disappear.
        for (const orgId of orgIds) {
          try { await purgeOrgStorage(admin, orgId); } catch (e) { console.warn("[lifecycle] late storage purge:", e?.message); }
        }
        if (orgIds.length) {
          const { error: delErr } = await admin.from("organizations").delete().in("id", orgIds);
          if (delErr) throw delErr;
        }
        // The auth user is deliberately kept: it costs nothing, it lets the
        // person still sign in and see what happened, and it preserves the
        // record of why their content was removed.
        await admin.from("billing_accounts")
          .update({ purged_at: new Date().toISOString() }).eq("owner_user_id", owner);
        await admin.from("account_lifecycle_log")
          .insert({ owner_user_id: owner, action: "purged", detail: { ...detail, orgs: orgIds.length } });
        result.purged += 1;
      }
    } catch (e) {
      console.error("[lifecycle] failed for", owner, e?.message);
      await admin.from("account_lifecycle_log")
        .insert({ owner_user_id: owner, action: "skipped", detail: { ...detail, error: e?.message || "unknown" } });
      result.failed += 1;
    }
  }

  return json({ ok: true, ...result });
}
