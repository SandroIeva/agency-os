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

// Upstream errors that are transient (rate-limit / server hiccup) and worth a quick
// automatic retry rather than surfacing to the user.
const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

// POST JSON with a couple of quick retries on transient upstream errors. These
// errors come back fast, so retrying smooths over the blips that otherwise
// surfaced as a (misleading) failure that only "worked on retry minutes later".
// Timeouts/network errors are NOT retried — that would risk the function budget;
// they're returned so the caller can show a clean "try again" message instead.
async function postJSONRetry(url, headers, body, label, retries = 2) {
  let last = { ok: false, status: 0, data: null, raw: "", timedOut: false };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await withTimeout(
        fetch(url, { method: "POST", headers, body: JSON.stringify(body) }),
        UPSTREAM_TIMEOUT_MS, label,
      );
      let d = null;
      try { d = await r.json(); } catch { /* non-JSON body */ }
      if (r.ok) return { ok: true, status: r.status, data: d, raw: "", timedOut: false };
      const raw = d?.error?.message || `HTTP ${r.status}`;
      last = { ok: false, status: r.status, data: d, raw, timedOut: false };
      if (!TRANSIENT_STATUS.has(r.status)) return last; // hard error — don't retry
    } catch (e) {
      return { ok: false, status: 0, data: null, raw: e.message || "network error", timedOut: true };
    }
    if (attempt < retries) await new Promise(res => setTimeout(res, 500 * (attempt + 1)));
  }
  return last;
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

  const { message, messages, systemPrompt, provider = "claude", apiKey, oauthToken, model, maxTokens, wantsImage, image } = req.body || {};

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

  // Optional vision input: resolve the image to base64 once, then attach it to
  // the last user turn in whichever provider-specific shape is needed below.
  let imgPart = null;
  if (image) {
    try {
      if (String(image).startsWith("data:")) {
        const m = String(image).match(/^data:([^;]+);base64,(.*)$/);
        if (m) imgPart = { mime: m[1], b64: m[2] };
      } else {
        const ir = await withTimeout(fetch(image), UPSTREAM_TIMEOUT_MS, "image-fetch");
        if (ir.ok) {
          const buf = await ir.arrayBuffer();
          imgPart = { mime: ir.headers.get("content-type") || "image/png", b64: Buffer.from(buf).toString("base64") };
        }
      }
    } catch (_) { /* best-effort — fall back to text-only */ }
  }
  const lastUserIdx = (() => { for (let i = conversation.length - 1; i >= 0; i--) if (conversation[i].role === "user") return i; return -1; })();

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
          messages: imgPart
            ? conversation.map((m, i) => i === lastUserIdx
                ? { role: "user", content: [{ type: "image", source: { type: "base64", media_type: imgPart.mime, data: imgPart.b64 } }, { type: "text", text: m.content }] }
                : m)
            : conversation,
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
      // ── Image generation via OpenAI ─────────────────────────────────────
      // dall-e-3 is the default because it's the most broadly accessible: any paid
      // OpenAI key can use it without org verification. gpt-image-1 is newer but
      // requires the org to be verified (passport/selfie), so it fails for most casual
      // accounts. We attempt to upgrade to gpt-image-1 ONLY if dall-e-3 itself fails
      // — gpt-image-1 won't help in that case either typically, but we still try as a
      // last resort. Never send response_format: OpenAI started rejecting it.
      if (wantsImage) {
        const lastUserMsg = [...conversation].reverse().find(m => m.role === "user")?.content || "";
        const callOpenAI = async (model) => {
          const body = { model, prompt: lastUserMsg, n: 1, size: "1024x1024" };
          const r = await withTimeout(fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify(body),
          }), UPSTREAM_TIMEOUT_MS, model);
          const d = await r.json().catch(() => ({}));
          return { r, d };
        };
        // Normalise OpenAI's response — could be b64_json (gpt-image-1) or url (dall-e fallback).
        const toDataUrl = async (item) => {
          if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
          if (item?.url) {
            try {
              const imgRes = await withTimeout(fetch(item.url), UPSTREAM_TIMEOUT_MS, "image-fetch");
              if (!imgRes.ok) return null;
              const buf = await imgRes.arrayBuffer();
              const b64 = Buffer.from(buf).toString("base64");
              return `data:image/png;base64,${b64}`;
            } catch { return null; }
          }
          return null;
        };
        try {
          // Strategy: dall-e-3 first (works on virtually all paid keys). Only fall through
          // to gpt-image-1 if dall-e-3 errors AND it doesn't look like an unrecoverable
          // billing/auth issue (no point retrying with a different model if the key is bad).
          let usedModel = "dall-e-3";
          let { r, d } = await callOpenAI("dall-e-3");
          if (!r.ok && r.status !== 401 && r.status !== 429) {
            const fb = await callOpenAI("gpt-image-1");
            if (fb.r.ok) { r = fb.r; d = fb.d; usedModel = "gpt-image-1"; }
          }
          if (r.ok) {
            const item = d.data?.[0];
            const dataUrl = await toDataUrl(item);
            if (dataUrl) {
              return res.status(200).json({
                content: [{ type: "image", url: dataUrl, mimeType: "image/png" }],
                provider: "openai",
                model: d.model || usedModel,
                hasImages: true,
              });
            }
            return res.status(502).json({ error: "OpenAI hat keine Bilddaten zurückgegeben.", provider: "openai" });
          }
          const raw = d.error?.message || JSON.stringify(d.error) || `HTTP ${r.status}`;
          // Specific hint for the verification wall (gpt-image-1 only)
          const verifyHit = /must be verified|verify.*organization/i.test(raw);
          const hint = verifyHit
            ? "OpenAI verlangt für die Bild-Generierung eine verifizierte Organisation. Im OpenAI-Dashboard unter Settings → Organization → Verification kannst du das anstoßen. Alternativ: Gemini-API wählen (funktioniert ohne Verifikation)."
            : (hintFor("OpenAI Image", r.status, raw) || raw);
          return res.status(r.status).json({
            error: hint,
            provider: "openai",
            statusCode: r.status,
            rawError: raw,
          });
        } catch (e) {
          return res.status(504).json({
            error: `OpenAI Image timed out: ${e.message || "unknown"}`,
            provider: "openai",
          });
        }
      }

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
            ...conversation.map((m, i) => (imgPart && i === lastUserIdx)
              ? { role: "user", content: [{ type: "image_url", image_url: { url: `data:${imgPart.mime};base64,${imgPart.b64}` } }, { type: "text", text: m.content }] }
              : m),
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
      const headers = { "Content-Type": "application/json" };
      if (oauthToken && !apiKey) headers["Authorization"] = `Bearer ${oauthToken}`;

      // ── Image generation: try Gemini multimodal first (what AI Studio uses), then Imagen ──
      if (wantsImage) {
        const lastUserMsg = [...conversation].reverse().find(m => m.role === "user")?.content || "";
        let lastStatus = 0;
        let lastRaw = "";

        // Strategy A: Gemini multimodal generateContent with responseModalities: ["IMAGE", "TEXT"]
        // This is the path Google AI Studio uses behind its "Image generation" toggle.
        // Latest naming (Nov 2025): gemini-3.x-image-preview / gemini-2.5-flash-image (no -preview).
        const gemMultimodalModels = model ? [model] : [
          "gemini-3.1-flash-image-preview",
          "gemini-3-pro-image-preview",
          "gemini-2.5-flash-image",
          "gemini-2.5-flash-image-preview",
          "gemini-2.0-flash-preview-image-generation",
          "gemini-2.0-flash-exp-image-generation",
        ];
        for (const m of gemMultimodalModels) {
          const url = apiKey
            ? `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`
            : `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
          const body = {
            contents: [{ role: "user", parts: [{ text: lastUserMsg }] }],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"],
              temperature: 0.9,
            },
          };
          const resp = await postJSONRetry(url, headers, body, "Gemini-Image");
          lastStatus = resp.status;
          if (resp.raw) lastRaw = resp.raw;
          if (resp.ok) {
            const d = resp.data || {};
            // Response: candidates[0].content.parts[] — may contain text + inlineData (image)
            const parts = d.candidates?.[0]?.content?.parts || [];
            const text = parts.map(p => p.text || "").join("").trim();
            const images = parts
              .filter(p => p.inlineData && p.inlineData.data)
              .map(p => ({
                type: "image",
                mimeType: p.inlineData.mimeType || "image/png",
                url: `data:${p.inlineData.mimeType || "image/png"};base64,${p.inlineData.data}`,
              }));
            if (images.length > 0) {
              const responseContent = [];
              if (text) responseContent.push({ type: "text", text });
              responseContent.push(...images);
              return res.status(200).json({
                content: responseContent,
                provider: "gemini",
                model: m,
                hasImages: true,
              });
            }
            // OK status but no image — possibly safety-blocked or model returned only text
            const blockReason = d.promptFeedback?.blockReason || d.candidates?.[0]?.finishReason;
            lastRaw = blockReason ? `Gemini blockierte den Prompt (${blockReason}).` : "Keine Bilddaten zurückerhalten.";
            break; // model accepted request, response is just bad — don't try others
          }
          // Timed out or transient even after retries, or a hard error: only advance to the
          // next model on a genuine "model not found"; otherwise bail with the real cause.
          if (resp.timedOut) break;
          if (resp.status !== 404 && !/model.*not.*found|not.*available|not.*supported/i.test(lastRaw)) {
            break;
          }
        }

        // Strategy B: Imagen :predict — only try if Gemini-multimodal definitely had no working model.
        // (i.e. only when the last status was 404 or "model not found")
        if (lastStatus === 404 || /not.*found|not.*available|not.*supported/i.test(lastRaw)) {
          // Latest naming (Nov 2025): Imagen 4 is the current generation.
          const imagenModels = [
            "imagen-4.0-generate-001",
            "imagen-4.0-fast-generate-001",
            "imagen-4.0-ultra-generate-001",
            "imagen-3.0-generate-002",
            "imagen-3.0-fast-generate-001",
            "imagen-3.0-generate-001",
          ];
          for (const m of imagenModels) {
            const url = apiKey
              ? `https://generativelanguage.googleapis.com/v1beta/models/${m}:predict?key=${apiKey}`
              : `https://generativelanguage.googleapis.com/v1beta/models/${m}:predict`;
            const body = {
              instances: [{ prompt: lastUserMsg }],
              parameters: { sampleCount: 1, aspectRatio: "1:1", personGeneration: "allow_adult" },
            };
            const resp = await postJSONRetry(url, headers, body, "Imagen");
            lastStatus = resp.status;
            if (resp.raw) lastRaw = resp.raw;
            if (resp.ok) {
              const d = resp.data || {};
              const pred = d.predictions?.[0];
              const b64 = pred?.bytesBase64Encoded || pred?.image?.imageBytes;
              const mime = pred?.mimeType || pred?.image?.mimeType || "image/png";
              if (b64) {
                return res.status(200).json({
                  content: [{ type: "image", url: `data:${mime};base64,${b64}`, mimeType: mime }],
                  provider: "gemini",
                  model: m,
                  hasImages: true,
                });
              }
              lastRaw = pred?.raiFilteredReason || "Imagen lieferte keine Bilddaten zurück.";
              break;
            }
            if (resp.timedOut) break;
            if (resp.status !== 404 && !/model.*not.*found|not.*available|not.*supported/i.test(lastRaw)) break;
          }
        }

        // Classify the real failure. Transient (rate-limit / server / timeout) and
        // auth/region issues take priority — the "your key has no image model" listing
        // is a LAST resort, only for a genuine "model not found", so we never tell the
        // user their models don't match when the real cause was a temporary blip.
        const isNotFound = lastStatus === 404 || /model.*not.*found|not.*available|not.*supported/i.test(lastRaw);

        // Only ask Google for the key's model list when it's actually a not-found case.
        let availableImageModels = [];
        if (isNotFound) {
          try {
            const listUrl = apiKey
              ? `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`
              : `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200`;
            const listRes = await fetch(listUrl, { headers });
            const listData = await listRes.json();
            if (listRes.ok && Array.isArray(listData.models)) {
              availableImageModels = listData.models
                .filter(m => /imagen|image/i.test(m.name || m.displayName || ""))
                .map(m => ({ name: (m.name || "").replace(/^models\//, ""), methods: m.supportedGenerationMethods || [] }))
                .filter(m => m.name);
            }
          } catch { /* ignore — best-effort */ }
        }

        let friendly;
        if (lastStatus === 401 || /invalid.*api.?key|unauthor|api key not valid/i.test(lastRaw)) {
          friendly = "Der Gemini-API-Key ist ungültig. Bitte in Settings → KI-Modelle prüfen.";
        } else if (lastStatus === 403 || /permission|forbidden|access.*denied|FAILED_PRECONDITION/i.test(lastRaw)) {
          friendly = "Bildgenerierung mit diesem Gemini-Key ist serverseitig blockiert — meist, weil der Key aus einem Cloud-Projekt ohne aktives Billing stammt. Lege einen neuen Key im Projekt mit Billing an. Alternativ läuft OpenAI/DALL·E sofort ohne Setup.";
        } else if (lastStatus === 400 && /location|region/i.test(lastRaw)) {
          friendly = "Dieses Modell ist in deiner Region blockiert. OpenAI/DALL·E funktioniert in DE problemlos.";
        } else if (lastStatus === 429 || /rate.?limit|quota|exceeded|resource.?exhausted/i.test(lastRaw)) {
          friendly = "Gemini ist gerade ausgelastet (Rate-Limit). Bitte in einem Moment erneut versuchen.";
        } else if (lastStatus === 0 || lastStatus >= 500) {
          friendly = "Die Bildgenerierung war kurz nicht erreichbar. Bitte gleich noch einmal versuchen.";
        } else if (isNotFound && availableImageModels.length > 0) {
          const list = availableImageModels.map(m => `${m.name}${m.methods.length ? ` (${m.methods.join(", ")})` : ""}`).join("\n  • ");
          friendly = `Dein Gemini-Key hat keinen Zugriff auf die Standard-Bildmodelle. Verfügbar wären:\n  • ${list}\n\nAlternativ funktioniert OpenAI/DALL·E sofort ohne Setup.`;
        } else {
          friendly = "Bildgenerierung momentan nicht möglich. Bitte erneut versuchen oder OpenAI/DALL·E nutzen.";
        }
        return res.status(lastStatus || 502).json({
          error: friendly,
          provider: "gemini",
          statusCode: lastStatus || 502,
          rawError: lastRaw,
          availableImageModels,
        });
      }

      // ── Standard chat (text) ─────────────────────────────────────────────
      const candidateModels = [model || "gemini-2.5-flash"];

      let data, response, geminiModel, lastRaw = "";
      for (const candidate of candidateModels) {
        const url = apiKey
          ? `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey}`
          : `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent`;
        const requestBody = {
          contents: conversation.map((m, i) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: (imgPart && i === lastUserIdx)
              ? [{ inlineData: { mimeType: imgPart.mime, data: imgPart.b64 } }, { text: m.content }]
              : [{ text: m.content }],
          })),
          generationConfig: {
            maxOutputTokens: tokenLimit,
            temperature: 0.7,
          },
        };
        if (systemPrompt && systemPrompt.trim()) {
          requestBody.systemInstruction = { parts: [{ text: systemPrompt.trim() }] };
        }

        response = await withTimeout(fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        }), UPSTREAM_TIMEOUT_MS, "Gemini");
        data = await response.json();
        geminiModel = candidate;

        if (response.ok) break;

        const raw = data.error?.message || JSON.stringify(data.error) || "";
        lastRaw = raw;
        // 404 / "model not found" → try the next candidate; everything else bails immediately
        if (response.status !== 404 && !/model.*not.*found|not.*supported|is not available/i.test(raw)) {
          console.error("Gemini API error:", raw);
          return res.status(response.status).json({
            error: hintFor("Gemini", response.status, raw) || raw || "Gemini API-Fehler",
            provider: "gemini",
            statusCode: response.status,
            rawError: raw,
          });
        }
      }

      if (!response.ok) {
        return res.status(response.status).json({
          error: hintFor("Gemini", response.status, lastRaw) || lastRaw || "Gemini API-Fehler",
          provider: "gemini",
          statusCode: response.status,
          rawError: lastRaw,
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

      // Extract text + any inline images. Gemini sometimes splits an answer across multiple parts,
      // and image-generation responses interleave text and inlineData (base64-encoded image bytes).
      const parts = candidate?.content?.parts || [];
      const text = parts.map(p => p.text || "").join("").trim();
      const images = parts
        .filter(p => p.inlineData && p.inlineData.data)
        .map(p => ({
          type: "image",
          mimeType: p.inlineData.mimeType || "image/png",
          url: `data:${p.inlineData.mimeType || "image/png"};base64,${p.inlineData.data}`,
        }));

      if (!text && images.length === 0) {
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
      // Compose the response: text first (if any), then images
      const responseContent = [];
      if (text) responseContent.push({ type: "text", text });
      responseContent.push(...images);
      return res.status(200).json({
        content: responseContent,
        provider: "gemini",
        model: geminiModel,
        finishReason,
        usage: data.usageMetadata,
        hasImages: images.length > 0,
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
