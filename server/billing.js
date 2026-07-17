import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

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

export async function getOrCreateCustomer({ orgId, user }) {
  const existing = await getWorkspaceBilling(orgId);
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
    .from("workspace_subscriptions")
    .upsert({
      org_id: orgId,
      stripe_customer_id: customer.id,
      status: "inactive",
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id" });
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
  if (!orgId) return null;

  const mapped = getPlanForPrice(priceId);
  // The active Stripe price is authoritative. Subscription metadata reflects
  // the original Checkout selection and doesn't change after a portal switch.
  const plan = mapped.plan || subscription.metadata?.plan;
  const billing = mapped.billing || subscription.metadata?.billing_interval;
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString()
    : null;

  const { data, error } = await admin
    .from("workspace_subscriptions")
    .upsert({
      org_id: orgId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_product_id: productId,
      stripe_price_id: priceId || null,
      plan: plan || null,
      billing_interval: billing || null,
      status: subscription.status,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}
