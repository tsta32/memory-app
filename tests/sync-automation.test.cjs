'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const {FILES,publish,merge,deploy,resume}=require('../scripts/sync-automation.cjs');
const {fileHashes}=require('../scripts/review-app-sync.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'memory-automation-tests-'));
let serial=0;
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function fixture() {
  const dir=path.join(root,String(serial++));fs.mkdirSync(dir);
  const remote=path.join(dir,'remote.git'),repo=path.join(dir,'repo');
  git(dir,'init','--bare',remote);git(dir,'clone',remote,repo);
  git(repo,'config','user.name','Fixture');git(repo,'config','user.email','fixture@example.invalid');
  git(repo,'switch','-c','main');
  FILES.forEach(file=>fs.writeFileSync(path.join(repo,file),'original '+file+'\n'));
  fs.writeFileSync(path.join(repo,'app.js'),'runtime fixture\n');
  git(repo,'add','.');git(repo,'commit','-m','base');git(repo,'push','origin','main');
  const base=git(repo,'rev-parse','HEAD');git(repo,'switch','-c','candidate');
  fs.writeFileSync(path.join(repo,FILES[1]),'verified user context\n');
  // This local file must survive and must never enter the candidate commit.
  fs.writeFileSync(path.join(repo,'untracked-user-note.txt'),'private note');
  const receipt={version:1,base,fileHashes:fileHashes(repo),changes:[{key:'business-general-001',operation:'upsert',before:{context:'old'},after:{context:'new'}}]};
  const env={GITHUB_REPOSITORY:'fixture/memory-app'};
  const f={dir,repo,remote,receipt,env,prs:[],calls:[],sleeps:0,pages:{build_type:'legacy',source:{branch:'main',path:'/'},html_url:'https://fixture.github.io/memory-app/'}};
  f.main=()=>git(dir,'--git-dir='+remote,'rev-parse','main');
  f.advance=()=>{
    const commit=git(repo,'commit-tree',git(repo,'rev-parse',base+'^{tree}'),'-p',base,'-m','Concurrent main edit');
    git(repo,'push','origin',commit+':refs/heads/main');return commit;
  };
  f.api=async(method,url,body)=>{
    f.calls.push({method,url,body});const suffix=url.replace('/repos/fixture/memory-app','');
    if(method==='GET'&&suffix==='/git/ref/heads/main')return {object:{sha:f.main()}};
    if(method==='GET'&&suffix.startsWith('/pulls?'))return f.prs;
    if(method==='POST'&&suffix==='/pulls'){
      const head=git(dir,'--git-dir='+remote,'rev-parse','refs/heads/'+body.head);
      const pr={number:1,state:'open',draft:false,merged:false,mergeable:true,
        head:{sha:head,ref:body.head,repo:{full_name:env.GITHUB_REPOSITORY}},base:{sha:base,ref:'main'}};
      f.prs.push(pr);return structuredClone(pr);
    }
    if(method==='GET'&&suffix==='/pulls/1')return structuredClone(f.prs[0]);
    if(method==='GET'&&suffix.startsWith('/git/commits/')){
      const head=suffix.split('/').pop();return {message:git(repo,'log','-1','--format=%B',head),tree:{sha:git(repo,'rev-parse',head+'^{tree}')},parents:git(repo,'rev-list','--parents','-n1',head).split(' ').slice(1).map(sha=>({sha}))};
    }
    if(method==='GET'&&suffix.startsWith('/compare/'))return {total_commits:1,files:[{filename:FILES[1],status:'modified'}]};
    if(method==='POST'&&suffix==='/git/commits')return {sha:git(repo,'commit-tree',body.tree,'-p',body.parents[0],'-p',body.parents[1],'-m',body.message)};
    if(method==='PATCH'&&suffix==='/git/refs/heads/main'){
      assert.equal(body.force,false);
      if(f.race)f.concurrent=f.advance();
      git(repo,'push','origin',body.sha+':refs/heads/main');
      f.prs[0].merged=true;f.prs[0].state='closed';f.prs[0].merge_commit_sha=body.sha;
      return {object:{sha:body.sha}};
    }
    if(method==='GET'&&suffix==='/pages')return f.pages;
    if(method==='GET'&&suffix==='/pages/builds/latest')return f.latestBuild||f.latestResponse||{status:'errored',commit:f.main()};
    if(method==='POST'&&suffix==='/pages/builds'){
      if(f.useLatest)f.latestResponse={status:f.buildStatus||'built',commit:f.buildCommit||f.main()};
      return {url:'https://api.github.com/repos/fixture/memory-app/pages/builds/'+(f.useLatest?'latest':'12')};
    }
    if(method==='GET'&&suffix==='/pages/builds/12')return {status:f.buildStatus||'built',commit:f.buildCommit||f.main()};
    assert.fail('Unexpected API call: '+method+' '+suffix);
  };
  f.opts={repo,env,api:f.api,sleep:async()=>{f.sleeps++;}};
  f.publish=()=>publish(receipt,{...f.opts,testsPassed:true});
  f.readPublic=async url=>{
    const file=new URL(url).pathname.split('/').pop();
    return Buffer.from(git(repo,'show',f.main()+':'+file)+'\n');
  };
  return f;
}
(async()=>{
  const noop=fixture();
  assert.deepEqual(await publish({...noop.receipt,changes:[]},noop.opts),{changed:false});
  assert.equal(noop.calls.length,0);assert.equal(noop.main(),noop.receipt.base);
  assert.deepEqual(await resume({...noop.opts,enabled:true}),{deployed:false,reason:'NO_MANAGED_MERGE'});
  await assert.rejects(publish(noop.receipt,noop.opts),/TESTS_NOT_PASSED/);
  // Independent failure cases must never update main or create a PR.
  for(const mode of ['tests','main','unexpected','staged','tampered-template']) {
    const f=fixture();
    if(mode==='main')f.advance();
    if(mode==='unexpected') fs.writeFileSync(path.join(f.repo,'app.js'),'unexpected runtime change');
    if(mode==='staged')git(f.repo,'add',FILES[1]);
    if(mode==='tampered-template')fs.appendFileSync(path.join(f.repo,FILES[1]),'unexpected change after tests');
    const before=f.main();
    await assert.rejects(publish(f.receipt,{...f.opts,testsPassed:mode!=='tests'}));
    assert.equal(f.main(),before);assert.equal(f.prs.length,0);
  }
  const f=fixture(),candidate=await f.publish();
  assert.equal(f.main(),f.receipt.base);assert.equal(f.prs.length,1);
  assert.equal(fs.readFileSync(path.join(f.repo,'untracked-user-note.txt'),'utf8'),'private note');
  assert.equal(git(f.repo,'ls-tree','--name-only',candidate.head).includes('untracked-user-note'),false);
  const retryRepo=path.join(f.dir,'retry');git(f.dir,'clone','--branch','main',f.remote,retryRepo);
  fs.writeFileSync(path.join(retryRepo,FILES[1]),'verified user context\n');
  const reused=await publish(f.receipt,{...f.opts,repo:retryRepo,testsPassed:true});
  assert.equal(reused.head,candidate.head);assert.equal(f.prs.length,1);
  assert.equal(f.calls.filter(c=>c.method==='POST'&&c.url.endsWith('/pulls')).length,1);
  git(retryRepo,'reset');f.prs[0].state='closed';
  await assert.rejects(publish(f.receipt,{...f.opts,repo:retryRepo,testsPassed:true}),/EXISTING_PR_MISMATCH/);
  f.prs[0].state='open';
  assert.deepEqual(await merge(candidate,{...f.opts,enabled:false}),{merged:false,reason:'AUTOMERGE_DISABLED'});
  for(const mode of ['tests','conflict','head','base','pages','pages-permission','pages-build']) {
    const before=f.main(),saved=structuredClone(f.prs[0]),savedPages=structuredClone(f.pages);
    if(mode==='conflict')f.prs[0].mergeable=false;
    if(mode==='head')f.prs[0].head.sha='f'.repeat(40);
    if(mode==='base')f.prs[0].base.sha='f'.repeat(40);
    if(mode==='pages')f.pages.build_type='workflow';
    if(mode==='pages-build')f.buildStatus='errored';
    const api=mode==='pages-permission'?async(method,url,body)=>{if(method==='POST'&&url.endsWith('/pages/builds'))throw Error('GITHUB_HTTP_403');return f.api(method,url,body);}:f.api;
    await assert.rejects(merge(candidate,{...f.opts,api,enabled:true,testsPassed:mode!=='tests'}));
    f.buildStatus=undefined;
    assert.equal(f.main(),before);f.prs[0]=saved;f.pages=savedPages;
  }
  const race=fixture(),raceCandidate=await race.publish();race.race=true;
  await assert.rejects(merge(raceCandidate,{...race.opts,enabled:true,testsPassed:true}));
  assert.equal(race.main(),race.concurrent,'fast-forward rejection preserves concurrent main work');
  const merged=await merge(candidate,{...f.opts,enabled:true,testsPassed:true});
  assert.equal(f.main(),merged.sha);assert.equal(git(f.repo,'rev-parse',merged.sha+'^{tree}'),candidate.tree);
  assert.equal(f.prs[0].merged,true);
  assert.equal((await deploy(merged,{...f.opts,readPublic:f.readPublic})).deployed,true);
  f.latestBuild={status:'built',commit:merged.sha};
  const builds=f.calls.filter(c=>c.method==='POST'&&c.url.endsWith('/pages/builds')).length;
  await deploy(merged,{...f.opts,readPublic:f.readPublic});
  assert.equal((await resume({...f.opts,enabled:true,readPublic:f.readPublic})).deployed,true);
  const savedMergeSHA=f.prs[0].merge_commit_sha;f.prs[0].merge_commit_sha='f'.repeat(40);
  await assert.rejects(resume({...f.opts,enabled:true,readPublic:f.readPublic}),/RESUME_UNVERIFIED_MERGE/);
  f.prs[0].merge_commit_sha=savedMergeSHA;
  assert.equal(f.calls.filter(c=>c.method==='POST'&&c.url.endsWith('/pages/builds')).length,builds,'verified deployment retry does not rebuild');
  f.latestBuild=undefined;
  f.useLatest=true;
  assert.equal((await deploy(merged,{...f.opts,readPublic:f.readPublic})).deployed,true,'Pages request may return a latest URL');
  f.useLatest=false;f.latestResponse=undefined;
  const publishedMain=f.main();
  f.buildStatus='errored';await assert.rejects(deploy(merged,{...f.opts,readPublic:f.readPublic}),/PAGES_BUILD_FAILED/);
  f.buildStatus='built';f.buildCommit='f'.repeat(40);await assert.rejects(deploy(merged,{...f.opts,readPublic:f.readPublic}),/PAGES_WRONG_COMMIT/);
  f.buildCommit=undefined;await assert.rejects(deploy(merged,{...f.opts,readPublic:async()=>Buffer.from('stale CDN')}),/PAGES_CONTENT_MISMATCH/);
  assert.equal(f.main(),publishedMain,'deployment failures never force-rewrite main');
  console.log('Passed no-op, test gates, untracked-file preservation, PR reuse, race-safe merge, Pages status/content and deployment-failure fixtures.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
