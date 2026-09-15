import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { parse } from '@babel/parser';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const hook = ast.program.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'useCollectionLoad');
const code = `import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
${source.slice(hook.start, hook.end)}
window.requests = [];
window.frames = [];
function Fixture({ org, project }) {
 const [rows, setRows] = useState([]);
 const load = useCollectionLoad(org, project);
 const reload = () => load.run(() => new Promise((resolve, reject) => {
   window.requests.push({ org, project, resolve, reject });
 }), setRows);
 useEffect(() => { reload(); }, [load.run]);
 window.reload = reload;
 const view = load.pending ? 'loading' : load.error ? 'error' : rows.length ? rows.join(',') : 'empty';
 window.frames.push(view);
 return <div id="status">{view}</div>;
}
const root = createRoot(document.getElementById('root'));
window.show = (org, project = null) => flushSync(() => root.render(<React.StrictMode><Fixture org={org} project={project}/></React.StrictMode>));
window.show(null);`;
const bundle = await build({ stdin: { contents: code, loader: 'jsx', resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife' });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
 const page = await browser.newPage();
 await page.setContent('<div id="root"></div>');
 await page.addScriptTag({ content: bundle.outputFiles[0].text });
 const status = async value => { await page.waitForFunction(v => document.querySelector('#status').textContent === v, value); };
 await status('loading');
 assert.equal(await page.evaluate(() => requests.length), 0, 'No query before workspace is known');
 await page.evaluate(() => show('A'));
 await status('loading');
 await page.evaluate(() => requests.at(-1).resolve(['artboard']));
 await status('artboard');
 assert.equal(await page.evaluate(() => frames.includes('empty')), false, 'No empty flash during hydration or data load');
 await page.evaluate(() => show('A', 'project'));
 await status('loading');
 await page.evaluate(() => requests.at(-1).resolve([]));
 await status('empty');
 await page.evaluate(() => { reload(); });
 await status('loading');
 await page.evaluate(() => requests.at(-1).reject(new Error('offline')));
 await status('error');
 await page.evaluate(() => { reload(); });
 await page.evaluate(() => requests.at(-1).resolve(['retry-success']));
 await status('retry-success');
 await page.evaluate(() => { reload(); window.stale = requests.at(-1); show('B'); });
 await status('loading');
 await page.evaluate(() => requests.at(-1).resolve(['workspace-B']));
 await status('workspace-B');
 await page.evaluate(() => stale.resolve([]));
 await page.waitForTimeout(30);
 await status('workspace-B');
 await page.evaluate(() => { reload(); window.older = requests.at(-1); reload(); });
 await page.evaluate(() => requests.at(-1).resolve(['newest']));
 await status('newest');
 await page.evaluate(() => older.resolve([]));
 await page.waitForTimeout(30);
 await status('newest');
 console.log('PASS: hydration, slow loads, confirmed empty, project/workspace switches, stale responses, failures and retry (StrictMode).');
} finally { await browser.close(); }
