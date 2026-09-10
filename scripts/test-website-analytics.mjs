import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const code = await readFile(new URL('../api/website-track.js', import.meta.url), 'utf8');
const { default: handler } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
process.env.SUPABASE_URL = 'https://test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-secret';
const calls = [];
globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return { ok: true }; };
const request = (body = { path: '/', referrer: 'https://google.com' }, headers = {}, method = 'POST') => new Request('https://app.i7os.com/api/website-track', {
  method, headers: { origin: 'https://www.i7os.com', 'x-vercel-forwarded-for': '192.0.2.1', 'x-vercel-ip-country': 'DE', 'user-agent': 'Mozilla/5.0', ...headers },
  ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
});
assert.equal((await handler(request({}, {origin:'https://evil.invalid'}))).status,403);
assert.equal((await handler(request({}, {}, 'GET'))).status,405);
assert.equal((await handler(request({}, {}, 'OPTIONS'))).status,204);
assert.equal((await handler(request({}, {dnt:'1'}))).status,204);
assert.equal((await handler(request({}, {'sec-gpc':'1'}))).status,204);
assert.equal((await handler(request({}, {'user-agent':'Googlebot'}))).status,204);
assert.equal(calls.length,0);
assert.equal((await handler(request('x'.repeat(2049)))).status,413);
assert.equal((await handler(request({path:'/private?email=test@example.com'}))).status,400);
assert.equal((await handler(request({path:'/',referrer:'javascript:alert(1)'}))).status,400);
assert.equal((await handler(request())).status,204);
const data=JSON.parse(calls.at(-1).body);
assert.match(data.p_visitor,/^[a-f0-9]{64}$/);
assert.equal(data.p_country,'DE');
assert.equal(data.p_source,'google.com');
assert.ok(!calls.at(-1).body.includes('192.0.2.1'));
await handler(request({path:'/de/index.html',referrer:'https://www.i7os.com/pricing?secret=yes'}));
const second=JSON.parse(calls.at(-1).body);
assert.equal(second.p_visitor,data.p_visitor);
assert.equal(second.p_path,'/de');
assert.equal(second.p_source,'Intern');
await handler(request({}, {'x-vercel-forwarded-for':'192.0.2.2'})); // invalid path must not count
await handler(request({path:'/'}, {'x-vercel-forwarded-for':'192.0.2.2'}));
assert.notEqual(JSON.parse(calls.at(-1).body).p_visitor,data.p_visitor);
const beforeFallback=calls.length;
await handler(request({path:'/'}, {'x-vercel-forwarded-for':'', 'x-forwarded-for':'192.0.2.3'}));
assert.equal(calls.length,beforeFallback+1);
const tracker=await readFile(new URL('../../i7os-website/website-analytics.js', import.meta.url),'utf8');
let events=[]; let listener;
const context={location:{hostname:'www.i7os.com',pathname:'/pricing'},navigator:{},document:{visibilityState:'hidden',referrer:'https://google.com/search?q=private',addEventListener:(_,fn)=>listener=fn},URL,fetch:async (...args)=>events.push(args)};
vm.runInNewContext(tracker,context); assert.equal(events.length,0);
context.document.visibilityState='visible'; listener(); listener(); assert.equal(events.length,1);
assert.deepEqual(JSON.parse(events[0][1].body),{path:'/pricing',referrer:'https://google.com'});
for (const override of [{navigator:{doNotTrack:'1'}},{navigator:{globalPrivacyControl:true}},{location:{hostname:'localhost'}}]) {
  events=[]; vm.runInNewContext(tracker,{...context,...override}); assert.equal(events.length,0);
}
console.log('Passed: origin/auth surface, opt-out, bots, payload limits, path validation, HMAC privacy, source sanitization, visibility and duplicate counting.');
