import {
  HttpError,
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
    const { orgId } = await readJsonBody(req);
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
