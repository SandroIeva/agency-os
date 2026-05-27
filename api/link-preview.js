// Lightweight Open Graph preview fetcher.
// GET /api/link-preview?url=https://example.com → { title, description, image, site, url, favicon }
// Used by the chat to render WhatsApp/Slack-style link previews.

const TIMEOUT_MS = 6000;
const MAX_HTML_SCAN = 120_000; // 120 KB is plenty for <head>

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, max-age=3600"); // 1h CDN cache per URL

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  let { url } = req.query || {};
  if (!url || typeof url !== "string") return res.status(400).json({ error: "Missing url" });
  url = url.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: "Invalid url" }); }

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; i7OS-LinkPreview/1.0; +https://i7os.com)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
      },
      redirect: "follow",
    }).catch(e => null);
    clearTimeout(t);

    if (!response) return res.status(502).json({ error: "Fetch failed or timeout" });
    if (!response.ok) return res.status(response.status).json({ error: `Site returned ${response.status}` });

    const finalUrl = response.url || parsed.toString();
    const origin = new URL(finalUrl).origin;
    const html = (await response.text()).slice(0, MAX_HTML_SCAN);

    const meta = (name) => {
      const re1 = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`, "i");
      const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`, "i");
      const m = html.match(re1) || html.match(re2);
      return m ? decodeEntities(m[1]) : null;
    };
    const linkHref = (rel) => {
      const re1 = new RegExp(`<link[^>]+rel=["'][^"']*${rel}[^"']*["'][^>]*href=["']([^"']+)["']`, "i");
      const re2 = new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*${rel}[^"']*["']`, "i");
      const m = html.match(re1) || html.match(re2);
      return m ? m[1] : null;
    };
    const abs = (u) => { if (!u) return null; try { return new URL(u, finalUrl).toString(); } catch { return null; } };

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const rawTitle = titleMatch ? decodeEntities(titleMatch[1].trim()) : null;

    const title = meta("og:title") || meta("twitter:title") || rawTitle || parsed.hostname;
    const description = meta("og:description") || meta("twitter:description") || meta("description") || null;
    let image = meta("og:image") || meta("twitter:image") || meta("twitter:image:src");
    image = abs(image);
    if (!image) {
      // Fall back to a high-res apple-touch-icon or favicon — gives some visual at least
      image = abs(linkHref("apple-touch-icon")) || abs(linkHref("icon")) || `${origin}/favicon.ico`;
    }
    const siteName = meta("og:site_name") || meta("application-name") || parsed.hostname.replace(/^www\./, "");
    const favicon = abs(linkHref("apple-touch-icon")) || abs(linkHref("icon")) || `${origin}/favicon.ico`;

    return res.status(200).json({
      url: finalUrl,
      title: title ? title.slice(0, 200) : null,
      description: description ? description.slice(0, 280) : null,
      image,
      site: siteName,
      favicon,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Failed" });
  }
}

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, " ").trim();
}
