import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const dir=path.dirname(fileURLToPath(import.meta.url)),out=path.resolve(dir,'../.test-artifacts/design-system');await fs.mkdir(out,{recursive:true});
const require=createRequire(import.meta.url),axe=await fs.readFile(require.resolve('axe-core/axe.min.js'),'utf8');
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');const target=path.resolve(dir,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!target.startsWith(dir+path.sep)){res.writeHead(403).end();return;}const content=await fs.readFile(target);res.writeHead(200,{'Content-Type':({'.html':'text/html','.png':'image/png','.json':'application/json','.css':'text/css','.md':'text/plain'})[path.extname(target)]||'text/plain'});res.end(content);}catch{res.writeHead(404).end('Not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const errors=[],report=[];page.on('pageerror',error=>errors.push(error.message));
async function check(name){await page.evaluate(code=>(0,eval)(code),axe);const result=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));report.push({name,violations:result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});assert.deepEqual(report.at(-1).violations,[],name);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' horizontal overflow');}
try{
await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('heading',{name:'Familiar controls. Deliberate moments of control.'}).waitFor();
await check('light / wide');await page.screenshot({path:path.join(out,'reference-light.png')});
await page.getByRole('button',{name:'Use dark theme',exact:true}).click();await check('dark / wide');await page.screenshot({path:path.join(out,'reference-dark.png')});
await page.getByRole('button',{name:'Use light theme',exact:true}).click();
await page.locator('#component-search').fill('switch');assert.equal(await page.locator('[data-component]:visible').count(),1);await page.locator('#component-search').fill('');assert.equal(await page.locator('[data-component]:visible').count(),11);
const toggle=page.getByRole('switch',{name:'Include subfolders example'});await toggle.click();assert.equal(await toggle.getAttribute('aria-checked'),'true');
await page.getByRole('checkbox',{name:'.pdf',exact:true}).uncheck();assert.equal(await page.getByRole('checkbox',{name:'.pdf',exact:true}).isChecked(),false);
const radio=page.getByRole('radio',{name:'Manual',exact:true});await radio.focus();await page.keyboard.press('End');assert.equal(await page.getByRole('radio',{name:'Monthly',exact:true}).isChecked(),true);
await page.locator('#open-workflow').click();await check('review dialog');await page.screenshot({path:path.join(out,'reference-review.png')});for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('#workflow-demo')),true);}
await page.getByRole('button',{name:'Apply and preview',exact:true}).click();await page.getByRole('heading',{name:'Preview Changes',exact:true}).waitFor();await check('file preview dialog');
await page.locator('#workflow-demo').getByRole('button',{name:'Confirm & Run',exact:true}).click();await page.getByRole('heading',{name:'Demo complete',exact:true}).waitFor();await page.getByRole('button',{name:'Undo demo',exact:true}).click();await page.getByRole('heading',{name:'Demo undone',exact:true}).waitFor();await page.getByRole('button',{name:'Finish',exact:true}).click();assert.equal(await page.locator('#open-workflow').evaluate(n=>n===document.activeElement),true);
await page.locator('#open-workflow').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#workflow-demo').evaluate(n=>n.open),false);
for(const width of [900,640]){await page.setViewportSize({width,height:960});await page.goto('http://127.0.0.1:'+server.address().port+'/#components');await check('layout / '+width+' CSS px');await page.screenshot({path:path.join(out,'reference-'+width+'.png')});}
await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});await check('Windows contrast theme / narrow');
for(const file of ['cover','foundations','components','selection','patterns','portfolio']){const bytes=await fs.readFile(path.join(dir,'exports',file+'.png'));assert.equal(bytes.subarray(1,4).toString(),'PNG');}
const tokens=JSON.parse(await fs.readFile(path.join(dir,'design-tokens.json'),'utf8')),inventory=JSON.parse(await fs.readFile(path.join(dir,'component-inventory.json'),'utf8'));assert.equal(Object.keys(tokens.colors).length,23);assert.equal(inventory.variantCount,49);assert.deepEqual(errors,[]);
console.log('PASS local reference: themes, 11-family search, live controls, keyboard radio selection, review/preview/confirm/Undo simulation, dialog focus/Escape, responsive layouts, contrast theme and PNG/JSON assets.');
}finally{await fs.writeFile(path.join(out,'validation.json'),JSON.stringify({browser:'Isolated Chrome via existing Playwright library',states:report,pageErrors:errors,limits:['Documentation examples are simulated','640 CSS px is a layout-width check, not a claim of native browser zoom testing','Automated accessibility results are not a conformance certification']},null,2));await browser.close();await new Promise(resolve=>server.close(resolve));}
