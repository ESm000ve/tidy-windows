import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.png':'image/png','.json':'application/json','.css':'text/css','.md':'text/plain; charset=utf-8','.js':'text/javascript'})[path.extname(file)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404).end('Not found');}});
server.listen(4176,'127.0.0.1',()=>console.log('Tidy design-system reference: http://127.0.0.1:4176/'));
