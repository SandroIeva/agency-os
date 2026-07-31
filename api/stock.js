// Stock photo search, proxied so the provider's API key never reaches the
// browser. Replaces the earlier Pexels-only version.
//
// Providers are adapters behind one normalised response, so switching or adding
// a source is a new adapter plus an env var — not a rewrite of the picker. That
// mattered here: Pexels allows 200 requests/hour, Pixabay 6,000, and Unsplash
// 5,000 after approval, so the sensible choice may well change again.
//
// Edge runtime → does NOT count against the Hobby 12-function Node limit, which
// is already full.
//
// The picked image is NOT hotlinked. Pixabay forbids permanent hotlinking, and
// copying the file into the workspace's own storage also keeps a moodboard
// intact if the image later disappears upstream. The copy runs on the client
// through /api/img-proxy so it reuses the existing quota check and storage
// ledger instead of reimplementing them here.
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const cache = new Map(); // key → { at, ttl, body }

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

// ── Providers ───────────────────────────────────────────────────────────────
// Each returns { url, headers, parse } so the handler stays provider-agnostic.
const PROVIDERS = {
  pixabay: {
    envKey: "PIXABAY_API_KEY",
    // Pixabay's terms require responses to be cached for 24 hours.
    cacheTtlMs: 24 * 60 * 60 * 1000,
    build(key, { query, page, perPage, orientation }) {
      const p = new URLSearchParams({
        key,
        image_type: "photo",
        safesearch: "true",
        per_page: String(perPage),
        page: String(page),
      });
      if (query) p.set("q", query);
      else p.set("order", "popular");
      if (orientation === "landscape") p.set("orientation", "horizontal");
      if (orientation === "portrait") p.set("orientation", "vertical");
      return { url: `https://pixabay.com/api/?${p}`, headers: {} };
    },
    parse(data) {
      return (data.hits || []).map(h => ({
        id: h.id,
        // webformatURL is 640px — right for a grid thumbnail.
        thumb: h.webformatURL || h.previewURL,
        // largeImageURL is 1280px and typically 200–500 KB. Deliberately not the
        // original: this file gets copied into the user's storage quota, and a
        // 4000px original would burn it for no visible gain on a moodboard.
        full: h.largeImageURL || h.webformatURL,
        width: h.imageWidth,
        height: h.imageHeight,
        alt: h.tags || "",
        avgColor: null,
        photographer: h.user,
        photographerUrl: h.pageURL,
        pageUrl: h.pageURL,
      }));
    },
    hasMore(data, page, perPage) {
      return (data.totalHits || 0) > page * perPage;
    },
  },

  pexels: {
    envKey: "PEXELS_API_KEY",
    cacheTtlMs: 5 * 60 * 1000,
    build(key, { query, page, perPage, orientation }) {
      const p = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      if (query) p.set("query", query);
      if (orientation) p.set("orientation", orientation);
      return {
        url: query ? `https://api.pexels.com/v1/search?${p}` : `https://api.pexels.com/v1/curated?${p}`,
        headers: { Authorization: key },
      };
    },
    parse(data) {
      return (data.photos || []).map(p => ({
        id: p.id,
        thumb: p.src?.medium || p.src?.small,
        full: p.src?.large2x || p.src?.large || p.src?.original,
        width: p.width,
        height: p.height,
        alt: p.alt || "",
        avgColor: p.avg_color || null,
        photographer: p.photographer,
        photographerUrl: p.photographer_url,
        pageUrl: p.url,
      }));
    },
    hasMore(data) { return Boolean(data.next_page); },
  },
};

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const name = (process.env.STOCK_PROVIDER || "pixabay").toLowerCase();
  const provider = PROVIDERS[name];
  if (!provider) return json({ error: `Unknown stock provider "${name}"`, code: "not_configured" }, 503);

  const key = process.env[provider.envKey];
  if (!key) return json({ error: "Stock search is not configured", code: "not_configured" }, 503);

  const supaUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supaUrl || !anonKey) return json({ error: "Server not configured" }, 503);

  // A session is required: without it this is an open relay and a stranger
  // could burn the shared hourly quota.
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json({ error: "Authentication required", code: "unauthorized" }, 401);
  const authClient = createClient(supaUrl, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Invalid session", code: "unauthorized" }, 401);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  const query = String(body.query || "").trim().slice(0, 100);
  const page = Math.min(50, Math.max(1, Number(body.page) || 1));
  const perPage = Math.min(40, Math.max(3, Number(body.perPage) || 24));
  const orientation = ["landscape", "portrait", "square"].includes(body.orientation) ? body.orientation : "";

  const { url, headers } = provider.build(key, { query, page, perPage, orientation });

  const cacheKey = `${name}|${url}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < hit.ttl) return json({ ...hit.body, cached: true });

  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
  } catch (e) {
    return json({ error: "Stock provider unreachable", detail: e?.message }, 502);
  }

  if (res.status === 429) {
    return json({ error: "Rate limit reached, please try again shortly", code: "rate_limited" }, 429);
  }
  if (!res.ok) return json({ error: `Provider returned ${res.status}`, code: "upstream_error" }, 502);

  const data = await res.json().catch(() => null);
  if (!data) return json({ error: "Unreadable provider response" }, 502);

  const payload = {
    provider: name,
    items: provider.parse(data).filter(i => i.thumb && i.full),
    page,
    hasMore: provider.hasMore(data, page, perPage),
  };

  cache.set(cacheKey, { at: Date.now(), ttl: provider.cacheTtlMs, body: payload });
  if (cache.size > 200) {
    for (const k of [...cache.keys()].slice(0, 60)) cache.delete(k);
  }

  return json(payload);
}
