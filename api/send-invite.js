// Canonical public app URL. Override via the PUBLIC_APP_URL env var if the
// domain changes again; defaults to the current production domain.
const APP_URL = process.env.PUBLIC_APP_URL || "https://app.i7os.com";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, token, orgName, inviterName } = req.body;

  if (!email || !token) {
    return res.status(400).json({ error: "Missing email or token" });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return res.status(500).json({ error: "RESEND_API_KEY not configured" });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "Agency OS <invite@i7os.com>",
        to: [email],
        subject: `${inviterName || "Someone"} invited you to join ${orgName || "their workspace"} on i7 OS`,
        html: `
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
        `,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend error:", data);
      return res.status(response.status).json({
        error: data.message || "Failed to send email",
      });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (error) {
    console.error("Send invite error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
