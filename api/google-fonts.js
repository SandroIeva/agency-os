// Proxy for the full Google Fonts catalogue (google-webfonts-helper).
// The upstream API has no CORS headers, so we fetch it server-side and serve a
// trimmed { fonts: [{ name, cat, weights }] } list (same-origin → no CORS issue).
//
// Runs on the Edge runtime so it does NOT count against the Hobby plan's
// 12 Serverless Functions limit (we're already at the cap with the Node APIs).
export const config = { runtime: "edge" };

const CAT = { "sans-serif": "Sans", "serif": "Serif", "display": "Display", "handwriting": "Handschrift", "monospace": "Mono" };

const json = (obj, status, extraHeaders = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...extraHeaders } });

export default async function handler() {
  try {
    const r = await fetch("https://gwfh.mranftl.com/api/fonts", { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return json({ fonts: [] }, 502);
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
    return json({ fonts }, 200, { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400" });
  } catch (e) {
    return json({ fonts: [] }, 502);
  }
}
