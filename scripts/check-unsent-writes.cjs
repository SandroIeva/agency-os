// Every supabase write that is built and never sent.
//
// The builder is lazy: `supabase.from(x).update(y).eq(z)` on its own line
// constructs a thenable and drops it. It compiles, it lints, it looks like a
// write, and no request leaves the browser. This walks the AST and reports
// every write chain whose value is thrown away — no await, no return, no
// .then, not assigned, not part of a Promise.all.
const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const files = process.argv.slice(2);
const WRITE = new Set(["insert", "update", "upsert", "delete", "rpc"]);

let total = 0;
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const ast = parser.parse(src, {
    sourceType: "module",
    plugins: ["jsx", "classProperties", "optionalChaining", "nullishCoalescingOperator", "objectRestSpread"],
    errorRecovery: true,
  });

  const hits = [];
  traverse(ast, {
    CallExpression(path) {
      // Is this chain rooted in a supabase write?
      let n = path.node, sawWrite = false, sawFrom = false, root = null;
      const walk = (node) => {
        while (node && node.type === "CallExpression" && node.callee.type === "MemberExpression") {
          const prop = node.callee.property;
          const name = prop && (prop.name || prop.value);
          if (WRITE.has(name)) sawWrite = true;
          if (name === "from") sawFrom = true;
          if (name === "rpc") sawWrite = sawFrom = true;
          node = node.callee.object;
        }
        root = node;
      };
      walk(n);
      if (!sawWrite || !sawFrom) return;
      // A chain that ENDS in .then/.catch/.finally is sent — that is the
      // documented fire-and-forget form, not a dropped builder.
      const outer = path.node.callee.type === "MemberExpression"
        && (path.node.callee.property.name || path.node.callee.property.value);
      if (outer === "then" || outer === "catch" || outer === "finally") return;
      // Only look at the OUTERMOST call of a chain.
      const parent = path.parent;
      if (parent.type === "MemberExpression" && parent.object === path.node) return;
      // Rooted in something named supabase / db / admin()?
      const rootName = root && (root.name || (root.callee && root.callee.name) || "");
      if (!/supabase|^db$|^admin$|client/i.test(String(rootName))) return;

      // Is the value used?
      const p = parent.type;
      const used =
        p === "AwaitExpression" || p === "ReturnStatement" || p === "VariableDeclarator" ||
        p === "AssignmentExpression" || p === "ArrayExpression" || p === "CallExpression" ||
        p === "ArrowFunctionExpression" || p === "ConditionalExpression" || p === "LogicalExpression" ||
        p === "BinaryExpression" || p === "MemberExpression" || p === "ObjectProperty" ||
        p === "JSXExpressionContainer" || p === "TemplateLiteral" || p === "SpreadElement" ||
        p === "UnaryExpression" || p === "NewExpression";
      if (used) return;
      hits.push({ line: path.node.loc.start.line, code: src.slice(path.node.start, path.node.end).replace(/\s+/g, " ").slice(0, 150) });
    },
  });

  if (hits.length) {
    console.log(`\n${file}`);
    for (const h of hits) console.log(`  ${h.line}: ${h.code}`);
  }
  total += hits.length;
}
console.log(`\n${total} unsent write${total === 1 ? "" : "s"}`);

process.exit(total ? 1 : 0);
