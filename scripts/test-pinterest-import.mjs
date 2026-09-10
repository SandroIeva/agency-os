import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { pinterestPinImages } from '../server/pinterest.js';

const image = (url, width = 600) => ({ url, width, height: 400 });
const single = { id: 'single', title: 'Title', media: { images: { '600x': image('small'), '1200x': image('large') } } };
assert.equal(pinterestPinImages(single)[0].url, 'large');
assert.equal(pinterestPinImages(single)[0].id, 'single');
const carousel = { id: 'carousel', title: 'Fallback', media: { media_type: 'multiple_images', items: Array.from({ length: 10 }, (_, i) => ({ images: { '1200x': image(`image-${i}`) }, link: `source-${i}` })) } };
const images = pinterestPinImages(carousel);
assert.equal(images.length, 10);
assert.equal(new Set(images.map(p => p.id)).size, 10);
assert(images.every(p => p.pinId === 'carousel'));
assert.equal(images[9].mediaIndex, 9);
assert.equal(images[9].link, 'source-9');
assert.equal(images[9].title, 'Fallback');
assert.equal(pinterestPinImages({ id: 'video', media: { cover_image_url: 'cover' } })[0].url, 'cover');
assert.equal(pinterestPinImages({ id: 'missing', media: null }).length, 0);
const mixed = pinterestPinImages({ id: 'mix', media: { items: [{}, { images: { large: image('image') } }, { cover_image_url: 'video-cover' }] } });
assert.deepEqual(mixed.map(p => p.id), ['mix:1', 'mix:2']);
assert.equal(pinterestPinImages({ id: 'fallback', media: { images: { large: { width: 1000 }, small: image('valid', 100) } } })[0].url, 'valid');

const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const component = ast.program.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'AssetsView');
const importer = component.body.body.filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations).find(n => n.id.name === 'importPinterestBoard').init;
const code = `globalThis.runImport = ${source.slice(importer.start, importer.end)};`;
function setup(pages) {
  const c = vm.createContext({ userOrg: { id: 'workspace' }, projectId: 'project', session: { access_token: 'test', user: { id: 'user' } },
    appLanguage: 'de', pinImportBusyRef: { current: false }, pinImport: { boards: [carousel] }, boards: [], writes: [], opened: [], calls: [], deleted: [],
    planLimitError: () => null });
  c.setPinImport = fn => { c.pinImport = typeof fn === 'function' ? fn(c.pinImport) : fn; };
  c.setBoards = fn => { c.boards = fn(c.boards); };
  c.openBoard = board => c.opened.push(board);
  c.fetch = async (_, options) => { c.calls.push(JSON.parse(options.body)); const page = pages.shift(); assert(page, 'unexpected page request'); return { ok: true, json: async () => page }; };
  c.supabase = { from: table => ({
    insert: rows => {
      c.writes.push({ table, rows });
      if (table === 'moodboards') return { select: () => ({ single: async () => ({ data: { ...rows, id: 'new-board' } }) }) };
      return Promise.resolve({ error: c.itemError || null });
    },
    delete: () => ({ eq: async (_, id) => { c.deleted.push(id); return { error: null }; } }),
  }) };
  vm.runInContext(code, c);
  return c;
}
{
  const c = setup([{ pins: images, bookmark: null }]); await c.runImport({ id: 'board', name: 'Modern branding' });
  assert.equal(c.writes.length, 2); assert.equal(c.writes[1].rows.length, 10);
  assert(c.writes[1].rows.every(row => row.board_id === 'new-board' && row.org_id === 'workspace'));
  assert.equal(c.writes[1].rows[9].metadata.sourcePinId, 'carousel');
  assert.equal(c.writes[1].rows[9].metadata.mediaIndex, 9);
  assert.equal(c.opened.length, 1); assert.equal(c.pinImport, null);
}
{
  const c = setup([{ pins: [], bookmark: 'next' }, { pins: images, bookmark: null }]);
  await c.runImport({ id: 'board', name: 'Modern branding' }); assert.equal(c.writes[1].rows.length, 10); assert.equal(c.calls.length, 2);
}
{
  const many = Array.from({ length: 501 }, (_, i) => ({ id: `pin-${i}`, url: `image-${i}` }));
  const c = setup([{ pins: many, bookmark: 'next' }, { pins: [many[0], { id: 'last', url: 'last' }], bookmark: null }]);
  await c.runImport({ id: 'board', name: 'Large board' }); assert.equal(c.writes[1].rows.length, 502); assert.equal(c.calls[1].bookmark, 'next');
}
for (const pages of [[{ pins: [], bookmark: null }], [{ pins: images, bookmark: 'repeat' }, { pins: images, bookmark: 'repeat' }]]) {
  const c = setup(pages); await c.runImport({ id: 'board', name: 'Board' });
  assert.equal(c.writes.length, 0); assert(c.pinImport.error); assert.equal(c.pinImportBusyRef.current, false);
}
{
  const c = setup([{ pins: images }]); c.itemError = { message: 'write failed' };
  await c.runImport({ id: 'board', name: 'Board' }); assert.equal(c.deleted[0], 'new-board'); assert.equal(c.opened.length, 0); assert.equal(c.pinImport.error, 'write failed');
}
{
  const c = setup([{ pins: images }]); await Promise.all([c.runImport({ id: 'board', name: 'Board' }), c.runImport({ id: 'board', name: 'Board' })]);
  assert.equal(c.calls.length, 1); assert.equal(c.writes.length, 2);
}
if (process.argv[2]) {
  const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const liveImages = raw.items.flatMap(pinterestPinImages);
  assert.equal(liveImages.length, 10);
  const c = setup([{ pins: liveImages, bookmark: raw.bookmark }]);
  await c.runImport({ id: '1126674100470158420', name: 'Modern branding' });
  assert.equal(c.writes[1].rows.length, 10);
  console.log('Actual Modern branding response: all 10 images imported by the tested flow.');
}
console.log('Pinterest import checks passed: multi-image pins, previews, pagination, no empty imports, cleanup and duplicate clicks.');
