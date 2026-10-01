import {spawn} from 'node:child_process';

// A single encoder owns its failure signal. A closed pipe must never wait for drain.
export function createEncoder(args,{command='ffmpeg'}={}) {
 const process=spawn(command,args,{stdio:['pipe','ignore','pipe']});
 let error=null,stderr='',closed=false;
 let resolveDone,rejectDone;
 const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});
 done.catch(()=>{});
 const failed=new Promise((_,reject)=>{
  const fail=e=>{error=e;reject(e);};
  process.once('error',fail);
  process.stdin.on('error',fail);
  process.once('exit',(code,signal)=>{closed=true;if(code!==0)fail(Error(`Encoder exited ${signal??code}: ${stderr}`));});
 });
 failed.catch(()=>{});
 process.stderr.on('data',b=>stderr=(stderr+b).slice(-64000));
 process.once('close',code=>error||code!==0?rejectDone(error??Error(stderr)):resolveDone());
 const write=async buffer=>{
  if(error||closed||process.stdin.destroyed)throw error??Error('Encoder input is closed');
  await Promise.race([new Promise((resolve,reject)=>process.stdin.write(buffer,e=>e?reject(e):resolve())),failed]);
 };
 const finish=async()=>{if(error||closed)throw error??Error('Encoder already exited');process.stdin.end();await done;};
 const stop=async()=>{process.stdin.destroy();if(!closed)process.kill('SIGKILL');try{await done;}catch{}};
 return {write,finish,stop,failed,get error(){return error;}};
}
