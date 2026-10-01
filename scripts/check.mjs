import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import path from 'node:path';
import {ROOT,listProjects,loadProject,versionNames,loadVersion,inside} from './project.mjs';
for(const dir of ['scripts','tests'])for(const name of await readdir(path.join(ROOT,dir))){if(!name.endsWith('.mjs'))continue;const r=spawnSync(process.execPath,['--check',path.join(ROOT,dir,name)],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}
const html=[path.join(ROOT,'templates/renderer.html')];for(const slug of await listProjects()){const p=await loadProject(slug);for(const version of await versionNames(p.directory)){const v=await loadVersion(slug,version);html.push(inside(v.directory,v.manifest.renderer.path));}}
for(const file of html)for(const match of (await readFile(file,'utf8')).matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1],{filename:file});
const template=spawnSync(process.execPath,[path.join(ROOT,'node_modules/typescript/bin/tsc'),'--noEmit','-p',path.join(ROOT,'templates/three-webgl/tsconfig.json')],{encoding:'utf8'});if(template.status!==0)throw Error(template.stdout+template.stderr);
for(const slug of await listProjects()){const p=await loadProject(slug);for(const version of await versionNames(p.directory)){const v=await loadVersion(slug,version);if(v.manifest.renderer.build==='vite'){const r=spawnSync(process.execPath,[path.join(ROOT,'node_modules/typescript/bin/tsc'),'--noEmit','-p',inside(v.directory,v.manifest.renderer.source_directory+'/tsconfig.json')],{encoding:'utf8'});if(r.status!==0)throw Error(r.stdout+r.stderr);}}}
console.log('Shared scripts and all HTML/TypeScript version renderers compile.');
