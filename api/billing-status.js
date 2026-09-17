import {
  getEntitlementsForOrg,
  readJsonBody,
  requireOrgMember,
  requireUser,
  sendBillingError,
} from "../server/billing.js";

// The single entitlement endpoint. Returns the plan actually in force for a
// workspace (resolved through its owner, with trial expiry applied), what that
// plan allows, and how much of the owner's pooled allowance is already used —
// so the client never has to derive a limit itself.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = await requireUser(req);
    const { orgId } = await readJsonBody(req);
    const membership = await requireOrgMember(user.id, orgId);
    const entitlements = await getEntitlementsForOrg(orgId);
    const account = entitlements.account;

    return res.status(200).json({
      isAdmin: membership.role === "admin",
      // Only the owner can buy or manage the plan; everyone else sees it read-only.
      isOwner: entitlements.ownerUserId === user.id,
      plan: entitlements.plan,
      // True when the plan was granted outside Stripe (plan_override). The UI
      // has to distinguish it, or a comped Agency account reads as a billing
      // error next to a Stripe subscription that still says "starter".
      comped: entitlements.isComped,
      // Whether a real Stripe subscription exists. The status alone can't answer
      // this: our cardless trial is also stored as 'trialing', and treating that
      // as a subscription hides the plan picker and offers a customer portal
      // that has no customer to open.
      stripeSubscription: Boolean(account?.stripe_subscription_id),
      limits: entitlements.limits,
      usage: entitlements.usage,
      trial: {
        active: entitlements.isTrial,
        expired: entitlements.trialExpired,
        endsAt: entitlements.trialEndsAt,
        daysLeft: entitlements.trialDaysLeft,
        // How long THIS trial runs, from its own row. Every trial used to be
        // described as TRIAL_DAYS long, so a trial extended by hand read
        // "trying i7OS for 7 days, 90 days left". Null when the row has no
        // start date, and the page falls back to the constant.
        lengthDays: account?.trial_started_at && account?.trial_ends_at
          ? Math.round((Date.parse(account.trial_ends_at) - Date.parse(account.trial_started_at)) / 86400000)
          : null,
      },
      // Kept in the previous shape so existing consumers keep working.
      billing: account ? {
        plan: account.plan,
        billingInterval: account.billing_interval,
        status: account.status,
        cancelAtPeriodEnd: account.cancel_at_period_end,
        currentPeriodEnd: account.current_period_end,
      } : null,
    });
  } catch (error) {
    return sendBillingError(res, error);
  }
}
