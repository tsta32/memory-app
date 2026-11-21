#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {fingerprint,verifyFiles} = require('./review-app-sync.cjs');
const FILES = ['general_business_english_literal_ko.json','business-contexts.js','business-priorities.js'];
const fail = code => { throw Object.assign(Error(code),{code}); };
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
const validSHA = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

function context({repo=process.cwd(),env=process.env,api,sleep=pause}={}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY || '')) fail('REPOSITORY_INVALID');
  const root = '/repos/' + env.GITHUB_REPOSITORY;
  const git = (...args) => execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const request = api || (async(method,endpoint,body)=> {
    if (endpoint!==root && !endpoint.startsWith(root+'/')) fail('API_PATH_INVALID');
    const response = await fetch('https://api.github.com'+endpoint,{
      method, headers:{authorization:'Bearer '+env.GH_TOKEN,accept:'application/vnd.github+json','content-type':'application/json','x-github-api-version':'2022-11-28'},
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    if (!response.ok) fail('GITHUB_HTTP_'+response.status);
    return response.status===204?{}:response.json();
  });
  return {repo,env,root,git,api:request,sleep};
}
function output(env,values) {
  if(env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT,Object.entries(values).map(([k,v])=>k+'='+v+'\n').join(''));
}
function summary(env,line) {
  if(env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY,line+'\n');
}
async function fresh(c,base) {
  c.git('fetch','origin','main');
  if(c.git('rev-parse','origin/main')!==base) fail('MAIN_ADVANCED');
  const ref=await c.api('GET',c.root+'/git/ref/heads/main');
  if(ref.object.sha!==base) fail('MAIN_ADVANCED');
}
function allowed(files) {
  if(!files.length || files.some(file=>!FILES.includes(file))) fail('UNEXPECTED_FILES');
}

async function publish(receipt,{testsPassed=false,...options}={}) {
  const c=context(options),{git,api,root,env}=c;
  if(receipt.version!==1||!validSHA(receipt.base)||!Array.isArray(receipt.changes)||
      receipt.changes.some(change=>change.operation!=='upsert'||!change.before)) fail('RECEIPT_INVALID');
  if(!receipt.changes.length) return {changed:false};
  if(!testsPassed) fail('TESTS_NOT_PASSED');
  verifyFiles(receipt,c.repo);
  if(git('rev-parse','HEAD')!==receipt.base) fail('BASE_CHANGED');
  // Never clean, stage, publish or delete user-owned untracked files.
  if(git('diff','--cached','--name-only')) fail('INDEX_NOT_EMPTY');
  const files=git('diff','--name-only').split('\n').filter(Boolean);allowed(files);
  await fresh(c,receipt.base);
  git('add','--',...FILES);git('diff','--cached','--check');
  const tree=git('write-tree'),id=fingerprint(receipt),branch='sync/app-templates-'+id.slice(0,32);
  const refs=git('ls-remote','origin','refs/heads/'+branch);
  let head;
  if(refs) {
    head=refs.split(/\s/)[0];git('fetch','origin',branch);
    if(git('rev-parse',head+'^{tree}')!==tree || git('rev-parse',head+'^')!==receipt.base) fail('EXISTING_BRANCH_MISMATCH');
  } else {
    git('branch','-m',branch);
    git('-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com',
      'commit','-m','Sync verified app template edits ['+id.slice(0,12)+']');
    head=git('rev-parse','HEAD');git('push','origin','HEAD:refs/heads/'+branch);
  }
  const query='?state=all&base=main&head='+encodeURIComponent(env.GITHUB_REPOSITORY.split('/')[0]+':'+branch)+'&per_page=100';
  const prs=await api('GET',root+'/pulls'+query);
  if(prs.length>1) fail('DUPLICATE_PRS');
  let pr=prs[0];
  if(pr && (pr.state!=='open'||pr.head.sha!==head||pr.base.sha!==receipt.base)) fail('EXISTING_PR_MISMATCH');
  if(!pr) pr=await api('POST',root+'/pulls',{
    base:'main',head:branch,title:'Sync verified app template edits',
    body:'Automated read-only Worker sync. Direct user edit provenance verified; full unit/browser tests passed on this exact tree. No learning records or Worker data changed.\n\nSync fingerprint: '+id});
  if(!Number.isInteger(pr.number)||pr.head.sha!==head||pr.base.ref!=='main'||pr.base.sha!==receipt.base) fail('PR_VERIFICATION_FAILED');
  const result={changed:true,base:receipt.base,head,tree,branch,pr:pr.number,fingerprint:id};
  output(env,{changed:true,pr:pr.number,head});
  summary(env,'Verified candidate: PR #'+pr.number+'; head `'+head+'`. Automatic merge is gated separately.');
  return result;
}

async function preflightPages(c) {
  const pages=await c.api('GET',c.root+'/pages');
  // Existing branch-based Pages is explicitly rebuilt: GITHUB_TOKEN merges do
  // not reliably trigger a Pages build by themselves. Never change Pages settings.
  if(pages.build_type!=='legacy'||pages.source?.branch!=='main'||pages.source?.path!=='/') fail('PAGES_CONFIGURATION_UNSUPPORTED');
  if(typeof pages.html_url!=='string'||!pages.html_url.startsWith('https://')) fail('PAGES_URL_INVALID');
  return pages;
}

async function requestBuild(c,expectedSHA) {
  const build=await c.api('POST',c.root+'/pages/builds');
  const prefix='https://api.github.com'+c.root+'/pages/builds/';
  const buildID=String(build.url).startsWith(prefix)?String(build.url).slice(prefix.length):'';
  if(!/^(latest|\d+)$/.test(buildID)) fail('PAGES_BUILD_INVALID');
  let wrongCommit=false;
  for(let attempt=0;attempt<45;attempt++) {
    const state=await c.api('GET',c.root+'/pages/builds/'+buildID);
    // The request endpoint may return /latest before the new build is visible.
    if(state.commit && state.commit!==expectedSHA) {
      wrongCommit=true;
      if((await c.api('GET',c.root+'/git/ref/heads/main')).object.sha!==expectedSHA) fail('MAIN_ADVANCED_DURING_BUILD');
      await c.sleep(20000);continue;
    }
    if(state.status==='errored') fail('PAGES_BUILD_FAILED');
    if(state.status==='built' && state.commit===expectedSHA) return;
    await c.sleep(20000);
  }
  fail(wrongCommit?'PAGES_WRONG_COMMIT':'PAGES_BUILD_TIMEOUT');
}

async function merge(candidate,{enabled=false,testsPassed=false,...options}={}) {
  if(!enabled) return {merged:false,reason:'AUTOMERGE_DISABLED'};
  if(!testsPassed) fail('TESTS_NOT_PASSED');
  const c=context(options),{api,root,env}=c;
  if(!candidate.changed||!validSHA(candidate.head)||!validSHA(candidate.base)||!validSHA(candidate.tree)||!Number.isInteger(candidate.pr)) fail('CANDIDATE_INVALID');
  await fresh(c,candidate.base);
  await preflightPages(c);
  const pr=await api('GET',root+'/pulls/'+candidate.pr);
  if(pr.state!=='open'||pr.draft||pr.merged||pr.mergeable!==true||pr.head.sha!==candidate.head||
      pr.head.ref!==candidate.branch||pr.head.repo?.full_name!==env.GITHUB_REPOSITORY||
      pr.base.ref!=='main'||pr.base.sha!==candidate.base) fail('PR_CHANGED_OR_CONFLICTED');
  const commit=await api('GET',root+'/git/commits/'+candidate.head);
  if(commit.tree.sha!==candidate.tree||commit.parents.length!==1||commit.parents[0].sha!==candidate.base) fail('UNTESTED_TREE');
  const comparison=await api('GET',root+'/compare/'+candidate.base+'...'+candidate.head);
  if(comparison.total_commits!==1) fail('UNEXPECTED_COMMITS');
  allowed(comparison.files.map(f=>f.filename));
  if(comparison.files.some(f=>f.status!=='modified')) fail('UNEXPECTED_FILE_OPERATION');
  // Prove the token can request a build of the CURRENT main before changing it.
  // This catches Pages permission/configuration failures before any main update.
  await requestBuild(c,candidate.base);
  await fresh(c,candidate.base);
  const latest=await api('GET',root+'/pulls/'+candidate.pr);
  if(latest.state!=='open'||latest.merged||latest.draft||latest.mergeable!==true||
      latest.head.sha!==candidate.head||latest.base.sha!==candidate.base) fail('PR_CHANGED_OR_CONFLICTED');
  // Construct the tested tree with BOTH known parents, then fast-forward only.
  // Unlike the PR merge endpoint, this cannot silently merge a newer main.
  const merged=await api('POST',root+'/git/commits',{
    message:'Merge verified app sync PR #'+candidate.pr+'\n\nMemory-App-Sync: '+candidate.fingerprint,
    tree:candidate.tree,parents:[candidate.base,candidate.head]});
  if(!validSHA(merged.sha)) fail('MERGE_COMMIT_INVALID');
  await api('PATCH',root+'/git/refs/heads/main',{sha:merged.sha,force:false});
  // Protected-branch rules are respected; there is no bypass or forced update.
  let confirmed=false;
  for(let attempt=0;attempt<10;attempt++) {
    const current=await api('GET',root+'/pulls/'+candidate.pr);
    if(current.merged===true && current.merge_commit_sha===merged.sha) {confirmed=true;break;}
    await c.sleep(2000);
  }
  if(!confirmed) fail('PR_MERGE_CONFIRMATION_PENDING');
  output(env,{merged:true,merge_sha:merged.sha});
  summary(env,'Merged verified PR #'+candidate.pr+' as `'+merged.sha+'`.');
  return {merged:true,sha:merged.sha};
}

async function deploy(merged,{readPublic,...options}={}) {
  if(!merged.merged||!validSHA(merged.sha)) fail('MERGE_NOT_CONFIRMED');
  const c=context(options),{api,root,git,env}=c;
  const pages=await preflightPages(c);
  if((await api('GET',root+'/git/ref/heads/main')).object.sha!==merged.sha) fail('MAIN_ADVANCED_BEFORE_DEPLOY');
  const last=await api('GET',root+'/pages/builds/latest');
  if(last.status!=='built'||last.commit!==merged.sha) await requestBuild(c,merged.sha);
  git('fetch','origin','main');
  const getPublic=readPublic || (async url=> {
    // Deliberately no GitHub or Worker authentication on public site requests.
    const response=await fetch(url,{signal:AbortSignal.timeout(20000),cache:'no-store'});
    if(!response.ok) fail('PAGES_PUBLIC_HTTP');
    return Buffer.from(await response.arrayBuffer());
  });
  let visible=false;
  for(let attempt=0;attempt<12;attempt++) {
    const checks=await Promise.all(FILES.map(async file=>{
      const url=new URL(file,pages.html_url);url.searchParams.set('sync',merged.sha);
      const expected=execFileSync('git',['show',merged.sha+':'+file],{cwd:c.repo,stdio:['ignore','pipe','pipe']});
      return sha(await getPublic(url.href))===sha(expected);
    }));
    if(checks.every(Boolean)) {visible=true;break;}
    await c.sleep(10000);
  }
  if(!visible) fail('PAGES_CONTENT_MISMATCH');
  if((await api('GET',root+'/git/ref/heads/main')).object.sha!==merged.sha) fail('MAIN_ADVANCED_DURING_DEPLOY');
  summary(env,'Pages build and all three public template files verified for `'+merged.sha+'`.');
  return {deployed:true,sha:merged.sha};
}

async function resume({enabled=false,...options}={}) {
  if(!enabled) return {deployed:false,reason:'AUTOMERGE_DISABLED'};
  const c=context(options),{api,root}=c;
  const head=(await api('GET',root+'/git/ref/heads/main')).object.sha;
  const commit=await api('GET',root+'/git/commits/'+head);
  const match=String(commit.message).trim().match(/^Merge verified app sync PR #(\d+)\n\nMemory-App-Sync: [a-f0-9]{64}$/);
  if(!match||commit.parents.length!==2) return {deployed:false,reason:'NO_MANAGED_MERGE'};
  const pr=await api('GET',root+'/pulls/'+match[1]);
  if(pr.merged!==true||pr.merge_commit_sha!==head||pr.head.sha!==commit.parents[1].sha||
      pr.head.repo?.full_name!==c.env.GITHUB_REPOSITORY||!/^sync\/app-templates-[a-f0-9]{32}$/.test(pr.head.ref)) fail('RESUME_UNVERIFIED_MERGE');
  return deploy({merged:true,sha:head},options);
}

async function cli() {
  const env=process.env,command=process.argv[2],statePath=env.MEMORY_APP_SYNC_STATE;
  if(!statePath) fail('STATE_PATH_MISSING');
  let state;
  if(command==='publish') {
    const receipt=JSON.parse(fs.readFileSync(env.MEMORY_APP_SYNC_RECEIPT,'utf8'));
    state=await publish(receipt,{testsPassed:env.SYNC_TESTS_PASSED==='true'});
  } else if(command==='resume') {
    state=await resume({enabled:env.AUTOMERGE_ENABLED==='true'});
  } else {
    state=JSON.parse(fs.readFileSync(statePath,'utf8'));
    if(command==='merge') state={...state,...await merge(state,{enabled:env.AUTOMERGE_ENABLED==='true',testsPassed:env.SYNC_TESTS_PASSED==='true'})};
    else if(command==='deploy') state={...state,...await deploy(state)};
    else fail('COMMAND_INVALID');
  }
  fs.writeFileSync(statePath,JSON.stringify(state),{mode:0o600});
}
if(require.main===module) cli().catch(error=>{
  const code=/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'AUTOMATION_FAILED';
  console.error('::error title=App sync stopped::'+code+'; inspect the failed stage. No credentials or card text are logged.');
  summary(process.env,'Sync failed: `'+code+'`. Before merge, main is unchanged. After merge, deployment failure requires attention; no history is force-rewritten.');
  process.exitCode=1;
});
module.exports={FILES,context,publish,merge,deploy,resume,preflightPages};
