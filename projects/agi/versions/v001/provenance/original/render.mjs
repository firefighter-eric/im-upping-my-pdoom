import {chromium} from '/Users/eric/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {once} from 'node:events';
const root=path.dirname(fileURLToPath(import.meta.url));
const outputs=path.resolve(root,'../../generations');await mkdir(outputs,{recursive:true});
const features=JSON.parse(await readFile(path.join(root,'audio-features-v001.json')));
const server=createServer(async(req,res)=>{try{let f=path.join(root,decodeURIComponent((req.url??'/').split('?')[0]));let b=await readFile(f);res.setHeader('Content-Type',f.endsWith('.html')?'text/html':'application/json');res.end(b)}catch{res.statusCode=404;res.end()}});server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling']});
try{const page=await browser.newPage({viewport:{width:1920,height:1080}});await page.goto(`http://127.0.0.1:${server.address().port}/renderer.html`);await page.evaluate(()=>window.ready);
const kinds=process.argv.slice(2).length?process.argv.slice(2):['abstract','narrative','lyrics'];
for(const kind of kinds){
 const id={abstract:'001',narrative:'002',lyrics:'003'}[kind];
 if(kind==='stills'){for(const mode of ['abstract','narrative','lyrics'])for(const t of [5,27,46,64,83,100,124,145]){await page.evaluate(({t,mode})=>window.renderFrame(t,mode),{t,mode});await page.locator('canvas').screenshot({path:path.join(root,`${mode}-${t}.jpg`)});}continue;}
 const out=path.join(outputs,`LLMV_001_MV_${id}_${kind}_1080p24_v001.mp4`);
 const args=['-hide_banner','-loglevel','error','-n','-f','image2pipe','-vcodec','mjpeg','-framerate','24','-i','pipe:0','-i',path.resolve(root,'../../audio/LLMV_001_audio_original_v001.m4a'),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',out];
 const encoder=spawn('ffmpeg',args,{stdio:['pipe','ignore','pipe']});let error='';encoder.stderr.on('data',b=>error+=b);const done=once(encoder,'exit');
 const frames=Math.ceil(features.duration*24);
 for(let i=0;i<frames;i+=12){let count=Math.min(12,frames-i);let data=await page.evaluate(({i,count,kind})=>Array.from({length:count},(_,j)=>window.renderFrame((i+j)/24,kind)),{i,count,kind});for(let frame of data){if(!encoder.stdin.write(Buffer.from(frame,'base64')))await once(encoder.stdin,'drain')}if(i%240===0)console.log(kind,Math.round(i/frames*100)+'%',Math.round(i/24)+'s');}
 encoder.stdin.end();let [code]=await done;if(code!==0)throw new Error(error);console.log('COMPLETE',out);
}
}finally{await browser.close();server.close()}
