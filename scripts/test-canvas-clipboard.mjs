import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '@babel/parser';
const src = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
const editor = ast.program.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'CanvasEditor');
const grab = name => {
  const n = editor.body.body.flatMap(n => n.declarations || []).find(n => n.id.name === name);
  assert.ok(n, name);
  return `const ${name} = ${src.slice(n.init.start,n.init.end)};`;
};
const run = new Function('assert', `
let items = [{id:'mask',type:'rect',x:10,y:20,w:30,h:40,groupId:'g',isMask:true},
  {id:'content',type:'rect',x:50,y:70,w:20,h:20,groupId:'g',maskId:'mask'}];
let sel='content',pick=['mask','content'],changes=0;
const clipRef={current:[]};
const selectionIds=()=>new Set(pick.length?pick:[sel]);
const setItems=fn=>{items=fn(items)},setSel=v=>{sel=v},setPick=v=>{pick=v};
const markChange=()=>{changes++};
const canvasRenderBoxOf=it=>it;
const movedBy=(it,dx,dy)=>({x:it.x+dx,y:it.y+dy});
${grab('copySel')}
${grab('deleteSel')}
${grab('pasteClip')}
copySel(); deleteSel();
assert.equal(items.length,0);
assert.equal(clipRef.current.length,2);
// The destination artboard starts empty.
items=[]; pasteClip(null);
assert.equal(items.length,2);
assert.notEqual(items[0].id,'mask');
assert.equal(items[1].maskId,items[0].id);
assert.equal(items[0].groupId,items[1].groupId);
assert.notEqual(items[0].groupId,'g');
assert.equal(items[1].x-items[0].x,40);
assert.equal(items[1].y-items[0].y,50);
assert.equal(pick.length,2);
assert.equal(changes,2,'cut and paste both enter undo history');
pasteClip({x:100,y:200});
assert.equal(items[2].x,100); assert.equal(items[2].y,200);
assert.equal(items[3].x,140); assert.equal(items[3].y,250);
`);
run(assert);
console.log('Passed: cut/paste retains selection, spacing, groups and masks across artboards.');
