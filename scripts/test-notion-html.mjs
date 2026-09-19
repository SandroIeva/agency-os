// The Notion → HTML conversion, against the shipped code (server/notion.js).
// Run: node scripts/test-notion-html.mjs
import { blocksToHtml, pageTitle, rich, notionTree, notionPath } from "../server/notion.js";

let failed = 0;
const eq = (name, got, want) => {
  if (got === want) { console.log("ok  ", name); return; }
  failed++; console.log("FAIL", name, "\n  got: ", got, "\n  want:", want);
};
const rt = (text, annotations = {}, href = null) => ({ plain_text: text, annotations, href, text: { content: text, link: href ? { url: href } : null } });
const blk = (type, data, extra = {}) => ({ type, [type]: data, ...extra });

eq("title from the title property",
  pageTitle({ properties: { Name: { type: "title", title: [rt("Brief "), rt("Q4")] }, Tags: { type: "multi_select" } } }), "Brief Q4");
eq("escapes html in text", rich([rt("<b>x</b> & y")]), "&lt;b&gt;x&lt;/b&gt; &amp; y");
eq("bold + link", rich([rt("Site", { bold: true }, "https://a.de")]), '<a href="https://a.de"><strong>Site</strong></a>');
eq("notion-internal link dropped", rich([rt("Page", {}, "/abc123")]), "Page");
eq("consecutive bullets become one list",
  blocksToHtml([blk("bulleted_list_item", { rich_text: [rt("a")] }), blk("bulleted_list_item", { rich_text: [rt("b")] }), blk("paragraph", { rich_text: [rt("c")] })]),
  "<ul><li>a</li><li>b</li></ul><p>c</p>");
eq("numbered then bulleted are two lists",
  blocksToHtml([blk("numbered_list_item", { rich_text: [rt("1")] }), blk("bulleted_list_item", { rich_text: [rt("x")] })]),
  "<ol><li>1</li></ol><ul><li>x</li></ul>");
eq("nested list items",
  blocksToHtml([{ ...blk("bulleted_list_item", { rich_text: [rt("a")] }), _children: [blk("bulleted_list_item", { rich_text: [rt("a1")] })] }]),
  "<ul><li>a<ul><li>a1</li></ul></li></ul>");
eq("to-do keeps its state",
  blocksToHtml([blk("to_do", { rich_text: [rt("done")], checked: true }), blk("to_do", { rich_text: [rt("open")], checked: false })]),
  '<ul><li><input type="checkbox" checked>done</li><li><input type="checkbox">open</li></ul>');
eq("headings", blocksToHtml([blk("heading_1", { rich_text: [rt("H")] }), blk("heading_3", { rich_text: [rt("h")] })]), "<h1>H</h1><h3>h</h3>");
eq("image keeps its url and caption",
  blocksToHtml([blk("image", { type: "file", file: { url: "https://s3/x.png" }, caption: [rt("Cap")] })]),
  '<img src="https://s3/x.png" alt="Cap"><p>Cap</p>');
eq("notion-hosted pdf leaves only its name",
  blocksToHtml([blk("pdf", { type: "file", file: { url: "https://s3/x.pdf" }, caption: [], name: "Deck.pdf" })]), "<p>Deck.pdf</p>");
eq("table",
  blocksToHtml([{ ...blk("table", { table_width: 2 }), _children: [blk("table_row", { cells: [[rt("a")], [rt("b")]] })] }]),
  "<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>");
eq("columns flatten", blocksToHtml([{ ...blk("column_list", {}), _children: [{ ...blk("column", {}), _children: [blk("paragraph", { rich_text: [rt("L")] })] }] }]), "<p>L</p>");
eq("child page leaves its title", blocksToHtml([blk("child_page", { title: "Sub" })]), "<p><strong>Sub</strong></p>");
eq("code is escaped, not formatted", blocksToHtml([blk("code", { rich_text: [rt("<div>")], language: "html" })]), "<pre><code>&lt;div&gt;</code></pre>");
eq("unknown block with text still reads", blocksToHtml([blk("something_new", { rich_text: [rt("t")] })]), "<p>t</p>");


// ── The picker's tree ──
{
  const items = [
    { id: "p-brand", kind: "page", title: "Brand", parent: { type: "workspace", id: null } },
    { id: "p-guide", kind: "page", title: "Guidelines", parent: { type: "page_id", id: "p-brand" } },
    { id: "ds-proj", kind: "db", title: "Projekte", databaseId: "db-proj", parent: { type: "page_id", id: "p-brand" } },
    { id: "p-a", kind: "page", title: "Projekt A", lastEdited: "2026-09-01", parent: { type: "data_source_id", id: "ds-proj", databaseId: "db-proj" } },
    { id: "p-b", kind: "page", title: "Projekt B", lastEdited: "2026-09-10", parent: { type: "database_id", id: "db-proj" } },
    { id: "p-orphan", kind: "page", title: "Alleine", parent: { type: "page_id", id: "not-shared" } },
    { id: "p-inblock", kind: "page", title: "In Spalte", parent: { type: "block_id", id: "blk" } },
    { id: "p-dsfallback", kind: "page", title: "Über DB-Id", parent: { type: "data_source_id", id: "other-ds", databaseId: "db-proj" } },
  ];
  const { roots, byId } = notionTree(items);
  eq("roots: shared-at-top pages, alphabetical", roots.map(r => r.id).join(","), "p-orphan,p-brand,p-inblock");
  eq("page before database under a page", byId.get("p-brand").children.map(c => c.id).join(","), "p-guide,ds-proj");
  eq("database entries newest first, both parent shapes", byId.get("ds-proj").children.map(c => c.id).join(","), "p-b,p-a,p-dsfallback");
  eq("path of a database entry", notionPath(byId, "p-a").join(" / "), "Brand / Projekte");
  eq("path of a root is empty", notionPath(byId, "p-brand").length, 0);
  const loop = notionTree([
    { id: "x", kind: "page", title: "X", parent: { type: "page_id", id: "y" } },
    { id: "y", kind: "page", title: "Y", parent: { type: "page_id", id: "x" } },
  ]);
  eq("a parent loop does not hang and keeps both", loop.byId.size, 2);
}

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
