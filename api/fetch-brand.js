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

    // ── Download the logo NOW so we can mine its SVG colors during palette extraction ──
    // We try a pyramid of sources, in quality order, and stop at the first that works.
    let logoDataUrl = null;
    let logoContentType = null;
    let logoUsedSource = null;
    const domain = new URL(finalUrl).hostname.replace(/^www\./, "");

    const tryDownload = async (imgUrl, refOrigin) => {
      try {
        const headers = {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          "Sec-Fetch-Dest": "image",
          "Sec-Fetch-Mode": "no-cors",
          "Sec-Fetch-Site": "cross-site",
        };
        if (refOrigin) headers["Referer"] = refOrigin + "/";
        const r = await fetch(imgUrl, { headers, redirect: "follow" });
        if (!r.ok) return null;
        const ct = r.headers.get("content-type") || "";
        if (!/^image\//i.test(ct) && !/svg|icon/i.test(ct) && !/octet-stream/i.test(ct)) return null;
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 100 || buf.length > 1_500_000) return null;
        const cleanCt = ct.split(";")[0].trim() || "image/png";
        return { dataUrl: `data:${cleanCt};base64,${buf.toString("base64")}`, contentType: cleanCt };
      } catch {
        return null;
      }
    };

    const trySources = [];
    if (logo) trySources.push({ url: logo, ref: origin, name: "page" });
    if (domain) {
      trySources.push({ url: `${origin}/apple-touch-icon.png`,                  ref: origin, name: "apple-touch-icon" });
      trySources.push({ url: `${origin}/apple-touch-icon-precomposed.png`,     ref: origin, name: "apple-touch-precomposed" });
      trySources.push({ url: `${origin}/apple-touch-icon-180x180.png`,         ref: origin, name: "apple-touch-180" });
      trySources.push({ url: `${origin}/favicon-196x196.png`,                  ref: origin, name: "favicon-196" });
      trySources.push({ url: `${origin}/favicon-192x192.png`,                  ref: origin, name: "favicon-192" });
      trySources.push({ url: `https://icons.duckduckgo.com/ip3/${domain}.ico`, ref: null,   name: "duckduckgo" });
      trySources.push({ url: `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=256`, ref: null, name: "google-faviconv2" });
      trySources.push({ url: `https://www.google.com/s2/favicons?domain=${domain}&sz=256`, ref: null, name: "google-s2-256" });
      trySources.push({ url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, ref: null, name: "google-s2-128" });
      trySources.push({ url: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,  ref: null, name: "google-s2-64" });
    }
    for (const s of trySources) {
      const r = await tryDownload(s.url, s.ref);
      if (r) {
        logoDataUrl = r.dataUrl;
        logoContentType = r.contentType;
        logoUsedSource = s.name;
        break;
      }
    }
    const browserSafeFallback = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=256` : null;

    const themeColor = meta("theme-color");

    // ── Colors ───────────────────────────────────────────────────────────
    // Strategy: weighted scoring. We assign each color a score, where signals
    // that are *strong* brand-hints (CSS custom properties named --primary, --brand,
    // theme-color meta tag, fills inside the SVG logo) get high weight, and raw
    // hex hits in arbitrary HTML get low weight. Then we pick the top colors.

    const isUseful = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luma < 12 || luma > 244) return false;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max - min < 10) return false;
      return true;
    };
    // Stricter test: only "vibrant" colours can claim Primary/Secondary slots.
    // Brand colours are saturated, not washed-out or muddy. Greys/beiges/dull tints stay in the
    // accent pool but never get promoted to the headline brand slot.
    const isVibrant = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max > 0 ? (max - min) / max : 0;
      const val = max / 255;
      return sat >= 0.35 && val >= 0.2 && val <= 0.95;
    };
    const normalizeHex = (raw) => {
      if (!raw) return null;
      let h = raw.trim().toUpperCase();
      if (/^#[0-9A-F]{3}$/.test(h)) h = "#" + h.slice(1).split("").map(c => c + c).join("");
      if (!/^#[0-9A-F]{6}$/.test(h)) return null;
      return h;
    };
    const rgbToHex = (r, g, b) => "#" + [r, g, b].map(n => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, "0").toUpperCase()).join("");

    const colorScore = {}; // hex -> score
    const bump = (hex, weight) => {
      const h = normalizeHex(hex);
      if (!h || !isUseful(h)) return;
      colorScore[h] = (colorScore[h] || 0) + weight;
    };

    // FREQUENCY-FIRST: every hex/rgb occurrence counts. The most-used colour wins.
    // Brand-name hints (theme-color, --primary, button backgrounds, logo SVG) add small bonuses
    // on top, but they cannot single-handedly outvote the truly dominant colour on the page.

    // ── 1. theme-color meta — moderate hint ──────────────────────────────
    if (themeColor) bump(themeColor, 30);

    // ── 2. Inline <style> blocks + fetched CSS: count EVERY hex + bonus for brandy contexts ──
    const inlineStyles = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []).join("\n");
    const collectFromCss = (cssText, varBonus, btnBonus) => {
      if (!cssText) return;
      // First: count every hex/rgb occurrence in this CSS — pure frequency signal (1pt each)
      const hexHits = cssText.match(/#[0-9a-fA-F]{6}\b/g) || [];
      for (const h of hexHits) bump(h, 1);
      const rgbHits = cssText.match(/rgba?\(\s*\d{1,3}\s*[\s,]\s*\d{1,3}\s*[\s,]\s*\d{1,3}/g) || [];
      for (const rg of rgbHits) {
        const m = rg.match(/(\d{1,3})\s*[\s,]\s*(\d{1,3})\s*[\s,]\s*(\d{1,3})/);
        if (m) bump(rgbToHex(m[1], m[2], m[3]), 1);
      }
      // Bonus for brandy CSS variables — small additional boost, not overpowering
      const varRe = /--([a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+)/g;
      let vm;
      while ((vm = varRe.exec(cssText)) !== null) {
        const varName = vm[1].toLowerCase();
        const val = vm[2].trim();
        const isBrandy = /\b(primary|brand|accent|main|cta|theme|action|link|highlight|focus|hero)\b/.test(varName);
        if (!isBrandy) continue;
        const hex = (val.match(/#[0-9a-fA-F]{3,6}/) || [null])[0];
        if (hex) { bump(hex, varBonus); continue; }
        const rgb = val.match(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
        if (rgb) { bump(rgbToHex(rgb[1], rgb[2], rgb[3]), varBonus); }
      }
      // Bonus for button-ish selectors using a color
      const buttonBlockRe = /([^\}\{]*?(?:btn|button|cta|primary|brand|action)[^\}\{]*)\{([^}]+)\}/gi;
      let bm;
      while ((bm = buttonBlockRe.exec(cssText)) !== null) {
        const decl = bm[2];
        const props = ["background-color", "background", "color", "fill", "border-color"];
        for (const p of props) {
          const re = new RegExp(`${p}\\s*:\\s*([^;]+)`, "gi");
          let pm;
          while ((pm = re.exec(decl)) !== null) {
            const val = pm[1].trim();
            const hex = (val.match(/#[0-9a-fA-F]{3,6}/) || [null])[0];
            if (hex) bump(hex, btnBonus);
            const rgb = val.match(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
            if (rgb) bump(rgbToHex(rgb[1], rgb[2], rgb[3]), btnBonus);
          }
        }
      }
    };
    collectFromCss(inlineStyles, /* var bonus */ 15, /* button bonus */ 8);

    // ── 3. Fetch linked stylesheets and mine them too ────────────────────
    const stylesheetUrls = [];
    const linkRe = /<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi;
    let lkm;
    while ((lkm = linkRe.exec(head)) !== null) {
      const hrefM = lkm[0].match(/href=["']([^"']+)["']/);
      if (hrefM) {
        const abs = absolutize(hrefM[1]);
        if (abs && !stylesheetUrls.includes(abs)) stylesheetUrls.push(abs);
      }
      if (stylesheetUrls.length >= 8) break; // limit fetches for perf
    }
    // Cache the fetched CSS bodies so we can mine fonts from them too without re-fetching
    const fetchedCss = [];
    await Promise.all(stylesheetUrls.map(async (cssUrl) => {
      try {
        const r = await fetch(cssUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; i7-OS-BrandFetcher/1.0)" },
          redirect: "follow",
        });
        if (!r.ok) return;
        let text = await r.text();
        // For huge bundles, sample the first 2MB — that's plenty to catch the design tokens at the top.
        if (text.length > 2_000_000) text = text.slice(0, 2_000_000);
        fetchedCss.push(text);
        collectFromCss(text, /* var bonus */ 12, /* button bonus */ 6);
      } catch { /* ignore */ }
    }));

    // ── 4. Inline SVGs on the page — heavily weighted if they look like the logo ──
    // The brand logo is almost always inline-SVG'd in the top nav, often with class="logo" or
    // data-name="logo". Those fills are the most reliable brand-colour signal we get.
    const svgBlockRe = /<svg[\s\S]*?<\/svg>/gi;
    let svm;
    let svgIdx = 0;
    while ((svm = svgBlockRe.exec(html)) !== null) {
      const svgText = svm[0];
      const isHeaderSvg = svm.index < 30_000; // within the first ~30kb of HTML = likely the nav logo
      const isLogoHinted = /(logo|brand|wordmark|mark)/i.test(svgText.slice(0, 400)) || /(logo|brand|wordmark|mark)/i.test(svgText.match(/^<svg[^>]*>/)?.[0] || "");
      // Weight per fill — higher near the top + when class/id hints at "logo"
      const w = isLogoHinted ? 40 : (isHeaderSvg && svgIdx < 3 ? 20 : 2);
      const attrRe = /(?:fill|stroke|stop-color)\s*=\s*["']([^"']+)["']/gi;
      let am;
      while ((am = attrRe.exec(svgText)) !== null) {
        const v = am[1].trim();
        if (/^(none|currentColor|transparent)$/i.test(v)) continue;
        const hex = (v.match(/#[0-9a-fA-F]{3,6}/) || [null])[0];
        if (hex) bump(hex, w);
        const rgb = v.match(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
        if (rgb) bump(rgbToHex(rgb[1], rgb[2], rgb[3]), w);
      }
      // Also style="fill: …" inside the SVG markup
      const styleRe = /style\s*=\s*["']([^"']+)["']/gi;
      let stm;
      while ((stm = styleRe.exec(svgText)) !== null) {
        const v = stm[1];
        const hexes = v.match(/#[0-9a-fA-F]{3,6}/g) || [];
        for (const hx of hexes) bump(hx, w);
      }
      svgIdx++;
    }
    // Also boost the downloaded logo's fills harder
    if (logoDataUrl && /image\/svg/i.test(logoContentType || "")) {
      try {
        const svgText = Buffer.from(logoDataUrl.split(",")[1] || "", "base64").toString("utf8");
        const attrRe = /(?:fill|stroke|stop-color)\s*=\s*["']([^"']+)["']/gi;
        let am;
        while ((am = attrRe.exec(svgText)) !== null) {
          const v = am[1].trim();
          if (/^(none|currentColor|transparent)$/i.test(v)) continue;
          const hex = (v.match(/#[0-9a-fA-F]{3,6}/) || [null])[0];
          if (hex) bump(hex, 40);
          const rgb = v.match(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
          if (rgb) bump(rgbToHex(rgb[1], rgb[2], rgb[3]), 40);
        }
      } catch { /* ignore */ }
    }

    // ── 5. Raw HTML hex hits — basic frequency signal ────────────────────
    const hexHits = head.match(/#[0-9a-fA-F]{6}\b/g) || [];
    const rgbHits = head.match(/rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)/g) || [];
    for (const h of hexHits) bump(h, 1);
    for (const rgb of rgbHits) {
      const m = rgb.match(/(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
      if (m) bump(rgbToHex(m[1], m[2], m[3]), 1);
    }

    // ── Cluster & pick top ───────────────────────────────────────────────
    // Two passes:
    //   1) Pick the top *vibrant* (saturated) candidates first — these fill Primary/Secondary
    //   2) Fill the remaining accent slots from the rest of the score list
    // That way a beige or grey can never accidentally land in the headline slot.
    const tooClose = (a, b) => {
      const dr = parseInt(a.slice(1,3),16) - parseInt(b.slice(1,3),16);
      const dg = parseInt(a.slice(3,5),16) - parseInt(b.slice(3,5),16);
      const db = parseInt(a.slice(5,7),16) - parseInt(b.slice(5,7),16);
      return Math.sqrt(dr*dr + dg*dg + db*db) < 24;
    };
    const rankedAll = Object.entries(colorScore).sort((a, b) => b[1] - a[1]).map(([h]) => h);
    const rankedVibrant = rankedAll.filter(isVibrant);

    const clustered = [];
    const pushIfDistinct = (c) => {
      if (clustered.some(x => tooClose(x, c))) return false;
      clustered.push(c);
      return true;
    };
    // First two slots: must be vibrant
    let primaryIdx = 0;
    for (const c of rankedVibrant) {
      if (pushIfDistinct(c)) primaryIdx++;
      if (primaryIdx >= 2) break;
    }
    // Remaining slots: any colour (vibrant or muted) ranked by frequency
    for (const c of rankedAll) {
      if (clustered.length >= 6) break;
      pushIfDistinct(c);
    }
    let colors = clustered;

    // ── Fonts ─────────────────────────────────────────────────────────────
    // Three signals: Google Fonts / Bunny / Adobe Fonts link tags, @font-face declarations,
    // and font-family declarations on body / html / headings.
    const fontSignals = {
      googleFonts: [],    // ["Inter", "Playfair Display"]
      customFaces: [],    // ["Stripe Sans"]
      bodyFamilies: [],   // ["Inter", "system-ui", "-apple-system"]
      headingFamilies: [],
    };
    const dedupe = (arr) => Array.from(new Set(arr.map(s => s.trim()).filter(Boolean)));
    const cleanFamily = (raw) => raw.replace(/['"]/g, "").trim();
    const looksGeneric = (n) => /^(system-ui|-apple-system|blinkmacsystemfont|sans-serif|serif|monospace|cursive|fantasy|emoji|math|fangsong|ui-(sans-serif|serif|monospace|rounded)|segoe ui|helvetica( neue)?|arial|roboto|verdana|tahoma|trebuchet|courier( new)?|times( new roman)?|georgia|inherit|initial|unset)$/i.test(n.trim());

    // Strip technical suffixes ("-var", "-vf", "-variable", trailing weight numbers) and title-case
    // the rest. "sohne-var" → "Sohne", "inter_variable" → "Inter", "general-sans-500" → "General Sans".
    const prettifyFont = (raw) => {
      let s = cleanFamily(raw);
      if (!s) return s;
      // Drop CSS-internal markers
      s = s.replace(/[-_\s]?(var|variable|vf|web|webfont|loaded)$/i, "");
      s = s.replace(/[-_\s]?[0-9]{2,4}$/g, "");
      s = s.replace(/[-_]+/g, " ").trim();
      // Title-case each word — but leave acronyms alone
      s = s.replace(/\b([a-z])([a-z]*)/g, (_, a, rest) => a.toUpperCase() + rest);
      return s;
    };
    // Reject if value is a CSS expression we can't render meaningfully on its own
    const isCssExpr = (v) => /^var\(|^calc\(|^env\(/i.test(v.trim());

    // CSS variable map: --name → resolved value string (potential font list)
    const cssFontVars = {};
    const resolveVarRef = (val) => {
      const m = val && val.match(/var\(\s*--([a-zA-Z0-9_-]+)/);
      if (!m) return val;
      const ref = cssFontVars[m[1].toLowerCase()];
      return ref || null;
    };

    // Google Fonts / Bunny Fonts URLs in <link>
    const fontHostRe = /<link[^>]+href=["']([^"']*(?:fonts\.googleapis\.com|fonts\.bunny\.net|use\.typekit\.net|fonts\.adobe\.com)[^"']*)["']/gi;
    let fhm;
    while ((fhm = fontHostRe.exec(html)) !== null) {
      const href = fhm[1];
      // Parse family= query param
      const famMatches = href.match(/family=([^&]+)/gi) || [];
      for (const fm of famMatches) {
        const families = fm.replace(/^family=/i, "").split("|");
        for (const fam of families) {
          const name = decodeURIComponent(fam.split(":")[0]).replace(/\+/g, " ").trim();
          if (name && !looksGeneric(name)) {
            fontSignals.googleFonts.push(name);
            bumpFamily(name, 4); // Google Fonts loads are very intentional brand choices
          }
        }
      }
    }

    // Frequency map for ANY font-family declaration across all CSS — the most-used family
    // is almost always the body font, the second-most is the heading.
    const familyFreq = {};
    const bumpFamily = (name, weight) => {
      const n = cleanFamily(name);
      if (!n || looksGeneric(n)) return;
      familyFreq[n] = (familyFreq[n] || 0) + weight;
    };

    // PASS 1: harvest font-related CSS variables so var(--xxx) references resolve later.
    const harvestFontVars = (cssText) => {
      if (!cssText) return;
      const re = /--([a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+)/g;
      let m;
      while ((m = re.exec(cssText)) !== null) {
        const name = m[1].toLowerCase();
        const val = m[2].trim();
        if (isCssExpr(val)) continue;
        // Heuristic: looks like a font-family list if it has quoted/unquoted family names
        // (i.e. contains a comma OR mentions sans-serif/serif OR has quotes)
        const looksLikeFontList = /['"]|sans-serif|serif|monospace/i.test(val) || (name.includes("font") && /[a-zA-Z]/.test(val));
        if (looksLikeFontList) cssFontVars[name] = val;
      }
    };
    harvestFontVars(inlineStyles);
    for (const css of fetchedCss) harvestFontVars(css);

    // Push a raw value (possibly "var(--x)") into the family-frequency map after resolution + prettify.
    const pushFamilyValue = (rawValue, weights /* [first, rest] */, sinkList) => {
      if (!rawValue) return;
      let val = rawValue.trim();
      if (isCssExpr(val)) {
        const resolved = resolveVarRef(val);
        if (!resolved) return; // unresolvable — drop
        val = resolved;
      }
      const parts = val.split(",");
      parts.forEach((part, i) => {
        let n = cleanFamily(part);
        if (!n || isCssExpr(n)) return;
        if (looksGeneric(n)) return;
        n = prettifyFont(n);
        if (!n) return;
        const w = i === 0 ? weights[0] : weights[1];
        bumpFamily(n, w);
        if (sinkList) sinkList.push(n);
      });
    };

    const mineCssForFonts = (cssText) => {
      if (!cssText) return;
      // @font-face — the font was deliberately loaded for the brand. Strong signal.
      const faceRe = /@font-face\s*\{([^}]+)\}/gi;
      let fm;
      while ((fm = faceRe.exec(cssText)) !== null) {
        const fam = fm[1].match(/font-family\s*:\s*([^;]+)/i);
        if (fam) {
          let name = cleanFamily(fam[1].split(",")[0]);
          if (!name || looksGeneric(name)) continue;
          name = prettifyFont(name);
          if (!name) continue;
          fontSignals.customFaces.push(name);
          bumpFamily(name, 5);
        }
      }
      // Body / html / :root — strongest signal for body font (resolve var(...) refs here)
      const bodyRe = /(?:^|[\s,}])(?:html|body|:root)\s*[,\s{][^}]*\{([^}]+)\}/gi;
      let bm;
      while ((bm = bodyRe.exec(cssText)) !== null) {
        const fam = bm[1].match(/font-family\s*:\s*([^;]+)/i);
        if (fam) pushFamilyValue(fam[1], [10, 2], fontSignals.bodyFamilies);
      }
      // Headings — strongest signal for heading font
      const headRe = /(?:^|[\s,}])(?:h1|h2|h3|\.h1|\.h2|\.heading|\.display|\.title)\s*[,\s{][^}]*\{([^}]+)\}/gi;
      let hm;
      while ((hm = headRe.exec(cssText)) !== null) {
        const fam = hm[1].match(/font-family\s*:\s*([^;]+)/i);
        if (fam) pushFamilyValue(fam[1], [10, 2], fontSignals.headingFamilies);
      }
      // Any other font-family declaration as background frequency signal
      const ffRe = /font-family\s*:\s*([^;}\n]+)/gi;
      let am;
      while ((am = ffRe.exec(cssText)) !== null) {
        pushFamilyValue(am[1], [3, 1], null);
      }
    };
    mineCssForFonts(inlineStyles);
    for (const css of fetchedCss) mineCssForFonts(css);

    // Compose final font picks — fall back through the layered signals
    const allFontHits = Object.entries(familyFreq).sort((a, b) => b[1] - a[1]).map(([n]) => n);
    const customDedup = dedupe(fontSignals.customFaces);
    const bodyDedup = dedupe(fontSignals.bodyFamilies);
    const headingDedup = dedupe(fontSignals.headingFamilies);
    const googleDedup = dedupe(fontSignals.googleFonts);

    // Heading: explicit heading rule > most-common font (after body) > custom face > google fonts
    // Body: explicit body rule > most-common font > custom face > google fonts
    const body = bodyDedup[0] || allFontHits[0] || customDedup[0] || googleDedup[0] || null;
    const heading = headingDedup[0] || allFontHits.find(f => f !== body) || allFontHits[0] || customDedup[0] || googleDedup[0] || null;

    const fonts = {
      heading,
      body,
      custom: customDedup.slice(0, 4),
      all: allFontHits.slice(0, 8),
      google_fonts: googleDedup.slice(0, 4),
    };

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
      // Prefer the inlined data URL so the UI displays it instantly even if the source blocks hotlinking.
      // If every download attempt failed, fall back to Google's favicon service which the browser can load directly.
      logo_url: logoDataUrl || browserSafeFallback || logo || null,
      logo_remote_url: logo || null,
      logo_content_type: logoContentType,
      logo_source: logoUsedSource || (browserSafeFallback ? "browser-fallback" : null),
      colors,
      primary: colors[0] || null,
      secondary: colors[1] || null,
      accents: colors.slice(2),
      theme_color: themeColor || null,
      fonts,
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
