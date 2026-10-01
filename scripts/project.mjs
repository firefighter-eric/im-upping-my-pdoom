import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,readdir,mkdir,writeFile,cp} from 'node:fs/promises';
import YAML from 'yaml';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const VERSION=/^v\d{3}$/;
export function inside(base,relative) {
 const resolved=path.resolve(base,relative);
 if(resolved!==base&&!resolved.startsWith(base+path.sep))throw Error('Path must stay inside its project');
 return resolved;
}
export function parseOptions(args) {
 const options={};
 for(let i=0;i<args.length;i++){
  const arg=args[i];if(!arg.startsWith('--'))throw Error('Unexpected argument '+arg);
  const name=arg.slice(2);
  if(['stills','smoke','probe','source-only'].includes(name)){options[name]=true;continue;}
  if(i+1>=args.length||args[i+1].startsWith('--'))throw Error('Missing value for '+arg);
  if(options[name]!==undefined)throw Error('Duplicate option '+arg);options[name]=args[++i];
 }
 return options;
}
export async function readJson(file){return JSON.parse(await readFile(file,'utf8'));}
export async function saveJson(file,value){await writeFile(file,JSON.stringify(value,null,2)+'\n');}
export async function listProjects(root=ROOT){
 const directory=path.join(root,'projects');
 return (await readdir(directory,{withFileTypes:true})).filter(x=>x.isDirectory()&&SLUG.test(x.name)).map(x=>x.name).sort();
}
export async function loadProject(slug,root=ROOT){
 if(!SLUG.test(slug??''))throw Error('Use --project <lowercase-slug>');
 const directory=path.join(root,'projects',slug),metadata=YAML.parse(await readFile(path.join(directory,'project.yaml'),'utf8'));
 if(metadata.slug!==slug||!metadata.id)throw Error('Project identity mismatch');return {directory,metadata};
}
export async function loadVersion(slug,version,root=ROOT){
 if(!VERSION.test(version??'')||Number(version.slice(1))<1)throw Error('Use --version v001 or later');
 const project=await loadProject(slug,root),directory=path.join(project.directory,'versions',version),manifest=await readJson(path.join(directory,'manifest.json'));
 if(manifest.project_id!==project.metadata.id||manifest.version!==version)throw Error('Version lineage mismatch');
 return {...project,projectDirectory:project.directory,directory,manifest};
}
export async function versionNames(directory){return (await readdir(path.join(directory,'versions'))).filter(x=>VERSION.test(x)).sort();}
export function outputIdentity(manifest,variant){return {id:variant.generation_id,path:`outputs/${variant.generation_id}_${variant.id}_${manifest.version}.mp4`};}
export async function cloneVersion(slug,version,from,root=ROOT){
 const old=await loadVersion(slug,from,root);
 if(!VERSION.test(version??'')||Number(version.slice(1))<=Number(from.slice(1)))throw Error('New version must be greater than its parent');
 const names=await versionNames(old.projectDirectory);
 if(Number(version.slice(1))<=Number(names.at(-1).slice(1)))throw Error('New version must be greater than all existing versions');
 const directory=path.join(old.projectDirectory,'versions',version);
 await mkdir(directory); // EEXIST is intentional; never merge with an existing version.
 if(old.manifest.renderer.source_directory)await cp(inside(old.directory,old.manifest.renderer.source_directory),inside(directory,old.manifest.renderer.source_directory),{recursive:true});
 else await cp(inside(old.directory,old.manifest.renderer.path),inside(directory,old.manifest.renderer.path));
 await cp(path.join(old.directory,'data'),path.join(directory,'data'),{recursive:true});
 if(old.manifest.audio_pipeline?.tool_directory)await cp(inside(old.directory,old.manifest.audio_pipeline.tool_directory),inside(directory,old.manifest.audio_pipeline.tool_directory),{recursive:true,filter:file=>!file.includes('__pycache__')&&!file.endsWith('.pyc')});
 if(old.manifest.reference?.import_record){const evidence=inside(directory,old.manifest.reference.import_record);await mkdir(path.dirname(evidence),{recursive:true});await cp(inside(old.directory,old.manifest.reference.import_record),evidence);}
 const manifest=structuredClone(old.manifest);
 delete manifest.review;
 delete manifest.analysis;
 Object.assign(manifest,{version,parent_version:from,status:'draft',created_at:new Date().toISOString(),request:['TBD'],model:'TBD',validation:{},historical_provenance:null});
 manifest.variants=manifest.variants.map((v,i)=>({...v,generation_id:`${manifest.project_id}_V${version.slice(1)}_${String(i+1).padStart(3,'0')}`,output:null,poster:null,known_issues:[]}));
 await saveJson(path.join(directory,'manifest.json'),manifest);
 await writeFile(path.join(directory,'TREATMENT.md'),`# ${old.metadata.title} · ${version}\n\nParent: ${from}\n\nCreative changes and prompts: TBD. Inputs and renderer copied from the parent; outputs remain independent.\n`);
 return directory;
}
