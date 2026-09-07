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

function readStripeId(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id || null;
}

async function syncCheckoutSubscription(checkout) {
  if (checkout.mode !== "subscription") return;
  const subscriptionId = readStripeId(checkout.subscription);
  if (!subscriptionId) return;
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  await syncStripeSubscription(subscription);
}

async function syncInvoiceSubscription(invoice) {
  const subscriptionId = readStripeId(
    invoice.subscription || invoice.parent?.subscription_details?.subscription,
  );
  if (!subscriptionId) return;
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  await syncStripeSubscription(subscription);
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

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      await syncCheckoutSubscription(event.data.object);
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      // Retrieved, not believed. The payload of these events is a SNAPSHOT of
      // the subscription at the moment the event was made, and Stripe does not
      // promise the order they arrive in, so an event made before a change can
      // land after it and write the older state back. The checkout and invoice
      // handlers above already retrieve; these three were the ones reading a
      // photograph. One extra API call per event buys away the whole stale half
      // of the problem.
      //
      // A subscription Stripe cannot hand back any more is answered from the
      // snapshot rather than dropped: knowing it is gone is still worth
      // recording, and syncStripeSubscription decides for itself whether that
      // event may write the row.
      const snapshot = event.data.object;
      let current = snapshot;
      try {
        current = await getStripe().subscriptions.retrieve(snapshot.id);
      } catch (e) {
        console.warn(`[billing] could not re-read ${snapshot.id}, using the event's own copy:`, e?.message);
      }
      await syncStripeSubscription(current);
    }

    if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_failed" ||
      event.type === "invoice.payment_action_required" ||
      event.type === "invoice.finalization_failed"
    ) {
      await syncInvoiceSubscription(event.data.object);
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
