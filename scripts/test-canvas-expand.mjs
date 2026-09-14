// An instance is resolved into ordinary items before anything draws it. This
// runs the SHIPPED canvasExpand, cut out of App.jsx with the two helpers it
// leans on, so the test cannot pass against a copy that has drifted.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

// Everything from the scaler to the end of the two id helpers, which is one
// contiguous block on purpose: they belong together and are read together.
const from = src.indexOf('const scaleItemInBox = (it, g, sx, sy, nx, ny) => {');
const to = src.indexOf('function CanvasThumb(');
assert.ok(from > 0, 'scaleItemInBox not found');
assert.ok(to > from, 'CanvasThumb not found after it');
const block = src.slice(from, to);
assert.ok(block.includes('const canvasExpand'), 'canvasExpand is not in the slice');

// The three things the block reaches for that live elsewhere in App.jsx. A box
// is enough here: this test is about what expansion does to a list, not about
// how a star or a rounded corner measures.
const stubs = `
const canvasRenderBoxOf = (it) => ({ x: it.x || 0, y: it.y || 0, w: it.w || 1, h: it.h || 1 });
const CANVAS_LH = 1.25;
const canvasTextH = (it) => (it.size || 16) * CANVAS_LH;
`;
const { canvasExpand } = await import('data:text/javascript,'
  + encodeURIComponent(stubs + block + '\nexport { canvasExpand };'));

const box = (id, o = {}) => ({ id, type: 'rect', x: 0, y: 0, w: 10, h: 10, ...o });
const ids = (l) => l.map(o => o.id);

// ── The free case: nothing to do, and it must cost nothing ──────────────────
{
  const list = [box('a'), box('b')];
  assert.equal(canvasExpand(list, null), list, 'no components: the same array back');
  assert.equal(canvasExpand(list, {}), list, 'no instances: the same array back');
  // Not just equal — the SAME array. A copy here would make every consumer that
  // compares by identity re-run on every render.
  assert.equal(canvasExpand(list, { c1: { w: 10, h: 10, items: [] } }), list,
    'components present but unused: still the same array');
}

// ── One instance becomes its parts, in the instance's place ─────────────────
{
  const comps = { c1: { id: 'c1', w: 100, h: 100, items: [box('p', { x: 10, y: 20, w: 30, h: 40 })] } };
  const out = canvasExpand([{ id: 'i1', type: 'instance', componentId: 'c1', x: 200, y: 300, w: 100, h: 100 }], comps);
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].x, out[0].y, out[0].w, out[0].h], [210, 320, 30, 40],
    'offset by the instance, unscaled at its natural size');
  assert.equal(out[0].id, 'i1:p', 'the part is named by its instance');
  assert.equal(out[0].fromInstance, 'i1', 'and says which instance to select');
}

// ── A resized instance scales its parts ─────────────────────────────────────
{
  const comps = { c1: { id: 'c1', w: 100, h: 100, items: [box('p', { x: 10, y: 20, w: 30, h: 40 })] } };
  const out = canvasExpand([{ id: 'i1', type: 'instance', componentId: 'c1', x: 0, y: 0, w: 200, h: 50 }], comps);
  assert.deepEqual([out[0].x, out[0].y, out[0].w, out[0].h], [20, 10, 60, 20],
    'each axis scales on its own');
}

// ── Two instances of one component do not collide ───────────────────────────
{
  const comps = { c1: { id: 'c1', w: 10, h: 10, items: [box('p'), box('q', { groupId: 'g' })] } };
  const out = canvasExpand([
    { id: 'i1', type: 'instance', componentId: 'c1', x: 0, y: 0, w: 10, h: 10 },
    { id: 'i2', type: 'instance', componentId: 'c1', x: 50, y: 0, w: 10, h: 10 },
  ], comps);
  assert.deepEqual(ids(out), ['i1:p', 'i1:q', 'i2:p', 'i2:q'], 'four distinct ids');
  assert.equal(out[1].groupId, 'i1:g');
  assert.equal(out[3].groupId, 'i2:g');
  assert.notEqual(out[1].groupId, out[3].groupId,
    'or dragging one instance would drag the other');
}

// ── The mask trap: a pointer must follow the ids it was given ───────────────
{
  const comps = { c1: { id: 'c1', w: 10, h: 10, items: [
    box('m', { isMask: true, groupId: 'g' }),
    box('pic', { maskId: 'm', groupId: 'g' }),
  ] } };
  const out = canvasExpand([
    { id: 'i1', type: 'instance', componentId: 'c1', x: 0, y: 0, w: 10, h: 10 },
    { id: 'i2', type: 'instance', componentId: 'c1', x: 50, y: 0, w: 10, h: 10 },
  ], comps);
  const pic1 = out.find(o => o.id === 'i1:pic'), pic2 = out.find(o => o.id === 'i2:pic');
  assert.equal(pic1.maskId, 'i1:m', 'clipped by its own mask');
  assert.equal(pic2.maskId, 'i2:m', 'and not by the first instance\'s');
}

// ── A mask that is not there any more clips nothing ─────────────────────────
{
  const comps = { c1: { id: 'c1', w: 10, h: 10, items: [box('pic', { maskId: 'gone' })] } };
  const out = canvasExpand([{ id: 'i1', type: 'instance', componentId: 'c1', x: 0, y: 0, w: 10, h: 10 }], comps);
  assert.equal(out[0].maskId, undefined, 'a dangling pointer is dropped, not left to clip by accident');
}

// ── Overrides reach text and pictures, and nothing else ─────────────────────
{
  const comps = { c1: { id: 'c1', w: 100, h: 100, items: [
    { id: 't', type: 'text', x: 0, y: 0, w: 80, size: 20, text: 'Platzhalter', fill: '#000' },
    { id: 'img', type: 'image', x: 0, y: 40, w: 80, h: 40, src: 'default.png' },
  ] } };
  const out = canvasExpand([{ id: 'i1', type: 'instance', componentId: 'c1', x: 0, y: 0, w: 100, h: 100,
    overrides: { t: { text: 'Echt' }, img: { src: 'echt.png' }, nope: { text: 'x' } } }], comps);
  assert.equal(out[0].text, 'Echt');
  assert.equal(out[1].src, 'echt.png');
  const plain = canvasExpand([{ id: 'i2', type: 'instance', componentId: 'c1', x: 0, y: 0, w: 100, h: 100 }], comps);
  assert.equal(plain[0].text, 'Platzhalter', 'the definition is untouched by the other instance');
}

// ── Opacity multiplies ──────────────────────────────────────────────────────
{
  const comps = { c1: { id: 'c1', w: 10, h: 10, items: [box('p', { opacity: 0.5 })] } };
  const out = canvasExpand([{ id: 'i1', type: 'instance', componentId: 'c1', x: 0, y: 0, w: 10, h: 10, opacity: 0.5 }], comps);
  assert.equal(out[0].opacity, 0.25, 'half of a half');
}

// ── Nesting resolves, and the outer instance owns the click ─────────────────
{
  const comps = {
    inner: { id: 'inner', w: 10, h: 10, items: [box('leaf')] },
    outer: { id: 'outer', w: 10, h: 10, items: [
      { id: 'nest', type: 'instance', componentId: 'inner', x: 0, y: 0, w: 10, h: 10 }] },
  };
  const out = canvasExpand([{ id: 'i1', type: 'instance', componentId: 'outer', x: 0, y: 0, w: 10, h: 10 }], comps);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'i1:nest:leaf');
  assert.equal(out[0].fromInstance, 'i1:nest',
    'the innermost instance owns it, so stepping in goes one level at a time');
}

// ── A component that contains itself must not hang ──────────────────────────
{
  const comps = { loop: { id: 'loop', w: 10, h: 10, items: [
    box('p'), { id: 'self', type: 'instance', componentId: 'loop', x: 0, y: 0, w: 10, h: 10 }] } };
  const out = canvasExpand([{ id: 'i1', type: 'instance', componentId: 'loop', x: 0, y: 0, w: 10, h: 10 }], comps);
  assert.deepEqual(ids(out), ['i1:p'], 'the cycle stops at the first repeat');
}

// ── An instance pointing at nothing draws nothing, and does not throw ───────
{
  const out = canvasExpand([box('a'), { id: 'i1', type: 'instance', componentId: 'weg', x: 0, y: 0, w: 10, h: 10 }], {});
  assert.deepEqual(ids(out), ['a'], 'a missing definition is skipped');
}

// ── A hidden instance hides its parts ───────────────────────────────────────
{
  const comps = { c1: { id: 'c1', w: 10, h: 10, items: [box('p')] } };
  const out = canvasExpand([{ id: 'i1', type: 'instance', componentId: 'c1', x: 0, y: 0, w: 10, h: 10, hidden: true }], comps);
  assert.equal(out[0].hidden, true);
}

// ── A vector inside a component, which is what a logo actually is ──────────
{
  const comps = { c1: { id: 'c1', w: 100, h: 100, items: [
    { id: 'v', type: 'path', ox: 5, oy: 5, w: 50, h: 50, fill: '#000',
      nodes: [{ x: 0, y: 0 }, { x: 10, y: 0, h1x: 4, h1y: 0 }],
      subs: [{ nodes: [{ x: 2, y: 2 }] }] },
    { id: 'd', type: 'draw', ox: 0, oy: 0, pts: [[0, 0], [10, 20]], width: 2 },
    { id: 'l', type: 'line', x1: 0, y1: 0, x2: 10, y2: 10, width: 2 },
  ] } };
  const out = canvasExpand([{ id: 'i1', type: 'instance', componentId: 'c1', x: 100, y: 0, w: 200, h: 100 }], comps);
  const v = out[0], d = out[1], l = out[2];
  // The offset is folded in by the scaler, so it starts again at zero rather
  // than being counted a second time when the item is drawn.
  assert.deepEqual([v.ox, v.oy], [0, 0]);
  assert.deepEqual([v.nodes[0].x, v.nodes[0].y], [110, 5], 'a node lands in the instance');
  assert.equal(v.nodes[1].h1x, 118, 'and so does its handle');
  assert.deepEqual(v.subs[0].nodes[0], { x: 114, y: 7 },
    'the subpaths that make the holes go through the same mapping');
  assert.deepEqual(d.pts, [[100, 0], [120, 20]], 'a pen stroke keeps its shape');
  assert.deepEqual([l.x1, l.y1, l.x2, l.y2], [100, 0, 120, 10], 'and a line its two ends');
}

console.log('Passed: an instance resolves into ordinary items, once, for all three drawers.');

// The inactive-artboard preview must receive the shared definitions too. Use
// its actual doc expression: expansion alone passes even when this wiring is missing.
{
  const { parse } = await import('@babel/parser');
  const ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
  const editor = ast.program.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'CanvasEditor');
  let docExpression;
  const visit = n => {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'JSXOpeningElement' && n.name?.name === 'CanvasThumb') {
      const attr = n.attributes.find(a => a.name?.name === 'doc');
      const expression = attr?.value?.expression;
      if (expression && /\bb\b/.test(src.slice(expression.start, expression.end))) docExpression = expression;
    }
    for (const value of Object.values(n)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(editor);
  assert.ok(docExpression, 'inactive artboard preview found');
  const previewDoc = new Function('b', 'components', `return (${src.slice(docExpression.start, docExpression.end)});`);
  const components = { c: { w: 10, h: 10, items: [box('part')] } };
  const boards = [0, 1].map(i => ({ id: `board-${i}`, items: [box(`plain-${i}`),
    { id: `instance-${i}`, type: 'instance', componentId: 'c', x: 20, y: 30, w: 10, h: 10 }] }));
  for (const active of [0, 1, 0]) {
    const inactive = boards[1 - active];
    const doc = previewDoc(inactive, components);
    const rendered = canvasExpand(doc.items, doc.components);
    assert.equal(rendered.length, 2);
    assert.ok(rendered.some(it => it.id === `instance-${1-active}:part` && it.type === 'rect'),
      'component stays visible when its board becomes inactive');
  }
  console.log('Passed: inactive artboards retain component contents across board switches.');
}

// Off-centre parts must orbit the instance centre as well as turn themselves.
{
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
  const components = { c: { w: 100, h: 100, items: [
    box('rect', { x: 10, y: 20, w: 20, h: 10, rot: 15 }),
    { id: 'line', type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 },
    { id: 'path', type: 'path', nodes: [{ x: 10, y: 20, h1x: 5, h1y: 20 }],
      subs: [{ nodes: [{ x: 20, y: 30 }] }] },
  ] } };
  const instance = { id: 'i', type: 'instance', componentId: 'c', x: 200, y: 300, w: 100, h: 100, rot: 90 };
  const [rect, line, path] = canvasExpand([instance], components);
  near(rect.x, 265); near(rect.y, 315); near(rect.rot, 105);
  near(line.x1, 300); near(line.y1, 300); near(line.x2, 300); near(line.y2, 400);
  near(path.nodes[0].x, 280); near(path.nodes[0].y, 310);
  near(path.nodes[0].h1x, 280); near(path.nodes[0].h1y, 305);
  near(path.subs[0].nodes[0].x, 270); near(path.subs[0].nodes[0].y, 320);
  assert.equal(components.c.items[0].rot, 15, 'definition remains unchanged');
  const [unchanged] = canvasExpand([{ ...instance, rot: 0 }], components);
  near(unchanged.x, 210); near(unchanged.y, 320); near(unchanged.rot, 15);
  console.log('Passed: component rotation moves contents around its centre, including paths and handles.');
}
