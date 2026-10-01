import {mkdir,writeFile,cp,readFile} from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import {createHash} from 'node:crypto';
import {ROOT,SLUG,parseOptions,saveJson,listProjects,loadProject} from './project.mjs';
const o=parseOptions(process.argv.slice(2));if(!SLUG.test(o.slug??'')||!/^([A-Z][A-Z0-9_]+)$/.test(o.id??''))throw Error('Required: --slug <lowercase-slug> --id <STABLE_ID> [--title <title>]');
for(const slug of await listProjects()){if((await loadProject(slug)).metadata.id===o.id)throw Error('Project ID already exists');}
const project=path.join(ROOT,'projects',o.slug);await mkdir(project);for(const d of ['sources/references','sources/audio','versions/v001/data'])await mkdir(path.join(project,d),{recursive:true});
const version=path.join(project,'versions/v001');await cp(path.join(ROOT,'templates/three-webgl'),path.join(version,'renderer'),{recursive:true});
await writeFile(path.join(project,'project.yaml'),YAML.stringify({schema_version:1,id:o.id,slug:o.slug,title:o.title??'TBD',created_at:new Date().toISOString(),type:'code-video',sources:[],rights:{status:'TBD'}}));
const rendererHash=createHash('sha256').update(await readFile(path.join(version,'renderer/index.html'))).digest('hex');
await saveJson(path.join(version,'manifest.json'),{schema_version:1,project_id:o.id,version:'v001',parent_version:null,status:'draft',created_at:new Date().toISOString(),request:['TBD'],model:'TBD',method:'TBD',renderer:{path:'renderer/index.html',entrypoint:'renderFrame',engine:'three-webgl',build:'vite',source_directory:'renderer',sha256:rendererHash},settings:{width:3840,height:2160,fps:60,duration_seconds:null,target_frames:null,frame_transport:'rgba-websocket'},inputs:{audio:{source_id:'TBD',path:'TBD',sha256:'TBD'}},data:{},variants:[{id:'main',label:'TBD',generation_id:`${o.id}_V001_001`,description:'TBD',known_issues:[],output:null}],rights:{status:'TBD'},validation:{}});
await writeFile(path.join(version,'TREATMENT.md'),'# Treatment v001\n\nSubject, narrative, prompts and source mapping: TBD.\n');console.log(project);
