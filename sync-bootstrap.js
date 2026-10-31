(function(){
'use strict';
var API='https://toeic-cloud-sync.tsta32.workers.dev/';
var CODE_KEY='memory_sync_code_v1';
var SNAPSHOT_META_KEY='__memorySyncSnapshotV1';
var DATA_KEYS=['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1','srs_error_history_v1'];
var applyingRemote=false, localDirty=false, pushTimer=null, lastSnapshot='',syncWriteQueue=Promise.resolve();
var syncCode=localStorage.getItem(CODE_KEY)||'';

function validCode(v){return /^[A-Za-z0-9_-]{12,80}$/.test(v);}
function snapshot(){var d={};DATA_KEYS.forEach(function(k){var v=localStorage.getItem(k);if(v!==null)d[k]=v;});return d;}
function snapshotData(d){var out={};DATA_KEYS.forEach(function(k){if(Object.prototype.hasOwnProperty.call(d||{},k))out[k]=d[k];});return out;}
function completeSnapshot(d){
  var meta=d&&d[SNAPSHOT_META_KEY],expected=DATA_KEYS.slice().sort();
  if(!meta||meta.version!==1||!Array.isArray(meta.keys)||meta.keys.length!==expected.length)return false;
  var keys=meta.keys.slice().sort();return expected.every(function(k,i){return keys[i]===k;});
}
function snapshotPayload(d){var out=snapshotData(d);out[SNAPSHOT_META_KEY]={version:1,keys:DATA_KEYS.slice().sort()};return out;}
function signature(d){return JSON.stringify(snapshotData(d));}
function hasData(d){return Object.keys(snapshotData(d)).length>0;}
function mergeSettings(localRaw,remoteRaw,preferLocal){
  var defaults={tense:true,number:true,modal:true,article:true,preposition:true},local={},remote={};
  try{local=localRaw?JSON.parse(localRaw):{};}catch(e){return localRaw;}
  try{remote=remoteRaw?JSON.parse(remoteRaw):{};}catch(e){}
  if(!local||typeof local!=='object'||Array.isArray(local))local={};
  if(!remote||typeof remote!=='object'||Array.isArray(remote))remote={};
  var merged=preferLocal?Object.assign({},remote,local):Object.assign({},local,remote);
  var opts=preferLocal?Object.assign({},defaults,remote.grammarOptions||{},local.grammarOptions||{}):Object.assign({},defaults,local.grammarOptions||{},remote.grammarOptions||{});
  Object.keys(defaults).forEach(function(k){if(typeof opts[k]!=='boolean')opts[k]=true;});
  merged.grammarOptions=opts;return JSON.stringify(merged);
}
function mergeHistory(localRaw,remoteRaw){
  function parse(raw){if(!raw)return{version:1,records:[]};try{var x=JSON.parse(raw);return Array.isArray(x)?{version:1,records:x}:x&&Array.isArray(x.records)?x:null;}catch(e){return null;}}
  var l=parse(localRaw),r=parse(remoteRaw);if(!l)return localRaw;if(!r)return localRaw||remoteRaw;
  var map={};l.records.concat(r.records).forEach(function(rec){
    if(!rec||rec.cardId==null||!rec.errorType)return;
    var id=rec.id||JSON.stringify([rec.cardId,rec.errorType]);
    if(!map[id])map[id]={id:id,cardId:rec.cardId,errorType:rec.errorType,referenceAnswer:rec.referenceAnswer||'',actualAnswer:rec.actualAnswer||'',count:0,firstAt:rec.firstAt||0,lastAt:rec.lastAt||0,occurrences:[]};
    var target=map[id],seen={};
    function eventKey(o){return o&&o.id?'id:'+o.id:'anon:'+JSON.stringify([o&&o.at,o&&o.referenceAnswer,o&&o.actualAnswer,o&&o.reason]);}
    target.occurrences.forEach(function(o){seen[eventKey(o)]=1;});
    (Array.isArray(rec.occurrences)?rec.occurrences:[]).forEach(function(o){if(o){var key=eventKey(o);if(!seen[key]){seen[key]=1;target.occurrences.push(o);}}});
    target.count=Math.max(target.count,rec.count||0);
    if(rec.firstAt&&(!target.firstAt||rec.firstAt<target.firstAt)){target.firstAt=rec.firstAt;target.referenceAnswer=rec.referenceAnswer||target.referenceAnswer;}
    if((rec.lastAt||0)>=target.lastAt){target.lastAt=rec.lastAt||target.lastAt;target.actualAnswer=rec.actualAnswer||target.actualAnswer;}
  });
  var records=Object.keys(map).map(function(id){var x=map[id];x.occurrences.sort(function(a,b){return(a.at||0)-(b.at||0);});if(x.occurrences.length){x.count=Math.max(x.count||0,x.occurrences.length);x.firstAt=x.occurrences[0].at||x.firstAt;x.lastAt=x.occurrences[x.occurrences.length-1].at||x.lastAt;x.referenceAnswer=x.occurrences[0].referenceAnswer||x.referenceAnswer;x.actualAnswer=x.occurrences[x.occurrences.length-1].actualAnswer||x.actualAnswer;}return x;});
  return JSON.stringify({version:1,records:records});
}
function mergeRecordArrays(localList,remoteList,preferLocal){
  var out=Array.isArray(remoteList)?remoteList.slice():[],positions={};
  function key(item){return item&&item.id!=null?'id:'+typeof item.id+':'+String(item.id):'value:'+JSON.stringify(item);}
  out.forEach(function(item,i){positions[key(item)]=i;});
  (Array.isArray(localList)?localList:[]).forEach(function(item){
    var k=key(item);
    if(Object.prototype.hasOwnProperty.call(positions,k)){if(preferLocal)out[positions[k]]=item;}
    else{positions[k]=out.length;out.push(item);}
  });
  return out;
}
function mergeWrappedRecords(localRaw,remoteRaw,listKey){
  var local,remote;
  try{local=localRaw?JSON.parse(localRaw):{};}catch(e){return localRaw;}
  try{remote=remoteRaw?JSON.parse(remoteRaw):{};}catch(e){return localRaw||remoteRaw;}
  if(!local||typeof local!=='object'||Array.isArray(local)||!remote||typeof remote!=='object'||Array.isArray(remote))return localRaw||remoteRaw;
  var merged=Object.assign({},remote,local);
  merged[listKey]=mergeRecordArrays(local[listKey],remote[listKey],true);
  if(typeof local.nextId==='number'||typeof remote.nextId==='number')merged.nextId=Math.max(local.nextId||0,remote.nextId||0);
  return JSON.stringify(merged);
}
function mergeNotes(localRaw,remoteRaw){
  var local,remote;
  try{local=localRaw?JSON.parse(localRaw):{};}catch(e){return localRaw;}
  try{remote=remoteRaw?JSON.parse(remoteRaw):{};}catch(e){return localRaw||remoteRaw;}
  if(!local||typeof local!=='object'||Array.isArray(local)||!remote||typeof remote!=='object'||Array.isArray(remote))return localRaw||remoteRaw;
  var merged=Object.assign({},remote,local);
  Object.keys(remote).forEach(function(cardId){merged[cardId]=mergeRecordArrays(local[cardId],remote[cardId],true);});
  Object.keys(local).forEach(function(cardId){merged[cardId]=mergeRecordArrays(local[cardId],remote[cardId],true);});
  return JSON.stringify(merged);
}
function mergePlainArrays(localRaw,remoteRaw){
  var local,remote;
  try{local=localRaw?JSON.parse(localRaw):[];}catch(e){return localRaw;}
  try{remote=remoteRaw?JSON.parse(remoteRaw):[];}catch(e){return localRaw||remoteRaw;}
  if(!Array.isArray(local)||!Array.isArray(remote))return localRaw||remoteRaw;
  return JSON.stringify(mergeRecordArrays(local,remote,true));
}
function mergeDataValue(key,localRaw,remoteRaw,preferLocal,unionRecords){
  if(key==='srs_settings_v1')return mergeSettings(localRaw,remoteRaw,preferLocal);
  if(!unionRecords)return preferLocal?localRaw:remoteRaw;
  if(key==='srs_cards_v2')return mergeWrappedRecords(localRaw,remoteRaw,'cards');
  if(key==='srs_chapters_v1')return mergeWrappedRecords(localRaw,remoteRaw,'chapters');
  if(key==='srs_notes_v1')return mergeNotes(localRaw,remoteRaw);
  if(key==='srs_trends_v1'||key==='srs_biz_sessions_v1')return mergePlainArrays(localRaw,remoteRaw);
  return preferLocal?localRaw:remoteRaw;
}
function mergeSnapshots(local,remote,preferLocal,unionRecords){
  var out={};
  DATA_KEYS.forEach(function(k){
    var hasLocal=Object.prototype.hasOwnProperty.call(local||{},k),hasRemote=Object.prototype.hasOwnProperty.call(remote||{},k);
    if(hasLocal&&hasRemote)out[k]=mergeDataValue(k,local[k],remote[k],preferLocal,unionRecords);
    else if(hasLocal)out[k]=local[k];
    else if(hasRemote)out[k]=remote[k];
  });
  var lh=(local||{}).srs_error_history_v1,rh=(remote||{}).srs_error_history_v1;
  if(lh||rh){var merged=mergeHistory(lh,rh);if(merged)out.srs_error_history_v1=merged;}
  return out;
}
function request(action,data){
  var payload={action:action,code:syncCode};
  if(action==='set')payload.data=data;
  return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    .then(function(r){return r.json().then(function(j){if(!r.ok||j.error)throw new Error(j.error||('HTTP '+r.status));return j;});});
}
function enqueueSyncWrite(){
  var job=syncWriteQueue.then(function(){
    var local=snapshot(),localSignature=signature(local);
    return request('get').then(function(r){var remote=snapshotData(r.data),d=mergeSnapshots(local,remote,true,!completeSnapshot(r.data));return request('set',snapshotPayload(d)).then(function(){
      lastSnapshot=signature(snapshot());localDirty=signature(snapshot())!==localSignature;
      return{ok:true,dirty:localDirty};
    });});
  });
  syncWriteQueue=job.then(function(){},function(){});
  return job;
}
function scheduleSyncRetry(delay){
  clearTimeout(pushTimer);
  pushTimer=setTimeout(function(){
    enqueueSyncWrite().then(function(result){if(result.dirty)scheduleSyncRetry(250);}).catch(function(e){
      console.warn('[Memory sync] Save failed; local data remains safe.',e);localDirty=true;scheduleSyncRetry(2000);
    });
  },delay);
}
function pushLocal(){
  if(applyingRemote||!syncCode)return;
  localDirty=true;scheduleSyncRetry(250);
}

// 백업 복원처럼 즉시 재시작해야 하는 작업을 위한 강제 저장
window.memorySyncFlush=function(){
  clearTimeout(pushTimer);

  if(!syncCode){
    return Promise.resolve({ok:true,localOnly:true});
  }

  localDirty=true;
  function flushUntilClean(){return enqueueSyncWrite().then(function(result){return result.dirty?flushUntilClean():{ok:true};});}
  return flushUntilClean().catch(function(e){
    console.warn('[Memory sync] Explicit save failed.',e);
    localDirty=true;scheduleSyncRetry(2000);
    return {ok:false,error:e};
  });
};
function installStorageHooks(){
  var oldSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){oldSet.call(this,k,v);if(DATA_KEYS.indexOf(String(k))!==-1)pushLocal();};
  var oldRemove=Storage.prototype.removeItem;
  Storage.prototype.removeItem=function(k){oldRemove.call(this,k);if(DATA_KEYS.indexOf(String(k))!==-1)pushLocal();};
}
function loadApp(){
  var s=document.createElement('script');s.src='app.js';
  s.onerror=function(){console.error('[Memory sync] Could not load app.js');};
  document.body.appendChild(s);
}
function applyRemote(d){
  var remote=snapshotData(d),isComplete=completeSnapshot(d),current=snapshot();
  // Old/unknown snapshots cannot prove completeness: preserve local values on conflicts.
  var merged=mergeSnapshots(current,remote,!isComplete,!isComplete);
  applyingRemote=true;
  try{DATA_KEYS.forEach(function(k){
    if(Object.prototype.hasOwnProperty.call(merged,k))localStorage.setItem(k,merged[k]);
  });}
  finally{applyingRemote=false;}
  var localNow=snapshot(),needsRepair=signature(localNow)!==signature(remote);
  lastSnapshot=signature(localNow);localDirty=false;
  if(needsRepair&&syncCode){localDirty=true;enqueueSyncWrite().then(function(result){if(result.dirty)scheduleSyncRetry(250);}).catch(function(e){console.warn('[Memory sync] Preserved local settings/history but cloud repair failed.',e);scheduleSyncRetry(2000);});}
}
function startPolling(){
  window.setInterval(function(){
    if(document.visibilityState==='hidden'||localDirty)return;
    request('get').then(function(r){
      if(!hasData(r.data)&&!completeSnapshot(r.data))return;
      var remoteSignature=signature(r.data),localSignature=signature(snapshot());
      if(remoteSignature!==localSignature&&remoteSignature!==lastSnapshot){applyRemote(r.data);window.location.reload();}
    }).catch(function(e){console.warn('[Memory sync] Background check failed; continuing locally.',e);});
  },20000);
}
function showCodeEntry(){
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#1E1C1A;color:#F0EDE8;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Arial,sans-serif;';
  overlay.innerHTML='<div style="width:100%;max-width:420px;background:#2A2724;border:1px solid #514942;border-radius:20px;padding:24px;box-sizing:border-box;">'+
  '<h2 style="margin:0 0 12px;font-size:22px;">Memory クラウド同期</h2>'+
  '<p style="font-size:14px;line-height:1.6;color:#D0C8BE;">最初の端末で決めた同期コードを入力してください。初めての場合は新しいコード（英数字など12文字以上）を決めてください。他の端末にも同じコードを入力します。</p>'+
  '<input id="memory-sync-code" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="同期コード（12文字以上）" style="width:100%;height:46px;padding:0 12px;border-radius:10px;border:1px solid #6E6560;background:#1E1C1A;color:#fff;font-size:16px;box-sizing:border-box;">'+
  '<button id="memory-sync-start" style="margin-top:14px;width:100%;height:46px;border:0;border-radius:12px;background:#2A9D8F;color:#fff;font-weight:bold;font-size:16px;">同期して開く</button>'+
  '<button id="memory-sync-local" style="margin-top:8px;width:100%;height:42px;border:1px solid #6E6560;border-radius:12px;background:transparent;color:#D0C8BE;font-size:14px;">同期せずに開く</button>'+
  '<p id="memory-sync-error" style="color:#FF7070;font-size:13px;min-height:18px;"></p>'+
  '<p style="color:#B0A89E;font-size:12px;line-height:1.5;">同期コードはパスワードのように扱い、他人に共有しないでください。</p></div>';
  document.body.appendChild(overlay);
  var input=overlay.querySelector('#memory-sync-code'),err=overlay.querySelector('#memory-sync-error');
  overlay.querySelector('#memory-sync-start').addEventListener('click',function(){
    var v=input.value.trim();
    if(!validCode(v)){err.textContent='12〜80文字で、英字・数字・_・- を使用してください。';return;}
    syncCode=v;localStorage.setItem(CODE_KEY,syncCode);overlay.remove();connectAndLoad();
  });
  overlay.querySelector('#memory-sync-local').addEventListener('click',function(){overlay.remove();loadApp();});
  input.addEventListener('keydown',function(e){if(e.key==='Enter')overlay.querySelector('#memory-sync-start').click();});
}
function connectAndLoad(){
  installStorageHooks();
  request('get').then(function(r){
    if(hasData(r.data)||completeSnapshot(r.data)){applyRemote(r.data);loadApp();startPolling();}
    else{var d=snapshot();return request('set',snapshotPayload(d)).then(function(){lastSnapshot=signature(d);loadApp();startPolling();});}
  }).catch(function(e){console.warn('[Memory sync] Server unavailable; opening local data.',e);loadApp();startPolling();});
}
function start(){if(!syncCode){showCodeEntry();return;}connectAndLoad();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
