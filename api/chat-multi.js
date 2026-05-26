// Unified chat endpoint for Claude / OpenAI / Gemini.
// Normalizes responses to a common shape so the client doesn't have to branch.
// On failure: returns a clear, user-readable `error` field with a hint about what's wrong.

const MAX_TOKENS_DEFAULT = 2000;       // generous — full answers, not truncated
const UPSTREAM_TIMEOUT_MS = 45_000;    // give the model time to think but bail before Vercel kills us

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

// Best-effort: translate raw provider errors into something a user can act on.
function hintFor(provider, statusCode, raw) {
  const msg = (raw || "").toLowerCase();
  if (statusCode === 401 || /invalid.*api.?key|unauthor/i.test(msg)) {
    return `${provider} API-Key ist ungültig oder fehlt. Bitte Settings → AI-Modelle prüfen.`;
  }
  if (statusCode === 403 || /permission|forbidden|access.*denied/i.test(msg)) {
    return `${provider} API-Key hat keinen Zugriff auf dieses Modell. Eventuell muss der Key freigeschaltet werden.`;
  }
  if (statusCode === 429 || /rate.?limit|quota|exceeded/i.test(msg)) {
    return `${provider} hat dich gerade rate-limited. Kurz warten und nochmal probieren.`;
  }
  if (statusCode >= 500) return `${provider} hat einen Server-Fehler — ist meist temporär.`;
  if (/model.*not.*found|invalid.*model/i.test(msg)) return `Modell wurde von ${provider} nicht gefunden. Anderes Modell wählen.`;
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, messages, systemPrompt, provider = "claude", apiKey, oauthToken, model, maxTokens } = req.body || {};

  // Build a normalised conversation history: array of { role: "user" | "assistant", content: string }
  // Accept either legacy single-message format or full messages array.
  let conversation = [];
  if (Array.isArray(messages) && messages.length > 0) {
    conversation = messages
      .filter(m => m && typeof m.content === "string" && m.content.trim() && (m.role === "user" || m.role === "assistant"))
      .map(m => ({ role: m.role, content: m.content }));
  } else if (message) {
    conversation = [{ role: "user", content: String(message) }];
  }

  if (conversation.length === 0) return res.status(400).json({ error: "Keine Nachricht erhalten." });
  if (!apiKey && !oauthToken) {
    return res.status(400).json({
      error: `Kein API-Key für ${provider} hinterlegt. Settings → AI-Modelle.`,
      provider,
    });
  }

  const tokenLimit = Math.min(Math.max(parseInt(maxTokens, 10) || MAX_TOKENS_DEFAULT, 64), 8000);

  try {
    // ── Claude (Anthropic) ─────────────────────
    if (provider === "claude") {
      const claudeModel = model || "claude-sonnet-4-20250514";
      const response = await withTimeout(fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: tokenLimit,
          system: systemPrompt || "",
          messages: conversation,
        }),
      }), UPSTREAM_TIMEOUT_MS, "Claude");

      const data = await response.json();

      if (!response.ok) {
        const raw = data.error?.message || JSON.stringify(data.error) || "";
        return res.status(response.status).json({
          error: hintFor("Claude", response.status, raw) || raw || "Claude API-Fehler",
          provider: "claude",
          statusCode: response.status,
          rawError: raw,
        });
      }

      const text = data.content?.[0]?.text || "";
      if (!text) {
        return res.status(502).json({
          error: `Claude hat eine leere Antwort zurückgegeben (stop_reason: ${data.stop_reason || "unknown"}). Eventuell wurde sie blockiert.`,
          provider: "claude",
        });
      }
      return res.status(200).json({
        content: [{ type: "text", text }],
        provider: "claude",
        model: claudeModel,
        stop_reason: data.stop_reason,
        usage: data.usage,
      });
    }

    // ── ChatGPT (OpenAI) ───────────────────────
    if (provider === "openai") {
      const openaiModel = model || "gpt-4o";
      const response = await withTimeout(fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: openaiModel,
          max_tokens: tokenLimit,
          messages: [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
            ...conversation,
          ],
        }),
      }), UPSTREAM_TIMEOUT_MS, "OpenAI");

      const data = await response.json();

      if (!response.ok) {
        const raw = data.error?.message || JSON.stringify(data.error) || "";
        return res.status(response.status).json({
          error: hintFor("OpenAI", response.status, raw) || raw || "OpenAI API-Fehler",
          provider: "openai",
          statusCode: response.status,
          rawError: raw,
        });
      }

      const choice = data.choices?.[0];
      const text = choice?.message?.content || "";
      if (!text) {
        return res.status(502).json({
          error: `OpenAI hat eine leere Antwort zurückgegeben (finish_reason: ${choice?.finish_reason || "unknown"}).`,
          provider: "openai",
        });
      }
      return res.status(200).json({
        content: [{ type: "text", text }],
        provider: "openai",
        model: openaiModel,
        finish_reason: choice?.finish_reason,
        usage: data.usage,
      });
    }

    // ── Gemini (Google) ────────────────────────
    if (provider === "gemini") {
      const geminiModel = model || "gemini-2.5-flash";
      const url = apiKey
        ? `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`
        : `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
      const headers = { "Content-Type": "application/json" };
      if (oauthToken && !apiKey) headers["Authorization"] = `Bearer ${oauthToken}`;

      // Use Gemini's official systemInstruction field + map conversation to its expected shape.
      // Gemini uses { role: "user" | "model", parts: [{ text }] } — translate "assistant" → "model".
      const requestBody = {
        contents: conversation.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          maxOutputTokens: tokenLimit,
          temperature: 0.7,
        },
      };
      if (systemPrompt && systemPrompt.trim()) {
        requestBody.systemInstruction = { parts: [{ text: systemPrompt.trim() }] };
      }

      const response = await withTimeout(fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      }), UPSTREAM_TIMEOUT_MS, "Gemini");

      const data = await response.json();

      if (!response.ok) {
        const raw = data.error?.message || JSON.stringify(data.error) || "";
        console.error("Gemini API error:", raw);
        return res.status(response.status).json({
          error: hintFor("Gemini", response.status, raw) || raw || "Gemini API-Fehler",
          provider: "gemini",
          statusCode: response.status,
          rawError: raw,
        });
      }

      // Gemini quirks:
      //  - `candidates[0].content.parts[0].text` may be missing if blocked
      //  - `finishReason` can be MAX_TOKENS / SAFETY / RECITATION / OTHER
      //  - `promptFeedback.blockReason` if the prompt itself was blocked
      const candidate = data.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const blockReason = data.promptFeedback?.blockReason;

      if (blockReason) {
        return res.status(502).json({
          error: `Gemini hat den Prompt blockiert (Grund: ${blockReason}). Eventuell wegen Safety-Filter — Anfrage anders formulieren.`,
          provider: "gemini",
          blockReason,
        });
      }

      // Concatenate all text parts (Gemini can split a single answer across multiple parts)
      const parts = candidate?.content?.parts || [];
      const text = parts.map(p => p.text || "").join("").trim();

      if (!text) {
        const why = finishReason === "MAX_TOKENS"
          ? "Antwort wurde wegen max_tokens abgeschnitten — eventuell Token-Limit erhöhen."
          : finishReason === "SAFETY"
          ? "Gemini hat die Antwort wegen Safety-Filter blockiert."
          : finishReason === "RECITATION"
          ? "Gemini hat die Antwort wegen Recitation-Filter blockiert."
          : `Gemini gab eine leere Antwort zurück (finishReason: ${finishReason || "unknown"}).`;
        return res.status(502).json({
          error: why,
          provider: "gemini",
          finishReason,
        });
      }
      return res.status(200).json({
        content: [{ type: "text", text }],
        provider: "gemini",
        model: geminiModel,
        finishReason,
        usage: data.usageMetadata,
      });
    }

    return res.status(400).json({ error: `Unbekannter Provider: ${provider}` });

  } catch (error) {
    console.error("Chat multi error:", error);
    const msg = error?.message || "Unbekannter Fehler";
    const isTimeout = /timed out/i.test(msg);
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout
        ? `${provider} hat zu lange gebraucht — bitte erneut probieren.`
        : `Server-Fehler: ${msg}`,
      provider,
    });
  }
}
