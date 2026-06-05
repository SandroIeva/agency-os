// Canonical public app URL. Override via the PUBLIC_APP_URL env var if the
// domain changes again; defaults to the current production domain.
const APP_URL = process.env.PUBLIC_APP_URL || "https://app.i7os.com";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, userName, token } = req.body;

  if (!email || !token) {
    return res.status(400).json({ error: "Missing email or token" });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return res.status(500).json({ error: "RESEND_API_KEY not configured" });
  }

  const setupUrl = `${APP_URL}/?push-setup=true&token=${encodeURIComponent(token)}`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "i7 OS <invite@i7os.com>",
        to: [email],
        subject: "Push-Benachrichtigungen aktivieren — i7 OS",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; text-align: center;">
            <div style="margin-bottom: 32px;">
              <img src="${APP_URL}/logo-dark.svg" alt="i7 OS" width="96" height="60" style="display: block; margin: 0 auto 16px;" />
              <h1 style="font-size: 20px; font-weight: 600; color: #1a1a2e; margin: 0;">Push-Benachrichtigungen aktivieren</h1>
            </div>
            <p style="font-size: 15px; color: #444; line-height: 1.6; margin-bottom: 8px;">
              Hey ${userName || ""},
            </p>
            <p style="font-size: 15px; color: #444; line-height: 1.6; margin-bottom: 28px;">
              öffne diesen Link <strong>auf deinem Handy</strong>, um Push-Benachrichtigungen für Erinnerungen zu aktivieren.
            </p>
            <a href="${setupUrl}" style="display: inline-block; padding: 14px 32px; background: #111111; color: white; text-decoration: none; border-radius: 12px; font-weight: 500; font-size: 15px; margin-bottom: 24px;">📱 Auf dem Handy öffnen</a>
            <p style="font-size: 13px; color: #888; line-height: 1.6; margin-top: 24px;">
              <strong>Android:</strong> Öffne den Link in Chrome und erlaube die Benachrichtigungen.
            </p>
            <div style="background: #fff8e1; border: 1px solid #ffe082; border-radius: 12px; padding: 14px 16px; margin-top: 16px; text-align: left;">
              <p style="font-size: 12px; color: #666; line-height: 1.6; margin: 0;">
                <strong style="color: #f57c00;">iPhone-Nutzer:</strong><br/>
                Apple erlaubt Push-Benachrichtigungen nur in installierten Web-Apps.<br/>
                1. Öffne den Link in Safari<br/>
                2. Tippe auf das <strong>Teilen-Symbol</strong> (↑)<br/>
                3. Wähle <strong>"Zum Home-Bildschirm"</strong><br/>
                4. Öffne i7 OS dann vom Home-Bildschirm und aktiviere dort die Benachrichtigungen
              </p>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0 16px;" />
            <p style="font-size: 11px; color: #999;">
              Du erhältst diese E-Mail, weil du Push-Benachrichtigungen in i7 OS aktivieren möchtest.
            </p>
          </div>
        `,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend error:", data);
      return res.status(response.status).json({ error: data.message || "Failed to send email" });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (error) {
    console.error("Send push setup email error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
