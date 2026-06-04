// Proxy for the full Google Fonts catalogue (google-webfonts-helper).
// The upstream API has no CORS headers, so we fetch it server-side and serve a
// trimmed { fonts: [{ name, cat, weights }] } list (same-origin → no CORS issue).
const CAT = { "sans-serif": "Sans", "serif": "Serif", "display": "Display", "handwriting": "Handschrift", "monospace": "Mono" };

export default async function handler(req, res) {
  try {
    const r = await fetch("https://gwfh.mranftl.com/api/fonts", { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return res.status(502).json({ fonts: [] });
    const list = await r.json();
    const fonts = (Array.isArray(list) ? list : []).map((f) => {
      const set = new Set();
      (f.variants || []).forEach((v) => {
        if (String(v).includes("italic")) return;
        if (v === "regular") set.add(400);
        else { const n = parseInt(v, 10); if (!isNaN(n)) set.add(n); }
      });
      const weights = [...set].sort((a, b) => a - b);
      return { name: f.family, cat: CAT[f.category] || "Sans", weights: weights.length ? weights : [400] };
    });
    // Cache hard — the catalogue rarely changes.
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
    return res.status(200).json({ fonts });
  } catch (e) {
    return res.status(502).json({ fonts: [] });
  }
}
