// The Notion → HTML conversion, against the shipped code (server/notion.js).
// Run: node scripts/test-notion-html.mjs
import { blocksToHtml, pageTitle, rich, notionTree, notionPath, notionTaskFields, notionTaskOf, notionBlocksToText } from "../server/notion.js";

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


// ── Tasks from a database ──
{
  const schema = { properties: {
    Name: { type: "title" },
    Status: { type: "status", status: {
      options: [{ id: "o1", name: "Nicht begonnen" }, { id: "o2", name: "In Bearbeitung" }, { id: "o3", name: "Erledigt" }],
      groups: [{ id: "g1", name: "Zu erledigen", option_ids: ["o1"] }, { id: "g2", name: "In Bearbeitung", option_ids: ["o2"] }, { id: "g3", name: "Abgeschlossen", option_ids: ["o3"] }] } },
    Fälligkeitsdatum: { type: "date" },
    Erstellt: { type: "created_time" },
    Priorität: { type: "select" },
  } };
  const f = notionTaskFields(schema);
  eq("fields found by type and name", [f.title, f.status, f.due, f.priority].join(","), "Name,Status,Fälligkeitsdatum,Priorität");
  const page = (statusId, statusName, extra = {}) => ({ id: "pg", url: "https://notion.so/pg", properties: {
    Name: { type: "title", title: [rt("Logo finalisieren")] },
    Status: { type: "status", status: { id: statusId, name: statusName } },
    Fälligkeitsdatum: { type: "date", date: { start: "2026-10-01" } },
    Priorität: { type: "select", select: { name: "Hoch" } }, ...extra } });
  const t1 = notionTaskOf(page("o2", "In Bearbeitung"), f);
  eq("status group -> column", t1.column, "progress");
  eq("title, due, priority", [t1.title, t1.due, t1.priority].join(","), "Logo finalisieren,2026-10-01,high");
  eq("last group is done", notionTaskOf(page("o3", "Erledigt"), f).column, "done");
  eq("first group is todo", notionTaskOf(page("o1", "Nicht begonnen"), f).column, "todo");
  const sel = notionTaskFields({ properties: { T: { type: "title" }, Stand: { type: "select" }, Done: { type: "checkbox" } } });
  eq("select read by words", notionTaskOf({ id: "x", properties: { T: { title: [rt("a")] }, Stand: { select: { name: "Review" } } } }, sel).column, "review");
  eq("done checkbox wins", notionTaskOf({ id: "x", properties: { T: { title: [rt("a")] }, Stand: { select: { name: "Offen" } }, Done: { checkbox: true } } }, sel).column, "done");
  eq("no priority field -> null", notionTaskOf({ id: "x", properties: { T: { title: [rt("a")] } } }, sel).priority, null);
  eq("page text", notionBlocksToText([
    { type: "paragraph", paragraph: { rich_text: [rt("Kontext")] } },
    { type: "to_do", to_do: { rich_text: [rt("Farben")], checked: true } },
    { type: "bulleted_list_item", bulleted_list_item: { rich_text: [rt("a")] }, _children: [{ type: "bulleted_list_item", bulleted_list_item: { rich_text: [rt("b")] } }] },
  ]), "Kontext\n[x] Farben\n- a\n  - b");
}

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
