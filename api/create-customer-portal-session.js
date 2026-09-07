// Two things an account owner can do to their own subscription without a
// workspace being involved: open Stripe's portal, and end it.
//
// They share a file because the Hobby plan allows twelve Node functions and
// Stripe's SDK cannot run on Edge. `mode` picks; the default stays the portal,
// so every existing caller is unchanged.
import {
  HttpError,
  getAdminSupabase,
  getAppUrl,
  getBillingAccount,
  getStripe,
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
    const { orgId } = body;

    // ── cancel-at-period-end ─────────────────────────────────────────────────
    //
    // Called by account deletion, and it has to run BEFORE anything is deleted.
    // billing_accounts cascades away with the auth user, so once the account is
    // gone there is nothing left that knows which Stripe subscription belonged
    // to it: a subscription would go on renewing with nobody able to point at
    // it. Deleting first and cancelling after is not an order that exists.
    //
    // At period end, not immediately. The period is paid for; ending it early
    // would take away time somebody bought without refunding it.
    if (body.mode === "cancel-at-period-end") {
      // No orgId here on purpose: a subscription belongs to the ACCOUNT, and
      // somebody deleting theirs may own several workspaces or none.
      const account = await getBillingAccount(user.id);
      const subId = account?.stripe_subscription_id;
      if (!subId) return res.status(200).json({ ok: true, cancelled: false, reason: "no_subscription" });

      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subId);
      if (sub.status === "canceled" || sub.status === "incomplete_expired") {
        return res.status(200).json({ ok: true, cancelled: false, reason: "already_ended" });
      }
      // Stripe carries cancellation two ways since the 2025-03-31 API: the flag
      // and a cancel_at timestamp. Either one means it is already ending, and
      // asking again would be a second write for nothing.
      const alreadyEnding = Boolean(sub.cancel_at_period_end) || Boolean(sub.cancel_at);
      const updated = alreadyEnding
        ? sub
        : await stripe.subscriptions.update(subId, { cancel_at_period_end: true });

      // Recorded before the row disappears, so a webhook that arrives in the
      // gap does not read this account as still renewing.
      await getAdminSupabase()
        .from("billing_accounts")
        .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
        .eq("owner_user_id", user.id);

      const endsAt = updated.cancel_at
        ?? updated.items?.data?.[0]?.current_period_end
        ?? updated.current_period_end
        ?? null;
      return res.status(200).json({
        ok: true, cancelled: true, alreadyEnding,
        endsAt: endsAt ? new Date(endsAt * 1000).toISOString() : null,
      });
    }

    await requireOrgOwner(user.id, orgId);

    const account = await getBillingAccount(user.id);
    if (!account?.stripe_customer_id) {
      throw new HttpError(404, "No Stripe customer exists for this account", "billing_customer_missing");
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: account.stripe_customer_id,
      return_url: `${getAppUrl(req)}/?checkout=portal-return`,
    });

    return res.status(200).json({ url: portal.url });
  } catch (error) {
    return sendBillingError(res, error);
  }
}
