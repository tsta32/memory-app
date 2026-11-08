#!/usr/bin/env node
'use strict';
// Synthetic data and a separate repository/site only. Never uses a real Worker.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const review=require('./review-app-sync.cjs'),overrides=require('../card-overrides');
const automation=require('./sync-automation.cjs');
const TARGET='tsta32/memory-app-sync-canary';
function guard(env) {
  if(env.GITHUB_REPOSITORY!==TARGET||env.GITHUB_REPOSITORY==='tsta32/memory-app')throw Error('CANARY_REPOSITORY_REQUIRED');
  if(env.MEMORY_APP_SYNC_CODE)throw Error('CANARY_MUST_NOT_HAVE_WORKER_SECRET');
}
function fixture(run) {
  const t=require('../business-priorities').items[0];
  const card={id:1,businessTemplateKey:t.key,chapterId:1,en:t.en,ko:t.ko,context:t.context,priority:t.priority,
    stage:3,dueAt:123,ngCount:4,firstCorrectAt:56};
  const previous={cards:[card],editHistory:[]},next=structuredClone(previous);
  next.cards[0].ko='격리된 자동 동기화 검증용 번역 '+run;
  next.cards[0].priorityAssessment={version:1,en:t.en,ko:next.cards[0].ko,context:t.context,priority:t.priority,
    reason:t.reason,coverageAreas:t.coverageAreas,coveragePurposes:t.coveragePurposes};
  const keys=['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1','srs_error_history_v1'];
  return {...Object.fromEntries(keys.map(key=>[key,'{}'])),srs_cards_v2:JSON.stringify(overrides.track(previous,next,'isolated-canary')),
    __memorySyncSnapshotV1:{version:1,keys}};
}
async function run(command,{env=process.env,repo=process.cwd()}={}) {
  guard(env);
  const receiptPath=env.MEMORY_APP_SYNC_RECEIPT,statePath=env.MEMORY_APP_SYNC_STATE,fixturePath=env.MEMORY_APP_CANARY_FIXTURE;
  if(!receiptPath||!statePath||!fixturePath)throw Error('CANARY_PATHS_REQUIRED');
  const fakeEnv={...env,MEMORY_APP_SYNC_CODE:'isolated_canary_fixture'};
  let state;
  if(command==='prepare') {
    const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    if(git('status','--porcelain'))throw Error('CANARY_CHECKOUT_NOT_CLEAN');
    git('switch','-c','canary/candidate-'+env.GITHUB_RUN_ID+'-'+env.GITHUB_RUN_ATTEMPT);
    const snapshot=fixture(env.GITHUB_RUN_ID+'-'+env.GITHUB_RUN_ATTEMPT);
    fs.writeFileSync(fixturePath,JSON.stringify(snapshot),{mode:0o600,flag:'wx'});
    await review.run({repo,env:fakeEnv,receiptPath,fetcher:async()=>snapshot,backupRoot:path.join(path.dirname(receiptPath),'canary-backups')});
    return;
  }
  const snapshot=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
  if(command==='publish') {
    const receipt=await review.verify({repo,receiptPath,env:fakeEnv,fetcher:async()=>snapshot});
    state=await automation.publish(receipt,{repo,env,testsPassed:env.SYNC_TESTS_PASSED==='true'});
  } else {
    state=JSON.parse(fs.readFileSync(statePath,'utf8'));
    if(command==='merge')state={...state,...await automation.merge(state,{repo,env,enabled:true,testsPassed:env.SYNC_TESTS_PASSED==='true'})};
    else if(command==='deploy')state={...state,...await automation.deploy(state,{repo,env})};
    else throw Error('CANARY_COMMAND_INVALID');
  }
  fs.writeFileSync(statePath,JSON.stringify(state),{mode:0o600});
  if(command==='deploy') {
    const report={version:1,repository:TARGET,synthetic_data_only:true,worker_requests:0,pr:state.pr,
      merge_sha:state.sha,pr_merged:state.merged===true,public_pages_verified:state.deployed===true,
      automation_code_hash:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'sync-automation.cjs'))).digest('hex')};
    fs.writeFileSync(env.SYNC_VALIDATION_REPORT,JSON.stringify(report,null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify(report));
  }
}
if(require.main===module)run(process.argv[2]).catch(()=>{
  console.error('::error title=Isolated sync canary failed::Canary did not complete; production automatic merging must remain disabled.');
  process.exitCode=1;
});
module.exports={TARGET,guard,fixture,run};
