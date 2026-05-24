export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, token, projectName, inviterName } = req.body;
  if (!email || !token) return res.status(400).json({ error: "Missing email or token" });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(500).json({ error: "RESEND_API_KEY not configured" });

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
        subject: `${inviterName || "Jemand"} hat dich zum Projekt "${projectName || ""}" eingeladen`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; text-align: center;">
            <div style="margin-bottom: 32px;">
              <img src="https://alpha.i7os.com/logo-dark.svg" alt="i7 os" width="96" height="60" style="display: block; margin: 0 auto 16px;" />
              <h1 style="font-size: 22px; font-weight: 600; color: #1a1a2e; margin: 0;">Projekt-Einladung</h1>
            </div>
            <p style="font-size: 15px; color: #444; line-height: 1.6; margin-bottom: 24px;">
              <strong>${inviterName || "Ein Teammitglied"}</strong> hat dich eingeladen, am Projekt <strong>${projectName || ""}</strong> mitzuwirken.
            </p>
            <a href="https://alpha.i7os.com/?project-invite=${token}" style="display: inline-block; padding: 12px 28px; background: #111111; color: white; text-decoration: none; border-radius: 10px; font-weight: 500; font-size: 14px; margin-bottom: 24px;">Projekt beitreten</a>
            <p style="font-size: 13px; color: #888; line-height: 1.6; margin-bottom: 24px;">
              Klick auf den Button, um dem Projekt beizutreten. Die Einladung ist 14 Tage gültig.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
            <p style="font-size: 11px; color: #999; text-align: center; margin: 0;">
              Wenn du diese Einladung nicht erwartet hast, kannst du sie ignorieren.
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
    console.error("Send project invite error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
