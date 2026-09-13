import assert from 'node:assert/strict';
import io from 'node:fs';
const src = io.readFileSync('/Users/sandroieva/Documents/vibe coding/i7os-app/src/App.jsx', 'utf8');
// Pull the three pure helpers straight out of the file, so the test runs the
// shipped code and not a copy of it.
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
const code = ["const CANVAS_RUN_KEYS = ['color','opacity','underline','strike'];", grab('canvasApplyRun'), grab('canvasShiftRuns'), grab('canvasLineSpans')].join('\n');
const { canvasApplyRun, canvasShiftRuns, canvasLineSpans } =
  await import('data:text/javascript,' + encodeURIComponent(code +
    '\nexport { canvasApplyRun, canvasShiftRuns, canvasLineSpans };'));

// ── applying a colour ──────────────────────────────────────────────────────
assert.deepEqual(canvasApplyRun([], 2, 5, { color: '#f00' }), [{ from: 2, to: 5, color: '#f00' }]);
// a second colour inside the first cuts it in two rather than stacking
assert.deepEqual(canvasApplyRun([{ from: 0, to: 10, color: '#f00' }], 4, 6, { color: '#00f' }),
  [{ from: 0, to: 4, color: '#f00' }, { from: 4, to: 6, color: '#00f' }, { from: 6, to: 10, color: '#f00' }]);
// overlapping the left edge trims it
assert.deepEqual(canvasApplyRun([{ from: 3, to: 8, color: '#f00' }], 0, 5, { color: '#00f' }),
  [{ from: 0, to: 5, color: '#00f' }, { from: 5, to: 8, color: '#f00' }]);
// an empty range changes nothing
assert.deepEqual(canvasApplyRun([{ from: 1, to: 2, color: '#f00' }], 4, 4, { color: '#00f' }),
  [{ from: 1, to: 2, color: '#f00' }]);

// ── an edit moves them ─────────────────────────────────────────────────────
const r = [{ from: 6, to: 11, color: '#f00' }];   // "World" in "Hello World"
// typing in front
assert.deepEqual(canvasShiftRuns(r, 'Hello World', 'Hello my World'),
  [{ from: 9, to: 14, color: '#f00' }], 'insert before moves it along');
// deleting in front
assert.deepEqual(canvasShiftRuns(r, 'Hello World', 'Hi World'),
  [{ from: 3, to: 8, color: '#f00' }], 'delete before pulls it back');
// typing after it leaves it alone
assert.deepEqual(canvasShiftRuns(r, 'Hello World', 'Hello World!!'), r, 'insert after changes nothing');
// deleting the coloured words themselves drops the run
assert.deepEqual(canvasShiftRuns(r, 'Hello World', 'Hello '), [], 'deleting the range drops it');
// no change at all is no change
assert.deepEqual(canvasShiftRuns(r, 'Hello World', 'Hello World'), r);

// ── finding the lines again ────────────────────────────────────────────────
assert.deepEqual(canvasLineSpans('Hello World', ['Hello', 'World']),
  [{ start: 0, end: 5 }, { start: 6, end: 11 }], 'the space at the break is consumed');
assert.deepEqual(canvasLineSpans('a\nb', ['a', 'b']), [{ start: 0, end: 1 }, { start: 2, end: 3 }],
  'a newline is consumed too');
const long = 'one two three';
assert.deepEqual(canvasLineSpans(long, ['one two', 'three']),
  [{ start: 0, end: 7 }, { start: 8, end: 13 }]);
// and the offsets really point at the words
const sp = canvasLineSpans(long, ['one two', 'three']);
assert.equal(long.slice(sp[0].start, sp[0].end), 'one two');
assert.equal(long.slice(sp[1].start, sp[1].end), 'three');

// A second property on part of the same range keeps the first.
const both = canvasApplyRun([{ from: 0, to: 10, color: '#f00' }], 4, 6, { underline: true });
assert.deepEqual(both, [
  { from: 0, to: 4, color: '#f00' },
  { from: 4, to: 6, color: '#f00', underline: true },
  { from: 6, to: 10, color: '#f00' },
], 'underlining part of a coloured phrase keeps the colour');

console.log('Passed: colouring part of a text, edits moving it, and finding each wrapped line in the source.');
