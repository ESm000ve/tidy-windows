import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
await fs.mkdir('.test-artifacts',{recursive:true});
const root=await fs.mkdtemp(path.join(path.resolve('.test-artifacts'),'dup-'));
const bundle=path.join(root,'s.mjs');
await build({stdin:{contents:'export * from "./electron/services/organizer"; export * from "./electron/services/preview";',resolveDir:process.cwd()},outfile:bundle,bundle:true,platform:'node',format:'esm',external:['@google/genai'],plugins:[{name:'e',setup(b){b.onResolve({filter:/^electron$/},()=>({path:'electron',namespace:'f'}));b.onLoad({filter:/.*/,namespace:'f'},()=>({contents:'export const safeStorage={decryptString:()=>{throw new Error()}}; export const app={getPath:()=>'+JSON.stringify(root)+'};export const Notification={isSupported:()=>false};',loader:'js'}));}}]});
const {buildPreview,runOrganizeJob,undoOperations}=await import(pathToFileURL(bundle));
process.env.GEMINI_API_KEY='';
const src=path.join(root,'src'); await fs.mkdir(src);
await fs.writeFile(path.join(src,'a.txt'),'hello');      // original
await fs.writeFile(path.join(src,'b.txt'),'longer text'); // unique size
await fs.writeFile(path.join(src,'c.txt'),'hello');      // duplicate of a
await fs.writeFile(path.join(src,'d.txt'),'world');      // same size, different
await fs.writeFile(path.join(src,'e.txt'),'hello');      // second duplicate
const cats=[{id:'d',name:'Docs',enabled:true,extensions:['txt'],subfolders:false,duplicateDetection:true}];
const filters={dateModified:'any',fileSize:'any',excludeHidden:false};
const preview=await buildPreview(src,cats,false,filters);
const dup=Object.fromEntries(preview.map(f=>[f.name,f.duplicateOf??null]));
assert.deepEqual(dup,{'a.txt':null,'b.txt':null,'c.txt':'a.txt','d.txt':null,'e.txt':'a.txt'});
const run=await runOrganizeJob({sourcePath:src,destPath:path.join(root,'out'),categories:cats,filters,conflictResolution:'archive'});
assert.equal(run.moved,5); assert.equal(run.duplicates,2);
const archived=(await fs.readdir(path.join(root,'out','Duplicates_Archive'))).sort();
assert.deepEqual(archived,['c.txt','e.txt']);
assert.equal((await undoOperations(run.operations)).reverted,5);
assert.equal((await fs.readdir(src)).length,6-1); // 5 files back (s.mjs is in root)
console.log('PASS size-first duplicate detection: preview and run agree, unique sizes unaffected, Undo restores all');
