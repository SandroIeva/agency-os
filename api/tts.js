// Text to speech through Fish Audio.
//
// ⚠ This endpoint SPENDS MONEY on every call: FISH_API_KEY is ours and Fish
// bills per character. It used to answer anybody. There was no authentication
// at all and the CORS header said `*`, so any page anywhere could point at it
// and empty the balance, and nothing in the request said who did it.
//
// Two things guard it now. A caller has to be a signed-in i7OS user, proven by
// the same Supabase bearer token every other endpoint takes, and a single
// request is bounded in length so one call cannot be made arbitrarily
// expensive. Neither is a rate limit — a signed-in person can still call it in
// a loop — but the spend now belongs to a named account instead of to the
// internet.
import { HttpError, requireUser } from "../server/billing.js";

// Fish charges per character. The longest thing the app actually reads out is
// an assistant reply; anything past this is not a sentence, it is a bill.
const MAX_CHARS = 4000;

export default async function handler(req, res) {
  // No CORS header on purpose. Every caller is the app itself, same origin.
  // `*` here was an invitation.
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    await requireUser(req);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 401;
    return res.status(status).json({ error: e.message || "Authentication required", code: "unauthorized" });
  }

  const { text, voiceId, speed } = req.body || {};
  if (!text) return res.status(400).json({ error: "No text provided" });
  if (typeof text !== "string" || text.length > MAX_CHARS) {
    return res.status(413).json({ error: `Text is limited to ${MAX_CHARS} characters`, code: "too_long" });
  }

  const apiKey = process.env.FISH_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "FISH_API_KEY not set in environment" });

  try {
    const response = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId || "6ab4c6b0f37f4243a99046478647be94",
        format: "mp3",
        mp3_bitrate: 128,
        normalize: true,
        latency: "normal",
        // Speaking rate. Fish accepts 0.5 to 2.0 and rejects the request
        // outright outside that, so a number arriving from a browser is
        // clamped here rather than trusted: this endpoint spends money, and a
        // rejected call is a call we still made.
        prosody: { speed: Math.min(2, Math.max(0.5, Number(speed) || 1)) },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Fish Audio error:", response.status, err);
      return res.status(response.status).json({ error: err, status: response.status });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    console.error("TTS error:", error);
    return res.status(500).json({ error: error.message || "Fish Audio request failed" });
  }
}
