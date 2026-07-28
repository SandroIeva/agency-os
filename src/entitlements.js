// ── Plan entitlements: the single source of truth ──────────────────────────
//
// Imported by BOTH the browser bundle (src/App.jsx, src/BillingSettings.jsx) and
// the Vercel functions (via server/billing.js), so a limit is defined exactly
// once. Keep this file dependency-free — anything imported here ends up in both
// runtimes.
//
// Model: the paying entity is the USER who owns a workspace, not the workspace.
// Storage and seats are ONE pooled allowance per account, spread across every
// workspace that owner created. See supabase/migrations/…_billing_accounts.sql.

export const STORAGE_GB = 1024 * 1024 * 1024;

// `null` means unlimited. (Not Infinity — this crosses JSON, where Infinity
// serializes to null anyway; being explicit avoids a silent surprise.)
export const PLAN_ENTITLEMENTS = {
  // No subscription, or the trial has run out. Existing content stays readable
  // and exportable; nothing new can be created.
  free: {
    storageBytes: 1 * STORAGE_GB,
    seats: 1,
    workspaces: 1,
    projects: 0,
    collaboration: false,
    readOnly: true,
  },
  starter: {
    storageBytes: 5 * STORAGE_GB,
    seats: 1,
    workspaces: 1,
    projects: 3,
    collaboration: false,
    readOnly: false,
  },
  pro: {
    storageBytes: 25 * STORAGE_GB,
    seats: 5,
    workspaces: 5,
    projects: null,
    collaboration: true,
    readOnly: false,
  },
  agency: {
    storageBytes: 100 * STORAGE_GB,
    seats: 12,
    workspaces: null,
    projects: null,
    collaboration: true,
    readOnly: false,
  },
};

export const TRIAL_DAYS = 7;
export const TRIAL_PLAN = "starter";

// EUR per month. The annual figure is the monthly equivalent of a yearly
// charge — the same convention the pricing page uses.
export const PLAN_PRICES = {
  starter: { monthly: 15, annual: 12 },
  pro: { monthly: 24, annual: 20 },
  agency: { monthly: 85, annual: 72 },
};

export const PLAN_NAMES = { free: "Free", starter: "Starter", pro: "Pro", agency: "Agency" };

function gb(bytes) {
  return Math.round(bytes / STORAGE_GB) + " GB";
}

/**
 * The selling points of a plan, generated FROM its limits rather than written
 * out by hand. Hand-written feature lists drift from the enforced numbers the
 * first time a limit changes, and then the pricing page lies.
 */
export function planFeatures(plan, de = true) {
  const l = PLAN_ENTITLEMENTS[plan];
  if (!l) return [];

  // Free isn't a plan anyone buys — it's where an expired trial or a cancelled
  // subscription lands. Describing it as "up to 0 projects" is nonsense; what
  // matters is that the content is still there and still readable.
  if (l.readOnly) {
    return de
      ? ["Bestehende Inhalte bleiben lesbar", "Nichts wird gelöscht", "Export jederzeit möglich"]
      : ["Existing content stays readable", "Nothing is deleted", "Export at any time"];
  }

  const out = [];

  out.push(l.projects == null
    ? (de ? "Unbegrenzt viele Projekte" : "Unlimited projects")
    : (de ? `Bis zu ${l.projects} Projekte` : `Up to ${l.projects} projects`));

  out.push(l.workspaces == null
    ? (de ? "Unbegrenzt viele Workspaces" : "Unlimited workspaces")
    : l.workspaces === 1
      ? (de ? "Ein Workspace" : "One workspace")
      : (de ? `Bis zu ${l.workspaces} Workspaces` : `Up to ${l.workspaces} workspaces`));

  out.push(!l.collaboration
    ? (de ? "Für eine Person" : "For one person")
    : (de ? `Zusammenarbeit mit bis zu ${l.seats} Personen` : `Collaborate with up to ${l.seats} people`));

  out.push(de ? `${gb(l.storageBytes)} Speicher` : `${gb(l.storageBytes)} storage`);

  return out;
}

// Stripe statuses that still grant the paid plan. `past_due` is included on
// purpose: Stripe retries a failed payment for days, and cutting access on the
// first failed charge punishes people for an expired card.
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

export function limitsFor(plan) {
  return PLAN_ENTITLEMENTS[plan] || PLAN_ENTITLEMENTS.free;
}

// True when `used` has reached a limit. `null` (unlimited) is never reached.
export function isOverLimit(used, limit) {
  return limit != null && (used || 0) >= limit;
}

/**
 * Resolve a billing_accounts row into the plan actually in force right now.
 *
 * Two things make this more than a field read:
 *  • Our cardless trial is stored as status 'trialing' with a trial_ends_at.
 *    Once that date passes the row still says 'trialing', so the expiry has to
 *    be evaluated here rather than written into the DB by a cron job.
 *  • Stripe ALSO uses 'trialing' for a card-backed trial. Those carry a
 *    subscription id, which is how the two are told apart.
 */
export function resolveEntitlements(account, now = Date.now()) {
  const status = account?.status || "inactive";
  const trialEndsAt = account?.trial_ends_at ? Date.parse(account.trial_ends_at) : null;
  const hasStripeSub = Boolean(account?.stripe_subscription_id);

  // A plan granted outside Stripe (internal/comped accounts) outranks everything
  // else. Kept out of the `plan` column because the webhook derives that from
  // the Stripe price and would revert it on the next subscription event.
  const override = account?.plan_override;
  if (override && PLAN_ENTITLEMENTS[override]) {
    return {
      plan: override,
      status,
      isPaid: true,
      isComped: true,
      isTrial: false,
      trialExpired: false,
      trialEndsAt: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
      trialDaysLeft: 0,
      limits: limitsFor(override),
    };
  }

  const trialActive = !hasStripeSub
    && status === "trialing"
    && trialEndsAt != null
    && trialEndsAt > now;
  const trialExpired = !hasStripeSub
    && status === "trialing"
    && trialEndsAt != null
    && trialEndsAt <= now;

  const paidPlan = (hasStripeSub && PAID_STATUSES.has(status) && account?.plan) ? account.plan : null;
  const plan = paidPlan || (trialActive ? TRIAL_PLAN : "free");

  return {
    plan,
    status,
    isPaid: Boolean(paidPlan),
    isComped: false,
    isTrial: trialActive,
    trialExpired,
    trialEndsAt: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
    trialDaysLeft: trialActive ? Math.max(0, Math.ceil((trialEndsAt - now) / 86400000)) : 0,
    limits: limitsFor(plan),
  };
}
