import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { resolveEntitlements } from "../src/entitlements.js";

const PLANS = new Set(["starter", "pro", "agency"]);
const BILLING_INTERVALS = new Set(["monthly", "annual"]);

let stripeClient;
let adminClient;
let authClient;

export class HttpError extends Error {
  constructor(status, message, code = "billing_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new HttpError(503, `${name} is not configured`, "billing_not_configured");
  return value;
}

export function getStripe() {
  if (!stripeClient) {
    stripeClient = new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
      maxNetworkRetries: 2,
    });
  }
  return stripeClient;
}

export function getAdminSupabase() {
  if (!adminClient) {
    adminClient = createClient(
      requiredEnv("SUPABASE_URL"),
      process.env.SUPABASE_SECRET_KEY || requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }
  return adminClient;
}

function getAuthSupabase() {
  if (!authClient) {
    authClient = createClient(
      requiredEnv("SUPABASE_URL"),
      process.env.SUPABASE_PUBLISHABLE_KEY || requiredEnv("SUPABASE_ANON_KEY"),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }
  return authClient;
}

export function parsePlanSelection(plan, billing) {
  if (!PLANS.has(plan) || !BILLING_INTERVALS.has(billing)) {
    throw new HttpError(400, "Invalid plan or billing interval", "invalid_plan");
  }
  return { plan, billing };
}

export async function requireUser(req) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw new HttpError(401, "Authentication required", "unauthorized");

  const { data, error } = await getAuthSupabase().auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "Invalid or expired session", "unauthorized");
  return data.user;
}

export async function requireOrgMember(userId, orgId, { adminOnly = false } = {}) {
  if (!orgId) throw new HttpError(400, "Workspace is required", "missing_workspace");

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new HttpError(403, "You do not belong to this workspace", "forbidden");
  if (adminOnly && data.role !== "admin") {
    throw new HttpError(403, "Only workspace admins can manage billing", "admin_required");
  }
  return data;
}

// Buying a plan is the OWNER's call, not any admin's. Without this an admin who
// was merely invited into someone else's workspace could start a second
// subscription for a workspace already covered by its owner's plan.
export async function requireOrgOwner(userId, orgId) {
  await requireOrgMember(userId, orgId);
  const ownerUserId = await getOrgOwner(orgId);
  if (ownerUserId !== userId) {
    throw new HttpError(
      403,
      "Only the workspace owner can manage the subscription for this workspace",
      "owner_required",
    );
  }
  return ownerUserId;
}

export function getPriceId(plan, billing) {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${billing.toUpperCase()}`;
  return requiredEnv(key);
}

export function getPlanForPrice(priceId) {
  for (const plan of PLANS) {
    for (const billing of BILLING_INTERVALS) {
      const key = `STRIPE_PRICE_${plan.toUpperCase()}_${billing.toUpperCase()}`;
      if (process.env[key] && process.env[key] === priceId) return { plan, billing };
    }
  }
  return { plan: null, billing: null };
}

export async function getWorkspaceBilling(orgId) {
  const { data, error } = await getAdminSupabase()
    .from("workspace_subscriptions")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── Account-level billing ──────────────────────────────────────────────────
// A plan belongs to the person who CREATED a workspace and covers every
// workspace they own, with one pooled storage/seat allowance. So every lookup
// starts by resolving a workspace to its owner.

export async function getOrgOwner(orgId) {
  const { data, error } = await getAdminSupabase()
    .from("organizations")
    .select("created_by")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Workspace not found", "unknown_workspace");
  return data.created_by || null;
}

export async function getBillingAccount(ownerUserId) {
  if (!ownerUserId) return null;
  const { data, error } = await getAdminSupabase()
    .from("billing_accounts")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Current pooled consumption for an account, across all workspaces it owns.
// Counts are what the limits in src/entitlements.js are compared against.
export async function getAccountUsage(ownerUserId) {
  const empty = { storageBytes: 0, seats: 0, workspaces: 0, projects: 0 };
  if (!ownerUserId) return empty;
  const admin = getAdminSupabase();

  const { data: orgs, error: orgErr } = await admin
    .from("organizations")
    .select("id")
    .eq("created_by", ownerUserId);
  if (orgErr) throw orgErr;

  const orgIds = (orgs || []).map(o => o.id);
  if (!orgIds.length) return empty;

  const [files, seats, projects] = await Promise.all([
    admin.from("workspace_files").select("size_bytes").in("org_id", orgIds),
    // Deliberately the same DB function the enforcement triggers use, rather
    // than a second count here. Seats span org_members AND project_members (a
    // project invite grants access without workspace membership) and include
    // still-pending invitations, because a sent invite is a seat someone can
    // walk into. Two implementations of that rule would eventually disagree.
    admin.rpc("account_seats_reserved", { p_owner: ownerUserId }),
    admin.from("projects").select("id", { count: "exact", head: true }).in("org_id", orgIds),
  ]);
  if (files.error) throw files.error;
  if (seats.error) throw seats.error;
  if (projects.error) throw projects.error;

  return {
    storageBytes: (files.data || []).reduce((sum, row) => sum + Number(row.size_bytes || 0), 0),
    seats: Number(seats.data) || 0,
    workspaces: orgIds.length,
    projects: projects.count || 0,
  };
}

// The full entitlement picture for a workspace: which plan is in force (trial
// expiry resolved), what it allows, and what the owner has already used.
export async function getEntitlementsForOrg(orgId) {
  const ownerUserId = await getOrgOwner(orgId);
  const account = await getBillingAccount(ownerUserId);
  const resolved = resolveEntitlements(account);
  const usage = await getAccountUsage(ownerUserId);
  return { ownerUserId, account, ...resolved, usage };
}

export async function getOrCreateCustomer({ orgId, user }) {
  const existing = await getBillingAccount(user.id);
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email || undefined,
    name: user.user_metadata?.full_name || user.user_metadata?.name || undefined,
    metadata: {
      org_id: orgId,
      supabase_user_id: user.id,
    },
  });

  const { error } = await getAdminSupabase()
    .from("billing_accounts")
    .upsert({
      owner_user_id: user.id,
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner_user_id" });
  if (error) throw error;
  return customer.id;
}

export function getAppUrl(req) {
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL.replace(/\/$/, "");
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}`;
}

export function sendBillingError(res, error) {
  const status = error instanceof HttpError ? error.status : 500;
  const code = error instanceof HttpError ? error.code : "internal_error";
  if (status >= 500) console.error("[Billing]", error);
  const message = status >= 500
    ? "Billing service is temporarily unavailable"
    : error.message || "Billing request failed";
  return res.status(status).json({ error: message, code });
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  return {};
}

// Which subscription owns the account row.
//
// Stripe does not promise the order its events arrive in, and the payload of a
// customer.subscription.* event is a SNAPSHOT taken when the event was made,
// not the subscription as it stands now. Two different things went wrong with
// that, and they need two different answers.
//
// The snapshot could simply be stale, so an event made before a change arrived
// after it and wrote the older state back. That half is closed in the webhook,
// which now retrieves the subscription fresh instead of believing the payload.
//
// The other half is this function. The event can be about a DIFFERENT and older
// subscription: somebody cancels and subscribes again, the cancellation event is
// delayed, and it lands after the new subscription and marks the account
// cancelled. The customer is paying and the product says they are not.
//
// The rule: an event only writes the account row if it is about the subscription
// the row already names, or about one that is genuinely newer. `created` is a
// Stripe timestamp in whole seconds, so two subscriptions made inside the same
// second cannot be told apart by it; a live stored subscription wins that tie,
// because overwriting something that is being paid for is the worse mistake.
export const SUBSCRIPTION_LIVE_STATUSES = new Set([
  "active", "trialing", "incomplete", "past_due", "unpaid", "paused",
]);

export function subscriptionWins(stored, incoming) {
  if (!incoming?.id) return { apply: false, reason: "no_subscription_id" };
  if (!stored?.id) return { apply: true, reason: "nothing_stored" };
  if (stored.id === incoming.id) return { apply: true, reason: "same_subscription" };

  // The stored one is over. Anything current takes the row.
  if (!SUBSCRIPTION_LIVE_STATUSES.has(stored.status)) {
    return { apply: true, reason: "stored_is_finished" };
  }

  const a = Number(incoming.created || 0);
  const b = Number(stored.created || 0);
  if (a > b) {
    // A second subscription while the first is still live is a double charge,
    // not a plan change: the Customer Portal switches the SAME subscription. The
    // newer one takes the row so the customer sees what they are being billed
    // for now, and the older one is named in the log because it is still
    // running and nothing in the product can find it any more.
    return { apply: true, reason: "newer_subscription", displaced: stored.id };
  }
  return { apply: false, reason: "older_than_stored" };
}

export async function syncStripeSubscription(subscription) {
  const admin = getAdminSupabase();
  const item = subscription.items?.data?.[0];
  const priceId = typeof item?.price === "string" ? item.price : item?.price?.id;
  const productId = typeof item?.price?.product === "string"
    ? item.price.product
    : item?.price?.product?.id || null;
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;

  let orgId = subscription.metadata?.org_id || null;
  if (!orgId && customerId) {
    const { data } = await admin
      .from("workspace_subscriptions")
      .select("org_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    orgId = data?.org_id || null;
  }

  // The subscription belongs to the account, so the owner is what actually
  // matters. Prefer deriving it from the workspace (authoritative), then the
  // existing customer row, and only then the Checkout metadata — which records
  // who clicked buy, and is stale if ownership ever moves.
  let ownerUserId = null;
  if (orgId) {
    const { data } = await admin
      .from("organizations")
      .select("created_by")
      .eq("id", orgId)
      .maybeSingle();
    ownerUserId = data?.created_by || null;
  }
  if (!ownerUserId && customerId) {
    const { data } = await admin
      .from("billing_accounts")
      .select("owner_user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    ownerUserId = data?.owner_user_id || null;
  }
  if (!ownerUserId) ownerUserId = subscription.metadata?.supabase_user_id || null;

  if (!orgId && !ownerUserId) return null;

  const mapped = getPlanForPrice(priceId);
  // The active Stripe price is authoritative. Subscription metadata reflects
  // the original Checkout selection and doesn't change after a portal switch.
  const plan = mapped.plan || subscription.metadata?.plan;
  const billing = mapped.billing || subscription.metadata?.billing_interval;
  // Stripe moved billing periods from the Subscription to its items in
  // 2025-03-31.basil. Webhook endpoints can still deliver older API shapes,
  // so support both locations while preferring the current one.
  const currentPeriodEnd = item?.current_period_end ?? subscription.current_period_end;
  // Stripe is moving cancellation off the `cancel_at_period_end` flag onto a
  // `cancel_at` timestamp — the same migration that moved billing periods from
  // the subscription onto its items, handled just above. A subscription
  // cancelled through the Customer Portal can arrive carrying only `cancel_at`,
  // and reading the flag alone recorded it as renewing: the customer was shown
  // a renewal date for a subscription they had just cancelled. Either signal
  // means it is ending.
  const cancelAt = subscription.cancel_at ?? null;
  const cancelling = Boolean(subscription.cancel_at_period_end) || Boolean(cancelAt);
  // The date the service actually ends. For the usual "cancel at period end"
  // that is the period end anyway; for a cancellation scheduled at some other
  // date it is not, and the customer must see the date they were promised.
  const endsAt = cancelling && cancelAt ? cancelAt : currentPeriodEnd;
  const periodEnd = endsAt
    ? new Date(endsAt * 1000).toISOString()
    : null;

  const shared = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_product_id: productId,
    stripe_price_id: priceId || null,
    plan: plan || null,
    billing_interval: billing || null,
    status: subscription.status,
    cancel_at_period_end: cancelling,
    current_period_end: periodEnd,
    updated_at: new Date().toISOString(),
  };

  // billing_accounts is the table the app reads. workspace_subscriptions is
  // written too for as long as the transition lasts, so rolling the code back
  // doesn't strand a paying customer with no subscription record.
  // Does this event get to write the row at all?
  const storedAccount = ownerUserId ? await getBillingAccount(ownerUserId) : null;
  const verdict = subscriptionWins(
    storedAccount?.stripe_subscription_id
      ? {
          id: storedAccount.stripe_subscription_id,
          status: storedAccount.status,
          created: storedAccount.stripe_subscription_created_at
            ? Math.floor(new Date(storedAccount.stripe_subscription_created_at).getTime() / 1000)
            : 0,
        }
      : null,
    { id: subscription.id, status: subscription.status, created: subscription.created },
  );
  if (!verdict.apply) {
    console.log(`[billing] ignoring ${subscription.id} (${subscription.status}): ${verdict.reason}, row holds ${storedAccount?.stripe_subscription_id}`);
    return null;
  }
  if (verdict.displaced) {
    // Two live subscriptions on one account is a double charge. Nothing here
    // cancels it by itself, because cancelling somebody's payment on the
    // strength of a webhook is not a decision code should take, but it is named
    // loudly so it can be found in Stripe.
    console.error(`[billing] DOUBLE SUBSCRIPTION on account ${ownerUserId}: ${subscription.id} displaces ${verdict.displaced}, which is still live and now unreachable from the app`);
  }
  // Only on billing_accounts. workspace_subscriptions has no such column, and
  // spreading it there would fail the upsert on a table that is only kept
  // alive so a rollback does not strand a paying customer.
  const subCreatedAt = subscription.created
    ? new Date(subscription.created * 1000).toISOString()
    : null;

  let account = null;
  if (ownerUserId) {
    // The owner can be gone. Deleting an account cancels its subscription at
    // period end and then removes the user; billing_accounts cascades with it,
    // so Stripe keeps sending events for weeks afterwards — the renewal that
    // does not happen, and finally customer.subscription.deleted. Those still
    // resolve an ownerUserId out of the subscription's metadata, and upserting
    // it would break the foreign key to auth.users: the webhook would answer
    // 500 and Stripe would retry the same event until it gave up.
    //
    // Nothing to record and nothing wrong. Say so and return 200.
    const { data: stillThere } = await admin.auth.admin.getUserById(ownerUserId).catch(() => ({ data: null }));
    if (!stillThere?.user) {
      console.log(`[billing] subscription ${subscription.id} belongs to a deleted account, nothing to record`);
      return null;
    }
    const { data, error } = await admin
      .from("billing_accounts")
      .upsert({ owner_user_id: ownerUserId, ...shared, stripe_subscription_created_at: subCreatedAt }, { onConflict: "owner_user_id" })
      .select()
      .single();
    if (error) throw error;
    account = data;
  }

  if (orgId) {
    const { error } = await admin
      .from("workspace_subscriptions")
      .upsert({ org_id: orgId, ...shared }, { onConflict: "org_id" });
    if (error) throw error;
  }

  return account;
}
