// A dependency array naming a `const` that is declared FURTHER DOWN the same
// component. It builds green and throws at load with "Cannot access X before
// initialization", which is the `de is not defined` family wearing a hat. It
// has now shipped twice, most recently as `canPublish` in the post composer,
// which crashed the channels step on arrival.
//
// Deliberately narrow: it only looks inside one function component at a time
// and only at names declared with `const`, which is the whole failure mode. A
// state variable declared with useState is a const too, and it is caught by
// the same rule.
const fs = require("fs");

let bad = 0;
for (const file of process.argv.slice(2)) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  // Component boundaries: a top-level `function Name(` or `const Name = (`.
  const starts = [];
  lines.forEach((l, i) => { if (/^(function|const) [A-Z]\w*\s*[=(]/.test(l)) starts.push(i); });
  starts.push(lines.length);

  for (let s = 0; s < starts.length - 1; s++) {
    const from = starts[s], to = starts[s + 1];
    const declaredAt = new Map();
    for (let i = from; i < to; i++) {
      // Exactly two spaces: component scope. A `const` deeper than that is
      // inside a callback or a loop, it lives and dies there, and it cannot be
      // what a dependency array at component level is naming.
      const one = lines[i].match(/^  const (\w+)\s*=/);
      if (one && !declaredAt.has(one[1])) declaredAt.set(one[1], i);
      const many = lines[i].match(/^  const \[(\w+),/);
      if (many && !declaredAt.has(many[1])) declaredAt.set(many[1], i);
    }
    for (let i = from; i < to; i++) {
      const dep = lines[i].match(/\}, \[([^\]]*)\]\)/);
      if (!dep) continue;
      for (const raw of dep[1].split(",")) {
        const name = raw.trim();
        if (!/^\w+$/.test(name)) continue;
        const d = declaredAt.get(name);
        if (d != null && d > i) {
          console.log(`${file}:${i + 1}  dependency "${name}" is declared below it, at line ${d + 1}`);
          bad++;
        }
      }
    }
  }
}
console.log(`\n${bad} dependencies read before their declaration`);
process.exit(bad ? 1 : 0);
