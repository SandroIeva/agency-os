import {
  HttpError,
  getAdminSupabase,
  getAppUrl,
  getOrCreateCustomer,
  getPriceId,
  getStripe,
  getWorkspaceBilling,
  parsePlanSelection,
  readJsonBody,
  requireOrgMember,
  requireUser,
  sendBillingError,
} from "../server/billing.js";

const MANAGED_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused"]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = await requireUser(req);
    const body = await readJsonBody(req);
    const orgId = body.orgId;
    const { plan, billing } = parsePlanSelection(body.plan, body.billing);
    await requireOrgMember(user.id, orgId, { adminOnly: true });

    const existing = await getWorkspaceBilling(orgId);
    if (existing && MANAGED_STATUSES.has(existing.status)) {
      throw new HttpError(409, "This workspace already has a subscription. Manage it in the billing portal.", "subscription_exists");
    }

    const customerId = await getOrCreateCustomer({ orgId, user });
    const priceId = getPriceId(plan, billing);
    const appUrl = getAppUrl(req);
    const metadata = {
      org_id: orgId,
      supabase_user_id: user.id,
      plan,
      billing_interval: billing,
    };

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: orgId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      subscription_data: { metadata },
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      success_url: `${appUrl}/?checkout=success`,
      cancel_url: `${appUrl}/?checkout=cancelled&plan=${plan}&billing=${billing}`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    return sendBillingError(res, error);
  }
}
