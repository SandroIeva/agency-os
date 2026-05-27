// Short-link resolver: /i/<slug>  →  302 to the stored target URL.
// Vercel rewrite (see vercel.json) maps /i/:slug → /api/redirect?slug=:slug.
// We call a Postgres RPC that atomically increments click_count and returns target_url —
// done in a single round trip so the latency is essentially equal to one DB hop.

const SUPABASE_URL = "https://oidbemeetiawiahpweyg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZGJlbWVldGlhd2lhaHB3ZXlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTA2ODAsImV4cCI6MjA5NDE4NjY4MH0.dTE2Yv1OgBS1k4oucHhVKKrUe4U31szqhtuW4dchM9M";

export default async function handler(req, res) {
  const slug = (req.query?.slug || "").toString();
  if (!slug || !/^[A-Za-z0-9_-]{4,32}$/.test(slug)) {
    return res.status(400).send("Invalid slug");
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/short_link_redirect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_slug: slug }),
    });
    if (!r.ok) return res.status(500).send("Lookup failed");

    const target = await r.json();
    if (!target || typeof target !== "string") {
      // Friendly 404 page — keeps the UX nicer than a plain "404 Not Found"
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(404).send(`<!doctype html><meta charset="utf-8"><title>Link nicht gefunden</title><style>body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#111117;color:#fffC;display:flex;align-items:center;justify-content:center;min-height:100vh}div{text-align:center;padding:40px}h1{font-size:18px;font-weight:600;margin:0 0 8px;letter-spacing:-0.2px}p{color:#fff70;margin:0;font-size:13px}</style><div><h1>Link nicht gefunden</h1><p>Dieser Kurzlink ist abgelaufen oder existiert nicht.</p></div>`);
      return;
    }

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    return res.redirect(302, target);
  } catch (e) {
    return res.status(500).send("Lookup failed: " + (e.message || ""));
  }
}
