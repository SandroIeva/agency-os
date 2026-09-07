// Identifiers that are read but bound nowhere — the class of bug the build
// cannot see. `withUrls` was one: used once, defined never, and every
// successful Figma import died on it. `de` is the other famous one in this
// repo: declared ~44 times inside nested functions, so a sibling that reaches
// for it compiles fine and throws at runtime.
const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

// Everything a browser, the bundler or React hands you for free.
const GLOBALS = new Set([
  "window","document","navigator","location","history","console","fetch","URL","URLSearchParams",
  "Blob","File","FileReader","FormData","Image","Audio","AbortController","AbortSignal","Headers",
  "Response","Request","WebSocket","Worker","crypto","localStorage","sessionStorage","indexedDB",
  "setTimeout","clearTimeout","setInterval","clearInterval","requestAnimationFrame","cancelAnimationFrame",
  "queueMicrotask","structuredClone","performance","matchMedia","alert","confirm","prompt","atob","btoa",
  "Math","JSON","Object","Array","String","Number","Boolean","Date","RegExp","Error","TypeError","RangeError",
  "Promise","Map","Set","WeakMap","WeakSet","Symbol","Proxy","Reflect","BigInt","Intl","globalThis",
  "parseInt","parseFloat","isNaN","isFinite","encodeURIComponent","decodeURIComponent","encodeURI","decodeURI",
  "Uint8Array","Uint8ClampedArray","Int8Array","Uint16Array","Int16Array","Uint32Array","Int32Array",
  "Float32Array","Float64Array","ArrayBuffer","DataView","TextEncoder","TextDecoder","Intl",
  "ResizeObserver","IntersectionObserver","MutationObserver","MediaRecorder","SpeechSynthesisUtterance",
  "speechSynthesis","DOMParser","XMLSerializer","Notification","IDBKeyRange","CustomEvent","Event",
  "MouseEvent","KeyboardEvent","PointerEvent","TouchEvent","DragEvent","WheelEvent","InputEvent",
  "HTMLElement","Node","NodeList","SVGElement","Element","CSS","OffscreenCanvas","createImageBitmap",
  "process","require","module","exports","__dirname","import","screen","frames","self","top","parent",
  "getComputedStyle","scrollTo","scrollBy","open","close","postMessage","addEventListener","removeEventListener",
  "reportError","caches","BroadcastChannel","EventSource","Element","Text","Range","Selection","getSelection",
  "undefined","Infinity","NaN","ClipboardItem","DOMMatrix","Path2D","GPUBufferUsage","GPUShaderStage","GPUTextureUsage","GPUMapMode",
]);

let total = 0;
for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, "utf8");
  const ast = parser.parse(src, {
    sourceType: "module",
    plugins: ["jsx", "classProperties", "optionalChaining", "nullishCoalescingOperator", "objectRestSpread"],
  });
  const seen = new Map();
  traverse(ast, {
    ReferencedIdentifier(path) {
      const name = path.node.name;
      if (GLOBALS.has(name)) return;
      if (path.scope.hasBinding(name, true)) return;
      // JSX element names that start uppercase are components; a lowercase one
      // is an intrinsic tag and never a binding.
      if (path.parent.type === "JSXOpeningElement" || path.parent.type === "JSXClosingElement") {
        if (/^[a-z]/.test(name)) return;
      }
      if (!seen.has(name)) seen.set(name, []);
      seen.get(name).push(path.node.loc.start.line);
    },
  });
  if (seen.size) {
    console.log(`\n${file}`);
    for (const [name, lines] of [...seen].sort()) {
      console.log(`  ${name}  → line${lines.length > 1 ? "s" : ""} ${lines.slice(0, 8).join(", ")}${lines.length > 8 ? ` (+${lines.length - 8} more)` : ""}`);
      total++;
    }
  }
}
console.log(`\n${total} unbound identifier${total === 1 ? "" : "s"}`);
process.exit(total ? 1 : 0);
