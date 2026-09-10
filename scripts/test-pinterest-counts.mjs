import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPinterestImageCounter, pinterestBoardCountLabel } from '../src/pinterestImageCounts.js';
import { pinterestPinImages } from '../server/pinterest.js';

assert.equal(pinterestBoardCountLabel(1, 10, false, true), '1 Pin (10 Bilder)');
assert.equal(pinterestBoardCountLabel(2, 1, false, true), '2 Pins (1 Bild)');
assert.equal(pinterestBoardCountLabel(0, 0, false, true), '0 Pins (0 Bilder)');
assert.equal(pinterestBoardCountLabel(1, 10, false, false), '1 Pin (10 images)');
assert.match(pinterestBoardCountLabel(null, null, false, true), /unbekannt.*gezählt/);
assert.match(pinterestBoardCountLabel(1, null, true, true), /nicht verfügbar/);
const board = { id: 'board', pinCount: 1 };
const image = id => ({ id, url: `image-${id}` });
{
  const pages = [{ pins: [image('a'), image('b')], bookmark: 'next' }, { pins: [image('b'), image('c'), { id: 'no-image' }] }];
  let calls = 0;
  const count = createPinterestImageCounter(async body => { assert.equal(body.mode, 'pins'); assert.equal(body.bookmark, calls ? 'next' : null); return pages[calls++]; });
  assert.equal(await count(board), 3);
  assert.equal(await count(board), 3); assert.equal(calls, 2, 'reuse the count while browsing');
}
{
  let calls = 0;
  const count = createPinterestImageCounter(async () => { calls++; return { pins: [image(calls)] }; });
  await count(board); await count({ ...board, pinCount: 2 }); assert.equal(calls, 2, 'changed pin count invalidates cache');
}
{
  const count = createPinterestImageCounter(async () => ({ pins: [image('a')], bookmark: 'repeat' }));
  await assert.rejects(count(board), /Repeated/);
}
{
  let calls = 0;
  const count = createPinterestImageCounter(async () => { if (!calls++) throw new Error('offline'); return { pins: [] }; });
  await assert.rejects(count(board), /offline/); assert.equal(await count(board), 0, 'errors must not cache a false zero');
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
{
  const pending = []; let requests = 0;
  const count = createPinterestImageCounter(async () => { requests++; const d = deferred(); pending.push(d); return d.promise; });
  const first = count({ id: 'a' }), second = count({ id: 'b' });
  const controller = new AbortController(); const third = count({ id: 'c' }, { signal: controller.signal });
  const cancelled = assert.rejects(third, { name: 'AbortError' });
  await Promise.resolve(); assert.equal(requests, 2, 'at most two board counts in parallel');
  controller.abort(); await cancelled;
  pending.forEach(p => p.resolve({ pins: [] })); await Promise.all([first, second]);
  assert.equal(requests, 2, 'closed off-screen rows must not issue requests');
}
{
  const d = deferred(); let requests = 0;
  const count = createPinterestImageCounter(async (_, { signal }) => { assert(signal); requests++; return requests === 1 ? d.promise : { pins: [image('new')] }; });
  const controller = new AbortController(); const pending = count(board, { signal: controller.signal });
  const cancelled = assert.rejects(pending, { name: 'AbortError' });
  await Promise.resolve(); controller.abort(); d.resolve({ pins: [image('old')], bookmark: 'next' }); await cancelled;
  assert.equal(await count(board, { signal: new AbortController().signal }), 1); assert.equal(requests, 2, 'do not cache an aborted count or fetch another page');
}
if (process.argv[2]) {
  const response = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const count = createPinterestImageCounter(async () => ({ pins: response.items.flatMap(pinterestPinImages), bookmark: response.bookmark }));
  assert.equal(pinterestBoardCountLabel(response.items.length, await count(board), false, true), '1 Pin (10 Bilder)');
  console.log('Modern branding: 1 Pin (10 Bilder).');
}
console.log('Pinterest image count checks passed: pagination, deduplication, cache, cancellation, concurrency and labels.');
