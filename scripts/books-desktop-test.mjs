import {_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
await fs.mkdir(path.resolve('.test-artifacts'), { recursive: true });
const root=await fs.mkdtemp(path.join(path.resolve('.test-artifacts'),'books-'));
const source=path.join(root,'source'),dest=path.join(root,'destination');await fs.mkdir(path.join(source,'nested'),{recursive:true});await fs.mkdir(dest);
const fixtures={'Novel.EPUB':'Synthetic first edition','Reader.mobi':'Synthetic mobile book','Comic.cbz':'Synthetic comic','reference.pdf':'Leave this document alone','nested/Novel.EPUB':'Synthetic nested edition'};
for(const [name,contents]of Object.entries(fixtures))await fs.writeFile(path.join(source,name),contents);
const env={...process.env,GEMINI_API_KEY:''};delete env.ELECTRON_RUN_AS_NODE;const executablePath=process.env.TIDY_EXECUTABLE;
const app=await electron.launch({executablePath,args:[...(executablePath?[]:['.']),'--user-data-dir='+path.join(root,'profile')],env,timeout:60000});const errors=[];
try{
const page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.locator('#main-content').waitFor();await page.emulateMedia({reducedMotion:'reduce'});
await page.evaluate(({source,dest})=>{localStorage.setItem('tidy_source_path',source);localStorage.setItem('tidy_dest_path',dest);},{source,dest});await page.reload();
for(const name of ['Documents','Images','Audio','Video','Archives'])await page.getByRole('switch',{name,exact:true}).uncheck();
assert.equal(await page.getByRole('switch',{name:'Books',exact:true}).isChecked(),true);
await page.getByRole('button',{name:/^Books\s+21 types/}).click();
for(const ext of ['epub','mobi','azw3','fb2','djvu','cbz'])await page.getByRole('button',{name:'.'+ext,exact:true}).waitFor();
await page.getByRole('button',{name:'.mobi',exact:true}).click();await page.getByRole('button',{name:'Run Tidy',exact:true}).click();
const preview=page.getByRole('dialog',{name:'Preview Changes',exact:true});await preview.waitFor();assert.equal(await preview.getByText('Reader.mobi',{exact:true}).count(),0);assert.equal(await preview.getByText('Novel.EPUB',{exact:true}).count(),1);assert.equal(await preview.getByText('Comic.cbz',{exact:true}).count(),1);assert.equal(await preview.getByText('reference.pdf',{exact:true}).count(),0);await page.keyboard.press('Escape');
await page.getByRole('button',{name:'.mobi',exact:true}).click();
await page.getByRole('switch',{name:'Include subfolders',exact:true}).check();const types=page.getByRole('group',{name:'File type selection',exact:true});await types.getByRole('checkbox',{name:'.epub',exact:true}).waitFor();
await page.getByRole('button',{name:'Clear file types',exact:true}).click();await types.getByRole('checkbox',{name:'.epub',exact:true}).check();
await page.getByRole('button',{name:'Run Tidy',exact:true}).click();await preview.waitFor();assert.equal(await preview.getByText('Novel.EPUB',{exact:true}).count(),2);assert.equal(await preview.getByText('Reader.mobi',{exact:true}).count(),0);
await preview.getByRole('button',{name:'Confirm & Run',exact:true}).click();await page.getByRole('heading',{name:'Tidy Complete!',exact:true}).waitFor();
const filed=await fs.readdir(path.join(dest,'Books','epub'));assert.deepEqual(filed.sort(),['Novel (1).EPUB','Novel.EPUB']);assert.equal(await fs.readFile(path.join(source,'reference.pdf'),'utf8'),fixtures['reference.pdf']);assert.equal(await fs.readFile(path.join(source,'Reader.mobi'),'utf8'),fixtures['Reader.mobi']);
await page.getByRole('button',{name:'Undo Changes',exact:true}).click();await page.getByRole('heading',{name:'Undo Complete',exact:true}).waitFor();for(const [name,contents]of Object.entries(fixtures))assert.equal(await fs.readFile(path.join(source,name),'utf8'),contents);await page.keyboard.press('Escape');
await page.getByRole('switch',{name:'Include subfolders',exact:true}).uncheck();await page.getByRole('switch',{name:'Books',exact:true}).uncheck();await page.getByRole('button',{name:'Run Tidy',exact:true}).click();await preview.waitFor();assert.equal(await preview.getByRole('button',{name:'Confirm & Run',exact:true}).isDisabled(),true);await page.keyboard.press('Escape');await page.getByRole('switch',{name:'Books',exact:true}).check();
const require=createRequire(import.meta.url),axe=await fs.readFile(require.resolve('axe-core/axe.min.js'),'utf8');
for(const theme of ['light','dark']){await page.evaluate(theme=>{document.documentElement.classList.toggle('dark',theme==='dark');},theme);await page.getByRole('button',{name:'.epub',exact:true}).scrollIntoViewIfNeeded();await page.evaluate(code=>(0,eval)(code),axe);const result=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));await fs.writeFile(path.join(root,"accessibility-"+theme+".json"),JSON.stringify(result,null,2));assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))})),[]);await page.screenshot({path:path.join(root,'books-'+theme+'.png')});}
assert.deepEqual(errors,[]);await fs.writeFile(path.join(root,'results.json'),JSON.stringify({passed:true,packaged:!!executablePath,checks:['Books offers 21 formats','MOBI deselection changes preview','EPUB appears in subfolder type selection','Exact EPUB scope moves only matching books','Nested same-named books keep both files','Undo restores exact contents and original paths','PDF remains outside Books','Disabled Books prevents moves','Light/dark accessibility'],pageErrors:errors},null,2));
console.log('PASS Books category UI, extension toggles, recursive EPUB selection, safe file moves, Undo and light/dark accessibility');
}finally{await app.close();}
