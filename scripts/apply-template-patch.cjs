#!/usr/bin/env node
'use strict';
// Authenticated writes happen only through the user's local Git installation.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
function apply(repo,patch,write=false,backupRoot=path.join(os.homedir(),'.config','memory-app','template-backups')){
 if(patch.kind!=='memory-app-template-patch'||patch.version!==1||!Array.isArray(patch.changes))throw new Error('Invalid patch format');
 const sourcePath=path.join(repo,'general_business_english_literal_ko.json'),source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
 const contextsPath=path.join(repo,'business-contexts.js'),prioritiesPath=path.join(repo,'business-priorities.js');
 const oldRows=structuredClone(source.items),seen=new Set();
 const fields=r=>({en:r.en,ko:r.ko_after,context:r.context,priority:r.priority});
 for(const change of patch.changes){
  if(typeof change.key!=='string'||seen.has(change.key))throw new Error('CONFLICT: duplicate or invalid template key');seen.add(change.key);
  const index=source.items.findIndex(r=>r.businessTemplateKey===change.key),existing=source.items[index];
  if(change.before===null?!!existing:!existing||JSON.stringify(fields(existing))!==JSON.stringify(change.before))throw new Error('CONFLICT: repository template changed: '+change.key);
  if(change.operation==='delete'){if(!existing)throw new Error('CONFLICT: missing deletion');source.items.splice(index,1);continue;}
  const a=change.after;if(change.operation!=='upsert'||!a||typeof a.en!=='string'||!a.en.trim()||typeof a.ko!=='string'||!a.ko.trim()||typeof a.context!=='string'||!['essential','important','supplementary'].includes(a.priority))throw new Error('Invalid template content');
  const row=existing||{businessTemplateKey:change.key,source_line:Math.max(0,...source.items.map(r=>r.source_line||0))+1,ko_before:a.ko};
  Object.assign(row,{en:a.en,ko_after:a.ko,context:a.context,priority:a.priority});if(!existing)source.items.push(row);
 }
 if(new Set(source.items.map(r=>r.en)).size!==source.items.length)throw new Error('CONFLICT: duplicate English templates');
 source.count=source.items.length;
 let contexts=fs.readFileSync(contextsPath,'utf8'),priorities=fs.readFileSync(prioritiesPath,'utf8');
 const readArray=(text,name)=>JSON.parse(text.match(new RegExp('var '+name+'=([\\s\\S]*?);\\n'))[1]);
 const oldContexts=readArray(contexts,'previousContexts'),priorityRows=readArray(priorities,'items');
 const newPrevious=source.items.map(row=>{const index=oldRows.findIndex(r=>r.businessTemplateKey===row.businessTemplateKey);return index<0?null:oldContexts[index];});
 const newPriority=source.items.map(row=>{
  const old=priorityRows.find(r=>r.key===row.businessTemplateKey),change=patch.changes.find(c=>c.key===row.businessTemplateKey&&c.operation==='upsert');
  const item=Object.assign({},old||{key:row.businessTemplateKey,source_line:row.source_line,ko_before:row.ko_before,criteria:[]},{en:row.en,ko:row.ko_after,context:row.context,priority:row.priority});
  if(!old){item.reason='';item.coverageAreas=[];item.coveragePurposes=[];}
  if(change){const a=change.after,assessment=a.priorityAssessment,validAssessment=assessment&&assessment.version===1&&assessment.en===a.en&&assessment.ko===a.ko&&assessment.context===a.context&&assessment.priority===a.priority&&String(assessment.reason||'').trim()&&Array.isArray(assessment.coverageAreas)&&assessment.coverageAreas.length&&Array.isArray(assessment.coveragePurposes)&&assessment.coveragePurposes.length;
   if(validAssessment){item.reason=assessment.reason;item.coverageAreas=assessment.coverageAreas.slice();item.coveragePurposes=assessment.coveragePurposes.slice();}
   else if(['en','ko','context'].some(f=>a[f]!==change.before[f])||(a.priority==='essential'&&change.before.priority!=='essential')){item.reason='';item.coverageAreas=[];item.coveragePurposes=[];}
  }
  return item;
 });
 const replace=(text,name,value)=>text.replace(new RegExp('var '+name+'=[\\s\\S]*?;\\n'),'var '+name+'='+JSON.stringify(value,null,2)+';\n');
 contexts=replace(replace(contexts,'items',source.items.map(r=>({en:r.en,context:r.context}))),'previousContexts',newPrevious);
 priorities=replace(priorities,'items',newPriority);
 const outputs=new Map([[sourcePath,JSON.stringify(source,null,2)+'\n'],[contextsPath,contexts],[prioritiesPath,priorities]]);
 let backupPath=null;
 if(write&&patch.changes.length){fs.mkdirSync(backupRoot,{recursive:true,mode:0o700});const stat=fs.lstatSync(backupRoot);if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('Unsafe template backup directory');fs.chmodSync(backupRoot,0o700);backupPath=path.join(backupRoot,new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid);fs.mkdirSync(backupPath,{mode:0o700});
  outputs.forEach((_,file)=>fs.copyFileSync(file,path.join(backupPath,path.basename(file)),fs.constants.COPYFILE_EXCL));
  const temporary=[];try{outputs.forEach((content,file)=>{const tmp=path.join(path.dirname(file),'.'+path.basename(file)+'.'+crypto.randomUUID()+'.tmp');temporary.push([file,tmp]);fs.writeFileSync(tmp,content,{mode:fs.statSync(file).mode&0o777,flag:'wx'});});temporary.forEach(([file,tmp])=>fs.renameSync(tmp,file));}
  catch(error){for(const [file] of temporary){const backup=path.join(backupPath,path.basename(file));if(fs.existsSync(backup))fs.copyFileSync(backup,file);}for(const [,tmp] of temporary)if(fs.existsSync(tmp))fs.unlinkSync(tmp);throw error;}
 }
 return {status:write?(patch.changes.length?'written-locally':'no-changes'):'validated-only',changes:patch.changes.length,backupPath};
}
if(require.main===module){
 try{
  const args=process.argv.slice(2),filename=args[0];if(!filename)throw new Error('Usage: node scripts/apply-template-patch.cjs patch.json [--repo path] [--write] [--push]');
  const repo=args.includes('--repo')?path.resolve(args[args.indexOf('--repo')+1]):path.resolve(__dirname,'..'),push=args.includes('--push');
  if(push){cp.execFileSync('git',['fetch','origin','main'],{cwd:repo,stdio:'inherit'});const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),remote=cp.execFileSync('git',['rev-parse','origin/main'],{cwd:repo,encoding:'utf8'}).trim();if(head!==remote)throw new Error('CONFLICT: local HEAD differs from origin/main');if(cp.execFileSync('git',['status','--porcelain'],{cwd:repo,encoding:'utf8'}).trim())throw new Error('CONFLICT: use a clean checkout before publishing');}
  const result=apply(repo,JSON.parse(fs.readFileSync(filename,'utf8')),args.includes('--write')||push);
  if(push){cp.execFileSync('git',['add','--','general_business_english_literal_ko.json','business-contexts.js','business-priorities.js'],{cwd:repo});cp.execFileSync('git',['diff','--cached','--check'],{cwd:repo,stdio:'inherit'});if(cp.execFileSync('git',['diff','--cached','--name-only'],{cwd:repo,encoding:'utf8'}).trim()){cp.execFileSync('git',['commit','-m','Apply reviewed app template edits'],{cwd:repo,stdio:'inherit'});cp.execFileSync('git',['push','origin','HEAD:main'],{cwd:repo,stdio:'inherit'});}result.status='pushed-to-github';}
  console.log(JSON.stringify(result));
 }catch(e){console.error(e.message);process.exitCode=e.message.includes('CONFLICT:')?2:1;}
}
module.exports={apply};
