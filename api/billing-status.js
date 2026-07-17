import {
  getWorkspaceBilling,
  readJsonBody,
  requireOrgMember,
  requireUser,
  sendBillingError,
} from "../server/billing.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = await requireUser(req);
    const { orgId } = await readJsonBody(req);
    const membership = await requireOrgMember(user.id, orgId);
    const billing = await getWorkspaceBilling(orgId);

    return res.status(200).json({
      isAdmin: membership.role === "admin",
      billing: billing ? {
        plan: billing.plan,
        billingInterval: billing.billing_interval,
        status: billing.status,
        cancelAtPeriodEnd: billing.cancel_at_period_end,
        currentPeriodEnd: billing.current_period_end,
      } : null,
    });
  } catch (error) {
    return sendBillingError(res, error);
  }
}
