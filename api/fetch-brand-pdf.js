// /api/fetch-brand-pdf.js
// Parse a Brand Book / Style Guide PDF and extract claim, description, colors,
// font names. Takes a public URL (e.g. Supabase Storage) and returns structured data.
import pdfParse from "pdf-parse";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.body || {};
  if (!url || typeof url !== "string") return res.status(400).json({ error: "Missing url" });

  try {
    const fileResp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; i7-OS-BrandFetcher/1.0)" },
    });
    if (!fileResp.ok) return res.status(502).json({ error: `Could not download PDF (${fileResp.status})` });
    const arrayBuf = await fileResp.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    // Vercel functions have ~50MB limit; PDF needs to be reasonable
    if (buf.length > 25 * 1024 * 1024) return res.status(413).json({ error: "PDF too large (max 25 MB)" });

    const parsed = await pdfParse(buf, { max: 60 }); // cap to first 60 pages for perf
    const text = (parsed.text || "").trim();
    const numPages = parsed.numpages || null;

    // ── Color extraction from text content ──
    const hexHits = text.match(/#[0-9a-fA-F]{6}\b/g) || [];
    // CMYK like "C: 80 M: 50 Y: 0 K: 0" — skip for now (would need conversion)
    // RGB like "RGB 12, 34, 56" or "R 12 G 34 B 56"
    const rgbHits = [];
    const rgbReA = /rgb\s*\(?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?/gi;
    let m;
    while ((m = rgbReA.exec(text)) !== null) rgbHits.push([+m[1], +m[2], +m[3]]);

    const rgbReB = /\bR\s*[:= ]\s*(\d{1,3})[, ]+G\s*[:= ]\s*(\d{1,3})[, ]+B\s*[:= ]\s*(\d{1,3})/gi;
    while ((m = rgbReB.exec(text)) !== null) rgbHits.push([+m[1], +m[2], +m[3]]);

    const toHex = (r, g, b) => "#" + [r, g, b].map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("").toUpperCase();
    const counts = {};
    const bump = (hex) => { const h = hex.toUpperCase(); counts[h] = (counts[h] || 0) + 1; };
    for (const h of hexHits) bump(h);
    for (const [r, g, b] of rgbHits) bump(toHex(r, g, b));

    const isUseful = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luma < 8 || luma > 248) return false;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max - min < 8) return false;
      return true;
    };
    const tooClose = (a, b) => {
      const dr = parseInt(a.slice(1,3),16) - parseInt(b.slice(1,3),16);
      const dg = parseInt(a.slice(3,5),16) - parseInt(b.slice(3,5),16);
      const db = parseInt(a.slice(5,7),16) - parseInt(b.slice(5,7),16);
      return Math.sqrt(dr*dr + dg*dg + db*db) < 24;
    };
    const candidates = Object.entries(counts).filter(([h]) => isUseful(h)).sort((a, b) => b[1] - a[1]).map(([h]) => h);
    const colors = [];
    for (const c of candidates) {
      if (!colors.some(x => tooClose(x, c))) colors.push(c);
      if (colors.length >= 8) break;
    }

    // ── Font name guesses ──
    // Pull strings that look like font names mentioned in the doc
    const KNOWN_FONT_HINTS = [
      "Inter","Helvetica","Arial","Roboto","Lato","Open Sans","Source Sans","Nunito","Poppins","Montserrat",
      "Geist","Manrope","Outfit","Plus Jakarta","DM Sans","Work Sans","Karla","Rubik","Mulish","Urbanist",
      "Playfair","Merriweather","Lora","PT Serif","Cormorant","EB Garamond","Crimson","Libre Caslon",
      "JetBrains Mono","Fira Code","IBM Plex","Space Grotesk","Space Mono","Roboto Mono","Source Code",
      "Futura","Avenir","Gotham","Proxima Nova","Brandon","Circular","Suisse",
    ];
    const fonts = [];
    for (const f of KNOWN_FONT_HINTS) {
      const re = new RegExp(`\\b${f.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (re.test(text) && !fonts.includes(f)) fonts.push(f);
    }
    // Cap
    const fontGuesses = fonts.slice(0, 6);

    // ── Claim & description ──
    // First non-empty line in the first 800 chars is often the title/claim
    const head = text.slice(0, 1200);
    const lines = head.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    let claim = null;
    for (const ln of lines) {
      if (ln.length >= 12 && ln.length <= 90 && /[A-Za-z]/.test(ln)) { claim = ln; break; }
    }
    // Description: first paragraph 80–600 chars long after the claim
    let description = null;
    if (claim) {
      const after = text.slice(text.indexOf(claim) + claim.length).trim();
      const paras = after.split(/\n{2,}|\.\s+(?=[A-Z])/).map(p => p.trim()).filter(Boolean);
      for (const p of paras) {
        if (p.length >= 60 && p.length <= 800) { description = p.length > 600 ? p.slice(0, 600) + "…" : p; break; }
      }
    }

    return res.status(200).json({
      pages: numPages,
      claim,
      description,
      colors: colors.slice(0, 6),
      primary: colors[0] || null,
      secondary: colors[1] || null,
      accents: colors.slice(2),
      fonts: fontGuesses,
      text_excerpt: text.slice(0, 500),
    });
  } catch (err) {
    console.error("fetch-brand-pdf error", err);
    return res.status(500).json({ error: err.message || "Failed to parse PDF" });
  }
}
