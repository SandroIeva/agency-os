// A document as a public page, against the shipped code (server/docRender.js).
// Run: node scripts/test-doc-render.mjs
import { docBlocksToHtml, docBlocksToMarkdown, docSummary, inlineHtml } from "../server/docRender.js";

let failed = 0;
const eq = (name, got, want) => {
  if (got === want) { console.log("ok  ", name); return; }
  failed++; console.log("FAIL", name, "\n  got: ", got, "\n  want:", want);
};
const txt = (text, styles = {}) => ({ type: "text", text, styles });
const blk = (type, content = [], props = {}, children = []) => ({ id: Math.random().toString(36).slice(2), type, props, content, children });

eq("escapes text", inlineHtml([txt("<script>alert(1)</script> & co")]), "&lt;script&gt;alert(1)&lt;/script&gt; &amp; co");
eq("styles nest", inlineHtml([txt("x", { bold: true, italic: true })]), "<em><strong>x</strong></em>");
eq("safe link kept", inlineHtml([{ type: "link", href: "https://a.de", content: [txt("A")] }]), '<a href="https://a.de" target="_blank" rel="noopener nofollow">A</a>');
eq("javascript link dropped", inlineHtml([{ type: "link", href: "javascript:alert(1)", content: [txt("A")] }]), "A");
eq("text colour", inlineHtml([txt("r", { textColor: "red" })]), '<span style="color:#d44c47;">r</span>');
eq("unknown colour ignored", inlineHtml([txt("r", { textColor: "url(x)" })]), "r");
eq("heading 1 becomes h2 under the page title", docBlocksToHtml([blk("heading", [txt("H")], { level: 1 })]), "<h2>H</h2>");
eq("empty paragraph keeps its space", docBlocksToHtml([blk("paragraph", [])]), '<p class="gap"></p>');
eq("bullets group into one list",
  docBlocksToHtml([blk("bulletListItem", [txt("a")]), blk("bulletListItem", [txt("b")]), blk("paragraph", [txt("c")])]),
  "<ul><li>a</li><li>b</li></ul><p>c</p>");
eq("nested bullets",
  docBlocksToHtml([blk("bulletListItem", [txt("a")], {}, [blk("bulletListItem", [txt("a1")])])]),
  "<ul><li>a<ul><li>a1</li></ul></li></ul>");
eq("numbered keeps its start", docBlocksToHtml([blk("numberedListItem", [txt("x")], { start: 3 })]), '<ol start="3"><li>x</li></ol>');
eq("checklist shows done state",
  docBlocksToHtml([blk("checkListItem", [txt("d")], { checked: true }), blk("checkListItem", [txt("o")], { checked: false })]),
  '<ul class="check"><li class="done"><span class="box">&#10003;</span><span>d</span></li><li class=""><span class="box"></span><span>o</span></li></ul>');
eq("image with caption", docBlocksToHtml([blk("image", undefined, { url: "https://x/y.png", caption: "Cap" })]),
  '<figure><img src="https://x/y.png" alt="Cap" loading="lazy"><figcaption>Cap</figcaption></figure>');
eq("image with a data: url is dropped", docBlocksToHtml([blk("image", undefined, { url: "data:image/png;base64,AA" })]), "");
eq("youtube embeds without cookies", docBlocksToHtml([blk("youtube", undefined, { url: "https://youtu.be/dQw4w9WgXcQ" })]).includes("youtube-nocookie.com/embed/dQw4w9WgXcQ"), true);
eq("divider", docBlocksToHtml([blk("divider", undefined)]), "<hr>");
eq("code is escaped", docBlocksToHtml([blk("codeBlock", [txt("<b>")], { language: "html" })]), "<pre><code>&lt;b&gt;</code></pre>");
eq("table", docBlocksToHtml([blk("table", { type: "tableContent", rows: [{ cells: [[txt("a")], { type: "tableCell", content: [txt("b")] }] }] })]),
  '<div class="tbl"><table><tbody><tr><td>a</td><td>b</td></tr></tbody></table></div>');
eq("alignment and block colour", docBlocksToHtml([blk("paragraph", [txt("c")], { textAlignment: "center", textColor: "blue" })]),
  '<p style="text-align:center;color:#337ea9">c</p>');
eq("markdown", docBlocksToMarkdown([blk("heading", [txt("T")], { level: 1 }), blk("checkListItem", [txt("x")], { checked: true }), blk("paragraph", [{ type: "link", href: "https://a.de", content: [txt("A")] }])]),
  "## T\n\n- [x] x\n\n[A](https://a.de)");
eq("summary skips headings", docSummary([blk("heading", [txt("Title")]), blk("paragraph", [txt("First words here.")])]), "First words here.");

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
