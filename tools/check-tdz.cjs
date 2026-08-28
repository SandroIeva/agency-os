// A const read before its declaration is a ReferenceError at RUNTIME only. The
// syntax is valid and the build is green, which is exactly how one shipped.
//
// With a REAL parser, not a regex: CLAUDE.md records that a regex scope checker
// was tried here once and deleted for being wrong, and my own first attempt at
// this reported 28 problems that were all the same name in different functions.
const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

let fail = 0;
const ok = (m) => console.log("ok    " + m);
const bad = (m) => { fail++; console.log("FAIL  " + m); };

for (const file of ["api/telegram.js", "api/slack.js", "server/messenger.js", "src/notificationText.js"]) {
  const src = fs.readFileSync(file, "utf8");
  const ast = parser.parse(src, { sourceType: "module", plugins: ["jsx"] });
  let checked = 0, problems = 0;
  traverse(ast, {
    
    Identifier(path) {
      if (!path.isReferencedIdentifier()) return;
      const binding = path.scope.getBinding(path.node.name);
      if (!binding || !["const", "let"].includes(binding.kind)) return;
      // Same function, and read at a point the declaration has not run yet.
      const declFn = binding.path.getFunctionParent();
      const useFn = path.getFunctionParent();
      if (declFn !== useFn) return;
      checked++;
      if (path.node.start < binding.path.node.start) {
        problems++;
        bad(`${file}:${path.node.loc.start.line} — "${path.node.name}" is read before its declaration on line ${binding.path.node.loc.start.line}`);
      }
    },
  });
  if (!problems) ok(`${file}: ${checked} same-scope reads, all after their declaration`);
}
console.log(fail ? `\n${fail} failing` : "\nall passing");
process.exit(fail ? 1 : 0);
