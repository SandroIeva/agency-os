// Image proxy: many external image hosts don't send CORS headers, so the browser
// can't read their pixels (needed to embed images into a client-side PDF export).
// We fetch the image server-side and re-serve it same-origin with CORS allowed.
//
// Edge runtime → does NOT count against the Hobby plan's 12 Serverless Functions.
import { assertPublicUrl, BlockedUrlError, readCapped, safeFetch } from "../server/safeUrl.js";

export const config = { runtime: "edge" };

// SVG is an image and also a document that can run script. Serving one back
// under our own domain means that script runs in the app's origin, with the
// app's storage and the app's session, as soon as somebody opens the proxy URL
// directly. The PDF export needs pixels, so the raster formats are what this
// exists for and SVG is refused rather than half-cleaned: sanitising SVG
// properly needs a parser that does not run here, and "probably clean" is not
// a thing to serve same-origin.
const ALLOWED_TYPES = new Set([
  "image/png", "image/jpeg", "image/jpg", "image/webp",
  "image/gif", "image/avif", "image/bmp", "image/x-icon", "image/vnd.microsoft.icon",
]);

const MAX_BYTES = 12 * 1024 * 1024;

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  if (!target) return new Response("missing url", { status: 400 });

  // One shared guard rather than this file's own idea of a private address.
  // The old one blocked 127.0.0.1 but not 127.0.0.2, compared the hostname
  // against "::1" when URL.hostname answers "[::1]", and let fetch follow
  // redirects without looking at where they went.
  try { assertPublicUrl(target); }
  catch (e) { return new Response(e instanceof BlockedUrlError ? e.message : "bad url", { status: 400 }); }

  try {
    const { res } = await safeFetch(target, { maxBytes: MAX_BYTES, timeoutMs: 12000 });
    if (!res.ok) return new Response("upstream " + res.status, { status: 502 });

    const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(ct)) {
      return new Response(ct === "image/svg+xml" ? "svg is not proxied" : "not a supported image", { status: 415 });
    }

    const bytes = await readCapped(res, MAX_BYTES);
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
        // Belt and braces on top of the allow-list. nosniff stops a browser
        // deciding for itself that these bytes are really HTML, and the policy
        // leaves nothing for a document to do if one ever gets through.
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (e) {
    if (e instanceof BlockedUrlError) return new Response(e.message, { status: 400 });
    return new Response("fetch failed", { status: 502 });
  }
}
