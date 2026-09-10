export const config = { runtime: "edge" };
const origins = new Set(["https://i7os.com", "https://www.i7os.com"]);
const enc = new TextEncoder();

export default async function handler(req) {
  const origin = req.headers.get("origin");
  const headers = { "Cache-Control": "no-store", "Vary": "Origin" };
  if (!origins.has(origin)) return new Response(null, { status: 403, headers });
  Object.assign(headers, { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
  const reply = status => new Response(null, { status, headers });
  if (req.method === "OPTIONS") return reply(204);
  if (req.method !== "POST") return reply(405);
  if (req.headers.get("dnt") === "1" || req.headers.get("sec-gpc") === "1") return reply(204);
  const ua = req.headers.get("user-agent") || "";
  if (/bot|crawler|spider|headless|preview|lighthouse/i.test(ua)) return reply(204);
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return reply(503);
  try {
    // Bound streamed bodies too: Content-Length is not always present.
    const reader = req.body?.getReader();
    if (!reader) return reply(400);
    let length = 0;
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 2048) { await reader.cancel(); return reply(413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    // Never store query strings, fragments, arbitrary URLs or personal form data.
    const path = typeof body.path === "string" ? body.path.replace(/\.html$/, "").replace(/\/$/, "") || "/" : "";
    if (!/^\/(?:de(?:\/(?:index|pricing|blog|blog-article|privacy|imprint|terms))?|index|pricing|blog|blog-article|privacy|imprint|terms)?$/.test(path)) return reply(400);
    let source = "Direkt / unbekannt";
    if (typeof body.referrer === "string" && body.referrer) {
      const ref = new URL(body.referrer);
      if (!["https:", "http:"].includes(ref.protocol)) return reply(400);
      if (!origins.has(ref.origin)) source = ref.hostname.slice(0, 253);
      else source = "Intern";
    }
    // Vercel overwrites this header. Do not trust client-provided IPs in payloads.
    const ip = (req.headers.get("x-vercel-forwarded-for") || req.headers.get("x-forwarded-for"))?.split(",")[0]?.trim();
    if (!ip) return reply(204); // Local requests are not production traffic.
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const hash = await crypto.subtle.sign("HMAC", key, enc.encode(`i7os-website:${day}:${ip}`));
    const visitor = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
    const countryHeader = req.headers.get("x-vercel-ip-country") || "";
    const country = /^[A-Z]{2}$/.test(countryHeader) ? countryHeader : "ZZ";
    const result = await fetch(`${url}/rest/v1/rpc/record_website_visit`, {
      method: "POST", headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_visitor: visitor, p_path: path === "/index" ? "/" : path === "/de/index" ? "/de" : path, p_country: country, p_source: source }),
    });
    return reply(result.ok ? 204 : 503);
  } catch { return reply(400); }
}
