import webpush from "web-push";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { subscription, title, body, tag, url } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Missing subscription" });
  }

  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

  if (!vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: "VAPID keys not configured" });
  }

  webpush.setVapidDetails("mailto:invite@i7os.com", vapidPublic, vapidPrivate);

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: title || "i7 OS", body: body || "", tag: tag || "reminder", url: url || "/" })
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Push send error:", error);
    // 410 = subscription expired, remove it
    if (error.statusCode === 410 || error.statusCode === 404) {
      return res.status(410).json({ error: "Subscription expired", gone: true });
    }
    return res.status(500).json({ error: "Failed to send push" });
  }
}
