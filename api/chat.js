// Legacy chat endpoint — uses the workspace's server-side Anthropic key.
// Used by the AI orb / quick-chat where the user hasn't entered their own API key yet.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, systemPrompt, maxTokens } = req.body || {};
  if (!message) return res.status(400).json({ error: "Keine Nachricht erhalten." });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: "Server hat keinen ANTHROPIC_API_KEY konfiguriert. Admin müsste den Key in Vercel hinterlegen.",
    });
  }

  const tokenLimit = Math.min(Math.max(parseInt(maxTokens, 10) || 1500, 64), 4000);
  const defaultPrompt = "You are the AI assistant inside Agency OS, a creative agency workspace app. Keep responses concise, friendly, and helpful. Never use emojis. You know about brand strategy, design, project management, and creative work.";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: tokenLimit,
        system: systemPrompt || defaultPrompt,
        messages: [{ role: "user", content: message }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const raw = data.error?.message || JSON.stringify(data.error) || "";
      return res.status(response.status).json({
        error: raw || "Claude API-Fehler",
        statusCode: response.status,
      });
    }

    const text = data.content?.[0]?.text || "";
    if (!text) {
      return res.status(502).json({
        error: `Claude hat eine leere Antwort zurückgegeben (stop_reason: ${data.stop_reason || "unknown"}).`,
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({
      error: `Verbindung zu Claude fehlgeschlagen: ${error.message || "unknown"}`,
    });
  }
}
