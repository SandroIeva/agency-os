// A public link to one thing inside a workspace. Today that is a moodboard.
//
// The point of this endpoint is that it answers with CONTENT, on a plain GET,
// with no JavaScript. The app's own share route (?b=…) is the SPA: fetched
// without a browser it is 1439 bytes of empty shell, which is nothing for
// anybody who is not a person with a browser. An agent handed such a link
// reads what the server sends and nothing else, so the server has to send the
// board.
//
// Three answers at one address, so nobody has to be told which URL to use:
//   text/html          the page a person opens (and what a chat previews)
//   application/json   the board as data
//   text/markdown      the board as prose, which is what most agents read best
// The JSON is also embedded in the HTML, so an agent that only ever reads the
// html still finds the structure without guessing at it.
//
// Edge runtime: the Hobby plan allows 12 Node functions and all 12 exist.
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const APP = (process.env.PUBLIC_APP_URL || "https://app.i7os.com").replace(/\/$/, "");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// A share link is not a search result. Nothing here should be indexed, and the
// answer must be fetchable from anywhere, which is what an agent needs.
const HEADERS = {
  "x-robots-tag": "noindex, nofollow",
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=60",
  // One address answering three ways is cached by what was ASKED for, not by
  // the address alone. Without this the CDN kept the first answer and handed
  // it to everybody: an agent fetched the json, and the next person to open
  // the link in a browser was served that json as their page. Seen live,
  // x-vercel-cache: HIT, before this line existed.
  "vary": "accept",
};

const notFound = (format) => {
  if (format === "json") {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404, headers: { ...HEADERS, "content-type": "application/json; charset=utf-8" } });
  }
  return new Response(`<!doctype html><meta charset="utf-8"><title>i7OS</title>`
    + `<style>body{margin:0;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;`
    + `background:#111117;color:#e9e9ee;display:flex;align-items:center;justify-content:center;min-height:100vh}`
    + `div{text-align:center;padding:40px}h1{font-size:18px;margin:0 0 8px;letter-spacing:-.2px}`
    + `p{color:#9a9aa6;margin:0;font-size:13px}</style>`
    + `<div><h1>Dieser Link ist nicht mehr gültig</h1>`
    + `<p>This link has been revoked or never existed.</p></div>`,
    { status: 404, headers: { ...HEADERS, "content-type": "text/html; charset=utf-8" } });
};

// What the reader asked for, in the order in which the answers are meant to be
// found: an explicit ?format wins, then the extension, then what the client
// says it accepts. A browser sends text/html first, so people get the page
// without ever seeing a query parameter.
const formatOf = (url, req) => {
  const q = (url.searchParams.get("format") || "").toLowerCase();
  if (q === "json" || q === "md" || q === "markdown" || q === "html") return q === "markdown" ? "md" : q;
  const accept = (req.headers.get("accept") || "").toLowerCase();
  if (accept.includes("application/json")) return "json";
  if (accept.includes("text/markdown")) return "md";
  if (accept.includes("text/html")) return "html";
  // No opinion at all is what a plain fetch or a script sends. Markdown reads
  // as text everywhere, and an agent that asked for nothing gets something it
  // can use rather than a page of style rules.
  return accept.trim() ? "html" : "md";
};

const payloadOf = (share, board, items) => ({
  kind: "moodboard",
  title: board.title || "Moodboard",
  description: board.description || null,
  palette: Array.isArray(board.color_palette) ? board.color_palette : [],
  shared_at: share.created_at,
  updated_at: board.updated_at,
  image_count: items.length,
  // Every url here is publicly readable: moodboard pictures live in the public
  // bucket, which is what makes them worth handing to somebody else at all.
  images: items.map((it, i) => ({
    position: i + 1,
    url: it.url || null,
    name: it.name || null,
    note: it.note || null,
    tags: Array.isArray(it.tags) ? it.tags : [],
    colors: Array.isArray(it.colors) ? it.colors : [],
  })),
  source: "i7OS",
});

const asMarkdown = (p) => {
  const lines = [`# ${p.title}`];
  if (p.description) lines.push("", p.description);
  if (p.palette.length) lines.push("", `**Farben:** ${p.palette.join(", ")}`);
  lines.push("", `**Bilder:** ${p.image_count}`, "");
  for (const im of p.images) {
    const bits = [im.name, im.note, im.tags.length ? `Tags: ${im.tags.join(", ")}` : null,
                  im.colors.length ? `Farben: ${im.colors.join(", ")}` : null].filter(Boolean);
    lines.push(`## ${im.position}. ${im.name || "Bild"}`);
    if (bits.length > 1 || (bits.length === 1 && !im.name)) lines.push(bits.slice(im.name ? 1 : 0).join("  \n"));
    if (im.url) lines.push("", `![](${im.url})`, "", im.url);
    lines.push("");
  }
  lines.push("---", `Moodboard aus i7OS. ${APP}`);
  return lines.join("\n");
};

const asHtml = (p, payload) => {
  const cover = p.images.find(i => i.url)?.url || "";
  const swatch = (c) => `<i style="background:${esc(c)}" title="${esc(c)}"></i>`;
  const card = (im) => `<figure>
      ${im.url ? `<img src="${esc(im.url)}" alt="${esc(im.name || "")}" loading="lazy">` : ""}
      ${im.name || im.note || im.colors.length ? `<figcaption>
        ${im.name ? `<b>${esc(im.name)}</b>` : ""}
        ${im.note ? `<span>${esc(im.note)}</span>` : ""}
        ${im.colors.length ? `<div class="sw">${im.colors.slice(0, 8).map(swatch).join("")}</div>` : ""}
      </figcaption>` : ""}
    </figure>`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="robots" content="noindex,nofollow">
<meta name="description" content="${esc(p.description || `Moodboard mit ${p.image_count} Bildern`)}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:type" content="website">
${cover ? `<meta property="og:image" content="${esc(cover)}">` : ""}
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#111117;color:#e9e9ee;
  font:15px/1.6 'Geist',-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
header{padding:56px 24px 24px;max-width:1100px;margin:0 auto}
h1{font-size:30px;line-height:1.2;letter-spacing:-.5px;margin:0 0 10px;font-weight:600}
p.desc{margin:0;color:#a4a4b0;max-width:62ch}
.meta{margin-top:18px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:#7d7d8a;font-size:13px}
.sw{display:flex;gap:5px}
.sw i{width:16px;height:16px;border-radius:5px;display:block;border:1px solid rgba(255,255,255,.14)}
main{max-width:1100px;margin:0 auto;padding:8px 24px 64px;
  display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}
figure{margin:0;background:#181820;border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden}
figure img{display:block;width:100%;height:auto}
figcaption{padding:12px 14px;font-size:13px;color:#a4a4b0;display:flex;flex-direction:column;gap:6px}
figcaption b{color:#e9e9ee;font-weight:500}
footer{max-width:1100px;margin:0 auto;padding:0 24px 64px;color:#6c6c78;font-size:12.5px}
footer a{color:#9a9aa6}
@media(max-width:560px){header{padding-top:36px}h1{font-size:24px}}
</style></head><body>
<header>
  <h1>${esc(p.title)}</h1>
  ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ""}
  <div class="meta"><span>${p.image_count} ${p.image_count === 1 ? "Bild" : "Bilder"}</span>
  ${p.palette.length ? `<div class="sw">${p.palette.slice(0, 10).map(swatch).join("")}</div>` : ""}</div>
</header>
<main>${p.images.map(card).join("")}</main>
<footer>Moodboard aus <a href="${APP}">i7OS</a>.
Als Daten: <a href="?format=json">JSON</a>, <a href="?format=md">Markdown</a>.</footer>
<script type="application/json" id="i7os-share">${payload.replace(/</g, "\\u003c")}</script>
</body></html>`;
};

export default async function handler(req) {
  const url = new URL(req.url);
  // The rewrite in vercel.json turns /s/<token> into ?t=<token>. A bare
  // ?t= works too, which is what makes this testable without the rewrite.
  let token = (url.searchParams.get("t") || "").trim();
  let format = formatOf(url, req);
  // "/s/<token>.json" is the shape people try first when they want data.
  const dotted = /\.(json|md)$/i.exec(token);
  if (dotted) { token = token.slice(0, -dotted[0].length); format = dotted[1].toLowerCase(); }
  if (!token || !/^[A-Za-z0-9_-]{4,64}$/.test(token)) return notFound(format);

  const supaUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!supaUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "not_configured" }), {
      status: 503, headers: { ...HEADERS, "content-type": "application/json; charset=utf-8" } });
  }
  const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  const { data: share } = await db.from("public_shares")
    .select("token, kind, target_id, org_id, created_at, revoked_at")
    .eq("token", token).maybeSingle();
  // A revoked link and a link that never existed answer the same way. Which of
  // the two it is, is nobody's business who holds neither.
  if (!share || share.revoked_at || share.kind !== "moodboard") return notFound(format);

  const { data: board } = await db.from("moodboards")
    .select("id, title, description, color_palette, updated_at, archived, org_id")
    .eq("id", share.target_id).maybeSingle();
  if (!board || board.archived || board.org_id !== share.org_id) return notFound(format);

  const { data: items } = await db.from("moodboard_items")
    .select("url, name, note, tags, colors, position, type")
    .eq("board_id", board.id).eq("type", "image")
    .order("position", { ascending: true });

  // Counting a view is not worth making anybody wait for.
  db.rpc("public_share_viewed", { p_token: token }).then(() => {}, () => {});

  const p = payloadOf(share, board, items || []);
  const json = JSON.stringify(p);
  if (format === "json") {
    return new Response(json, { headers: { ...HEADERS, "content-type": "application/json; charset=utf-8" } });
  }
  if (format === "md") {
    return new Response(asMarkdown(p), { headers: { ...HEADERS, "content-type": "text/markdown; charset=utf-8" } });
  }
  return new Response(asHtml(p, json), { headers: { ...HEADERS, "content-type": "text/html; charset=utf-8" } });
}
