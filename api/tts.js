export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided" });

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
        reference_id: "0fb9b7b9dd7247cbb04db512b0f354e6",
        format: "mp3",
        mp3_bitrate: 128,
        normalize: true,
        latency: "normal",
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
