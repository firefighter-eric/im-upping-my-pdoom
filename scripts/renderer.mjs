import path from 'node:path';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {build} from 'vite';
import {ROOT,inside} from './project.mjs';

export async function rendererFiles(version) {
 const m=version.manifest,files={};
 const collect=async relative=>{
  const directory=inside(version.directory,relative);
  for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   if(entry.isSymbolicLink())throw Error('Renderer source symlinks are not supported');
   const file=path.posix.join(relative,entry.name);
   if(entry.isDirectory())await collect(file);
   else files[file]=createHash('sha256').update(await readFile(inside(version.directory,file))).digest('hex');
  }
 };
 if(m.renderer.build==='vite')await collect(m.renderer.source_directory);
 else files[m.renderer.path]=createHash('sha256').update(await readFile(inside(version.directory,m.renderer.path))).digest('hex');
 return files;
}
export async function buildRenderer(version) {
 if(version.manifest.renderer.build!=='vite')return null;
 const files=await rendererFiles(version),key=createHash('sha256').update(JSON.stringify(files)).update(await readFile(path.join(ROOT,'package-lock.json'))).digest('hex');
 // Each caller owns a build directory; compiling must not clear a live preview's files.
 const output=path.join(ROOT,'.cache/renderers',version.metadata.slug,version.manifest.version,key+'-'+randomUUID().slice(0,8));
 await mkdir(output,{recursive:true});
 await build({configFile:false,root:inside(version.directory,version.manifest.renderer.source_directory),base:'./',logLevel:'warn',build:{outDir:output,emptyOutDir:true},server:{hmr:false}});
 await writeFile(path.join(output,'build-source.json'),JSON.stringify({key,files},null,2)+'\n');
 return {directory:output,prefix:`versions/${version.manifest.version}/${version.manifest.renderer.source_directory}/`,files,key};
}
export function rendererURL(version,port,{exportMode=false}={}) {
 const m=version.manifest,url=new URL(`http://127.0.0.1:${port}/versions/${m.version}/${m.renderer.path}`);
 if(m.renderer.engine==='three-webgl')url.searchParams.set('scale',String(m.settings.width/1920));
 if(exportMode)url.searchParams.set('export','1');
 return url;
}
