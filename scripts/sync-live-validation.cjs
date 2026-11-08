#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const {context,FILES}=require('./sync-automation.cjs');
const sync=require('./sync-app-templates.cjs');
const {plan}=require('./review-app-sync.cjs');
const fail=code=>{throw Object.assign(Error(code),{code});};
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const validSHA=value=>/^[a-f0-9]{40}$/.test(value||'');

async function audit({env=process.env,fetcher=sync.fetchSnapshot,localCode=sync.getCode,readPublic,...options}={}) {
  const report={version:1,worker_read:false,source_verified:false,no_changes:false,verified_change_count:null,
    github_metadata_read:false,contents_write_reported:false,pages_configuration:false,pages_build:false,
    public_templates:false,main_stable:false,isolated_canary_verified:false,automerge_eligible:false};
  try {
    const code=Object.hasOwn(env,'MEMORY_APP_SYNC_CODE')?sync.validate(env.MEMORY_APP_SYNC_CODE):localCode();
    const data=await fetcher(code);report.worker_read=true;
    const before=hash(JSON.stringify(data));
    const patch=plan(data);
    if(hash(JSON.stringify(data))!==before)fail('SNAPSHOT_MUTATED');
    report.source_verified=true;report.verified_change_count=patch.changes.length;report.no_changes=patch.changes.length===0;
    const c=context({...options,env}),{api,root}=c;
    const repository=await api('GET',root);
    report.github_metadata_read=true;report.contents_write_reported=repository.permissions?.push===true;
    const base=(await api('GET',root+'/git/ref/heads/main')).object.sha;
    if(!validSHA(base))fail('MAIN_SHA_INVALID');
    report.source_sha=base;
    const pages=await api('GET',root+'/pages');
    if(pages.build_type!=='legacy'||pages.source?.branch!=='main'||pages.source?.path!=='/')fail('PAGES_CONFIGURATION_UNSUPPORTED');
    report.pages_configuration=true;
    const last=await api('GET',root+'/pages/builds/latest');
    if(last.status!=='built'||last.commit!==base)fail('PAGES_NOT_CURRENT');
    report.pages_build=true;
    const publicRead=readPublic|| (async url=>{
      const response=await fetch(url,{signal:AbortSignal.timeout(20000),cache:'no-store'});
      if(!response.ok)fail('PUBLIC_HTTP_FAILED');return Buffer.from(await response.arrayBuffer());
    });
    if(typeof pages.html_url!=='string'||!pages.html_url.startsWith('https://'))fail('PAGES_URL_INVALID');
    for(const file of FILES) {
      const source=await api('GET',root+'/contents/'+file+'?ref='+base);
      if(source.encoding!=='base64'||typeof source.content!=='string')fail('PUBLIC_SOURCE_INVALID');
      const url=new URL(file,pages.html_url);url.searchParams.set('sync-audit',base);
      if(hash(Buffer.from(source.content,'base64'))!==hash(await publicRead(url.href)))fail('PUBLIC_CONTENT_MISMATCH');
    }
    report.public_templates=true;
    if((await api('GET',root+'/git/ref/heads/main')).object.sha!==base)fail('MAIN_ADVANCED');
    report.main_stable=true;
    return report;
  } catch(error) {
    const code=/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'LIVE_READ_VALIDATION_FAILED';
    throw Object.assign(Error(code),{code,report});
  }
}

// Write permissions are proved on disposable BASE/HEAD refs, never production
// main. No Worker requests, template edits, or Pages configuration/build changes.
async function permissionsProbe({env=process.env,...options}={}) {
  if(env.GITHUB_REPOSITORY!=='tsta32/memory-app'||env.GITHUB_REF!=='refs/heads/codex/production-sync-validation')fail('PROBE_SCOPE_INVALID');
  if(!/^\d+$/.test(env.GITHUB_RUN_ID||'')||!/^\d+$/.test(env.GITHUB_RUN_ATTEMPT||''))fail('PROBE_RUN_INVALID');
  const c=context({...options,env}),{api,root}=c;
  const original=(await api('GET',root+'/git/ref/heads/main')).object.sha;
  const suffix=env.GITHUB_RUN_ID+'-'+env.GITHUB_RUN_ATTEMPT;
  const baseBranch='sync-permission-probe/base-'+suffix,headBranch='sync-permission-probe/head-'+suffix;
  const base=await api('GET',root+'/git/commits/'+original);
  await api('POST',root+'/git/refs',{ref:'refs/heads/'+baseBranch,sha:original});
  const tree=await api('POST',root+'/git/trees',{base_tree:base.tree.sha,tree:[{
    path:'.sync-permission-probe.json',mode:'100644',type:'blob',content:JSON.stringify({disposable:true,run:suffix})+'\n'}]});
  const head=await api('POST',root+'/git/commits',{message:'Disposable sync permission probe',tree:tree.sha,parents:[original]});
  await api('POST',root+'/git/refs',{ref:'refs/heads/'+headBranch,sha:head.sha});
  const pr=await api('POST',root+'/pulls',{base:baseBranch,head:headBranch,title:'Disposable sync permissions probe',
    body:'Isolated permission test: base and head are disposable probe branches. Production main, templates, Worker and Pages are untouched.'});
  if(!Number.isInteger(pr.number))fail('PROBE_PR_INVALID');
  let ready=false;
  for(let i=0;i<15;i++) {
    const state=await api('GET',root+'/pulls/'+pr.number);
    if(state.head.sha!==head.sha||state.base.ref!==baseBranch||state.base.sha!==original||state.state!=='open')fail('PROBE_PR_CHANGED');
    if(state.mergeable===true){ready=true;break;}if(state.mergeable===false)fail('PROBE_PR_CONFLICT');await c.sleep(2000);
  }
  if(!ready)fail('PROBE_MERGEABILITY_TIMEOUT');
  const commit=await api('POST',root+'/git/commits',{message:'Merge disposable permission probe',tree:tree.sha,parents:[original,head.sha]});
  await api('PATCH',root+'/git/refs/heads/'+baseBranch,{sha:commit.sha,force:false});
  let recognized=false;
  for(let i=0;i<15;i++) {
    const state=await api('GET',root+'/pulls/'+pr.number);
    if(state.merged===true&&state.merge_commit_sha===commit.sha){recognized=true;break;}await c.sleep(2000);
  }
  if(!recognized)fail('PROBE_MERGE_UNRECOGNIZED');
  if((await api('GET',root+'/git/ref/heads/main')).object.sha!==original)fail('PRODUCTION_MAIN_ADVANCED');
  return {version:1,pr_creation:true,isolated_ref_merge:true,github_merge_recognized:true,production_main_unchanged:true,
    pr:pr.number,base_branch:baseBranch,head_branch:headBranch,merge_sha:commit.sha,pages_canary_verified:false,automerge_eligible:false};
}

function record(report,env) {
  // Fixed report schema contains only booleans, counts and public Git metadata.
  if(env.SYNC_VALIDATION_REPORT)fs.writeFileSync(env.SYNC_VALIDATION_REPORT,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  const text=JSON.stringify(report);
  console.log(text);
  if(env.GITHUB_STEP_SUMMARY)fs.appendFileSync(env.GITHUB_STEP_SUMMARY,'Read-only/probe validation (not production activation):\n\n```json\n'+text+'\n```\n');
}
if(require.main===module) (process.argv[2]==='permissions-probe'?permissionsProbe():audit()).then(report=>record(report,process.env)).catch(error=>{
  const code=/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'LIVE_VALIDATION_FAILED';
  record({...error.report,error_code:code,automerge_eligible:false},process.env);
  console.error('::error title=Sync validation blocked::'+code);process.exitCode=1;
});
module.exports={audit,permissionsProbe};
