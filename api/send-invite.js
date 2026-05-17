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
        subject: `${inviterName || "Someone"} invited you to join ${orgName || "their workspace"} on Agency OS`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; text-align: center;">
            <div style="margin-bottom: 32px;">
              <img src="https://agency-os-ebon-phi.vercel.app/logo-dark.svg" alt="i7 os" width="76" height="48" style="display: block; margin: 0 auto 16px;" />
              <h1 style="font-size: 22px; font-weight: 600; color: #1a1a2e; margin: 0;">You're invited!</h1>
            </div>
            <p style="font-size: 15px; color: #444; line-height: 1.6; margin-bottom: 24px;">
              <strong>${inviterName || "A team member"}</strong> has invited you to join <strong>${orgName || "their workspace"}</strong> on Agency OS.
            </p>
            <div style="background: #f8f7ff; border: 1px solid #e8e5ff; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Your Invite Code</div>
              <div style="font-size: 16px; font-weight: 600; color: #8B7AFF; letter-spacing: 0.5px; word-break: break-all; margin-bottom: 16px; font-family: monospace;">${token}</div>
              <a href="https://agency-os-ebon-phi.vercel.app/?invite=${token}" style="display: inline-block; padding: 10px 24px; background: #8B7AFF; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">Join Workspace</a>
            </div>
            <p style="font-size: 13px; color: #888; line-height: 1.6; margin-bottom: 24px;">
              Click the button to join directly, or copy the invite code and enter it manually in Agency OS.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
            <p style="font-size: 11px; color: #999;">
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
