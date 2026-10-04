import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {verifyOutputFile} from '../scripts/media-retention.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t){
 const directory=await mkdtemp(path.join(os.tmpdir(),'pdoom-retention-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 await mkdir(path.join(directory,'provenance'));await mkdir(path.join(directory,'outputs'));
 const bytes=Buffer.from('original registered media');
 const variant={id:'main',generation_id:'VIDEO_001_V002_001',output:{path:'outputs/clip.mp4',sha256:digest(bytes),size_bytes:bytes.length}};
 const version={directory,manifest:{project_id:'VIDEO_001',version:'v002'}};
 const receipt={schema_version:1,action:'remove-local-output',status:'completed',authorized_by:'conversation-user',user_statement:'Delete this output.',deleted_at:'2026-10-04T09:00:00Z',project_id:'VIDEO_001',version:'v002',variant_id:variant.id,generation_id:variant.generation_id,output:{...variant.output}};
 async function record(value=receipt){
  const text=JSON.stringify(value);await writeFile(path.join(directory,'provenance/cleanup.json'),text);
  variant.output.retention={state:'removed-by-user',record:'provenance/cleanup.json',record_sha256:digest(text)};
 }
 return {version,variant,bytes,receipt,record,file:path.join(directory,variant.output.path)};
}

test('missing outputs fail unless an exact completed user-removal receipt is bound',async t=>{
 const f=await fixture(t);
 await assert.rejects(verifyOutputFile(f.version,f.variant),{code:'ENOENT'});
 await f.record();assert.equal((await verifyOutputFile(f.version,f.variant)).state,'removed-by-user');
 await assert.rejects(verifyOutputFile(f.version,f.variant,{requireMedia:true}),/restore or rebuild/);
 assert.equal((await verifyOutputFile(f.version,f.variant,{sourceOnly:true})).state,'source-only');
});

test('a cleanup receipt never bypasses integrity checks on a present or restored output',async t=>{
 const f=await fixture(t);await f.record();await writeFile(f.file,'different media');
 await assert.rejects(verifyOutputFile(f.version,f.variant),/Output hash mismatch/);
 await writeFile(f.file,f.bytes);assert.equal((await verifyOutputFile(f.version,f.variant)).state,'present');
 assert.equal((await verifyOutputFile(f.version,f.variant,{requireMedia:true})).state,'present');
});

test('tampered, incomplete and mismatched removal records fail even in source-only checks',async t=>{
 const f=await fixture(t);await f.record();
 await writeFile(path.join(f.version.directory,'provenance/cleanup.json'),'{}');
 await assert.rejects(verifyOutputFile(f.version,f.variant,{sourceOnly:true}),/receipt hash mismatch/);
 for(const change of [{status:'planned'},{authorized_by:'automatic'},{user_statement:''},{deleted_at:'invalid'},{project_id:'OTHER'},{version:'v003'},{variant_id:'other'},{generation_id:'OTHER'},{output:{...f.receipt.output,path:'outputs/other.mp4'}},{output:{...f.receipt.output,sha256:'wrong'}},{output:{...f.receipt.output,size_bytes:999}}]){
  await f.record({...f.receipt,...change});
  await assert.rejects(verifyOutputFile(f.version,f.variant,{sourceOnly:true}),/user-authorized receipt|identity mismatch/);
 }
 await f.record();f.variant.output.retention.record='provenance/../../outside.json';
 await assert.rejects(verifyOutputFile(f.version,f.variant),/inside its project/);
});
