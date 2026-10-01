import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,open,realpath} from 'node:fs/promises';
import path from 'node:path';
import {inside} from './project.mjs';
const MIME={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.m4a':'audio/mp4','.wav':'audio/wav'};
export function byteRange(value,size){const m=/^bytes=(\d*)-(\d*)$/.exec(value??'');if(!m||(!m[1]&&!m[2])||size===0)return null;let start,end;if(!m[1]){const length=Number(m[2]);if(!Number.isSafeInteger(length)||length<=0)return null;start=Math.max(0,size-length);end=size-1;}else{start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;}if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||start>end)return null;return{start,end};}
export function createProjectServer(root,{rendererBuild=null}={}){const rootReady=realpath(root);return createServer(async(req,res)=>{try{
 const canonicalRoot=await rootReady;
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
 let relative;try{relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')}catch{res.writeHead(400);res.end();return;}
 if(!['sources/','versions/'].some(p=>relative.startsWith(p))||relative.split('/').some(p=>p==='..'||p.startsWith('.'))){res.writeHead(403);res.end();return;}
 let file;try{const base=rendererBuild&&relative.startsWith(rendererBuild.prefix)?await realpath(rendererBuild.directory):canonicalRoot;
 const target=base===canonicalRoot?relative:relative.slice(rendererBuild.prefix.length);
 file=inside(base,target);inside(base,path.relative(base,await realpath(file)));}catch{res.writeHead(404);res.end();return;}
 const info=await stat(file);if(!info.isFile()){res.writeHead(404);res.end();return;}
 if(['.mp4','.m4a','.wav'].includes(path.extname(file))){const f=await open(file),b=Buffer.alloc(100);await f.read(b,0,100,0);await f.close();if(b.toString().startsWith('version https://git-lfs.github.com/spec/v1')){res.writeHead(503,{'Content-Type':'text/plain'});res.end('Media not downloaded. Run git lfs pull.');return;}}
 const headers={'Content-Type':MIME[path.extname(file)]??'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'};
 let start=0,end=info.size-1,status=200;if(req.headers.range){const r=byteRange(req.headers.range,info.size);if(!r){res.writeHead(416,{...headers,'Content-Range':`bytes */${info.size}`});res.end();return;}({start,end}=r);status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;}
 headers['Content-Length']=String(Math.max(0,end-start+1));res.writeHead(status,headers);if(req.method==='HEAD'||info.size===0){res.end();return;}
 const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
}catch(e){if(!res.headersSent)res.writeHead(e.code==='ENOENT'?404:500);res.end();}});}
