// Bundled "send" endpoint — one serverless function for every outbound message,
// dispatched by `mode` in the POST body (Vercel Hobby caps us at 12 functions,
// so related endpoints are multiplexed here instead of one file each):
//   mode "invite"          → workspace invite email (Resend)
//   mode "project-invite"  → project invite email (Resend)
//   mode "push-setup"      → "enable push" setup email (Resend)
//   mode "push"            → web-push notification (VAPID)
import webpush from "web-push";

// Canonical public app URL. Override via the PUBLIC_APP_URL env var if the
// domain changes again; defaults to the current production domain.
const APP_URL = process.env.PUBLIC_APP_URL || "https://app.i7os.com";

// Fire a single transactional email through Resend. Returns a normalized result.
async function sendResend({ from, to, subject, html }) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, status: 500, error: "RESEND_API_KEY not configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const data = await response.json();
  if (!response.ok) {
    console.error("Resend error:", data);
    return { ok: false, status: response.status, error: data.message || "Failed to send email" };
  }
  return { ok: true, id: data.id };
}

const inviteHtml = ({ token, orgName, inviterName }) => `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; text-align: center;">
            <div style="margin-bottom: 32px;">
              <img src="${APP_URL}/i7OS-Logo.png" alt="i7 OS" width="96" height="59" style="display: block; margin: 0 auto 16px; border: 0;" />
              <h1 style="font-size: 22px; font-weight: 600; color: #1a1a2e; margin: 0;">You're invited to join a workspace</h1>
            </div>
            <p style="font-size: 15px; color: #444; line-height: 1.6; margin-bottom: 24px;">
              <strong>${inviterName || "A team member"}</strong> has invited you to join <strong>${orgName || "their workspace"}</strong> on i7 OS.
            </p>
            <div style="background: #f8f7ff; border: 1px solid #e8e5ff; border-radius: 12px; padding: 16px 20px; margin-bottom: 28px;">
              <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Your Invite Code</div>
              <div style="font-size: 15px; font-weight: 600; color: #555; letter-spacing: 0.3px; word-break: break-all; font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;">${token}</div>
            </div>
            <a href="${APP_URL}/?invite=${token}" style="display: inline-block; padding: 12px 28px; background: #111111; color: white; text-decoration: none; border-radius: 10px; font-weight: 500; font-size: 14px; margin-bottom: 24px;">Join Workspace</a>
            <p style="font-size: 13px; color: #888; line-height: 1.6; margin-bottom: 24px;">
              Click the button to join directly,<br/>or copy the invite code and enter it manually in i7 OS.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
            <p style="font-size: 11px; color: #999; text-align: center; margin: 0;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        `;

const projectInviteHtml = ({ projectName, inviterName, token }) => `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; text-align: center;">
            <div style="margin-bottom: 32px;">
              <img src="${APP_URL}/i7OS-Logo.png" alt="i7 OS" width="96" height="59" style="display: block; margin: 0 auto 16px; border: 0;" />
              <h1 style="font-size: 22px; font-weight: 600; color: #1a1a2e; margin: 0;">Projekt-Einladung</h1>
            </div>
            <p style="font-size: 15px; color: #444; line-height: 1.6; margin-bottom: 24px;">
              <strong>${inviterName || "Ein Teammitglied"}</strong> hat dich eingeladen, am Projekt <strong>${projectName || ""}</strong> mitzuwirken.
            </p>
            <a href="${APP_URL}/?project-invite=${token}" style="display: inline-block; padding: 12px 28px; background: #111111; color: white; text-decoration: none; border-radius: 10px; font-weight: 500; font-size: 14px; margin-bottom: 24px;">Projekt beitreten</a>
            <p style="font-size: 13px; color: #888; line-height: 1.6; margin-bottom: 24px;">
              Klick auf den Button, um dem Projekt beizutreten. Die Einladung ist 14 Tage gültig.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
            <p style="font-size: 11px; color: #999; text-align: center; margin: 0;">
              Wenn du diese Einladung nicht erwartet hast, kannst du sie ignorieren.
            </p>
          </div>
        `;

const pushSetupHtml = ({ userName, setupUrl }) => `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; text-align: center;">
            <div style="margin-bottom: 32px;">
              <img src="${APP_URL}/i7OS-Logo.png" alt="i7 OS" width="96" height="59" style="display: block; margin: 0 auto 16px; border: 0;" />
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
        `;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const mode = req.body?.mode || req.query?.mode;

  try {
    if (mode === "invite") {
      const { email, token, orgName, inviterName } = req.body;
      if (!email || !token) return res.status(400).json({ error: "Missing email or token" });
      const r = await sendResend({
        from: "Agency OS <invite@i7os.com>",
        to: email,
        subject: `${inviterName || "Someone"} invited you to join ${orgName || "their workspace"} on i7 OS`,
        html: inviteHtml({ token, orgName, inviterName }),
      });
      return r.ok ? res.status(200).json({ success: true, id: r.id }) : res.status(r.status).json({ error: r.error });
    }

    if (mode === "project-invite") {
      const { email, token, projectName, inviterName } = req.body;
      if (!email || !token) return res.status(400).json({ error: "Missing email or token" });
      const r = await sendResend({
        from: "i7 OS <invite@i7os.com>",
        to: email,
        subject: `${inviterName || "Jemand"} hat dich zum Projekt "${projectName || ""}" eingeladen`,
        html: projectInviteHtml({ projectName, inviterName, token }),
      });
      return r.ok ? res.status(200).json({ success: true, id: r.id }) : res.status(r.status).json({ error: r.error });
    }

    if (mode === "push-setup") {
      const { email, userName, token } = req.body;
      if (!email || !token) return res.status(400).json({ error: "Missing email or token" });
      const setupUrl = `${APP_URL}/?push-setup=true&token=${encodeURIComponent(token)}`;
      const r = await sendResend({
        from: "i7 OS <invite@i7os.com>",
        to: email,
        subject: "Push-Benachrichtigungen aktivieren — i7 OS",
        html: pushSetupHtml({ userName, setupUrl }),
      });
      return r.ok ? res.status(200).json({ success: true, id: r.id }) : res.status(r.status).json({ error: r.error });
    }

    if (mode === "push") {
      const { subscription, title, body, tag, url } = req.body;
      if (!subscription || !subscription.endpoint) return res.status(400).json({ error: "Missing subscription" });
      const vapidPublic = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
      if (!vapidPublic || !vapidPrivate) return res.status(500).json({ error: "VAPID keys not configured" });
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

    return res.status(400).json({ error: "Unknown mode" });
  } catch (error) {
    console.error("send handler error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
