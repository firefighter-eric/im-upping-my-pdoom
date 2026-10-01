import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
import {once} from 'node:events';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {ROOT,parseOptions,loadVersion,saveJson} from './project.mjs';
import {createProjectServer} from './server.mjs';
const o=parseOptions(process.argv.slice(2)),v=await loadVersion(o.project,o.version),m=v.manifest;
if(m.variants.some(x=>!x.output))throw Error('Playback acceptance needs every variant output registered');
const server=createProjectServer(v.projectDirectory);server.listen(0,'127.0.0.1');await once(server,'listening');let browser;
try{
 const config={headless:true};if(o.browser==='chrome'||(!o.browser&&process.platform==='darwin'&&existsSync('/Applications/Google Chrome.app')))config.channel='chrome';browser=await chromium.launch(config);
 const page=await browser.newPage(),results=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const variant of m.variants){
  const url=`http://127.0.0.1:${server.address().port}/versions/${o.version}/${variant.output.path}`;
  await page.goto(url);const player=page.locator('video');await player.waitFor();
  await player.evaluate(async v=>{v.muted=true;await v.play()});await page.waitForTimeout(1100);
  const initial=await player.evaluate(v=>({src:v.currentSrc,time:v.currentTime,readyState:v.readyState,error:v.error?.message??null,width:v.videoWidth,height:v.videoHeight,duration:v.duration}));
  if(initial.time<=0||initial.readyState<3||initial.error||initial.width!==m.settings.width||initial.height!==m.settings.height)throw Error('Initial playback failed '+variant.id);
  const seeks=[];for(const fraction of [.3,.64,.93]){
   const t=initial.duration*fraction;await player.evaluate((v,t)=>new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=t}),t);await page.waitForTimeout(250);
   const state=await player.evaluate(v=>({time:v.currentTime,readyState:v.readyState,error:v.error?.message??null}));if(state.time<=t||state.readyState<3||state.error)throw Error('Seek/playback failed '+variant.id);seeks.push(state);
  }
  await player.evaluate(v=>v.pause());results.push({variant:variant.id,generation_id:variant.generation_id,...initial,seeks});
 }
 if(errors.length)throw Error(errors.join('\n'));
 const directory=path.join(ROOT,'.cache/acceptance');await mkdir(directory,{recursive:true});
 const record={project_id:m.project_id,version:m.version,date:new Date().toISOString(),browser:browser.version(),status:'passed',results};
 await saveJson(path.join(directory,`${o.project}-${o.version}-playback.json`),record);console.log(JSON.stringify(record,null,2));
}finally{if(browser)await browser.close();server.close();}
