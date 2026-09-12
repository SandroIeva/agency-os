import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { parse } from '@babel/parser';
import { build } from 'esbuild';
import traverseModule from '@babel/traverse';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
let program;
traverseModule.default(ast, { Program(path) { program = path; } });
const included = new Set(), definitions = new Set();
const stubs = new Set(['FONT']);
function include(name) {
  if (included.has(name) || stubs.has(name)) return;
  included.add(name);
  const binding = program.scope.getBinding(name);
  if (!binding) return;
  const path = binding.path;
  const statement = path.isVariableDeclarator() ? path.parentPath : path;
  definitions.add(statement.node);
  path.traverse({ ReferencedIdentifier(p) {
    const b = p.scope.getBinding(p.node.name);
    if (b?.scope === program.scope) include(p.node.name);
  } });
}
include('renderPostArtboard'); include('boardsFromDoc');
const rendererCode = [...definitions].sort((a,b)=>a.start-b.start).map(n=>source.slice(n.start,n.end)).join('\n');
const modal = ast.program.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'ImageInsertModal');
const modalCode = source.slice(modal.start,modal.end);
const node = ast.program.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'CreatePostView');
// Exercise the actual component and layout with local images and no account/API.
let component = source.slice(node.start, node.end)
  .replace('const [visual, setVisual] = useState(null)', 'const [visual, setVisual] = useState(testEmpty ? null : testSlides[0])')
  .replace('const [extras, setExtras] = useState([])', 'const [extras, setExtras] = useState(testEmpty ? [] : testSlides.slice(1).map((s,i) => ({...s,id:String(i)})))')
  .replace('const canPublish = stepIdx === LAST && (accounts || []).length > 0', 'const canPublish = stepIdx === LAST && ((accounts || []).length > 0 || new URLSearchParams(location.search).has("preview"))');
const code = `
import React, {useState,useRef,useEffect,useLayoutEffect,useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {motion} from 'framer-motion';
const testEmpty = new URLSearchParams(location.search).has('empty');
const sizes = new URLSearchParams(location.search).get('sizes').split(',').map(x=>x.split('x').map(Number));
const testSlides = sizes.map(([w,h],i)=>({w,h,url:URL.createObjectURL(new Blob([
 '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"><rect width="100%" height="100%" fill="'+['#94c5c7','#b8a1d1','#e4b386'][i%3]+'"/><rect x="2" y="2" width="'+(w-4)+'" height="'+(h-4)+'" fill="none" stroke="#172c39" stroke-width="4"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="'+(Math.min(w,h)/10)+'">'+w+' × '+h+'</text></svg>'
],{type:'image/svg+xml'}))}));
const currentEntitlements={limits:{socialAccounts:10},loaded:true};
const ZERNIO_UI_PLATFORMS=[], POST_CHAR_LIMITS={}, TOUCHPOINT_PLATFORMS=[], FONT='sans-serif';
const frostedPanelStyle=()=>({background:'#fff'}), zernioErrorText=e=>e.message;
const zernioRequest=async()=>({accounts:[]}), zernioKeyFor=x=>x, uiKeyFor=x=>x;
const ChannelConnectChip=()=>null, primaryBtn={}, UPLOAD_ICON=null, StockSearchPanel=()=>null;
const refreshUserFileUrls=async()=>null;
const openBillingSettings=()=>{}, stashZernioReturn=()=>{}, tpGlyphSize=()=>16, touchpointGlyph=()=>null;
const testBoards=[{id:'doc-a',name:'Campaign',w:300,h:450,doc:{boards:[{id:'a',name:'First',w:300,h:450,bg:'#ff0000',items:[]},{id:'b',name:'Second',w:600,h:300,bg:'#0000ff',items:[]}]}},{id:'doc-b',name:'Single',w:200,h:200,doc:{w:200,h:200,bg:'#00ff00',items:[]}}];
const testAssets=testSlides.map((s,i)=>({id:'asset-'+i,name:'Asset '+(i+1),public_url:s.url,mime_type:'image/svg+xml'}));
const supabase={from(table){if(!['brand_canvases','user_files'].includes(table))throw new Error('Unexpected table '+table);const chain={select(){return chain},eq(){return chain},order(){return chain},limit(){return chain},then(resolve){return Promise.resolve({data:table==='brand_canvases'?testBoards:testAssets}).then(resolve)}};return chain}}, uploadTracked=()=>{throw new Error('Unexpected upload')};
const fetch=(url,options)=>String(url).startsWith('/api/')?Promise.resolve({ok:true,json:async()=>({enabled:false})}):window.fetch(url,options);
${rendererCode}
${modalCode}
${component}
createRoot(document.getElementById('root')).render(<React.StrictMode><CreatePostView userOrg={testEmpty ? {id:'fixture',name:'Test workspace'} : null} session={null} onBack={()=>{}} theme={{text:'#15151c',textDim:'#777',textFaint:'#999',border:'#ccc',borderFaint:'#ddd',accent:'#15151c'}} darkMode={false}/></React.StrictMode>);
`;
const dir=mkdtempSync(join(tmpdir(),'post-visual-'));
await build({stdin:{contents:code,loader:'jsx',resolveDir:process.cwd()},bundle:true,outfile:join(dir,'app.js'),define:{'process.env.NODE_ENV':'"development"'}});
writeFileSync(join(dir,'index.html'), '<html><head><style>*{box-sizing:border-box}html,body,#root{margin:0;width:100%;height:100%}body{background:#dedee3}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(readFileSync(join(dir,req.url==='/app.js'?'app.js':'index.html')))});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function verify(carousel) {
  await page.waitForFunction(()=>{const i=document.querySelector('img');return i?.complete&&i.naturalWidth>0&&i.clientHeight>0});
  await page.waitForTimeout(100);
  const box=await page.locator('img').evaluate(img=>{
   const stage=img.parentElement, viewport=stage.parentElement.parentElement, area=viewport.parentElement;
   const r=img.getBoundingClientRect(),v=viewport.getBoundingClientRect(),a=area.getBoundingClientRect();
   return {w:r.width,h:r.height,vw:v.width,vh:v.height,aw:a.width,ah:a.height,nw:img.naturalWidth,nh:img.naturalHeight,left:r.left,right:r.right,vl:v.left,vr:v.right,top:r.top,bottom:r.bottom,vt:v.top,vb:v.bottom,scroll:area.scrollHeight-area.clientHeight,scrollX:area.scrollWidth-area.clientWidth};
  });
  assert(box.vh>50,JSON.stringify(box));
  assert(Math.abs(box.vh-box.ah)<1,'viewport must use all available height');
  assert(Math.abs(box.vw-(box.aw-(carousel?116:0)))<1,'reserve exact arrow gutters');
  const scale=Math.min(box.vw/box.nw,box.vh/box.nh);
  assert(Math.abs(box.w-box.nw*scale)<1 && Math.abs(box.h-box.nh*scale)<1,'image must fill maximum proportional area: '+JSON.stringify(box));
  assert(box.left>=box.vl-1&&box.right<=box.vr+1&&box.top>=box.vt-1&&box.bottom<=box.vb+1,'no clipping');
  assert(box.scroll<=1&&box.scrollX<=1,'no scrollable overflow');
  return box;
 }
 for(const [w,h] of [[1440,900],[1000,850],[820,640]]) {
  await page.setViewportSize({width:w,height:h});
  for(const sizes of ['800x1000','1600x900','3000x1000','160x90','800x1000,1600x900,3000x1000']) {
   await page.goto('http://127.0.0.1:'+server.address().port+'/?sizes='+sizes);await page.waitForTimeout(550);
   const carousel=sizes.includes(',');await verify(carousel);
   if(carousel){for(let i=0;i<3;i++){await page.getByRole('button',{name:'Nächstes Bild'}).click();await verify(true);}}
  }
 }
 await page.setViewportSize({width:1400,height:720});await verify(true);
 await page.getByText('Beschreibung',{exact:true}).click();await page.getByText('Visual',{exact:true}).click();await verify(true);
 await page.getByRole('button',{name:'Nächstes Bild'}).click();await verify(true);
 await page.screenshot({path:join(dir,'landscape.png')});
 // Exercise initial multi-selection with no Instagram connection.
 await page.goto('http://127.0.0.1:'+server.address().port+'/?empty=1&sizes=800x1000,1600x900,3000x1000'); await page.waitForTimeout(550);
 const uploads = ['800x1000','1600x900'].map((size,i)=>{const [w,h]=size.split('x');return {name:'image-'+i+'.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"><rect width="100%" height="100%" fill="red"/></svg>')}});
 await page.locator('input[type=file]').first().setInputFiles(uploads);
 await verify(true); await page.getByRole('button',{name:'Nächstes Bild'}).click(); await verify(true);
 await page.goto('http://127.0.0.1:'+server.address().port+'/?empty=1&sizes=800x1000,1600x900,3000x1000'); await page.waitForTimeout(550);
 await page.getByText('Aus den Assets',{exact:true}).click();
 await page.getByTitle('Asset 2',{exact:true}).click(); await page.getByTitle('Asset 1',{exact:true}).click();
 await page.getByRole('button',{name:'2 Bilder übernehmen'}).click(); await verify(true);
 assert.equal(await page.locator('img').evaluate(i=>i.naturalWidth),1600,'preserve selection order');
 await page.goto('http://127.0.0.1:'+server.address().port+'/?empty=1&sizes=800x1000'); await page.waitForTimeout(550);
 await page.getByText('Artboards',{exact:true}).click();
 await page.getByText('Campaign',{exact:true}).click(); await page.getByText('Single',{exact:true}).click();
 await page.getByRole('button',{name:'3 Bilder übernehmen'}).click(); await verify(true);
 for(const [w,h,color] of [[300,450,[255,0,0]],[600,300,[0,0,255]],[200,200,[0,255,0]]]) {
  const data=await page.locator('img').evaluate(img=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');x.drawImage(img,0,0);return {w:c.width,h:c.height,pixel:[...x.getImageData(5,5,1,1).data].slice(0,3)}});
  assert.equal(data.w,w); assert.equal(data.h,h); assert.deepEqual(data.pixel,color);
  await page.getByRole('button',{name:'Nächstes Bild'}).click(); await verify(true);
 }
 await page.goto('http://127.0.0.1:'+server.address().port+'/?empty=1&sizes=800x1000'); await page.waitForTimeout(550);
 await page.locator('input[type=file]').first().setInputFiles(Array.from({length:11},(_,i)=>({...uploads[0],name:'limit-'+i+'.svg'})));
 await page.getByText('Ein Karussell kann bis zu 10 Bilder enthalten.',{exact:true}).waitFor();
 assert.equal(await page.locator('img').count(),0,'over-limit selection must not partially replace the visual');
 // Channel preview: hover-only arrows stay centered through the first press.
 await page.goto('http://127.0.0.1:'+server.address().port+'/?preview=1&sizes=800x1000,1600x900');
 await page.waitForTimeout(550);
 await page.getByText('Kanäle',{exact:true}).click();
 const frame=page.locator('.post-preview-media');
 const next=frame.getByRole('button',{name:'Nächstes Bild'});
 const arrow=frame.locator('.post-preview-arrow').last();
 await page.mouse.move(0,0); await page.waitForTimeout(220);
 assert.equal(await arrow.evaluate(e=>getComputedStyle(e).opacity),'0');
 await frame.hover(); await page.waitForTimeout(220);
 assert.equal(await arrow.evaluate(e=>getComputedStyle(e).opacity),'1');
 const before=await next.boundingBox();
 await next.hover(); await page.mouse.down(); await page.waitForTimeout(150);
 const pressed=await next.boundingBox();
 assert(Math.abs(before.y+before.height/2-pressed.y-pressed.height/2)<1,'first press must preserve arrow center');
 await page.mouse.up(); await page.waitForTimeout(250);
 const after=await next.boundingBox();
 assert(Math.abs(before.y-after.y)<1,'arrow must not jump after first click');
 for(let i=0;i<2;i++) {
  await frame.locator('img').evaluate(img=>img.decode());
  const inset=await frame.locator('img').evaluate(img=>{const r=img.getBoundingClientRect(),f=img.parentElement.getBoundingClientRect();return [r.left-f.left,f.right-r.right,r.top-f.top,f.bottom-r.bottom]});
  assert(inset.every(n=>n>=23),'preview image must have at least 24px breathing room: '+inset);
  await next.click(); await page.waitForTimeout(200);
 }
 await page.mouse.move(0,0); await page.waitForTimeout(220);
 assert.equal(await arrow.evaluate(e=>getComputedStyle(e).opacity),'0','arrows fade out after clicking and leaving the frame');
 await page.keyboard.press("Tab"); await next.focus(); await page.waitForTimeout(220);
 assert.equal(await arrow.evaluate(e=>getComputedStyle(e).opacity),'1','keyboard users can reveal arrows');
 await page.screenshot({path:join(dir,'channel-preview.png')});
 console.log('Channel preview passed: first-click stability, hover fade, keyboard focus, portrait and landscape insets.');
 assert.deepEqual(errors,[]);
 console.log('Visual layout passed: portrait, landscape, panorama, small images, mixed carousel, three window sizes, resize, step remount, initial multi-upload, multi-asset selection and all nested artboards.');
 console.log('Screenshot: '+join(dir,'landscape.png'));
} finally {await browser?.close(); await new Promise(r=>server.close(r));}
