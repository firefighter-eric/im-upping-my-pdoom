import {chromium} from 'playwright';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {once} from 'node:events';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadVersion,saveJson} from '../../../../../scripts/project.mjs';
import {buildRenderer,rendererFiles,rendererURL} from '../../../../../scripts/renderer.mjs';
import {createProjectServer} from '../../../../../scripts/server.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const version=await loadVersion('math','v003.0'),m=version.manifest;
const digest=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const runId='RUN_'+new Date().toISOString().replace(/[:.]/g,'-')+'_'+randomUUID().slice(0,8);
const lock=path.join(version.directory,'.render.lock'),record=path.join(version.directory,'runs',runId+'.json');
const annotations=JSON.parse(await readFile(path.join(version.directory,m.data.annotations_zh),'utf8'));
const annotated=new Set(annotations.items.map(item=>item.index));
const receipt={id:runId,project_id:m.project_id,version:m.version,status:'preparing',purpose:'stills',started_at:new Date().toISOString(),renderer_sha256:await digest(path.join(version.directory,m.renderer.path)),renderer_files:await rendererFiles(version),data_hashes:{},treatment_sha256:await digest(path.join(version.directory,'TREATMENT.md')),settings:m.settings,request:m.request,script_sha256:await digest(path.join(here,'render-design-stills.mjs')),tools:{browser:'TBD',method:'Three.js renderFrame; exact-time stills; no video or audio encoding'},variants:[m.variants[0].id],outputs:[]};
for(const [key,file] of Object.entries(m.data))receipt.data_hashes[key]=await digest(path.join(version.directory,file));
await mkdir(path.dirname(record),{recursive:true});await saveJson(record,receipt);
let owned=false,server,browser;
try {
  await writeFile(lock,runId,{flag:'wx'});owned=true;
  const build=await buildRenderer(version);receipt.build_key=build.key;
  server=createProjectServer(version.projectDirectory,{rendererBuild:build});server.listen(0,'127.0.0.1');await once(server,'listening');
  browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-background-timer-throttling']});receipt.tools.browser=browser.version();
  const page=await browser.newPage({viewport:{width:m.settings.width,height:m.settings.height}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.goto(rendererURL(version,server.address().port,{exportMode:true}).href);await page.evaluate(async()=>{await window.ready;await document.fonts.ready;});
  const dir=path.join(version.directory,'stills',runId);await mkdir(dir,{recursive:true});
  for(const [i,t] of m.still_review.times_seconds.entries()) {
    const image=await page.evaluate(({t,id})=>window.renderFrame(t,id),{t,id:m.variants[0].id});
    const state=await page.evaluate(()=>window.scrollPreview.state());
    if(i===1) {
      const maxOffset=722*76-(866-108),offset=maxOffset*(t-2.75)/(52.91-2.75);
      const range=[Math.floor(offset/76),Math.ceil((offset+758)/76)];
      for(let row=range[0];row<range[1];row++)if(!annotated.has(row))throw Error('Unprepared Chinese annotation in design sample: '+row);
      receipt.middle_scene={seconds:t,visible_range:range,notes_complete_for_visible_rows:true,shared_offset_px:offset};
    }
    if(errors.length)throw Error(errors.join('\n'));
    const file=path.join(dir,['01-opening.jpg','02-directory.jpg','03-closing.jpg'][i]);
    await writeFile(file,Buffer.from(image,'base64'));
    receipt.outputs.push({variant:m.variants[0].id,path:path.relative(version.directory,file),seconds:t,sha256:await digest(file),scope:'design still only'});
  }
  receipt.status='completed';receipt.finished_at=new Date().toISOString();await saveJson(record,receipt);
  m.still_review={...m.still_review,status:'review',run_id:runId,images:receipt.outputs};
  m.renderer.sha256=receipt.renderer_sha256;m.renderer.files=receipt.renderer_files;m.data_hashes=receipt.data_hashes;
  m.validation.still_capture='passed';m.validation.human_review='pending';await saveJson(path.join(version.directory,'manifest.json'),m);
  console.log(JSON.stringify({run_id:runId,status:receipt.status,images:receipt.outputs.map(output=>path.join(version.directory,output.path))},null,2));
} catch(error) {
  receipt.status='failed';receipt.finished_at=new Date().toISOString();receipt.error=error.message;await saveJson(record,receipt);throw error;
} finally {
  if(browser)await browser.close();if(server)server.close();if(owned)await unlink(lock);
}
