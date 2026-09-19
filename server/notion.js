// Notion blocks as the HTML BlockNote reads back. Shared by api/notion.js and
// scripts/test-notion-html.mjs, so the conversion is tested against the code
// that ships. Dependency-free: it runs on the edge.

export const plain = (rt) => (rt || []).map(t => t?.plain_text || "").join("");

export function pageTitle(p) {
  const props = p?.properties || {};
  for (const k of Object.keys(props)) {
    if (props[k]?.type === "title") return plain(props[k].title).trim();
  }
  return "";
}

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Notion's rich text as the HTML BlockNote reads back: bold, italic, strike,
// underline, inline code and links. Links that point inside Notion are
// relative ("/abc…") and would point nowhere here, so only http(s) survives.
export function rich(rt) {
  return (rt || []).map(t => {
    let s = esc(t?.plain_text || "").replace(/\n/g, "<br>");
    const a = t?.annotations || {};
    if (a.code) s = `<code>${s}</code>`;
    if (a.bold) s = `<strong>${s}</strong>`;
    if (a.italic) s = `<em>${s}</em>`;
    if (a.strikethrough) s = `<s>${s}</s>`;
    if (a.underline) s = `<u>${s}</u>`;
    const href = t?.href || t?.text?.link?.url;
    if (href && /^https?:\/\//i.test(href)) s = `<a href="${esc(href)}">${s}</a>`;
    return s;
  }).join("");
}

// A file Notion hosts itself comes with a signed url that expires within the
// hour. Images are copied into our storage by the browser on import, so they
// may keep it; a LINK to such a file would be dead by tomorrow, so files,
// videos and PDFs hosted by Notion leave only their name behind.
const fileUrl = (d) => (d?.type === "external" ? d.external?.url : d?.type === "file" ? d.file?.url : null) || d?.url || null;

function blockHtml(b) {
  const d = b[b.type] || {};
  const kids = b._children ? blocksToHtml(b._children) : "";
  switch (b.type) {
    case "paragraph": return `<p>${rich(d.rich_text)}</p>${kids}`;
    case "heading_1": return `<h1>${rich(d.rich_text)}</h1>${kids}`;
    case "heading_2": return `<h2>${rich(d.rich_text)}</h2>${kids}`;
    case "heading_3":
    case "heading_4": return `<h3>${rich(d.rich_text)}</h3>${kids}`;
    case "quote": return `<blockquote>${rich(d.rich_text)}</blockquote>${kids}`;
    case "callout": {
      const mark = d.icon?.type === "emoji" ? `${esc(d.icon.emoji)} ` : "";
      return `<p>${mark}${rich(d.rich_text)}</p>${kids}`;
    }
    case "toggle": return `<p>${rich(d.rich_text)}</p>${kids}`;
    case "code": return `<pre><code>${esc(plain(d.rich_text))}</code></pre>`;
    case "equation": return `<p>${esc(d.expression || "")}</p>`;
    case "divider": return "<hr>";
    case "image": {
      const src = fileUrl(d);
      const cap = plain(d.caption);
      return src ? `<img src="${esc(src)}" alt="${esc(cap)}">${cap ? `<p>${esc(cap)}</p>` : ""}` : "";
    }
    case "bookmark":
    case "embed":
    case "link_preview": {
      const u = d.url;
      const cap = plain(d.caption);
      return u && /^https?:\/\//i.test(u) ? `<p><a href="${esc(u)}">${esc(cap || u)}</a></p>` : "";
    }
    case "video":
    case "audio":
    case "file":
    case "pdf": {
      const cap = plain(d.caption) || d.name || "";
      const u = d.type === "external" ? d.external?.url : null;
      if (u && /^https?:\/\//i.test(u)) return `<p><a href="${esc(u)}">${esc(cap || u)}</a></p>`;
      return cap ? `<p>${esc(cap)}</p>` : "";
    }
    case "child_page":
    case "child_database": return d.title ? `<p><strong>${esc(d.title)}</strong></p>` : "";
    case "table": {
      const rows = (b._children || []).filter(r => r.type === "table_row");
      if (!rows.length) return "";
      const body = rows.map(r => `<tr>${(r.table_row?.cells || []).map(c => `<td>${rich(c)}</td>`).join("")}</tr>`).join("");
      return `<table><tbody>${body}</tbody></table>`;
    }
    case "column_list":
    case "column":
    case "synced_block":
    case "template": return kids;
    case "table_of_contents":
    case "breadcrumb":
    case "meeting_notes":
    case "unsupported": return "";
    default: return d.rich_text ? `<p>${rich(d.rich_text)}</p>${kids}` : kids;
  }
}

// Consecutive list items become ONE list, the way they read in Notion; one
// <ul> per item would come back as a stack of separate lists.
export function blocksToHtml(blocks) {
  let html = "";
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === "bulleted_list_item" || b.type === "numbered_list_item" || b.type === "to_do") {
      const tag = b.type === "numbered_list_item" ? "ol" : "ul";
      let items = "";
      while (i < blocks.length && blocks[i].type === b.type) {
        const x = blocks[i];
        const d = x[x.type] || {};
        const box = x.type === "to_do" ? `<input type="checkbox"${d.checked ? " checked" : ""}>` : "";
        items += `<li>${box}${rich(d.rich_text)}${x._children ? blocksToHtml(x._children) : ""}</li>`;
        i++;
      }
      html += `<${tag}>${items}</${tag}>`;
      continue;
    }
    html += blockHtml(b);
    i++;
  }
  return html;
}
