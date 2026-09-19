// A document's stored BlockNote blocks as a public page (HTML) and as
// Markdown, for the public link (api/share, kind "document").
//
// Dependency-free: it runs on the edge. Tested against the shipped code by
// scripts/test-doc-render.mjs.
//
// Everything that came from a document is escaped. A link survives only as
// http(s) or mailto, a picture or a video only as http(s): the page is served
// from our own domain, and a "javascript:" href in a shared document would be
// script running there.

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const safeHref = (u) => {
  const s = String(u || "").trim();
  return /^(https?:\/\/|mailto:)/i.test(s) ? s : null;
};
const safeSrc = (u) => {
  const s = String(u || "").trim();
  return /^https?:\/\//i.test(s) ? s : null;
};

// BlockNote's named colours, as the editor shows them in light mode. These are
// the document's own colours, content rather than chrome, so all of them stay.
const TEXT = { gray: "#787774", brown: "#9f6b53", red: "#d44c47", orange: "#d9730d", yellow: "#cb912f", green: "#448361", blue: "#337ea9", purple: "#9065b0", pink: "#c14c8a" };
const BG = { gray: "#f1f1ef", brown: "#f4eeee", red: "#fdebec", orange: "#fbecdd", yellow: "#fbf3db", green: "#edf3ec", blue: "#e7f3f8", purple: "#f6f3f9", pink: "#faf1f5" };

export function inlineText(content) {
  if (typeof content === "string") return content;
  return (content || []).map(c => {
    if (typeof c === "string") return c;
    if (c?.type === "link") return inlineText(c.content);
    return c?.text || "";
  }).join("");
}

export function inlineHtml(content) {
  if (typeof content === "string") return esc(content);
  return (content || []).map(c => {
    if (typeof c === "string") return esc(c);
    if (c?.type === "link") {
      const inner = inlineHtml(c.content);
      const href = safeHref(c.href);
      return href ? `<a href="${esc(href)}" target="_blank" rel="noopener nofollow">${inner}</a>` : inner;
    }
    let t = esc(c?.text || "").replace(/\n/g, "<br>");
    const s = c?.styles || {};
    if (s.code) t = `<code>${t}</code>`;
    if (s.bold) t = `<strong>${t}</strong>`;
    if (s.italic) t = `<em>${t}</em>`;
    if (s.underline) t = `<u>${t}</u>`;
    if (s.strike) t = `<s>${t}</s>`;
    const col = TEXT[s.textColor];
    const bg = BG[s.backgroundColor];
    if (col || bg) t = `<span style="${col ? `color:${col};` : ""}${bg ? `background:${bg};border-radius:3px;padding:0 2px;` : ""}">${t}</span>`;
    return t;
  }).join("");
}

// A block's own alignment and colours, as an inline style attribute.
function blockStyle(p = {}) {
  const bits = [];
  if (p.textAlignment && p.textAlignment !== "left" && /^(center|right|justify)$/.test(p.textAlignment)) bits.push(`text-align:${p.textAlignment}`);
  if (TEXT[p.textColor]) bits.push(`color:${TEXT[p.textColor]}`);
  if (BG[p.backgroundColor]) bits.push(`background:${BG[p.backgroundColor]};border-radius:6px;padding:2px 6px`);
  return bits.length ? ` style="${bits.join(";")}"` : "";
}

const ytId = (u) => {
  const m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,15})/.exec(String(u || ""));
  return m ? m[1] : null;
};

function tableHtml(content) {
  const rows = Array.isArray(content?.rows) ? content.rows : [];
  if (!rows.length) return "";
  const cell = (c) => inlineHtml(Array.isArray(c) ? c : (c?.content || []));
  const body = rows.map(r => `<tr>${(r.cells || []).map(c => `<td>${cell(c)}</td>`).join("")}</tr>`).join("");
  return `<div class="tbl"><table><tbody>${body}</tbody></table></div>`;
}

function blockHtml(b) {
  const p = b.props || {};
  const kids = Array.isArray(b.children) && b.children.length ? `<div class="nest">${docBlocksToHtml(b.children)}</div>` : "";
  switch (b.type) {
    case "paragraph": {
      const inner = inlineHtml(b.content);
      return (inner ? `<p${blockStyle(p)}>${inner}</p>` : `<p class="gap"></p>`) + kids;
    }
    case "heading": {
      // The document's title is the page's h1, so its headings start one below.
      const lv = Math.min(4, Math.max(2, (Number(p.level) || 1) + 1));
      return `<h${lv}${blockStyle(p)}>${inlineHtml(b.content)}</h${lv}>${kids}`;
    }
    case "quote": return `<blockquote${blockStyle(p)}>${inlineHtml(b.content)}</blockquote>${kids}`;
    case "codeBlock": return `<pre><code>${esc(inlineText(b.content))}</code></pre>${kids}`;
    case "divider": return "<hr>";
    case "image": {
      const src = safeSrc(p.url);
      if (!src) return kids;
      const cap = p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : "";
      return `<figure><img src="${esc(src)}" alt="${esc(p.caption || p.name || "")}" loading="lazy">${cap}</figure>${kids}`;
    }
    case "video": {
      const src = safeSrc(p.url);
      if (!src) return kids;
      const cap = p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : "";
      return `<figure><video src="${esc(src)}" controls preload="metadata" playsinline></video>${cap}</figure>${kids}`;
    }
    case "youtube": {
      const id = ytId(p.url);
      if (!id) return kids;
      return `<figure class="yt"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}" title="YouTube" loading="lazy" allowfullscreen `
        + `allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"></iframe></figure>${kids}`;
    }
    case "audio":
    case "file": {
      const href = safeSrc(p.url);
      const name = p.name || p.caption || href || "";
      return href ? `<p><a href="${esc(href)}" target="_blank" rel="noopener nofollow">${esc(name)}</a></p>${kids}` : kids;
    }
    case "table": return tableHtml(b.content) + kids;
    default: {
      const inner = Array.isArray(b.content) ? inlineHtml(b.content) : "";
      return (inner ? `<p${blockStyle(p)}>${inner}</p>` : "") + kids;
    }
  }
}

const LIST = { bulletListItem: "ul", numberedListItem: "ol", checkListItem: "ul" };

// Consecutive list items are ONE list, as they read in the editor.
export function docBlocksToHtml(blocks) {
  const arr = Array.isArray(blocks) ? blocks : [];
  let html = "";
  let i = 0;
  while (i < arr.length) {
    const b = arr[i];
    const tag = LIST[b?.type];
    if (tag) {
      const type = b.type;
      const start = type === "numberedListItem" && Number(b.props?.start) > 1 ? ` start="${Number(b.props.start)}"` : "";
      let items = "";
      while (i < arr.length && arr[i]?.type === type) {
        const x = arr[i];
        const nested = Array.isArray(x.children) && x.children.length ? docBlocksToHtml(x.children) : "";
        if (type === "checkListItem") {
          const done = !!x.props?.checked;
          items += `<li class="${done ? "done" : ""}"><span class="box">${done ? "&#10003;" : ""}</span><span>${inlineHtml(x.content)}</span>${nested}</li>`;
        } else {
          items += `<li${blockStyle(x.props)}>${inlineHtml(x.content)}${nested}</li>`;
        }
        i++;
      }
      html += `<${tag}${type === "checkListItem" ? ' class="check"' : ""}${start}>${items}</${tag}>`;
      continue;
    }
    if (b && typeof b === "object") html += blockHtml(b);
    i++;
  }
  return html;
}

// The same document as Markdown, for agents and for ?format=md.
export function docBlocksToMarkdown(blocks) {
  const out = [];
  const md = (content) => (typeof content === "string" ? content : (content || []).map(c => {
    if (typeof c === "string") return c;
    if (c?.type === "link") { const h = safeHref(c.href); const t = md(c.content); return h ? `[${t}](${h})` : t; }
    let t = c?.text || ""; const s = c?.styles || {};
    if (!t) return "";
    if (s.code) t = "`" + t + "`";
    if (s.bold) t = "**" + t + "**";
    if (s.italic) t = "*" + t + "*";
    if (s.strike) t = "~~" + t + "~~";
    return t;
  }).join(""));
  const walk = (arr, depth) => (arr || []).forEach(b => {
    const pad = "  ".repeat(depth);
    const p = b?.props || {};
    switch (b?.type) {
      case "heading": out.push("#".repeat(Math.min(6, Number(p.level) || 1) + 1) + " " + md(b.content)); break;
      case "bulletListItem": out.push(pad + "- " + md(b.content)); break;
      case "numberedListItem": out.push(pad + "1. " + md(b.content)); break;
      case "checkListItem": out.push(pad + "- [" + (p.checked ? "x" : " ") + "] " + md(b.content)); break;
      case "quote": out.push("> " + md(b.content)); break;
      case "codeBlock": out.push("```" + (p.language || "") + "\n" + inlineText(b.content) + "\n```"); break;
      case "divider": out.push("---"); break;
      case "image": if (safeSrc(p.url)) out.push(`![${p.caption || ""}](${safeSrc(p.url)})`); break;
      case "video": case "audio": case "file": if (safeSrc(p.url)) out.push(`[${p.name || p.caption || p.url}](${safeSrc(p.url)})`); break;
      case "youtube": if (ytId(p.url)) out.push(`https://www.youtube.com/watch?v=${ytId(p.url)}`); break;
      case "table": {
        const rows = Array.isArray(b.content?.rows) ? b.content.rows : [];
        rows.forEach((r, ri) => {
          const cells = (r.cells || []).map(c => md(Array.isArray(c) ? c : (c?.content || [])).replace(/\|/g, "\\|"));
          out.push("| " + cells.join(" | ") + " |");
          if (ri === 0) out.push("|" + cells.map(() => " --- ").join("|") + "|");
        });
        break;
      }
      default: { const t = md(b?.content); if (t) out.push(pad + t); }
    }
    if (Array.isArray(b?.children) && b.children.length) walk(b.children, depth + 1);
  });
  walk(Array.isArray(blocks) ? blocks : [], 0);
  return out.join("\n\n");
}

// The first sentence-ish of a document, for a link preview.
export function docSummary(blocks, max = 180) {
  const parts = [];
  const walk = (arr) => (arr || []).forEach(b => {
    if (parts.join(" ").length > max) return;
    if (b?.type !== "heading" && b?.type !== "codeBlock") { const t = inlineText(b?.content).trim(); if (t) parts.push(t); }
    if (Array.isArray(b?.children)) walk(b.children);
  });
  walk(Array.isArray(blocks) ? blocks : []);
  const s = parts.join(" ").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export function docBlocksFromContent(content) {
  if (!content) return [];
  if (Array.isArray(content)) return content;
  try { const p = JSON.parse(content); return Array.isArray(p) ? p : []; } catch { return []; }
}

// ── Documents ──────────────────────────────────────────────────────────────
// A light page to read, like the document itself, not the dark gallery the
// moodboard gets. Its words (the date line, the footer) follow the reader's
// browser language; the document is shown as it was written.
const docPayload = (share, doc, blocks) => ({
  kind: "document",
  title: doc.title || "",
  format: doc.kind === "pdf" ? "pdf" : "text",
  shared_at: share.created_at,
  updated_at: doc.updated_at,
  file_url: doc.kind === "pdf" ? (doc.file_url || null) : undefined,
  markdown: doc.kind === "pdf" ? undefined : docBlocksToMarkdown(blocks),
  blocks: doc.kind === "pdf" ? undefined : blocks,
  source: "i7OS",
});

const docMarkdown = (p, app) => {
  const head = `# ${p.title || "Dokument"}`;
  const body = p.format === "pdf" ? (p.file_url ? `[PDF](${p.file_url})` : "") : (p.markdown || "");
  return [head, "", body, "", "---", `Dokument aus i7OS. ${app}`].join("\n");
};

const docHtml = (p, payload, blocks, de, app) => {
  const title = p.title || (de ? "Unbenanntes Dokument" : "Untitled document");
  const when = (() => { try { return new Date(p.updated_at).toLocaleDateString(de ? "de-DE" : "en-GB", { day: "numeric", month: "long", year: "numeric" }); } catch { return ""; } })();
  const cover = (blocks.find(b => b?.type === "image" && /^https?:\/\//i.test(b.props?.url || "")) || {}).props?.url || "";
  const summary = p.format === "pdf" ? "" : docSummary(blocks);
  const body = p.format === "pdf"
    ? (p.file_url && /^https?:\/\//i.test(p.file_url)
        ? `<iframe class="pdf" src="${esc(p.file_url)}" title="${esc(title)}"></iframe>
           <p><a href="${esc(p.file_url)}" target="_blank" rel="noopener">${de ? "PDF in neuem Tab öffnen" : "Open the PDF in a new tab"}</a></p>`
        : "")
    : docBlocksToHtml(blocks);
  return `<!doctype html><html lang="${de ? "de" : "en"}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="robots" content="noindex,nofollow">
${summary ? `<meta name="description" content="${esc(summary)}">` : ""}
<meta property="og:title" content="${esc(title)}">
<meta property="og:type" content="article">
${summary ? `<meta property="og:description" content="${esc(summary)}">` : ""}
${cover ? `<meta property="og:image" content="${esc(cover)}">` : ""}
<style>
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#1d1d24;font:16px/1.7 'Geist',-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.wrap{max-width:720px;margin:0 auto;padding:64px 24px 40px}
h1{font-size:36px;line-height:1.2;letter-spacing:-.6px;margin:0 0 10px;font-weight:650}
.meta{color:#8a8a94;font-size:13px;margin:0 0 36px}
h2{font-size:26px;line-height:1.3;letter-spacing:-.3px;margin:34px 0 10px;font-weight:620}
h3{font-size:21px;line-height:1.35;margin:28px 0 8px;font-weight:620}
h4{font-size:17.5px;line-height:1.4;margin:22px 0 6px;font-weight:620}
p{margin:0 0 10px}p.gap{height:12px;margin:0}
ul,ol{padding-left:24px;margin:0 0 10px}li{margin:3px 0}
ul.check{list-style:none;padding-left:2px}
ul.check li{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}
ul.check li>ul,ul.check li>ol{flex-basis:100%;margin-left:26px}
.box{width:16px;height:16px;border:1.5px solid #c9c9d1;border-radius:4px;flex-shrink:0;margin-top:5px;display:flex;align-items:center;justify-content:center;font-size:11px;line-height:1;color:#fff}
li.done .box{background:#15151c;border-color:#15151c}
li.done>span:nth-child(2){color:#8a8a94;text-decoration:line-through}
blockquote{margin:14px 0;padding:2px 0 2px 16px;border-left:3px solid #15151c;color:#44444c}
pre{background:#f5f5f7;border-radius:10px;padding:14px 16px;overflow:auto;margin:14px 0}
code{font:13.5px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;background:#f1f1f3;border-radius:5px;padding:1px 5px}
pre code{background:none;padding:0}
hr{border:0;border-top:1px solid #e6e6ea;margin:28px 0}
figure{margin:22px 0}figure img,figure video{max-width:100%;height:auto;border-radius:12px;display:block}
figcaption{font-size:13px;color:#8a8a94;margin-top:8px}
.yt{position:relative;padding-top:56.25%;margin:22px 0}.yt iframe{position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:12px}
.tbl{overflow-x:auto;margin:14px 0}table{border-collapse:collapse;min-width:100%}
td{border:1px solid #e6e6ea;padding:8px 12px;vertical-align:top;font-size:14.5px}
a{color:#15151c;text-decoration:underline;text-underline-offset:2px}
.nest{padding-left:24px}
iframe.pdf{width:100%;height:80vh;border:1px solid #e6e6ea;border-radius:12px;margin:0 0 12px}
footer{max-width:720px;margin:0 auto;padding:22px 24px 64px;color:#9a9aa4;font-size:12.5px;border-top:1px solid #f0f0f2}
footer a{color:#6a6a74}
@media(max-width:560px){.wrap{padding-top:36px}h1{font-size:28px}}
</style></head><body>
<article class="wrap">
  <h1>${esc(title)}</h1>
  ${when ? `<p class="meta">${de ? "Aktualisiert am" : "Updated"} ${esc(when)}</p>` : ""}
  ${body}
</article>
<footer>${de ? "Erstellt mit" : "Made with"} <a href="${app}">i7OS</a>.
${de ? "Als Daten" : "As data"}: <a href="?format=json">JSON</a>, <a href="?format=md">Markdown</a>.</footer>
<script type="application/json" id="i7os-share">${payload.replace(/</g, "\\u003c")}</script>
</body></html>`;
};

// The whole public answer for one document: the page, the Markdown and the
// JSON, from the row and its parsed blocks.
export function docSharePage({ share, doc, blocks, de, app }) {
  const p = docPayload(share, doc, blocks);
  const json = JSON.stringify(p);
  return { json, md: docMarkdown(p, app), html: docHtml(p, json, blocks, de, app) };
}
