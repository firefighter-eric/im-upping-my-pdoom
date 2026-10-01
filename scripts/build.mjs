import {parseOptions,loadVersion} from './project.mjs';
import {buildRenderer} from './renderer.mjs';
const o=parseOptions(process.argv.slice(2)),version=await loadVersion(o.project,o.version);
const result=await buildRenderer(version);console.log(result?.directory??'This version uses an unbundled HTML renderer.');
