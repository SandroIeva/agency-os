import {
  HttpError,
  getAdminSupabase,
  getAppUrl,
  getOrCreateCustomer,
  getPriceId,
  getStripe,
  parsePlanSelection,
  readJsonBody,
  requireOrgOwner,
  requireUser,
  sendBillingError,
} from "../server/billing.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = await requireUser(req);
    const body = await readJsonBody(req);
    const orgId = body.orgId;
    const { plan, billing } = parsePlanSelection(body.plan, body.billing);
    await requireOrgOwner(user.id, orgId);

    // ── One payment page at a time ────────────────────────────────────────────
    //
    // The guard here used to refuse a second checkout only once a subscription
    // already existed. Before the first purchase there is none, so two tabs, or
    // a double click, or going back and trying again, each got a VALID payment
    // page. Completing both meant two subscriptions on one customer and two
    // charges, while billing_accounts keyed on the owner kept only the last one:
    // the first subscription went on billing with nothing in the product able to
    // find it.
    //
    // begin_checkout decides and claims in one statement under a lock, so the
    // second request cannot also be told to go ahead. Its answers:
    //   has_subscription → already paying, nothing to buy
    //   reuse            → a page they already have open for the same plan
    //   busy             → somebody is making one right now, 60 second lease
    //   create           → this request owns the right to make it
    const admin = getAdminSupabase();
    const decide = async () => {
      const { data, error } = await admin.rpc("begin_checkout", {
        p_owner: user.id, p_plan: plan, p_billing: billing,
      });
      if (error) throw error;
      return data;
    };

    let decision = await decide();
    if (decision?.verdict === "has_subscription") {
      throw new HttpError(409, "You already have a subscription. Manage it in the billing portal.", "subscription_exists");
    }
    if (decision?.verdict === "busy") {
      throw new HttpError(409, "A payment page for this account was just opened. Finish it or close it, then try again.", "checkout_in_progress");
    }
    if (decision?.verdict === "reuse") {
      // Hand back the page they already have rather than making a second one.
      // If Stripe says it is no longer open, forget it and decide again.
      let existingSession = null;
      try { existingSession = await getStripe().checkout.sessions.retrieve(decision.sessionId); }
      catch { existingSession = null; }
      if (existingSession?.status === "open" && existingSession.url) {
        return res.status(200).json({ url: existingSession.url, reused: true });
      }
      await admin.rpc("clear_checkout_session", { p_owner: user.id });
      decision = await decide();
      if (decision?.verdict !== "create") {
        throw new HttpError(409, "Could not start a payment page just now. Please try again in a moment.", "checkout_in_progress");
      }
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

    // Remembered so the next tab is handed this same page, and the claim is
    // released. Not fatal if it misses: the worst case is the claim expiring on
    // its own a minute later.
    const { error: recErr } = await admin.rpc("record_checkout_session", {
      p_owner: user.id,
      p_session_id: session.id,
      p_expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      p_plan: plan,
      p_billing: billing,
    });
    if (recErr) console.warn("[billing] checkout session not recorded:", recErr.message);

    return res.status(200).json({ url: session.url });
  } catch (error) {
    return sendBillingError(res, error);
  }
}
