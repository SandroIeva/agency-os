import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('const canvasFramePadding ='), source.indexOf('const canvasExpand ='));
const { attach, layout, descendants, layerRows } = new Function('canvasRenderBoxOf', 'measureCtx', 'canvasText', 'canvasFontAt', 'canvasLS', `${helpers}; return {attach:canvasFrameAttach,layout:canvasFrameLayout,descendants:canvasFrameDescendants,layerRows:canvasFrameLayerRows};`)(
  it => it.type === 'text' ? {...it, h: Math.ceil(it.text.length * 10 / it.w) * 20 || 20} : it,
  () => ({measureText: () => ({width:10})}), it => it.text, () => '10px Test', () => 0,
);
const frame = {id:'f',type:'rect',isFrame:true,x:10,y:10,w:300,h:200};
const text = {id:'t',type:'text',x:30,y:30,w:100,text:'Hello'};
let items = attach([text,frame],['f'],true);
assert.equal(items[0].id,'f');
assert.equal(items[1].frameId,'f');
items = layout(items.map(it=>it.id==='f'?{...it,autoLayout:{enabled:true,direction:'horizontal',paddingX:16,paddingY:8,gap:12,hugW:true,hugH:true}}:it));
assert.equal(items[0].w,82);assert.equal(items[0].h,36);
assert.equal(items[1].x,26);assert.equal(items[1].y,18);
let expanded = layout(items.map(it=>it.id==='t'?{...it,text:'Longer button label'}:it),items);
assert.equal(expanded[0].w,222,'Frame grows with text');
assert.equal(expanded[1].w,190);
let moved = layout(expanded.map(it=>it.id==='f'?{...it,x:110,y:70}:it),expanded);
assert.equal(moved[1].x,126);assert.equal(moved[1].y,78);
assert.deepEqual([...descendants(moved,['f'])],['f','t']);
let fixed = layout([{...frame,autoLayout:{enabled:true,direction:'vertical',gap:10,paddingX:5,paddingY:5,align:'center'}},
 {id:'a',type:'rect',frameId:'f',x:0,y:0,w:40,h:20}, {id:'b',type:'rect',frameId:'f',x:0,y:0,w:60,h:30}]);
assert.equal(fixed[1].x,140);assert.equal(fixed[2].y,45);assert.equal(fixed[0].w,300);
const nested = layout([{...frame,autoLayout:{enabled:true,hugW:true,hugH:true,paddingX:10,paddingY:10}},
 {id:'inner',type:'rect',isFrame:true,frameId:'f',x:40,y:40,w:50,h:50,autoLayout:{enabled:true,hugW:true,hugH:true,paddingX:5,paddingY:5}},
 {...text,frameId:'inner'}]);
assert.equal(nested[0].w,80);assert.equal(nested[1].x,20);assert.equal(nested[2].x,25);
let dropped = attach([{...frame},{id:'outside',type:'rect',x:50,y:60,w:10,h:10}],['outside']);
assert.equal(dropped[1].frameId,'f');
dropped = attach(dropped.map(it=>it.id==='outside'?{...it,x:900}:it),['outside']);
assert.equal(dropped[1].frameId,undefined);
const restored = layout(JSON.parse(JSON.stringify(nested)));
assert.deepEqual(restored,nested,'Saved frame reloads without layout drift');
console.log('PASS: frame capture, drop in/out, horizontal/vertical layout, text growth, movement, nesting, persistence.');

const small = {...frame,w:80,h:40};
const createdText = attach([small,{...text,x:20,y:20,w:500}],['t'],false,true);
assert.equal(createdText[1].frameId,'f','Text created inside a small frame belongs to it before measuring');

const asym=layout([{...frame,autoLayout:{enabled:true,hugW:true,hugH:true,paddingLeft:7,paddingRight:19,paddingTop:3,paddingBottom:11}}, {...text,frameId:'f'}]);
assert.equal(asym[0].w,76);assert.equal(asym[0].h,34);
assert.equal(asym[1].x,17);assert.equal(asym[1].y,13);
assert.deepEqual(layerRows(nested).map(({it,depth})=>[it.id,depth]),[['f',0],['inner',1],['t',2]]);
assert.deepEqual(layerRows(nested,['f']).map(({it})=>it.id),['f']);
console.log('PASS: independent padding and nested/collapsible layer hierarchy.');
