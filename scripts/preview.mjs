import {parseOptions,loadVersion,inside} from './project.mjs';
import {createProjectServer} from './server.mjs';
import {buildRenderer,rendererURL} from './renderer.mjs';
const o=parseOptions(process.argv.slice(2)),v=await loadVersion(o.project,o.version),rendererBuild=await buildRenderer(v),server=createProjectServer(v.projectDirectory,{rendererBuild});
const port=Number(o.port??0);if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port');
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is occupied; choose --port explicitly.`:e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{const base=`http://127.0.0.1:${server.address().port}`,url=rendererURL(v,server.address().port);url.searchParams.set('mode',o.variant??v.manifest.variants[0].id);url.searchParams.set('t',String(Number(o.time??5)));console.log(url.href);for(const variant of v.manifest.variants)if(variant.output)console.log(`${variant.label}: ${base}/versions/${o.version}/${variant.output.path}`);});
