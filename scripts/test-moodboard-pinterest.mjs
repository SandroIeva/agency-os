import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const component = ast.program.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'AssetsView');
const declarations = new Map(component.body.body.filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations).filter(n => n.id.type === 'Identifier').map(n => [n.id.name, n.init]));
const slice = n => source.slice(n.start, n.end);
const overview = component.body.body.find(n => n.type === 'IfStatement' && slice(n.test) === '!activeBoard');
const detail = component.body.body.at(-1);
assert(declarations.get('pinterestDialogs').start < overview.start);
assert(slice(overview).includes('{pinterestDialogs}'));
assert(slice(detail).includes('{pinterestDialogs}'));
assert(slice(detail).includes('boardFullscreen ? createPortal(boardDetail, document.body) : boardDetail'));

// Render the actual shared JSX, with portals kept inline for server rendering.
const sharedJS = transformSync(`globalThis.Dialog = () => (${slice(declarations.get('pinterestDialogs'))});`, { loader: 'jsx' }).code;
const renderContext = vm.createContext({ React, motion: { div: ({ whileHover, whileTap, children, ...props }) => React.createElement('div', props, children) }, createPortal: node => node, document: { body: {} },
  pinConnectAsk: null, pinSync: null, pinPick: { target: { title: 'Example' }, boards: [], step: 'boards', selected: [], loading: false },
  loadingItems: false, appLanguage: 'de', darkMode: false, theme: {}, FONT: 'sans-serif', primaryBtn: {}, t: () => '',
  closePinPick() {}, backPinPick() {}, openPinPickBoard() {}, addPinsToBoard() {}, setPinPick() {} });
vm.runInContext(sharedJS, renderContext);
assert.match(renderToStaticMarkup(React.createElement(renderContext.Dialog)), /Hinzufügen zu: .*Example/);

const names = ['closePinPick', 'isPinPickCurrent', 'backPinPick', 'openPinPick', 'openPinPickBoard', 'addPinsToBoard'];
const behavior = names.map(name => `globalThis.${name} = ${slice(declarations.get(name))};`).join('\n');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function setup() {
  const c = vm.createContext({ activeBoard: { id: 'example', title: 'Example' }, userOrg: { id: 'workspace' },
    activeMoodboardRef: { current: { boardId: 'example', orgId: 'workspace' } }, pinPickRequest: { current: 0 }, pinAddBusyRef: { current: false },
    pinPick: null, items: [], loadingItems: false, session: { user: { id: 'user' } }, appLanguage: 'de', planLimitError: () => null, writes: [],
    pinPost: async () => ({ boards: [{ id: 'pinterest-board', name: 'References' }] }), syncPinterestBoard() {} });
  c.setPinPick = update => { c.pinPick = typeof update === 'function' ? update(c.pinPick) : update; };
  c.setItems = update => { c.items = typeof update === 'function' ? update(c.items) : update; };
  c.supabase = { from: table => { assert.equal(table, 'moodboard_items'); return { insert: rows => { c.writes.push(rows); return { select: async () => ({ data: rows.map((row, i) => ({ ...row, id: `row-${i}` })), error: null }) }; } }; } };
  vm.runInContext(behavior, c);
  return c;
}
async function selection(c) {
  await c.openPinPick();
  c.pinPost = async () => ({ pins: [{ id: 'pin-1', url: 'https://example.com/image.jpg', title: 'Reference' }] });
  await c.openPinPickBoard(c.pinPick.boards[0]);
  c.pinPick.selected = ['pin-1'];
}
{
  const c = setup(); await selection(c); await c.addPinsToBoard();
  assert.equal(c.writes.length, 1); assert.equal(c.writes[0][0].board_id, 'example'); assert.equal(c.writes[0][0].org_id, 'workspace');
  assert.equal(c.items.length, 1); assert.equal(c.pinPick, null);
}
for (const fail of [false, true]) {
  const c = setup(), request = deferred(); c.pinPost = () => request.promise;
  const pending = c.openPinPick(); c.closePinPick();
  fail ? request.reject(new Error('offline')) : request.resolve({ boards: [] });
  await pending; assert.equal(c.pinPick, null, 'closed dialog must stay closed');
}
{
  const c = setup(); await c.openPinPick(); const request = deferred(); c.pinPost = () => request.promise;
  const pending = c.openPinPickBoard(c.pinPick.boards[0]); c.backPinPick();
  request.resolve({ pins: [{ id: 'stale' }], bookmark: 'next' }); await pending;
  assert.equal(c.pinPick.step, 'boards'); assert.equal(c.pinPick.pins.length, 0);
}
{
  const c = setup(); await selection(c); c.activeMoodboardRef.current = { boardId: 'other', orgId: 'workspace' };
  await c.addPinsToBoard(); assert.equal(c.writes.length, 0);
}
{
  const c = setup(); await selection(c); const request = deferred();
  c.supabase = { from: () => ({ insert: rows => { c.writes.push(rows); return { select: () => request.promise }; } }) };
  const pending = c.addPinsToBoard(); await c.addPinsToBoard(); assert.equal(c.writes.length, 1, 'prevent duplicate submit');
  c.closePinPick(); c.activeMoodboardRef.current = { boardId: 'other', orgId: 'workspace' }; c.items = [{ id: 'other-board-item' }];
  request.resolve({ data: [{ id: 'inserted' }], error: null }); await pending;
  assert.equal(c.writes[0][0].board_id, 'example'); assert.equal(c.items.length, 1); assert.equal(c.items[0].id, 'other-board-item'); assert.equal(c.pinPick, null);
}
for (const rejects of [false, true]) {
  const c = setup(); await selection(c);
  c.supabase = { from: () => ({ insert: () => ({ select: async () => { if (rejects) throw new Error('offline'); return { error: { message: 'limit' } }; } }) }) };
  await c.addPinsToBoard(); assert.equal(c.pinPick.busy, false); assert.equal(c.pinPick.error, rejects ? 'offline' : 'limit'); assert.equal(c.pinAddBusyRef.current, false);
}
{
  const c = setup(); await selection(c); c.items = [{ metadata: { pinId: 'pin-1' } }];
  await c.addPinsToBoard(); assert.equal(c.writes.length, 0); assert.equal(c.items.length, 1);
}
{
  const c = setup(); await selection(c); c.loadingItems = true;
  await c.addPinsToBoard(); assert.equal(c.writes.length, 0, 'wait for existing board items before adding');
}
console.log('Pinterest regression checks passed: dialog rendering, destination, stale requests, navigation, duplicate submission and errors.');
