import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import {createEncoder} from '../scripts/encoder.mjs';
import {cloneVersion,loadVersion,ROOT} from '../scripts/project.mjs';

test('encoder failure while writing a large frame rejects without a drain deadlock',async()=>{
 const encoder=createEncoder(['-e','setTimeout(()=>process.exit(3),10)'],{command:process.execPath});
 try{await assert.rejects(Promise.race([encoder.write(Buffer.alloc(8*1024*1024)),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('deadlock timeout')),2000);timer.unref();})]),error=>!error.message.includes('deadlock'));}finally{await encoder.stop();}
});
test('a successful encoder consumes every byte and exits after input EOF',async()=>{
 const encoder=createEncoder(['-e','let n=0;process.stdin.on("data",b=>n+=b.length);process.stdin.on("end",()=>process.exit(n===1024*1024?0:4))'],{command:process.execPath});
 try{await encoder.write(Buffer.alloc(512*1024));await encoder.write(Buffer.alloc(512*1024));await encoder.finish();}finally{await encoder.stop();}
});
test('modular renderer sources are inherited and approval is cleared in a new version',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'video-renderer-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const project=path.join(root,'projects/example'),old=path.join(project,'versions/v001');await mkdir(path.join(old,'renderer/src'),{recursive:true});await mkdir(path.join(old,'data'));
 await writeFile(path.join(project,'project.yaml'),YAML.stringify({id:'VIDEO_001',slug:'example',title:'Example'}));
 await mkdir(path.join(old,'provenance'));await writeFile(path.join(old,'provenance/import.json'),'{"commit":"reference-commit"}');
 await writeFile(path.join(old,'manifest.json'),JSON.stringify({project_id:'VIDEO_001',version:'v001',status:'approved',review:{human_approval:{scope:'v001'}},reference:{import_record:'provenance/import.json'},renderer:{path:'renderer/index.html',source_directory:'renderer'},variants:[{id:'main',output:{path:'outputs/old.mp4'}}],data:{}}));
 await writeFile(path.join(old,'renderer/index.html'),'<script src="./src/main.ts"></script>');await writeFile(path.join(old,'renderer/src/main.ts'),'export const x=1;');
 const fresh=await cloneVersion('example','v002','v001',root),version=await loadVersion('example','v002',root);
 assert.equal(await readFile(path.join(fresh,'renderer/src/main.ts'),'utf8'),'export const x=1;');assert.equal(version.manifest.review,undefined);assert.equal(version.manifest.status,'draft');assert.equal(version.manifest.variants[0].output,null);
 assert.equal(await readFile(path.join(fresh,version.manifest.reference.import_record),'utf8'),'{"commit":"reference-commit"}');
});
test('verification fails for a requested version that does not exist',()=>{
 assert.throws(()=>execFileSync(process.execPath,[path.join(ROOT,'scripts/verify.mjs'),'--source-only','--project','agi','--version','v999'],{stdio:'pipe'}));
});
