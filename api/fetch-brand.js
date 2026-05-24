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

    // ── Brand context: hero headlines + first meaningful paragraphs ──────
    const homeContext = extractBrandContext(html);
    const homeHeadlines = extractHeadlines(html);
    const homeValueProps = extractListItems(html);
    const socials = extractSocialLinks(html);

    // ── Try to enrich with About / Über-uns / Über page (best-effort) ────
    const aboutCandidates = ["/about", "/about-us", "/ueber-uns", "/uber-uns", "/ueber", "/who-we-are", "/company"];
    let aboutContext = null;
    let aboutUrl = null;
    for (const path of aboutCandidates) {
      try {
        const aboutResp = await fetch(`${origin}${path}`, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; i7-OS-BrandFetcher/1.0)" },
          redirect: "follow",
        });
        if (aboutResp.ok) {
          const aboutHtml = await aboutResp.text();
          const ctx = extractBrandContext(aboutHtml);
          if (ctx && ctx.length > 120) {
            aboutContext = ctx;
            aboutUrl = aboutResp.url || `${origin}${path}`;
            break;
          }
        }
      } catch { /* ignore — about page is optional */ }
    }

    // Compose a single rich "about" string for the brand context field
    const aboutParts = [];
    if (homeContext) aboutParts.push(homeContext);
    if (aboutContext && aboutContext !== homeContext) aboutParts.push(aboutContext);
    let about = aboutParts.join("\n\n").trim();
    if (about.length > 1800) about = about.slice(0, 1797) + "…";

    return res.status(200).json({
      url: finalUrl,
      name: name?.slice(0, 60) || null,
      claim: claim || null,
      description: description || null,
      about: about || null,
      about_url: aboutUrl || null,
      headlines: homeHeadlines.slice(0, 8),
      value_props: homeValueProps.slice(0, 8),
      socials,
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

// Pull headlines and first meaningful paragraphs out of an HTML doc.
// Returns a single deduped, length-capped string that describes the brand.
function extractBrandContext(html) {
  if (!html) return null;
  // Strip scripts/styles/SVGs/etc. so we don't pick up code
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Limit how much we scan for perf
  body = body.slice(0, 250_000);

  const pieces = [];
  const push = (txt) => {
    const clean = decodeEntities(stripTags(txt))
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return;
    if (clean.length < 20) return;          // skip nav/menu junk
    if (clean.length > 400) return;         // skip giant chunks (likely menus/jsondata)
    if (/cookie|datenschutz|impressum|privacy policy|©|all rights reserved/i.test(clean)) return;
    if (pieces.some(p => p.toLowerCase() === clean.toLowerCase())) return;
    pieces.push(clean);
  };

  // Collect headlines first (H1 → H3), then body paragraphs
  for (const tag of ["h1", "h2", "h3"]) {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
    let m;
    while ((m = re.exec(body)) !== null) push(m[1]);
  }
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let pm;
  while ((pm = pRe.exec(body)) !== null) push(pm[1]);

  // Also pull list items — often bullet value-props
  const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let lm;
  while ((lm = liRe.exec(body)) !== null) push(lm[1]);

  if (!pieces.length) return null;

  // Build the final string up to ~1500 chars
  const out = [];
  let total = 0;
  for (const p of pieces) {
    if (total + p.length + 1 > 1500) break;
    out.push(p);
    total += p.length + 1;
  }
  return out.join("\n");
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, " ");
}

// Pull H1/H2/H3 as separate strings (deduped, length-bounded)
function extractHeadlines(html) {
  if (!html) return [];
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ");
  const out = [];
  for (const tag of ["h1", "h2", "h3"]) {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
    let m;
    while ((m = re.exec(body)) !== null) {
      const txt = decodeEntities(stripTags(m[1])).replace(/\s+/g, " ").trim();
      if (txt && txt.length >= 6 && txt.length <= 160 && !out.includes(txt)) out.push(txt);
      if (out.length >= 15) return out;
    }
  }
  return out;
}

// Find social-network profile URLs from anchor hrefs anywhere in the document
function extractSocialLinks(html) {
  if (!html) return {};
  const PATTERNS = {
    instagram: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\-/]+/i,
    linkedin:  /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in|school)\/[A-Za-z0-9_.\-/]+/i,
    tiktok:    /https?:\/\/(?:www\.)?tiktok\.com\/@?[A-Za-z0-9_.\-/]+/i,
    youtube:   /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/|user\/)[A-Za-z0-9_.\-]+/i,
    x:         /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!intent|share|home)[A-Za-z0-9_]+/i,
    facebook:  /https?:\/\/(?:www\.)?facebook\.com\/(?!sharer|share|tr|plugins)[A-Za-z0-9_.\-/]+/i,
    pinterest: /https?:\/\/(?:[a-z]{2,3}\.)?pinterest\.com\/[A-Za-z0-9_.\-/]+/i,
    threads:   /https?:\/\/(?:www\.)?threads\.net\/@?[A-Za-z0-9_.\-/]+/i,
  };
  const out = {};
  for (const [key, re] of Object.entries(PATTERNS)) {
    const m = html.match(re);
    if (m) {
      // Trim trailing punctuation / quotes
      let url = m[0].replace(/[\s"'<>)\]]+$/, "");
      // Skip really short paths (just the bare domain) — likely a tracking pixel, not a profile
      try {
        const u = new URL(url);
        if (u.pathname.length <= 1) continue;
      } catch { continue; }
      out[key] = url;
    }
  }
  return out;
}

// Pull list items — typically value props / features
function extractListItems(html) {
  if (!html) return [];
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ");
  const out = [];
  const re = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    const txt = decodeEntities(stripTags(m[1])).replace(/\s+/g, " ").trim();
    if (!txt) continue;
    if (txt.length < 12 || txt.length > 200) continue;        // skip menu shorties + giant nested blobs
    if (/^(home|kontakt|contact|about|über|menü|menu|impressum|privacy|datenschutz)$/i.test(txt)) continue;
    if (out.includes(txt)) continue;
    out.push(txt);
    if (out.length >= 12) break;
  }
  return out;
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
