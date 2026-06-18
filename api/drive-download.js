// Download a Google Drive file's bytes server-side and stream them back same-origin.
// Why: the browser can fetch small Drive files via `alt=media`, but large files
// (e.g. videos) redirect to a googleusercontent.com URL that has no CORS headers,
// so the browser download throws. Fetching here (server-side) avoids CORS entirely.
//
// The target is hard-locked to the Drive API + the provided file id (no arbitrary
// URL → no SSRF). The user's own OAuth token is passed via the x-drive-token header
// and only used to fetch their own file; it is never logged.
//
// Edge runtime → streams large bodies (no 4.5MB serverless cap) and doesn't count
// against the Hobby plan's Serverless Functions limit.
export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("id");
  const token = req.headers.get("x-drive-token") || searchParams.get("token");

  if (!fileId || !token) return new Response("missing id or token", { status: 400 });
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) return new Response("bad file id", { status: 400 });

  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true&acknowledgeAbuse=true`;
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const detail = (await r.text().catch(() => "")).slice(0, 500);
      console.error("[drive-download] drive returned", r.status, "for", fileId, "→", detail);
      return new Response(`drive ${r.status}: ${detail}`, { status: r.status === 401 ? 401 : 502 });
    }
    return new Response(r.body, {
      status: 200,
      headers: {
        "Content-Type": r.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response("fetch failed: " + (e?.message || "unknown"), { status: 502 });
  }
}
