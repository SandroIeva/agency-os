export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, systemPrompt, provider = "claude", apiKey, oauthToken, model } = req.body;

  if (!message) return res.status(400).json({ error: "No message provided" });
  if (!apiKey && !oauthToken) return res.status(400).json({ error: "No API key or OAuth token provided" });

  try {
    let data;

    // ── Claude (Anthropic) ─────────────────────
    if (provider === "claude") {
      const claudeModel = model || "claude-sonnet-4-20250514";
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: 400,
          system: systemPrompt || "",
          messages: [{ role: "user", content: message }],
        }),
      });

      data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: data.error?.message || "Claude API error",
          provider: "claude",
          statusCode: response.status,
        });
      }

      // Normalize to common format
      return res.status(200).json({
        content: [{ type: "text", text: data.content?.[0]?.text || "" }],
        provider: "claude",
        model: claudeModel,
      });
    }

    // ── ChatGPT (OpenAI) ───────────────────────
    if (provider === "openai") {
      const openaiModel = model || "gpt-4o";
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: openaiModel,
          max_tokens: 400,
          messages: [
            { role: "system", content: systemPrompt || "" },
            { role: "user", content: message },
          ],
        }),
      });

      data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: data.error?.message || "OpenAI API error",
          provider: "openai",
          statusCode: response.status,
        });
      }

      // Normalize to common format
      return res.status(200).json({
        content: [{ type: "text", text: data.choices?.[0]?.message?.content || "" }],
        provider: "openai",
        model: openaiModel,
      });
    }

    // ── Gemini (Google) ────────────────────────
    if (provider === "gemini") {
      const geminiModel = model || "gemini-2.0-flash";
      // Support both API key and OAuth token
      const url = apiKey
        ? `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`
        : `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
      const headers = { "Content-Type": "application/json" };
      if (oauthToken && !apiKey) {
        headers["Authorization"] = `Bearer ${oauthToken}`;
      }

      // Build request body — include system prompt as first user turn if system_instruction fails
      const requestBody = {
        contents: [{ role: "user", parts: [{ text: systemPrompt ? `${systemPrompt}\n\n---\n\nUser message: ${message}` : message }] }],
        generationConfig: {
          maxOutputTokens: 400,
        },
      };

      const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        }
      );

      data = await response.json();

      if (!response.ok) {
        console.error("Gemini API error:", JSON.stringify(data));
        return res.status(response.status).json({
          error: data.error?.message || "Gemini API error",
          provider: "gemini",
          statusCode: response.status,
        });
      }

      // Normalize to common format
      const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return res.status(200).json({
        content: [{ type: "text", text: geminiText }],
        provider: "gemini",
        model: geminiModel,
      });
    }

    return res.status(400).json({ error: `Unknown provider: ${provider}` });

  } catch (error) {
    console.error("Chat multi error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
