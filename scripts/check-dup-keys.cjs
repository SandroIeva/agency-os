// The same key written twice in one object literal. The later one wins, in
// silence, and the build has nothing to say about it.
//
// This has shipped twice in one day. Once it was harmless and looked right
// (`instagram` in a size table, where the second value was the one wanted).
// Once it undid a fix completely: `clipPath` set to a mask and then, four lines
// below, set again to `undefined` for anything that is not a polygon, so
// masked pictures went on covering whole artboards while the code above them
// said otherwise.
//
// A style object is where this hides, because it is long, it is written in one
// breath, and nobody reads it top to bottom afterwards.
const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

let bad = 0;
for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, "utf8");
  const ast = parser.parse(src, {
    sourceType: "module",
    plugins: ["jsx", "classProperties", "optionalChaining", "nullishCoalescingOperator"],
  });
  traverse(ast, {
    ObjectExpression(path) {
      const seen = new Map();
      for (const prop of path.node.properties) {
        if (prop.type !== "ObjectProperty" || prop.computed) continue;
        const k = prop.key.name ?? prop.key.value;
        if (k == null) continue;
        if (seen.has(k)) {
          console.log(`${file}:${prop.loc.start.line}  "${k}" is written twice in one object`
            + ` (first at line ${seen.get(k)}); the later one silently wins`);
          bad++;
        } else seen.set(k, prop.loc.start.line);
      }
    },
  });
}
console.log(`\n${bad} keys written twice in one object`);
process.exit(bad ? 1 : 0);
