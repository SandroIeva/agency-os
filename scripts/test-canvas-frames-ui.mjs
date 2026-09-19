import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir=mkdtempSync(join(tmpdir(),'i7-frames-'));
import {parse} from '@babel/parser';
import traverseModule from '@babel/traverse';
import {build} from 'esbuild';
const source=readFileSync('src/App.jsx','utf8');
const ast=parse(source,{sourceType:'module',plugins:['jsx']});let program;
traverseModule.default(ast,{Program(p){program=p;}});
const included=new Set(),defs=new Set();
const stubs=new Set(['supabase','currentEntitlements','CANVAS_SHAPES']);
function include(name){if(included.has(name)||stubs.has(name))return;included.add(name);const b=program.scope.getBinding(name);if(!b)return;const p=b.path;const statement=p.isVariableDeclarator()?p.parentPath:p.isImportSpecifier()||p.isImportDefaultSpecifier()?p.parentPath:p;defs.add(statement.node);p.traverse({ReferencedIdentifier(q){const b=q.scope.getBinding(q.node.name);if(b?.scope===program.scope)include(q.node.name);}});}
include('CanvasEditor');
let code=[...defs].sort((a,b)=>a.start-b.start).map(n=>source.slice(n.start,n.end)).join('\n');
code+=`\nimport {createRoot} from 'react-dom/client';
const currentEntitlements={}; const supabase={}; const CANVAS_SHAPES=[];
const testFrame={id:'f',type:'rect',isFrame:true,name:'Test Frame',x:100,y:100,w:400,h:200,fill:'#fff',stroke:'#999',strokeWidth:1};
const testDoc={bg:'#eee',items:[testFrame,{id:'t',type:'text',frameId:'f',x:125,y:130,w:180,text:'Button',size:28,weight:600,color:'#15151c'}]};
window.saved=null;window.errors=[];
const darkMode=new URLSearchParams(location.search).has('dark');
const theme={text:darkMode?'#eee':'#28283D',textDim:darkMode?'#aaa':'#666',textFaint:'#888',textSub:'#999',borderFaint:darkMode?'#333':'#ddd',accent:'#28283D',bg:darkMode?'#15151c':'#fff'};
createRoot(document.getElementById('root')).render(<CanvasEditor size={[800,600]} title="Frame test" doc={testDoc} brand={{}} theme={theme} darkMode={darkMode} appLanguage="en" onClose={()=>{}} onDone={()=>{}} onAutoSave={doc=>{window.saved=doc;}} />);`;
await build({stdin:{contents:code,loader:'jsx',resolveDir:process.cwd()+'/src'},bundle:true,format:'iife',jsx:'automatic',outfile:join(dir,'frames-ui.js')});
const html='<html><head><style>body{margin:0}*{box-sizing:border-box}</style></head><body><div id="root"></div><script src="/frames-ui.js"></script></body></html>';
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url.startsWith('/frames-ui.js')?'text/javascript':'text/html');res.end(req.url.startsWith('/frames-ui.js')?readFileSync(join(dir,'frames-ui.js')):html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 for (const dark of [false,true]) {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+(dark?'/?dark':''),{waitUntil:'domcontentloaded'});
  await page.getByTitle('Draw frame',{exact:true}).waitFor();
  await page.waitForTimeout(700);
  assert.equal(await page.getByText('Test Frame',{exact:true}).count(),0,'No frame label on canvas');
  await page.getByTitle('Layers',{exact:true}).click();
  await page.getByRole('button',{name:'Collapse frame',exact:true}).click();
  assert.equal(await page.getByText('Button',{exact:true}).count(),1,'Folded frame hides its layer children');
  await page.getByRole('button',{name:'Expand frame',exact:true}).click();
  assert.equal(await page.getByText('Button',{exact:true}).count(),2,'Frame child appears as a nested layer');
  await page.getByTitle('Layers',{exact:true}).click();
  await page.mouse.click(620,470);
  await page.getByRole('button',{name:'Add auto layout',exact:true}).click();
  await page.waitForFunction(()=>window.saved?.boards[0].items[0].autoLayout?.enabled);
  await page.getByRole('slider',{name:'Top',exact:true}).press('ArrowRight');
  await page.waitForFunction(()=>window.saved?.boards[0].items[0].autoLayout?.paddingTop===17);
  const padding=await page.evaluate(()=>window.saved.boards[0].items[0].autoLayout);
  assert.equal(padding.paddingY,16,'Other padding sides retain previous values');
  const width=await page.evaluate(()=>window.saved.boards[0].items[0].w);
  assert.ok(width<400,'Frame hugs text');
  await page.getByText('Button',{exact:true}).first().dblclick();
  await page.locator('textarea').fill('A much longer button label');
  await page.locator('textarea').press('Escape');
  await page.waitForFunction(w=>window.saved?.boards[0].items[0].w>w,width);
  await page.getByTitle('Draw frame',{exact:true}).click();
  await page.mouse.move(720,580);await page.mouse.down();await page.mouse.move(970,760,{steps:8});await page.mouse.up();
  await page.waitForFunction(()=>window.saved?.boards[0].items.filter(it=>it.isFrame).length===2);
  const drawn=await page.evaluate(()=>window.saved.boards[0].items.filter(it=>it.isFrame).at(-1));
  assert.equal(drawn.w,250);assert.equal(drawn.h,180);
  await page.getByRole('button',{name:'Add auto layout',exact:true}).waitFor();
  await page.getByRole('textbox',{name:'Frame name',exact:true}).fill('Content frame');
  await page.getByRole('textbox',{name:'Frame name',exact:true}).press('Enter');
  await page.waitForFunction(()=>window.saved?.boards[0].items.some(it=>it.name==='Content frame'));

  await page.getByTitle('Text',{exact:true}).click();
  await page.mouse.click(750,620);
  await page.waitForFunction(()=>window.saved?.boards[0].items.some(it=>it.text==='Text'));
  const addedText=await page.evaluate(()=>window.saved.boards[0].items.find(it=>it.text==='Text'));
  assert.equal(addedText.frameId,drawn.id,'New text belongs to drawn frame');
  await page.getByTitle('Shapes',{exact:true}).first().click();
  await page.getByTitle('Circle',{exact:true}).click();
  await page.mouse.move(860,660);await page.mouse.down();await page.mouse.move(910,710,{steps:5});await page.mouse.up();
  await page.waitForFunction(()=>window.saved?.boards[0].items.some(it=>it.type==='ellipse'));
  assert.equal(await page.evaluate(()=>window.saved.boards[0].items.find(it=>it.type==='ellipse').frameId),drawn.id,'New shape belongs to frame');
  const beforeMove=await page.evaluate(()=>window.saved.boards[0].items);
  await page.keyboard.down('Alt');
  await page.mouse.move(940,740);await page.mouse.down();await page.mouse.move(920,720,{steps:5});await page.mouse.up();
  await page.keyboard.up('Alt');
  await page.waitForFunction(id=>window.saved.boards[0].items.find(it=>it.id===id).x<519,drawn.id);
  const afterMove=await page.evaluate(()=>window.saved.boards[0].items);
  const parentBefore=beforeMove.find(it=>it.id===drawn.id),parentAfter=afterMove.find(it=>it.id===drawn.id);
  for(const child of beforeMove.filter(it=>it.frameId===drawn.id)) {
    const moved=afterMove.find(it=>it.id===child.id);
    assert.equal(moved.x-child.x,parentAfter.x-parentBefore.x);
    assert.equal(moved.y-child.y,parentAfter.y-parentBefore.y);
    assert.equal(moved.frameId,drawn.id);
  }

  // Reloaded fixture exercises the other direction and fixed sizing controls.
  await page.getByRole('button',{name:'Add auto layout',exact:true}).click();
  await page.getByText('Horizontal',{exact:true}).click();
  await page.getByText('Vertical',{exact:true}).click();
  await page.waitForFunction(()=>window.saved?.boards[0].items.filter(it=>it.isFrame).at(-1).autoLayout?.direction==='vertical');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:join(tmpdir(),dark?'i7-frames-dark.png':'i7-frames-light.png')});
  await page.close();
 }
 console.log('PASS: real editor in light/dark, frame drawing, auto layout, text editing grows frame, direction and autosave.');
} finally { await browser?.close();server.close();rmSync(dir,{recursive:true,force:true}); }
