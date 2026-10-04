import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inside} from './project.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

// A cleanup receipt preserves the output identity; it never makes missing media
// pass a requested media probe or permits an existing file with different bytes.
export async function verifyOutputFile(version,variant,{sourceOnly=false,requireMedia=false}={}){
 const output=variant.output,file=inside(version.directory,output.path),retention=output.retention;
 let removal=null;
 if(retention){
  if(retention.state!=='removed-by-user'||typeof retention.record!=='string'||!/^provenance\/.+\.json$/.test(retention.record))throw Error('Invalid output retention record');
  const bytes=await readFile(inside(version.directory,retention.record));
  if(digest(bytes)!==retention.record_sha256)throw Error('Output removal receipt hash mismatch');
  removal=JSON.parse(bytes);
  if(removal.schema_version!==1||removal.action!=='remove-local-output'||removal.status!=='completed'||removal.authorized_by!=='conversation-user'||typeof removal.user_statement!=='string'||!removal.user_statement.trim()||!Number.isFinite(Date.parse(removal.deleted_at)))throw Error('Output removal needs a completed user-authorized receipt');
  if(removal.project_id!==version.manifest.project_id||removal.version!==version.manifest.version||removal.variant_id!==variant.id||removal.generation_id!==variant.generation_id||['path','sha256','size_bytes'].some(key=>removal.output?.[key]!==output[key]))throw Error('Output removal identity mismatch');
 }
 if(sourceOnly&&!requireMedia)return {file,state:'source-only'};
 let bytes;
 try{bytes=await readFile(file);}
 catch(error){
  if(error.code!=='ENOENT'||!removal)throw error;
  if(requireMedia)throw Error('Local output was removed by user; restore or rebuild before media verification: '+variant.generation_id);
  return {file,state:'removed-by-user'};
 }
 if(digest(bytes)!==output.sha256||bytes.length!==output.size_bytes)throw Error('Output hash mismatch '+variant.generation_id);
 return {file,state:'present'};
}
