const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cli=require('../scripts/sync-app-templates.cjs'),keys=['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1','srs_error_history_v1'];
assert.equal(cli.validate('abcdefghijkl'), 'abcdefghijkl');assert.throws(()=>cli.validate(''),/Invalid/);
const data=Object.fromEntries(keys.map(k=>[k,'{}']));data.srs_cards_v2=JSON.stringify({cards:[]});data.__memorySyncSnapshotV1={version:1,keys:[...keys].sort()};assert.equal(cli.complete(data),true);assert.equal(cli.complete({}),false);
const old=global.fetch, requests=[];process.env.MEMORY_APP_SYNC_API='https://mock.invalid';global.fetch=async(url,options)=>{const body=JSON.parse(options.body);requests.push(body.action);assert.equal(body.code,'abcdefghijkl');return {ok:true,json:async()=>({data})};};
(async()=>{try{const got=await cli.fetchSnapshot('abcdefghijkl');assert.equal(got.srs_cards_v2,data.srs_cards_v2);assert.deepEqual(requests,['get']);
 global.fetch=async()=>({ok:false,status:403});await assert.rejects(cli.fetchSnapshot('abcdefghijkl'),/No data was written/);
 global.fetch=async()=>({ok:true,json:async()=>({data:{...data,__memorySyncSnapshotV1:undefined}})});await assert.rejects(cli.fetchSnapshot('abcdefghijkl'),/incomplete/);
 const repo=require('../business-priorities').items, state={cards:[],editHistory:[],deletedCards:[]};assert.equal(cli.analyze(data).changes.changes.length,0);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'memory-app-secret-'));try{fs.writeFileSync(path.join(dir,'secret.json'),JSON.stringify({version:1,code:'abcdefghijkl'}),{mode:0o600});assert.equal(fs.statSync(path.join(dir,'secret.json')).mode&0o777,0o600);}finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('Passed read-only Worker get, full-snapshot requirement, auth/network failure handling, secret format and private-file permissions.');
}finally{global.fetch=old;delete process.env.MEMORY_APP_SYNC_API;}})().catch(e=>{console.error(e);process.exitCode=1;});
