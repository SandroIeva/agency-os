// The line breaker was rewritten to measure per character, so that a size or a
// font on PART of a text can change where a line breaks. Every artboard that
// exists was laid out by the old one, so the first thing to prove is that plain
// text still breaks in exactly the same places.
//
// The real function is lifted out of App.jsx and given a measuring context that
// counts characters, so the comparison is against the shipped code.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const grab = (name) => {
  const i = src.indexOf(`const ${name} = `);
  if (i < 0) throw new Error('not found: ' + name);
  let d = 0, j = src.indexOf('{', i), started = false;
  for (; j < src.length; j++) {
    if (src[j] === '{') { d++; started = true; }
    else if (src[j] === '}') { d--; if (started && d === 0) break; }
  }
  return src.slice(i, src.indexOf(';', j) + 1);
};

// Everything the wrapper leans on, stubbed so a character is one unit wide
// unless a run says otherwise. That makes the expected breaks countable by hand.
const prelude = `
const _wrapCache = new Map();
const CANVAS_LH = 1.2;
const CANVAS_RUN_KEYS = ["color","opacity","underline","strike","font","weight","italic","size"];
const canvasText = (it) => String(it.text ?? "");
const canvasLS = () => 0;
const canvasPlain = (it) => !it.runs || !it.runs.length;
const canvasRunStyle = (it, i) => {
  let out = { size: it.size, font: it.font, weight: it.weight, italic: !!it.italic };
  for (const r of it.runs || []) if (i >= r.from && i < r.to)
    for (const k of CANVAS_RUN_KEYS) if (r[k] !== undefined) out = { ...out, [k]: r[k] };
  return out;
};
const canvasFont = (it) => String(it.size);
const canvasFontAt = (it, i) => String(canvasRunStyle(it, i).size || it.size);
let _measureCtx = null;
const measureCtx = () => {
  if (!_measureCtx) _measureCtx = { font: "10", measureText: (s) => ({ width: s.length * Number(_measureCtx.font) }) };
  return _measureCtx;
};
`;
const mod = await import('data:text/javascript,' + encodeURIComponent(
  prelude + grab('canvasTextLayout') + '\nexport { canvasTextLayout };'));
const lines = (it) => mod.canvasTextLayout(it).lines.map(l => l.text);

// The old wrapper, word by word with one font for the whole text.
const oldLines = (text, width, per) => {
  const widthOf = (s) => s.length * per;
  const out = [];
  for (const para of String(text).split('\n')) {
    if (!para) { out.push(''); continue; }
    const words = para.split(/(\s+)/).filter(x => x !== '');
    let line = '';
    for (const word of words) {
      const next = line + word;
      if (line && widthOf(next) > width) {
        out.push(line.replace(/\s+$/, ''));
        line = /^\s+$/.test(word) ? '' : word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
};

const cases = [
  ['one two three four five', 100],
  ['one two three four five', 45],
  ['a b c d e f g h i j k l', 35],
  ['supercalifragilistic', 50],
  ['two  spaces  kept', 60],
  ['line one\nline two', 100],
  ['line one\nline two', 45],
  ['', 100],
  ['trailing ', 40],
  ['\n\nblank lines\n', 100],
];
for (const [text, w] of cases) {
  const it = { text, w, size: 10, lh: 1.2 };
  assert.deepEqual(lines(it), oldLines(text, w, 10),
    `plain text must break exactly as before: ${JSON.stringify(text)} at ${w}px`);
}

// Where each line starts, straight from the wrapper rather than reconstructed.
const l2 = mod.canvasTextLayout({ text: 'one two three', w: 45, size: 10, lh: 1.2 }).lines;
for (const l of l2) assert.equal('one two three'.slice(l.start, l.end), l.text, 'offsets point at the line');

// A bigger word makes its own line taller, and only that line.
const tall = mod.canvasTextLayout({
  text: 'small BIG small', w: 1000, size: 10, lh: 1.2,
  runs: [{ from: 6, to: 9, size: 30 }],
}).lines;
assert.equal(tall.length, 1);
assert.equal(tall[0].lh, 36, 'the line is as tall as the tallest thing on it');

// A bigger word is also wider, so it breaks earlier than the same word small.
// 11 characters at 10px is 110, so it fits in 120 and nothing breaks.
const narrow = { text: 'aaa bbb ccc', w: 120, size: 10, lh: 1.2 };
assert.deepEqual(lines(narrow), ['aaa bbb ccc'], 'it fits while every letter is the same size');
// Setting the middle word to 30px makes it 90 wide on its own, so it no longer
// fits beside the first, and the line after it no longer fits beside IT.
assert.deepEqual(lines({ ...narrow, runs: [{ from: 4, to: 7, size: 30 }] }), ['aaa', 'bbb', 'ccc'],
  'a word set larger takes more room and pushes the others down');

console.log('Passed: plain text breaks exactly as before, offsets come from the wrapper, and a size on part of a text changes both height and breaks.');
