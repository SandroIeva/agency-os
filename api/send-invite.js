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
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzYiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA3NiA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBvcGFjaXR5PSIwLjgiIGQ9Ik00LjY0ODY3IDEzLjU0OTRDM5NTg2MyAxMy41NDk0IDMuMzc3NTUgMTMuMzEzMyAyLjkwNTQyIDEyLjg1OTRDMi40MzMyOSAxMi40MDU0IDIuMTk3MjIgMTEuODI0MyAyLjE5NzIyIDExLjEzNDNDMi4xOTcyMiAxMC40OTg3IDIuNDMzMjkgOS45MzU3OSAyLjkwNTQyIDkuNDYzNjZDMy4zNzc1NSA4Ljk5MTUyIDMuOTU4NjMgOC43NTU0NiA0LjY0ODY3IDguNzU1NDZDNS4zMzg3IDguNzU1NDYgNS45MTk3OSA4Ljk5MTUyIDYuMzkxOTIgOS40NjM2NkM2Ljg2NDA1IDkuOTM1NzkgNy4xMDAxMSAxMC40OTg3IDcuMTAwMTEgMTEuMTM0M0M3LjEwMDExIDExLjgyNDMgNi44NjQwNSAxMi40MDU0IDYuMzkxOTIgMTIuODU5NEM1LjkxOTc5IDEzLjMxMzMgNS4zMzg3IDEzLjU0OTQgNC42NDg2NyAxMy41NDk0Wk0yLjY2OTM1IDM1LjMwMzdWMTYuNjAwMUg2LjUzNzE5VjM1LjMwMzdIMi42NjkzNVpNMTEuMDQ4NiA5LjI2MzkxSDI5LjMzNDVWMTIuMTMzTDE5LjA3NDggMzUuMzAzN0gxNC44MDc1TDI0Ljc3NjcgMTIuOTEzOEgxMS4wNDg2VjkuMjYzOTFaIiBmaWxsPSIjMWExYTJlIiBmaWxsLW9wYWNpdHk9IjAuOCIvPjxnIG9wYWNpdHk9IjAuOCI+PHJlY3QgeD0iMzkuMzk5OSIgeT0iMC41IiB3aWR0aD0iMzYiIGhlaWdodD0iMjIiIHJ4PSIxMSIgc3Ryb2tlPSIjMWExYTJlIi8+PHBhdGggZD0iTTUxLjE0IDE3LjAzNzZWMTcuMDQ1NEM0OS40NzU5IDE3LjA0NTQgNDguMDg1MyAxNi40OTA3IDQ2Ljk2ODEgMTUuMzczNUM0NS44NTA5IDE0LjI1NjMgNDUuMjk2MiAxMi44NzM1IDQ1LjI5NjIgMTEuMjE3M0M0NS4yOTYyIDkuNTYxMDQgNDUuODUwOSA4LjE3ODIyIDQ2Ljk2MDMgNy4wNzY2NkM0OC4wNjk2IDUuOTc1MSA0OS40NjAzIDUuNDIwNDEgNTEuMTMyMSA1LjQyMDQxQzUyLjc5NjIgNS40MjA0MSA1NC4xODY4IDUuOTc1MSA1NS4yOTYyIDcuMDc2NjZDNTYuNDA1NiA4LjE3ODIyIDU2Ljk2MDMgOS41NTMyMiA1Ni45NjAzIDExLjIwOTVDNTYuOTYwMyAxMi44NjU3IDU2LjQwNTYgMTQuMjQ4NSA1NS4yOTYyIDE1LjM2NTdDNTQuMTg2OCAxNi40ODI5IDUyLjgwNCAxNy4wMzc2IDUxLjE0IDE3LjAzNzZaTTUxLjE0IDE1LjQ0MzhWMTUuNDU5NUM1Mi4zNDMxIDE1LjQ1OTUgNTMuMzI3NSAxNS4wNTMyIDU0LjA4NTMgMTQuMjMyOUM1NC44NDMxIDEzLjQxMjYgNTUuMjI1OSAxMi40MDQ4IDU1LjIyNTkgMTEuMjA5NUM1NS4yMjU5IDEwLjAzNzYgNTQuODQzMSA5LjA0NTQxIDU0LjA3NzUgOC4yNDA3MkM1My4zMTE4IDcuNDM2MDQgNTIuMzM1MyA3LjAyOTc5IDUxLjE0IDcuMDI5NzlDNDkuOTM2OCA3LjAyOTc5IDQ4Ljk1MjUgNy40MjgyMiA0OC4xODY4IDguMjMyOTFDNDcuNDIxMiA5LjAzNzYgNDcuMDM4NCAxMC4wMjIgNDcuMDM4NCAxMS4xOTM4QzQ3LjAzODQgMTIuMzg5MiA0Ny40MjEyIDEzLjM5NyA0OC4xODY4IDE0LjIxNzNDNDguOTUyNSAxNS4wMzc2IDQ5LjkzNjggMTUuNDQzOCA1MS4xNCAxNS40NDM4Wk02My40Njc1IDE3LjAzNzZMNjMuNDIwNiAxNy4wNDU0QzYyLjE3MDYgMTcuMDQ1NCA2MS4xMDAzIDE2LjcxNzMgNjAuMjAxOCAxNi4wNjg4QzU5LjMwMzQgMTUuNDIwNCA1OC42OTQgMTQuNjE1NyA1OC4zNzM3IDEzLjY2MjZMNjAuMDE0MyAxMy4xNzA0QzYwLjI3MjEgMTMuODUwMSA2MC43MDk2IDE0LjQxMjYgNjEuMzI2OCAxNC44NTAxQzYxLjk0NCAxNS4yODc2IDYyLjY3MDYgMTUuNTA2MyA2My41MTQzIDE1LjUwNjNDNjQuMjU2NSAxNS41MDYzIDY0Ljg2NTkgMTUuMzI2NyA2NS4zNDI1IDE0Ljk3NTFDNjUuODE5IDE0LjYyMzUgNjYuMDYxMiAxNC4yMTczIDY2LjA2MTIgMTMuNzU2M0M2Ni4wNjEyIDEzLjM4MTMgNjUuOTI4NCAxMy4wNjg4IDY1LjY1NSAxMi44MTFDNjUuMzgxNSAxMi41NTMyIDY0LjkyODQgMTIuMzI2NyA2NC4yODc4IDEyLjEyMzVMNjEuNDc1MyAxMS4yMjUxQzU5Ljc5NTYgMTAuNzAxNyA1OC45NTk2IDkuNzg3NiA1OC45NTk2IDguNDgyOTFDNTguOTU5NiA3LjYzOTE2IDU5LjMyNjggNi45MTI2IDYwLjA2MTIgNi4zMTEwNEM2MC43OTU2IDUuNzA5NDcgNjEuNzE3NSA1LjQwNDc5IDYyLjgyNjggNS40MDQ3OUM2My45Njc1IDUuNDA0NzkgNjQuOTUxOCA1LjY3MDQxIDY1Ljc4IDYuMjAxNjZDNjYuNjA4MSA2LjczMjkxIDY3LjE5NCA3LjM5Njk3IDY3LjUzNzggOC4xOTM4NUw2NS45MjA2IDguNjc4MjJDNjUuNjU1IDguMTU0NzkgNjUuMjU2NSA3LjczMjkxIDY0LjcxNzUgNy40MTI2QzY0LjE3ODQgNy4wOTIyOSA2My41NTM0IDYuOTM2MDQgNjIuODQyNSA2LjkzNjA0QzYyLjIyNTMgNi45MzYwNCA2MS43MTc1IDcuMDg0NDcgNjEuMzE5IDcuMzgxMzVDNjAuOTIwNiA3LjY3ODIyIDYwLjcxNzUgOC4wMjk3OSA2MC43MTc1IDguNDM2MDRDNjAuNzE3NSA4Ljc1NjM1IDYwLjgzNDYgOS4wMjE5NyA2MS4wNjEyIDkuMjMyOTFDNjEuMjg3OCA5LjQ0Mzg1IDYxLjY1NSA5LjYyMzU0IDYyLjE1NSA5Ljc3MTk3TDY0LjkwNSAxMC42NDdDNjUuODczNyAxMC45NTE3IDY2LjYwODEgMTEuMzI2NyA2Ny4xMDAzIDExLjc3MkM2Ny41OTI1IDEyLjIxNzMgNjcuODQyNSAxMi44MzQ1IDY3Ljg0MjUgMTMuNjMxM0M2Ny44NDI1IDE0LjU5MjMgNjcuNDM2MiAxNS4zOTcgNjYuNjIzNyAxNi4wNTMyQzY1LjgxMTIgMTYuNzA5NSA2NC43NTY1IDE3LjAzNzYgNjMuNDY3NSAxNy4wMzc2WiIgZmlsbD0iIzFhMWEyZSIvPjwvZz48L3N2Zz4=" alt="i7 OS" width="76" height="48" style="display: block; margin: 0 auto 16px;" />
              <h1 style="font-size: 22px; font-weight: 600; color: #1a1a2e; margin: 0;">You're invited!</h1>
            </div>
            <p style="font-size: 15px; color: #444; line-height: 1.6; margin-bottom: 24px;">
              <strong>${inviterName || "A team member"}</strong> has invited you to join <strong>${orgName || "their workspace"}</strong> on Agency OS.
            </p>
            <div style="background: #f8f7ff; border: 1px solid #e8e5ff; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
              <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Your Invite Code</div>
              <div style="font-size: 18px; font-weight: 600; color: #8B7AFF; letter-spacing: 0.5px; word-break: break-all; margin-bottom: 14px;">${token}</div>
              <a href="https://agency-os-ebon-phi.vercel.app/?invite=${token}" style="display: inline-block; padding: 8px 20px; background: #8B7AFF; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 13px;">📋 Copy &amp; Join Workspace</a>
            </div>
            <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 24px;">
              Click the button above to join directly, or copy the invite code and paste it in Agency OS during onboarding.
            </p>
            <div style="text-align: center;">
              <a href="https://agency-os-ebon-phi.vercel.app" style="display: inline-block; padding: 12px 28px; background: #8B7AFF; color: white; text-decoration: none; border-radius: 10px; font-weight: 500; font-size: 14px;">Open Agency OS</a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
            <p style="font-size: 11px; color: #999; text-align: center;">
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
