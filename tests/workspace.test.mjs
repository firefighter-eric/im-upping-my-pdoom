import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {once} from 'node:events';
import YAML from 'yaml';
import {byteRange,createProjectServer} from '../scripts/server.mjs';
import {cloneVersion,loadVersion,inside,parseOptions,versionNames,compareVersions,nextVersion,generationVersionTag} from '../scripts/project.mjs';

test('media server supports exact byte seeking and rejects missing LFS objects/private paths',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pdoom-media-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(root,'versions/v001/outputs'),{recursive:true});
 await writeFile(path.join(root,'versions/v001/outputs/clip.mp4'),'0123456789');
 await writeFile(path.join(root,'versions/v001/outputs/missing.mp4'),'version https://git-lfs.github.com/spec/v1\noid sha256:abcdef\nsize 10\n');
 const server=createProjectServer(root);server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));const base=`http://127.0.0.1:${server.address().port}`;
 let r=await fetch(base+'/versions/v001/outputs/clip.mp4',{headers:{Range:'bytes=3-6'}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 3-6/10');assert.equal(await r.text(),'3456');
 r=await fetch(base+'/versions/v001/outputs/clip.mp4',{headers:{Range:'bytes=-3'}});assert.equal(await r.text(),'789');
 r=await fetch(base+'/versions/v001/outputs/clip.mp4',{method:'HEAD'});assert.equal(r.headers.get('content-length'),'10');assert.equal(await r.text(),'');
 assert.equal((await fetch(base+'/versions/v001/outputs/clip.mp4',{headers:{Range:'bytes=30-40'}})).status,416);
 assert.equal((await fetch(base+'/versions/v001/outputs/missing.mp4')).status,503);
 assert.equal((await fetch(base+'/.git/config')).status,403);
 assert.equal((await fetch(base+'/versions/%2e%2e%2f.git/config')).status,403);
});

test('new versions retain exact input lineage, leave parent outputs immutable and start in draft',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pdoom-versions-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const project=path.join(root,'projects/example'),old=path.join(project,'versions/v001');await mkdir(path.join(old,'data'),{recursive:true});await mkdir(path.join(old,'outputs'));
 await writeFile(path.join(project,'project.yaml'),YAML.stringify({id:'VIDEO_001',slug:'example',title:'Example'}));
 const manifest={project_id:'VIDEO_001',version:'v001',status:'review',settings:{fps:24},renderer:{path:'renderer.html',sha256:'unchanged'},inputs:{audio:{path:'sources/audio.wav',sha256:'immutable-input'}},data:{audio_features:'data/features.json'},variants:[{id:'main',generation_id:'VIDEO_001_OLD',output:{path:'outputs/old.mp4'},known_issues:['old issue']}],validation:{approved:false}};
 await writeFile(path.join(old,'manifest.json'),JSON.stringify(manifest));await writeFile(path.join(old,'renderer.html'),'original code');await writeFile(path.join(old,'data/features.json'),'{}');await writeFile(path.join(old,'outputs/old.mp4'),'old output');
 const directory=await cloneVersion('example','v002','v001',root);const fresh=await loadVersion('example','v002',root);
 assert.equal(fresh.manifest.status,'draft');assert.equal(fresh.manifest.parent_version,'v001');assert.deepEqual(fresh.manifest.inputs,manifest.inputs);assert.equal(fresh.manifest.variants[0].output,null);assert.equal(await readFile(path.join(old,'outputs/old.mp4'),'utf8'),'old output');assert.equal(await readFile(path.join(directory,'renderer.html'),'utf8'),'original code');
 await assert.rejects(access(path.join(directory,'outputs/old.mp4')));
 await assert.rejects(cloneVersion('example','v002','v001',root));await assert.rejects(cloneVersion('example','v001','v002',root));
 assert.deepEqual(JSON.parse(await readFile(path.join(old,'manifest.json'),'utf8')),manifest);
});

test('cross-project version records and paths outside a project are rejected',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pdoom-lineage-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const project=path.join(root,'projects/example');await mkdir(path.join(project,'versions/v001'),{recursive:true});await writeFile(path.join(project,'project.yaml'),YAML.stringify({id:'VIDEO_001',slug:'example'}));await writeFile(path.join(project,'versions/v001/manifest.json'),JSON.stringify({project_id:'VIDEO_002',version:'v001'}));
 await assert.rejects(loadVersion('example','v001',root),/lineage/);assert.throws(()=>inside(project,'../../secret'));assert.throws(()=>parseOptions(['--version']));
});

test('range parser handles end clamping, empty ranges and invalid multi-range requests',()=>{
 assert.deepEqual(byteRange('bytes=7-200',10),{start:7,end:9});assert.deepEqual(byteRange('bytes=7-',10),{start:7,end:9});assert.equal(byteRange('bytes=3-2',10),null);assert.equal(byteRange('bytes=-0',10),null);assert.equal(byteRange('bytes=0-1,3-4',10),null);assert.equal(byteRange('bytes=0-',0),null);
});

test('revision versions sort numerically, reject equivalent directories and clone with independent identities',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pdoom-revisions-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const project=path.join(root,'projects/example'),old=path.join(project,'versions/v003.0');await mkdir(path.join(old,'data'),{recursive:true});
 await writeFile(path.join(project,'project.yaml'),YAML.stringify({id:'VIDEO_001',slug:'example',title:'Example'}));
 const manifest={project_id:'VIDEO_001',version:'v003.0',status:'review',renderer:{path:'renderer.html'},data:{},inputs:{audio:{sha256:'same'}},variants:[{id:'main',generation_id:'OLD',output:{path:'outputs/original.mp4'}}],naming_migration:'provenance/version-naming.json'};
 await writeFile(path.join(old,'manifest.json'),JSON.stringify(manifest));await writeFile(path.join(old,'renderer.html'),'original code');
 await cloneVersion('example','v003.1','v003.0',root);
 const fresh=await loadVersion('example','v003.1',root);
 assert.equal(fresh.manifest.parent_version,'v003.0');assert.equal(fresh.manifest.status,'draft');assert.equal(fresh.manifest.naming_migration,undefined);assert.equal(fresh.manifest.variants[0].generation_id,'VIDEO_001_V003_R001_001');assert.equal(fresh.manifest.variants[0].output,null);
 assert.equal(await readFile(path.join(old,'manifest.json'),'utf8'),JSON.stringify(manifest));
 await assert.rejects(cloneVersion('example','v003','v003.1',root),/greater/);
 await cloneVersion('example','v003.10','v003.1',root);await cloneVersion('example','v004.0','v003.10',root);
 assert.deepEqual(await versionNames(project),['v003.0','v003.1','v003.10','v004.0']);
 await assert.rejects(cloneVersion('example','v003.2','v003.1',root),/all existing/);
 await mkdir(path.join(project,'versions/v003.2'));
 assert.deepEqual(await versionNames(project),['v003.0','v003.1','v003.2','v003.10','v004.0']);
 await mkdir(path.join(project,'versions/v003'));
 await assert.rejects(versionNames(project),/Equivalent/);
 assert.equal(compareVersions('v003','v003.0'),0);assert.equal(nextVersion('v003.9'),'v003.10');assert.equal(nextVersion('v002'),'v003');assert.equal(generationVersionTag('v003.0'),'V003_R000');
 for(const bad of ['v000.1','v003.01','v003.1.2','v003.-1'])assert.throws(()=>compareVersions(bad,'v003.0'));
});
