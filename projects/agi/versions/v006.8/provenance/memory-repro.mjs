import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const mode=process.argv[2];
const failed=new Promise(()=>{});globalThis.keepFailure=failed;
global.gc();const initial=process.memoryUsage().heapUsed;
for(let i=0;i<700;i++){
 const payload=Promise.resolve(randomBytes(96*1024).toString('base64'));
 const value=mode==='before'?await Promise.race([payload,failed]):await payload;
 if(value.length!==131072)throw Error('Unexpected payload.');
}
global.gc();global.gc();
const result={mode,iterations:700,characters_per_frame:131072,initial_heap_bytes:initial,final_heap_bytes:process.memoryUsage().heapUsed};
result.retained_heap_growth_bytes=result.final_heap_bytes-initial;
await writeFile('.cache/v0068-memory-'+mode+'.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
