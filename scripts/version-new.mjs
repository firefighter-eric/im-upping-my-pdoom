import {parseOptions,loadProject,versionNames,cloneVersion,nextVersion} from './project.mjs';
const o=parseOptions(process.argv.slice(2)),p=await loadProject(o.project),names=await versionNames(p.directory);
const from=o.from??names.at(-1);const version=o.version??nextVersion(names.at(-1));
console.log(await cloneVersion(o.project,version,from));
