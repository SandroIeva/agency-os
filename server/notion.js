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

// The picker's tree, built from what `mode: "tree"` returns: pages and
// databases, each with its parent. Used by the browser (NotionImportModal) and
// by scripts/test-notion-html.mjs.
//
// Where a parent is not in the list (a page under something that was not
// shared, or under a block such as a column), the item goes to the top, the
// same place Notion's own sidebar would show a page shared on its own.
export function notionTree(items) {
  const byId = new Map();
  const dbByDatabaseId = new Map();
  for (const it of items || []) {
    if (!it?.id || byId.has(it.id)) continue;
    byId.set(it.id, { ...it, children: [], parentId: null });
    if (it.kind === "db" && it.databaseId) dbByDatabaseId.set(it.databaseId, it.id);
  }
  const parentOf = (n) => {
    const p = n.parent;
    if (!p || !p.id) return null;
    if (p.type === "page_id") return byId.has(p.id) ? p.id : null;
    if (p.type === "data_source_id") return byId.has(p.id) ? p.id : (p.databaseId && dbByDatabaseId.get(p.databaseId)) || null;
    if (p.type === "database_id") return dbByDatabaseId.get(p.id) || (byId.has(p.id) ? p.id : null);
    return null; // workspace, block, agent
  };
  const roots = [];
  for (const n of byId.values()) {
    const pid = parentOf(n);
    // A parent chain that loops back on itself cannot happen in Notion; this
    // only keeps a malformed answer from hanging the page.
    let loop = false;
    for (let q = pid, guard = 0; q && guard < 50; guard++) {
      if (q === n.id) { loop = true; break; }
      const up = byId.get(q);
      q = up ? parentOf(up) : null;
    }
    if (pid && !loop) { n.parentId = pid; byId.get(pid).children.push(n); }
    else roots.push(n);
  }
  const byTitle = (a, b) => (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" });
  const byNewest = (a, b) => String(b.lastEdited || "").localeCompare(String(a.lastEdited || ""));
  const sortAll = (arr, parent) => {
    // A database's entries newest first (meeting notes, projects); everything
    // else alphabetically, pages before databases, as a sidebar reads.
    if (parent?.kind === "db") arr.sort(byNewest);
    else arr.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "db" ? 1 : -1) || byTitle(a, b));
    for (const x of arr) sortAll(x.children, x);
  };
  sortAll(roots, null);
  return { roots, byId };
}

// The titles above an item, top first, for showing where a search hit lives.
export function notionPath(byId, id) {
  const out = [];
  let n = byId.get(id);
  for (let guard = 0; n && n.parentId && guard < 50; guard++) {
    n = byId.get(n.parentId);
    if (n) out.unshift(n.title || "");
  }
  return out;
}

// ── Tasks from a Notion database ────────────────────────────────────────────
// Which of a database's fields mean status, due date and priority, read off
// its schema (GET /data_sources/{id}), and how one entry maps onto a Kanban
// task. Notion names are free text and often German, so fields are found by
// TYPE first and by name only to choose between several of one type.
const pick = (props, types, nameRe) => {
  const all = Object.entries(props || {}).filter(([, v]) => types.includes(v?.type));
  return (all.find(([k]) => nameRe.test(k)) || all[0] || [])[0] || null;
};
const pickNamed = (props, types, nameRe) => {
  const hit = Object.entries(props || {}).find(([k, v]) => types.includes(v?.type) && nameRe.test(k));
  return hit ? hit[0] : null;
};

// Our four columns. A Notion status belongs to one of its groups (To-do, In
// progress, Complete by default); the first group is "todo", the last is
// "done", anything between is "progress". A plain select is read by words.
const COLUMN_WORDS = [
  ["done", /(done|erledigt|fertig|complete|abgeschlossen|closed|finished|✓)/i],
  ["review", /(review|prüfung|pruefung|freigabe|feedback)/i],
  ["progress", /(progress|arbeit|doing|bearbeitung|läuft|laeuft|started|begonnen|active|aktiv)/i],
];
const PRIORITY_WORDS = [
  ["high", /(high|hoch|urgent|dringend|kritisch|critical|wichtig|p1|p0)/i],
  ["low", /(low|niedrig|gering|p3|p4|später|spaeter|someday)/i],
  ["medium", /(medium|mittel|normal|p2)/i],
];
const byWords = (name, table) => { const s = String(name || ""); for (const [k, re] of table) if (re.test(s)) return k; return null; };

export function notionTaskFields(schema) {
  const props = schema?.properties || {};
  const statusKey = pickNamed(props, ["status"], /status|stand|phase/i) || pick(props, ["status"], /./);
  let groupOf = null;
  if (statusKey) {
    const groups = props[statusKey]?.status?.groups || [];
    groupOf = {};
    groups.forEach((g, i) => {
      const col = i === 0 ? "todo" : i === groups.length - 1 ? "done" : "progress";
      (g.option_ids || []).forEach(id => { groupOf[id] = col; });
    });
  }
  return {
    title: Object.entries(props).find(([, v]) => v?.type === "title")?.[0] || null,
    status: statusKey,
    statusGroupOf: groupOf,
    selectStatus: statusKey ? null : pickNamed(props, ["select"], /status|stand|phase|spalte|column/i),
    doneCheckbox: pickNamed(props, ["checkbox"], /done|erledigt|fertig|complete|abgeschlossen/i),
    due: pickNamed(props, ["date"], /due|fällig|faellig|frist|deadline|termin|datum|date|bis/i) || pick(props, ["date"], /./),
    priority: pickNamed(props, ["select", "status"], /prio/i),
  };
}

export function notionTaskOf(page, f) {
  const p = page?.properties || {};
  const title = f.title ? plain(p[f.title]?.title).trim() : pageTitle(page);
  let column = "todo", statusName = null;
  if (f.status && p[f.status]?.status) {
    const s = p[f.status].status;
    statusName = s.name || null;
    column = (f.statusGroupOf && f.statusGroupOf[s.id]) || byWords(s.name, COLUMN_WORDS) || "todo";
  } else if (f.selectStatus && p[f.selectStatus]?.select) {
    statusName = p[f.selectStatus].select.name || null;
    column = byWords(statusName, COLUMN_WORDS) || "todo";
  }
  if (f.doneCheckbox && p[f.doneCheckbox]?.checkbox === true) column = "done";
  const due = f.due ? (p[f.due]?.date?.start || null) : null;
  const prRaw = f.priority ? (p[f.priority]?.select?.name || p[f.priority]?.status?.name || null) : null;
  return {
    id: page.id,
    title: title || "",
    column,
    statusName,
    due,
    priority: prRaw ? (byWords(prRaw, PRIORITY_WORDS) || "medium") : null,
    url: page.url || null,
  };
}

// A page's content as the plain text a task description holds.
export function notionBlocksToText(blocks, depth = 0) {
  const out = [];
  const pad = "  ".repeat(depth);
  for (const b of blocks || []) {
    const d = b?.[b?.type] || {};
    const t = plain(d.rich_text).trim();
    switch (b?.type) {
      case "bulleted_list_item": if (t) out.push(`${pad}- ${t}`); break;
      case "numbered_list_item": if (t) out.push(`${pad}1. ${t}`); break;
      case "to_do": if (t) out.push(`${pad}[${d.checked ? "x" : " "}] ${t}`); break;
      case "code": if (t) out.push(t); break;
      case "divider": out.push("---"); break;
      case "child_page": case "child_database": if (d.title) out.push(`${pad}${d.title}`); break;
      case "table": (b._children || []).forEach(r => out.push(pad + (r.table_row?.cells || []).map(c => plain(c).trim()).join(" | "))); break;
      default: if (t) out.push(pad + t);
    }
    if (b?._children && b.type !== "table") {
      const inner = notionBlocksToText(b._children, ["bulleted_list_item", "numbered_list_item", "to_do"].includes(b.type) ? depth + 1 : depth);
      if (inner) out.push(inner);
    }
  }
  return out.join("\n");
}
