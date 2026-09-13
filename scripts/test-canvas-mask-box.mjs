import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const i = src.indexOf('const visibleRotBoxes = (list) => {');
let d = 0, j = src.indexOf('{', i), started = false;
for (; j < src.length; j++) {
  if (src[j] === '{') { d++; started = true; }
  else if (src[j] === '}') { d--; if (started && d === 0) break; }
}
const code = 'const rotBoxOf = (it) => ({ x: it.x, y: it.y, w: it.w, h: it.h });\n'
  + src.slice(i, src.indexOf(';', j) + 1) + '\nexport { visibleRotBoxes };';
const { visibleRotBoxes } = await import('data:text/javascript,' + encodeURIComponent(code));
const box = (l) => {
  const bs = visibleRotBoxes(l);
  if (!bs.length) return null;
  const x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y));
  return { x, y, w: Math.max(...bs.map(b => b.x + b.w)) - x, h: Math.max(...bs.map(b => b.y + b.h)) - y };
};

// A big picture clipped to a small circle shows the circle.
assert.deepEqual(box([
  { id: 'm', isMask: true, x: 100, y: 100, w: 50, h: 50 },
  { id: 'p', maskId: 'm', x: 0, y: 0, w: 400, h: 400 },
]), { x: 100, y: 100, w: 50, h: 50 }, 'the frame is the mask, not the picture');

// A picture SMALLER than its mask shows only as much as there is.
assert.deepEqual(box([
  { id: 'm', isMask: true, x: 0, y: 0, w: 400, h: 400 },
  { id: 'p', maskId: 'm', x: 10, y: 10, w: 20, h: 20 },
]), { x: 10, y: 10, w: 20, h: 20 }, 'and not the mask when the picture is smaller');

// Partly overlapping: the overlap.
assert.deepEqual(box([
  { id: 'm', isMask: true, x: 0, y: 0, w: 100, h: 100 },
  { id: 'p', maskId: 'm', x: 50, y: 50, w: 100, h: 100 },
]), { x: 50, y: 50, w: 50, h: 50 }, 'the part that is actually shown');

// An unmasked item in the same group still counts for itself.
assert.deepEqual(box([
  { id: 'm', isMask: true, x: 0, y: 0, w: 50, h: 50 },
  { id: 'p', maskId: 'm', x: 0, y: 0, w: 400, h: 400 },
  { id: 'free', x: 200, y: 0, w: 20, h: 20 },
]), { x: 0, y: 0, w: 220, h: 50 }, 'a sibling outside the mask is still visible');

// Clipped away entirely: it bounds nothing, and the mask alone remains.
assert.deepEqual(box([
  { id: 'm', isMask: true, x: 0, y: 0, w: 10, h: 10 },
  { id: 'p', maskId: 'm', x: 500, y: 500, w: 10, h: 10 },
]), { x: 0, y: 0, w: 10, h: 10 }, 'nothing visible falls back to the mask');

// No mask at all behaves exactly as before.
assert.deepEqual(box([
  { id: 'a', x: 0, y: 0, w: 10, h: 10 },
  { id: 'b', x: 90, y: 40, w: 10, h: 10 },
]), { x: 0, y: 0, w: 100, h: 50 }, 'a plain group is unchanged');

console.log('Passed: a masked group is bounded by what it shows.');
