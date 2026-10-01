import {parseOptions,loadProject,versionNames,cloneVersion} from './project.mjs';
const o=parseOptions(process.argv.slice(2)),p=await loadProject(o.project),names=await versionNames(p.directory);
const from=o.from??names.at(-1);const version=o.version??`v${String(Number(names.at(-1).slice(1))+1).padStart(3,'0')}`;
console.log(await cloneVersion(o.project,version,from));
