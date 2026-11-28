'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const hash=value=>createHash('sha256').update(value).digest('hex');

(async()=>{
 const {default:worker}=await import('../workers/chatgpt-refresh/index.mjs');
 const origin='https://tsta32.github.io', key=hash('synthetic-refresh-fixture'), snapshotSha256=hash('fixture snapshot');
 const env={APP_ORIGIN:origin,REFRESH_KEY_SHA256:hash(key),GITHUB_TOKEN:'fake-fixture-token',
  REFRESH_LIMIT:{limit:async()=>({success:true})}};
 let upstreamStatus=0;
 let calls=[],phase='queued',conflicts=0,verified=true,privateRepo=true,expectedHash=snapshotSha256;
 const checkedAt=new Date(Date.now()-1000).toISOString();
 const run={id:123,event:'workflow_dispatch',head_branch:'main',path:'.github/workflows/private-sentence-library.yml',run_attempt:1,created_at:checkedAt};
 const savedFetch=global.fetch;
 global.fetch=async(url,options)=>{
  assert(url.startsWith('https://api.github.com/repos/tsta32/memory-app-private'));
  assert.equal(options.headers.Authorization,'Bearer fake-fixture-token');
  assert.equal(options.redirect,'manual');
  calls.push({url,method:options.method,body:options.body});
  if(url.endsWith('/memory-app-private')&&upstreamStatus)return Response.json({detail:'private error detail'},{status:upstreamStatus});
  if(url.endsWith('/memory-app-private'))return Response.json({full_name:'tsta32/memory-app-private',private:privateRepo,visibility:privateRepo?'private':'public',default_branch:'main'});
  if(url.endsWith('/dispatches'))return Response.json({workflow_run_id:123},{status:200});
  if(url.endsWith('/runs/123'))return Response.json({...run,status:phase,conclusion:'success'});
  if(url.endsWith('/jobs'))return Response.json({jobs:[{conclusion:'success',steps:[{name:'Verify published bytes for ChatGPT Work',conclusion:verified?'success':'skipped'}]}]});
  if(url.endsWith('/git/ref/heads/main'))return Response.json({object:{sha:'a'.repeat(40)}});
  if(url.includes('/contents/memory-library/status.json?ref='))return Response.json({encoding:'base64',content:Buffer.from(JSON.stringify({
   workflowRunId:'123',workflowRunAttempt:'1',version:1,source:'worker-get',snapshotVersion:1,
   hashVersion:1,storageKeyCount:7,catalogSha256:hash('fixture catalog'),snapshotSha256:expectedHash,conflictCount:conflicts,checkedAt
  })).toString('base64')});
  assert.fail('Unexpected API request');
 };
 const req=(path,body={},from=origin,method='POST')=>worker.fetch(new Request('https://fixture.invalid'+path,{
  method,headers:{Origin:from,'Content-Type':'application/json'},body:method==='POST'?JSON.stringify(body):undefined
 }),env);
 const check=()=>req('/status',{refreshKey:key,snapshotSha256,runId:123}).then(r=>r.json());
 try{
  assert.equal((await req('/start',{},'https://unexpected.invalid')).status,403);
  assert.equal((await req('/start',{},origin,'OPTIONS')).status,204);
  assert.equal((await req('/start',{refreshKey:'bad',snapshotSha256})).status,401);
  assert.equal(calls.length,0);
  upstreamStatus=302;
  const redirected=await req('/start',{refreshKey:key,snapshotSha256});
  assert.equal(redirected.status,502);
  assert.deepEqual(await redirected.json(),{reason:'github',stage:'repository',upstreamStatus:302});
  upstreamStatus=403;
  const upstreamError=await req('/start',{refreshKey:key,snapshotSha256});
  assert.equal(upstreamError.status,502);
  assert.deepEqual(await upstreamError.json(),{reason:'github',stage:'repository',upstreamStatus:403});
  upstreamStatus=0;
  privateRepo=false;
  assert.equal((await req('/start',{refreshKey:key,snapshotSha256})).status,409);
  assert.equal(calls.filter(c=>c.method==='POST').length,0);
  privateRepo=true;
  const started=await req('/start',{refreshKey:key,snapshotSha256,repository:'public/ignored'});
  assert.equal(started.status,202);assert.deepEqual(await started.json(),{runId:123});
  assert.equal(calls.at(-1).body,'{"ref":"main"}');
  assert.deepEqual(await check(),{state:'pending'});
  phase='completed';
  assert.deepEqual(await check(),{state:'success',checkedAt,revision:'a'.repeat(40)});
  conflicts=1;assert.deepEqual(await check(),{state:'failed',reason:'conflicts'});
  conflicts=0;expectedHash=hash('new snapshot');assert.deepEqual(await check(),{state:'failed',reason:'snapshot-changed'});
  verified=false;assert.deepEqual(await check(),{state:'failed',reason:'verification'});
  assert.equal(calls.filter(c=>c.method==='POST').length,1);
 }finally{global.fetch=savedFetch;}
 console.log('Passed relay auth, private dispatch, status verification, conflicts, and snapshot race checks.');
})().catch(error=>{console.error(error);process.exitCode=1;});
