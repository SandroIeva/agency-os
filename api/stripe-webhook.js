import {
  getStripe,
  sendBillingError,
  syncStripeSubscription,
} from "../server/billing.js";

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing Stripe signature" });

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(503).json({ error: "Stripe webhook is not configured" });
    }

    const rawBody = await readRawBody(req);
    let event;
    try {
      event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      return res.status(400).json({ error: "Invalid Stripe signature" });
    }

    if (event.type === "checkout.session.completed") {
      const checkout = event.data.object;
      if (checkout.mode === "subscription" && checkout.subscription) {
        const subscriptionId = typeof checkout.subscription === "string"
          ? checkout.subscription
          : checkout.subscription.id;
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        await syncStripeSubscription(subscription);
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncStripeSubscription(event.data.object);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    return sendBillingError(res, error);
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
