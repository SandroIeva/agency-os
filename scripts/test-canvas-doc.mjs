// The editor's document, assembled while somebody is standing inside a
// component. This exists for one failure: `items` holds the COMPONENT's parts
// while a component is open, and filing those as the active board's items
// deletes the board at the next autosave, a second later, with nothing on
// screen saying so. The artboards have already been emptied once by a mistake
// of exactly this shape, from the other direction (a stale peer's snapshot).
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const i = src.indexOf('const canvasAssembleDoc = ({');
assert.ok(i > 0, 'canvasAssembleDoc not found');
const end = src.indexOf('\n});', i) + 4;
const { canvasAssembleDoc } = await import('data:text/javascript,'
  + encodeURIComponent(src.slice(i, end) + '\nexport { canvasAssembleDoc };'));

const boardItems = [{ id: 'a' }, { id: 'b' }];
const compItems = [{ id: 'p' }];
const boards = [
  { id: 'b0', name: 'Artboard 1', w: 100, h: 100, items: boardItems },
  { id: 'b1', name: 'Artboard 2', w: 100, h: 100, items: [{ id: 'z' }] },
];
const live = { w: 100, h: 100, bg: '#fff', radius: 0, clip: true, shadow: true };
const components = { c1: { id: 'c1', name: 'Logo', w: 10, h: 10, items: [{ id: 'old' }] } };

// ── Not in a component: unchanged behaviour ─────────────────────────────────
{
  const d = canvasAssembleDoc({ boards, active: 0, live, components: null, focus: null,
    items: boardItems, stage: null });
  assert.deepEqual(d.boards[0].items, boardItems, 'the active board takes what is on screen');
  assert.deepEqual(d.boards[1].items, [{ id: 'z' }], 'the others are untouched');
  assert.equal(d.components, undefined, 'no components, nothing written');
  assert.equal(d.stage, undefined);
}

// ── Inside a component: THE trap ────────────────────────────────────────────
{
  const focus = { cid: 'c1', instanceId: 'i1', parked: boardItems, cam: null };
  const d = canvasAssembleDoc({ boards, active: 0, live, components, focus,
    items: compItems, stage: null });

  assert.deepEqual(d.boards[0].items, boardItems,
    'THE TRAP: the board keeps its own parts, not the component\'s');
  assert.notDeepEqual(d.boards[0].items, compItems,
    'if this ever fails, the next autosave deletes the artboard');
  assert.deepEqual(d.components.c1.items, compItems,
    'and the component gets the live edits');
  assert.equal(d.components.c1.name, 'Logo', 'keeping everything else it had');
  assert.deepEqual(d.boards[1].items, [{ id: 'z' }], 'the other board is still untouched');
}

// ── Inside a component while the SECOND board is active ─────────────────────
{
  const parked = [{ id: 'z' }];
  const focus = { cid: 'c1', instanceId: 'i1', parked, cam: null };
  const d = canvasAssembleDoc({ boards, active: 1, live, components, focus,
    items: compItems, stage: null });
  assert.deepEqual(d.boards[1].items, parked, 'the board being stood on keeps its parts');
  assert.deepEqual(d.boards[0].items, boardItems, 'and so does the one beside it');
}

// ── A component that is not in the map yet is created, not lost ─────────────
{
  const focus = { cid: 'neu', instanceId: 'i1', parked: boardItems, cam: null };
  const d = canvasAssembleDoc({ boards, active: 0, live, components, focus,
    items: compItems, stage: null });
  assert.deepEqual(d.components.neu.items, compItems);
  assert.deepEqual(d.components.c1.items, [{ id: 'old' }], 'the others are left alone');
}

// ── The board's own fields still come from the live state ──────────────────
{
  const d = canvasAssembleDoc({ boards, active: 0, live: { ...live, bg: '#000', w: 640 },
    components: null, focus: null, items: boardItems, stage: '#eee' });
  assert.equal(d.boards[0].bg, '#000');
  assert.equal(d.boards[0].w, 640);
  assert.equal(d.boards[0].name, 'Artboard 1', 'and the name it already had survives');
  assert.equal(d.stage, '#eee');
}

console.log('Passed: a component open on screen never overwrites the artboard underneath it.');
