// /api/fetch-brand-zip.js
// Inspect a Brand-Paket ZIP and surface logos, fonts and any embedded PDFs/images.
// Returns metadata only — uploads to user storage happen client-side if needed.
import JSZip from "jszip";

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
    if (!fileResp.ok) return res.status(502).json({ error: `Could not download ZIP (${fileResp.status})` });
    const arrayBuf = await fileResp.arrayBuffer();
    if (arrayBuf.byteLength > 50 * 1024 * 1024) return res.status(413).json({ error: "ZIP too large (max 50 MB)" });

    const zip = await JSZip.loadAsync(arrayBuf);

    const logos = [];
    const fonts = [];
    const pdfs = [];
    const images = [];
    const others = [];

    const fileNames = Object.keys(zip.files);
    for (const name of fileNames) {
      const entry = zip.files[name];
      if (entry.dir) continue;
      const base = name.split("/").pop() || name;
      const ext = (base.split(".").pop() || "").toLowerCase();
      const lower = base.toLowerCase();
      const size = entry._data?.uncompressedSize || 0;

      const meta = { path: name, name: base, size, ext };

      if (["svg", "png", "jpg", "jpeg", "webp", "ai", "eps"].includes(ext)) {
        const looksLikeLogo = /logo|wordmark|symbol|icon|mark|brand/i.test(name);
        if (looksLikeLogo) logos.push(meta);
        else images.push(meta);
      } else if (["ttf", "otf", "woff", "woff2"].includes(ext)) {
        fonts.push(meta);
      } else if (ext === "pdf") {
        pdfs.push(meta);
      } else {
        others.push(meta);
      }
    }

    // Deduplicate font filenames into family hints
    const fontFamilies = Array.from(new Set(fonts.map(f => {
      const stem = f.name.replace(/\.[^.]+$/, "");
      // Strip common weight/style suffixes
      return stem.replace(/[-_ ]?(Thin|ExtraLight|Light|Regular|Italic|Medium|SemiBold|Bold|ExtraBold|Black|Heavy|Oblique|Roman|Book|\d+wt?)$/i, "").trim();
    }).filter(Boolean)));

    return res.status(200).json({
      total_files: fileNames.length,
      logos,
      fonts,
      font_families: fontFamilies.slice(0, 8),
      pdfs,
      images: images.slice(0, 20),
      others_count: others.length,
    });
  } catch (err) {
    console.error("fetch-brand-zip error", err);
    return res.status(500).json({ error: err.message || "Failed to read ZIP" });
  }
}
