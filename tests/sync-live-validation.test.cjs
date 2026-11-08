'use strict';
const assert=require('node:assert/strict');
const {audit,permissionsProbe}=require('../scripts/sync-live-validation.cjs');
const {guard,fixture}=require('../scripts/sync-canary.cjs');
const t=require('../business-priorities').items[0];
const keys=['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1','srs_error_history_v1'];
const data={...Object.fromEntries(keys.map(k=>[k,'{}'])),srs_cards_v2:JSON.stringify({cards:[{id:1,businessTemplateKey:t.key,
  en:t.en,ko:t.ko,context:t.context,priority:t.priority,stage:4,ngCount:7}],editHistory:[]}),__memorySyncSnapshotV1:{version:1,keys}};
const original=JSON.stringify(data),env={GITHUB_REPOSITORY:'tsta32/memory-app',MEMORY_APP_SYNC_CODE:'private-fixture-code'};
const base='a'.repeat(40),head='b'.repeat(40),tree='c'.repeat(40),merged='d'.repeat(40);
const root='/repos/tsta32/memory-app';
let reads=0;
const fetcher=async code=>{assert.equal(code,env.MEMORY_APP_SYNC_CODE);reads++;return data;};
const readPublic=async url=>Buffer.from('public '+new URL(url).pathname.split('/').pop());
const calls=[];
const api=async(method,url)=>{
  calls.push({method,url});assert.equal(method,'GET','live audit must be read-only');
  if(url===root)return {permissions:{push:true}};
  if(url.endsWith('/git/ref/heads/main'))return {object:{sha:base}};
  if(url.endsWith('/pages'))return {build_type:'legacy',source:{branch:'main',path:'/'},html_url:'https://tsta32.github.io/memory-app/'};
  if(url.endsWith('/pages/builds/latest'))return {status:'built',commit:base};
  if(url.includes('/contents/'))return {encoding:'base64',content:Buffer.from('public '+url.split('/contents/')[1].split('?')[0]).toString('base64')};
  assert.fail(url);
};
(async()=>{
  const report=await audit({env,fetcher,api,readPublic});
  assert.equal(report.worker_read,true);assert.equal(report.no_changes,true);assert.equal(report.verified_change_count,0);
  assert.equal(report.public_templates,true);assert.equal(report.automerge_eligible,false);
  assert.equal(JSON.stringify(data),original);
  assert.equal(JSON.stringify(report).includes(env.MEMORY_APP_SYNC_CODE),false);
  assert.equal(JSON.stringify(report).includes(t.en),false,'no card text in evidence');
  await assert.rejects(audit({env,fetcher,api,readPublic:async()=>Buffer.from('stale')}),error=>
    error.code==='PUBLIC_CONTENT_MISMATCH'&&error.report.worker_read===true&&error.report.public_templates===false);
  await assert.rejects(audit({env,fetcher:async()=>{throw Error(env.MEMORY_APP_SYNC_CODE);},api,readPublic}),error=>
    !JSON.stringify(error).includes(env.MEMORY_APP_SYNC_CODE)&&error.report.worker_read===false);
  const conflict=JSON.parse(data.srs_cards_v2);conflict.editConflicts=[{field:'ko'}];
  await assert.rejects(audit({env,fetcher:async()=>({...data,srs_cards_v2:JSON.stringify(conflict)}),api,readPublic}),error=>
    error.report.worker_read===true&&error.report.source_verified===false);
  assert.throws(()=>guard({GITHUB_REPOSITORY:'tsta32/memory-app'}),/CANARY_REPOSITORY_REQUIRED/);
  assert.throws(()=>guard({GITHUB_REPOSITORY:'tsta32/memory-app-sync-canary',MEMORY_APP_SYNC_CODE:'real-secret'}),/MUST_NOT_HAVE/);
  guard({GITHUB_REPOSITORY:'tsta32/memory-app-sync-canary'});
  const synthetic=fixture('123-1');assert.equal(JSON.parse(synthetic.srs_cards_v2).cards[0].id,1);
  assert.ok(JSON.parse(synthetic.srs_cards_v2).editHistory.every(e=>e.origin==='user'));

  let prMerged=false,prExists=false;
  const writes=[];
  const probeEnv={GITHUB_REPOSITORY:'tsta32/memory-app',GITHUB_REF:'refs/heads/codex/production-sync-validation',GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1'};
  const probeApi=async(method,url,body)=>{
    if(method!=='GET') {
      writes.push({method,url,body});
      assert.notEqual(url,root+'/git/refs/heads/main');
      assert.equal(url.includes('/pages'),false);
      if(body?.ref)assert.ok(body.ref.startsWith('refs/heads/sync-permission-probe/'));
    }
    if(method==='GET'&&url.endsWith('/git/ref/heads/main'))return {object:{sha:base}};
    if(method==='GET'&&url.includes('/git/commits/'))return {tree:{sha:base}};
    if(method==='POST'&&url.endsWith('/git/refs'))return {};
    if(method==='POST'&&url.endsWith('/git/trees'))return {sha:tree};
    if(method==='POST'&&url.endsWith('/git/commits'))return {sha:body.parents.length===1?head:merged};
    if(method==='POST'&&url.endsWith('/pulls')){prExists=true;return {number:99};}
    if(method==='GET'&&url.endsWith('/pulls/99'))return {state:prMerged?'closed':'open',mergeable:true,merged:prMerged,
      merge_commit_sha:prMerged?merged:null,head:{sha:head},base:{ref:'sync-permission-probe/base-123-1',sha:base}};
    if(method==='PATCH'&&url.endsWith('/git/refs/heads/sync-permission-probe/base-123-1')){assert.equal(body.force,false);prMerged=true;return {};}
    assert.fail(method+' '+url);
  };
  const proof=await permissionsProbe({env:probeEnv,api:probeApi,sleep:async()=>{}});
  assert.equal(prExists,true);assert.equal(proof.github_merge_recognized,true);assert.equal(proof.production_main_unchanged,true);
  assert.equal(proof.automerge_eligible,false,'isolated branch proof cannot substitute for a separate Pages canary');
  await assert.rejects(permissionsProbe({env:{...probeEnv,GITHUB_REF:'refs/heads/main'},api:probeApi}),/PROBE_SCOPE_INVALID/);
  assert.ok(reads>=2);assert.ok(writes.length>0);
  console.log('Passed read-only live audit, no-op, evidence redaction, conflict refusal, isolated-ref permission probe and production canary guards.');
})().catch(error=>{console.error(error);process.exitCode=1;});
