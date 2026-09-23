import assert from 'node:assert/strict';
import { saveNewsletterPreference } from '../server/newsletter.js';
const user = { id: 'verified-user', email: 'owner@example.test', email_confirmed_at: '2026-09-23' };
const env = { LOOPS_API_KEY: 'fake-test-key' };
async function run({ subscribed = true, source = 'tour', who = user, dbError = false, responses = [], config = env } = {}) {
  const writes = [], calls = [];
  const admin = { from(table) { assert.equal(table,'profiles'); return { update(value) { writes.push(value); return { eq(key,id) { assert.equal(key,'id'); assert.equal(id,user.id); return { select() { return { async single() { return dbError ? {error:{message:'fail'}} : {data:{id,display_name:'Test Person'}}; } }; } }; } }; } }; } };
  const result = await saveNewsletterPreference({user:who, body:{subscribed,source,email:'attacker@example.test',userId:'someone-else'},admin,env:config,
    fetchImpl: async (url, opts) => { calls.push({url,...opts,body:opts.body && JSON.parse(opts.body)}); const next=responses.shift(); assert.ok(next,`Unexpected request ${url}`); if(next instanceof Error) throw next; return { ok:next.ok!==false, json:async()=>next.data }; } });
  return {result,writes,calls};
}
const lists={data:[{id:'updates-list',name:'i7OS Product Updates'}]}, success={data:{success:true}};
let t=await run({responses:[lists,success]});
assert.equal(t.result.status,200); assert.equal(t.calls[1].body.email,user.email); assert.equal(t.calls[1].body.userId,user.id); assert.equal(t.calls[1].body.subscribed,true); assert.deepEqual(t.calls[1].body.mailingLists,{'updates-list':true}); assert.equal(t.writes[0].marketing_opt_in,true);
t=await run({subscribed:false,responses:[{data:[]}]}); assert.equal(t.result.status,200); assert.equal(t.calls.length,1); assert.equal(t.writes[0].marketing_opt_in,false);
t=await run({subscribed:false,responses:[{data:[{id:'existing'}]},lists,success]}); assert.equal(t.result.status,200); assert.deepEqual(t.calls[2].body.mailingLists,{'updates-list':false}); assert.equal('subscribed' in t.calls[2].body,false);
for(const who of [null,{...user,email_confirmed_at:null}]) {t=await run({who}); assert.equal(t.result.status,401); assert.equal(t.calls.length,0); assert.equal(t.writes.length,0);}
for(const opts of [{subscribed:'true'},{source:'import'}]) {t=await run(opts); assert.equal(t.result.status,400); assert.equal(t.writes.length,0);}
t=await run({dbError:true}); assert.equal(t.result.status,500); assert.equal(t.calls.length,0);
t=await run({config:{}}); assert.equal(t.result.status,502); assert.equal(t.result.saved,true);
for(const responses of [[{ok:false,data:{error:'private provider data'}}],[{data:[]}],[{data:[{id:'one',name:'i7OS Product Updates'},{id:'two',name:'i7OS Product Updates'}]}],[lists,new Error('timeout')],[lists,{data:{success:false}}]]) {t=await run({responses}); assert.equal(t.result.status,502); assert.equal(t.result.saved,true); assert.ok(!JSON.stringify(t.result).includes('private'));}
t=await run({config:{...env,LOOPS_PRODUCT_UPDATES_LIST_ID:'explicit-id'},responses:[success]}); assert.equal(t.calls.length,1); assert.deepEqual(t.calls[0].body.mailingLists,{'explicit-id':true});
console.log('Newsletter tests passed: consent, identity, list targeting, withdrawal, auth, validation, DB/provider failures, timeout, optional list ID.');
