// Image proxy: many external image hosts don't send CORS headers, so the browser
// can't read their pixels (needed to embed images into a client-side PDF export).
// We fetch the image server-side and re-serve it same-origin with CORS allowed.
//
// Edge runtime → does NOT count against the Hobby plan's 12 Serverless Functions.
export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  if (!target) return new Response("missing url", { status: 400 });

  let u;
  try { u = new URL(target); } catch { return new Response("bad url", { status: 400 }); }
  // Only allow public http(s); block localhost / private hosts (basic SSRF guard).
  if (u.protocol !== "http:" && u.protocol !== "https:") return new Response("bad protocol", { status: 400 });
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1"
    || /^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.endsWith(".internal")) {
    return new Response("forbidden host", { status: 403 });
  }

  try {
    const r = await fetch(u.toString(), { headers: { "User-Agent": "Mozilla/5.0 (compatible; i7OS/1.0)" }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return new Response("upstream " + r.status, { status: 502 });
    const ct = r.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return new Response("not an image", { status: 415 });
    const buf = await r.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (_) {
    return new Response("fetch failed", { status: 502 });
  }
}
