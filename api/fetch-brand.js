// /api/fetch-brand.js
// Server-side fetch a brand's public website and extract name, claim, description,
// logo candidate(s) and a rough color palette. Used by the Brand Onboarding wizard.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let { url } = req.body || {};
  if (!url || typeof url !== "string") return res.status(400).json({ error: "Missing url" });
  url = url.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: "Invalid url" }); }

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; i7-OS-BrandFetcher/1.0; +https://i7os.com)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    if (!response.ok) return res.status(502).json({ error: `Site returned ${response.status}` });
    const html = await response.text();

    const finalUrl = response.url || parsed.toString();
    const origin = new URL(finalUrl).origin;

    // ── Helpers ──────────────────────────────────────────────────────────
    const head = html.slice(0, Math.min(html.length, 200_000)); // only scan first 200kb of HTML for perf

    const meta = (name) => {
      const re1 = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`, "i");
      const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`, "i");
      const m = head.match(re1) || head.match(re2);
      return m ? decodeEntities(m[1]) : null;
    };
    const linkHref = (rel) => {
      const re1 = new RegExp(`<link[^>]+rel=["'][^"']*${rel}[^"']*["'][^>]*href=["']([^"']+)["']`, "i");
      const re2 = new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*${rel}[^"']*["']`, "i");
      const m = head.match(re1) || head.match(re2);
      return m ? m[1] : null;
    };
    const absolutize = (u) => {
      if (!u) return null;
      try { return new URL(u, finalUrl).toString(); } catch { return null; }
    };

    // ── Name + claim + description ───────────────────────────────────────
    const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const rawTitle = titleMatch ? decodeEntities(titleMatch[1].trim()) : null;
    const ogTitle = meta("og:title");
    const siteName = meta("og:site_name") || meta("application-name");

    // Brand name guess: prefer og:site_name, then split title by separator
    let name = siteName || null;
    if (!name && (ogTitle || rawTitle)) {
      const t = (ogTitle || rawTitle).trim();
      // Split on common title separators: |, ·, —, –, -
      const parts = t.split(/\s*[|·—–-]\s+/);
      // Heuristic: shortest non-empty part is most likely the brand
      const candidates = parts.filter(p => p.length > 0 && p.length < 40);
      name = candidates.length ? candidates.sort((a,b) => a.length - b.length)[0] : t;
    }

    const description = meta("description") || meta("og:description") || null;
    // Claim: the longer half of the title, if title had a separator
    let claim = null;
    if (rawTitle && /\s[|·—–-]\s/.test(rawTitle)) {
      const parts = rawTitle.split(/\s*[|·—–-]\s+/).map(s => s.trim()).filter(Boolean);
      const tagline = parts.find(p => p !== name && p.length > 6);
      if (tagline && tagline.length < 90) claim = tagline;
    }

    // ── Logo ─────────────────────────────────────────────────────────────
    // Prefer apple-touch-icon (usually high-res square), then og:image, then favicon
    let logo = linkHref("apple-touch-icon") || meta("og:image") || meta("twitter:image")
      || linkHref("icon") || linkHref("shortcut icon") || linkHref("mask-icon");
    if (!logo) logo = `${origin}/favicon.ico`;
    logo = absolutize(logo);

    const themeColor = meta("theme-color");

    // ── Colors ───────────────────────────────────────────────────────────
    // Collect hex codes from inline styles, <style> blocks and (sampled) attributes
    const hexHits = head.match(/#[0-9a-fA-F]{6}\b/g) || [];
    const rgbHits = head.match(/rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)/g) || [];

    const counts = {};
    const bump = (hex) => { const h = hex.toUpperCase(); counts[h] = (counts[h] || 0) + 1; };
    for (const h of hexHits) bump(h);
    for (const rgb of rgbHits) {
      const m = rgb.match(/(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
      if (!m) continue;
      const hex = "#" + [m[1], m[2], m[3]].map(n => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, "0")).join("");
      bump(hex);
    }
    const isUseful = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luma < 12 || luma > 244) return false; // skip near-black/white
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max - min < 10) return false; // skip near-grey
      return true;
    };
    // Cluster: if two colors are within delta-E-ish proximity, count once
    let candidates = Object.entries(counts).filter(([h]) => isUseful(h)).sort((a, b) => b[1] - a[1]).map(([h]) => h);
    const clustered = [];
    const tooClose = (a, b) => {
      const dr = parseInt(a.slice(1,3),16) - parseInt(b.slice(1,3),16);
      const dg = parseInt(a.slice(3,5),16) - parseInt(b.slice(3,5),16);
      const db = parseInt(a.slice(5,7),16) - parseInt(b.slice(5,7),16);
      return Math.sqrt(dr*dr + dg*dg + db*db) < 24;
    };
    for (const c of candidates) {
      if (!clustered.some(x => tooClose(x, c))) clustered.push(c);
      if (clustered.length >= 6) break;
    }
    let colors = clustered;
    if (themeColor && /^#[0-9a-f]{6}$/i.test(themeColor)) {
      const tc = themeColor.toUpperCase();
      colors = [tc, ...colors.filter(c => c !== tc)].slice(0, 6);
    }

    return res.status(200).json({
      url: finalUrl,
      name: name?.slice(0, 60) || null,
      claim: claim || null,
      description: description || null,
      logo_url: logo || null,
      colors,
      primary: colors[0] || null,
      secondary: colors[1] || null,
      accents: colors.slice(2),
      theme_color: themeColor || null,
    });
  } catch (err) {
    console.error("fetch-brand error", err);
    return res.status(500).json({ error: err.message || "Failed to fetch" });
  }
}

// Small HTML entity decoder for the handful that show up in titles/descs
function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}
