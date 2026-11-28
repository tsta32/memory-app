(function(){
'use strict';
var API='https://toeic-cloud-sync.tsta32.workers.dev/';
var CODE_KEY='memory_sync_code_v1';
var DIRTY_KEY='memory_sync_dirty_v1',STATUS_KEY='memory_sync_status_v1';
function readLocal(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback;}catch(e){return fallback;}}
var dirtyKeys=new Set(readLocal(DIRTY_KEY,[])),retryDelay=2000,pulling=false;
var syncStatus=readLocal(STATUS_KEY,{});
function showSyncStatus(){
  var node=document.getElementById('memory-sync-status');
  if(!node)return;
  var labels={pending:'저장 대기',ok:'동기화 성공',error:'동기화 실패 · 재시도 대기'};
  node.textContent=(labels[syncStatus.result]||'아직 동기화하지 않음')+
    (syncStatus.lastSuccessAt?' · 마지막 성공 '+new Date(syncStatus.lastSuccessAt).toLocaleString():'')+
    (syncStatus.result==='error'&&syncStatus.lastAttemptAt?' · 실패 시각 '+new Date(syncStatus.lastAttemptAt).toLocaleString():'');
}
function setSyncStatus(result){
  syncStatus.result=result;
  syncStatus.lastAttemptAt=new Date().toISOString();
  if(result==='ok')syncStatus.lastSuccessAt=syncStatus.lastAttemptAt;
  try{localStorage.setItem(STATUS_KEY,JSON.stringify(syncStatus));}catch(e){}
  showSyncStatus();
}
function saveDirtyKeys(){try{localStorage.setItem(DIRTY_KEY,JSON.stringify(Array.from(dirtyKeys)));}catch(e){}}
var SNAPSHOT_META_KEY='__memorySyncSnapshotV1';
var DATA_KEYS=window.SyncIntegrity.keys;
var applyingRemote=false, localDirty=dirtyKeys.size>0, pushTimer=null, lastSnapshot='',syncWriteQueue=Promise.resolve();
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
  merged.grammarOptions=opts;
  function events(s){return Array.isArray(s.manualCorrectEvents)?s.manualCorrectEvents.filter(function(id){return typeof id==='string';}):[];}
  function baseline(s,list){return Math.max(0,(Number(s.manualCorrectTotal)||Number(s.manualCorrectCount)||0)-new Set(list).size);}
  var le=events(local),re=events(remote),ids=Array.from(new Set(le.concat(re))).sort();
  if(ids.length)merged.manualCorrectEvents=ids;
  if(ids.length||local.manualCorrectTotal!==undefined||remote.manualCorrectTotal!==undefined){
    merged.manualCorrectTotal=Math.max(baseline(local,le),baseline(remote,re))+ids.length;
  }
  return JSON.stringify(merged);
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
function mergePlainArrays(localRaw,remoteRaw,preferLocal){
  var local,remote;
  try{local=localRaw?JSON.parse(localRaw):[];}catch(e){return localRaw;}
  try{remote=remoteRaw?JSON.parse(remoteRaw):[];}catch(e){return localRaw||remoteRaw;}
  if(!Array.isArray(local)||!Array.isArray(remote))return localRaw||remoteRaw;
  return JSON.stringify(mergeRecordArrays(local,remote,preferLocal));
}
function mergeDataValue(key,localRaw,remoteRaw,preferLocal,unionRecords){
  if(key==='srs_cards_v2'&&window.CardOverrides){
    try{
      var l=JSON.parse(localRaw||'{"cards":[]}'),r=JSON.parse(remoteRaw||'{"cards":[]}');
      if(Array.isArray(l.cards)&&Array.isArray(r.cards)){
        window.CardOverrides.seed(l,window.BusinessPriority.items,window.BusinessContexts.isDefault);
        window.CardOverrides.seed(r,window.BusinessPriority.items,window.BusinessContexts.isDefault);
        return JSON.stringify(window.CardOverrides.merge(l,r,preferLocal));
      }
    }catch(e){console.warn('[Memory sync] Card edit merge failed; keeping local data.',e);return localRaw||remoteRaw;}
  }
  if(key==='srs_settings_v1')return mergeSettings(localRaw,remoteRaw,preferLocal);
  if(key==='srs_trends_v1'||key==='srs_biz_sessions_v1')return mergePlainArrays(localRaw,remoteRaw,preferLocal);
  if(!unionRecords)return preferLocal?localRaw:remoteRaw;
  if(key==='srs_cards_v2')return mergeWrappedRecords(localRaw,remoteRaw,'cards');
  if(key==='srs_chapters_v1')return mergeWrappedRecords(localRaw,remoteRaw,'chapters');
  if(key==='srs_notes_v1')return mergeNotes(localRaw,remoteRaw);
  return preferLocal?localRaw:remoteRaw;
}
function mergeSnapshots(local,remote,preferLocal,unionRecords,localKeys){
  var out={};
  DATA_KEYS.forEach(function(k){
    var hasLocal=Object.prototype.hasOwnProperty.call(local||{},k),hasRemote=Object.prototype.hasOwnProperty.call(remote||{},k);
    if(hasLocal&&hasRemote)out[k]=mergeDataValue(k,local[k],remote[k],preferLocal&&(!localKeys||localKeys.has(k)),unionRecords);
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
  return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout?AbortSignal.timeout(20000):undefined})
    .then(function(r){return r.json().then(function(j){if(!r.ok||j.error)throw new Error(j.error||('HTTP '+r.status));return j;});});
}
function enqueueSyncWrite(){
  async function write(){
    var local=snapshot(),localSignature=signature(local),changedKeys=new Set(dirtyKeys);
    for(var attempt=0;attempt<3;attempt++){
      var current=(await request('get')).data;
      var data=snapshotPayload(mergeSnapshots(local,snapshotData(current),true,!completeSnapshot(current),completeSnapshot(current)?changedKeys:null));
      if(signature(data)!==signature(current)||!completeSnapshot(current)){
        // The deployed API offers snapshot get/set. Recheck before writing and verify afterward.
        var latest=(await request('get')).data;
        if(signature(latest)!==signature(current)||completeSnapshot(latest)!==completeSnapshot(current))continue;
        await request('set',data);
        var confirmed=(await request('get')).data;
        if(signature(confirmed)!==signature(data)||!completeSnapshot(confirmed)){
          local=mergeSnapshots(data,snapshotData(confirmed),true,!completeSnapshot(confirmed));
          continue;
        }
      }
      lastSnapshot=localSignature;localDirty=signature(snapshot())!==localSignature;
      if(!localDirty){dirtyKeys.clear();saveDirtyKeys();setSyncStatus('ok');}
      retryDelay=2000;
      return {ok:true,dirty:localDirty};
    }
    throw new Error('Concurrent sync could not be verified');
  }
  var job=syncWriteQueue.then(function(){
    return navigator.locks?navigator.locks.request('memory-app-sync-write',write):write();
  });
  syncWriteQueue=job.then(function(){},function(){});
  return job;
}
function scheduleSyncRetry(delay){
  clearTimeout(pushTimer);
  pushTimer=setTimeout(function(){
    pushTimer=null;
    if(studyProtected())return;
    enqueueSyncWrite().then(function(result){if(result.dirty)scheduleSyncRetry(250);}).catch(function(e){
      localDirty=true;retrySync();
    });
  },delay);
}
function retrySync(){
  setSyncStatus('error');scheduleSyncRetry(retryDelay);retryDelay=Math.min(60000,retryDelay*2);
}
function pushLocal(key){
  if(applyingRemote||!syncCode)return;
  dirtyKeys.add(key);saveDirtyKeys();
  localDirty=true;setSyncStatus('pending');scheduleSyncRetry(250);
}

// 백업 복원처럼 즉시 재시작해야 하는 작업을 위한 강제 저장
window.memorySyncFlush=function(){
  clearTimeout(pushTimer);pushTimer=null;

  if(!syncCode){
    return Promise.resolve({ok:true,localOnly:true});
  }

  localDirty=true;
  function flushUntilClean(){return enqueueSyncWrite().then(function(result){return result.dirty?flushUntilClean():{ok:true};});}
  return flushUntilClean().catch(function(e){
    console.warn('[Memory sync] Explicit save failed.',e);
    localDirty=true;retrySync();
    return {ok:false,error:e};
  });
};
function installStorageHooks(){
  var oldSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){
    var tracked=DATA_KEYS.indexOf(String(k))!==-1,previous=tracked?this.getItem(k):null;
    oldSet.call(this,k,v);
    if(tracked&&previous!==String(v))pushLocal(String(k));
  };
  var oldRemove=Storage.prototype.removeItem;
  Storage.prototype.removeItem=function(k){oldRemove.call(this,k);if(DATA_KEYS.indexOf(String(k))!==-1)pushLocal(String(k));};
}
function loadApp(){
  var s=document.createElement('script');s.src='app.js?v=86';
  s.onerror=function(){console.error('[Memory sync] Could not load app.js');};
  document.body.appendChild(s);
}
function applyRemote(d){
  var remote=snapshotData(d),isComplete=completeSnapshot(d),current=snapshot();
  // Old/unknown snapshots cannot prove completeness: preserve local values on conflicts.
  var merged=mergeSnapshots(current,remote,!isComplete||dirtyKeys.size>0,!isComplete,isComplete?dirtyKeys:null);
  // Preserve locally edited contexts when an older complete snapshot carries defaults.
  if(!window.CardOverrides&&window.BusinessContexts&&merged.srs_cards_v2&&current.srs_cards_v2){
    try{
      var incomingCards=JSON.parse(merged.srs_cards_v2),localCards=JSON.parse(current.srs_cards_v2);
      var scopedChapters=JSON.parse(merged.srs_chapters_v1||'{"chapters":[]}');
      if(Array.isArray(incomingCards.cards)&&Array.isArray(localCards.cards)&&Array.isArray(scopedChapters.chapters)){
        window.BusinessContexts.preserveUserContexts(incomingCards.cards,localCards.cards,scopedChapters.chapters);
        merged.srs_cards_v2=JSON.stringify(incomingCards);
      }
    }catch(e){/* Existing validation and storage behavior handles malformed snapshots. */}
  }
  applyingRemote=true;
  try{DATA_KEYS.forEach(function(k){
    if(Object.prototype.hasOwnProperty.call(merged,k))localStorage.setItem(k,merged[k]);
  });}
  finally{applyingRemote=false;}
  var localNow=snapshot(),needsRepair=signature(localNow)!==signature(remote);
  lastSnapshot=signature(localNow);localDirty=false;
  if(needsRepair&&syncCode){localDirty=true;scheduleSyncRetry(250);}
  else if(isComplete){dirtyKeys.clear();saveDirtyKeys();setSyncStatus('ok');}
}
function studyProtected(){
  if(window.memoryStudySession&&window.memoryStudySession.isActive())return true;
  var latest=null;
  [localStorage,sessionStorage].forEach(function(storage){try{var s=JSON.parse(storage.getItem('memory_study_session_v1'));
    if(s&&s.version===1&&typeof s.revision==='number'&&(!latest||s.revision>latest.revision))latest=s;
  }catch(e){}});
  return !!(latest&&latest.status==='active'&&latest.state&&latest.state.currentId!=null);
}
function canRefresh(){
  return document.visibilityState!=='hidden'&&!localDirty&&!studyProtected()&&
    !document.querySelector('.modal.show, .modal-overlay.show');
}
function refreshRemote(){
  if(pulling||!canRefresh())return;
  pulling=true;
  var requestedSignature=signature(snapshot());
  request('get').then(function(r){
    if(!canRefresh()||signature(snapshot())!==requestedSignature)return;
    if(!hasData(r.data)&&!completeSnapshot(r.data))return;
    var remoteSignature=signature(r.data);
    if(remoteSignature!==requestedSignature&&remoteSignature!==lastSnapshot){
      applyRemote(r.data);
      if(signature(snapshot())!==requestedSignature)window.location.reload();
    }else if(completeSnapshot(r.data))setSyncStatus('ok');
  }).catch(function(){setSyncStatus('error');}).finally(function(){pulling=false;});
}
function startPolling(){
  function resume(immediate){
    if(document.visibilityState==='hidden'||studyProtected())return;
    if(localDirty){
      if(immediate||!pushTimer)scheduleSyncRetry(0);
    }else refreshRemote();
  }
  window.setInterval(function(){resume(false);},20000);
  function foreground(){resume(true);}
  document.addEventListener('visibilitychange',foreground);
  window.addEventListener('pageshow',foreground);
  window.addEventListener('focus',foreground);
  window.addEventListener('online',foreground);
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
  // Restore local session/card journal before any remote snapshot can replace it.
  if(studyProtected()){loadApp();startPolling();return;}
  request('get').then(function(r){
    if(hasData(r.data)||completeSnapshot(r.data)){applyRemote(r.data);loadApp();startPolling();}
    else{return enqueueSyncWrite().then(function(){loadApp();startPolling();});}
  }).catch(function(){setSyncStatus('error');loadApp();startPolling();if(localDirty)scheduleSyncRetry(2000);});
}

/* Read-only sync diagnostics: never reveal codes or snapshot contents. */
function installSyncDiagnostics(){
  if(document.getElementById('memory-sync-diagnostic-button'))return;
  var button=document.createElement('button');
  button.id='memory-sync-diagnostic-button';
  button.type='button';
  button.textContent='☁ 동기화 진단';
  button.setAttribute('aria-controls','memory-sync-diagnostic-panel');
  button.setAttribute('aria-expanded','false');
  var panel=document.createElement('section');
  panel.id='memory-sync-diagnostic-panel';
  panel.setAttribute('role','region');
  panel.setAttribute('aria-label','동기화 진단');
  panel.style.cssText='display:none;margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:12px';
  var title=document.createElement('strong');title.textContent='동기화 진단 (읽기 전용)';
  var status=document.createElement('div');status.style.cssText='margin:12px 0;white-space:pre-line;overflow-wrap:anywhere';
  var check=document.createElement('button');check.type='button';check.textContent='기기·Worker 데이터 일치 검사';
  var receiptButton=document.createElement('button');
  receiptButton.type='button';receiptButton.textContent='검증 영수증 복사';receiptButton.hidden=true;
  var receipt=null,receiptSignature=null;
  receiptButton.addEventListener('click',async function(){
    if(!receipt||!settled()||receiptSignature!==signature(snapshot())){
      receipt=null;receiptButton.hidden=true;
      status.textContent='검증 중단 · 기기 상태가 변경되었습니다. 다시 검사하세요.';
      return;
    }
    var receiptText=JSON.stringify(receipt);
    try{
      await navigator.clipboard.writeText(receiptText);
      status.textContent+='\n검증 영수증을 복사했습니다.';
    }catch(e){
      status.textContent+='\n복사 실패 · 다음 영수증을 선택해 복사하세요.\n'+receiptText;
    }
  });
  check.style.cssText='padding:9px;border-radius:8px;margin-right:8px';
  var reveal=document.createElement('button');reveal.type='button';reveal.textContent='코드 확인 / 복사';reveal.style.cssText='padding:9px;border-radius:8px;margin:8px 8px 8px 0';
  var secretArea=document.createElement('div');secretArea.style.cssText='display:none;margin:8px 0;padding:10px;border:1px solid #777;border-radius:8px';
  var secretInput=document.createElement('input');secretInput.type='password';secretInput.readOnly=true;secretInput.autocomplete='off';secretInput.setAttribute('aria-label','현재 PWA 동기화 코드');
  secretInput.style.cssText='box-sizing:border-box;width:100%;padding:9px;color:white;background:#333;border:1px solid #777;border-radius:6px';
  var toggle=document.createElement('button');toggle.type='button';toggle.textContent='보기';toggle.style.cssText='margin:8px 8px 0 0;padding:7px';
  var copy=document.createElement('button');copy.type='button';copy.textContent='복사';copy.style.cssText='margin:8px 8px 0 0;padding:7px';
  var secretMsg=document.createElement('div');secretMsg.style.cssText='font-size:12px;color:#ddd';
  secretArea.appendChild(secretInput);secretArea.appendChild(toggle);secretArea.appendChild(copy);secretArea.appendChild(secretMsg);
  var compare=document.createElement('button');compare.type='button';compare.textContent='Codex 코드 일치 검사';compare.style.cssText='padding:9px;border-radius:8px;margin:8px 8px 8px 0';
  var comparison=document.createElement('div');comparison.setAttribute('aria-live','polite');
  compare.addEventListener('click',async function(){
    if(!syncCode){comparison.textContent='앱 코드 미등록';return;}
    var expected=window.prompt('Codex에서 확인한 SHA-256 해시를 입력하세요. 원본 코드는 입력하지 마세요.');
    if(expected===null)return;
    expected=expected.trim().toLowerCase();
    if(!/^[a-f0-9]{64}$/.test(expected)){comparison.textContent='SHA-256 형식이 올바르지 않습니다.';return;}
    try{
      var bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(syncCode));
      var actual=Array.from(new Uint8Array(bytes),function(b){return b.toString(16).padStart(2,'0');}).join('');
      comparison.textContent='앱 코드 길이: '+syncCode.length+'자 / Codex 코드: '+(actual===expected?'일치':'불일치');
    }catch(e){comparison.textContent='기기에서 해시 계산을 실행할 수 없습니다.';}
  });
  var close=document.createElement('button');close.type='button';close.textContent='닫기';close.style.cssText='padding:9px;border-radius:8px';
  var note=document.createElement('p');note.textContent='동기화 코드와 학습 내용은 표시하지 않습니다. 이 조회는 서버에 저장하지 않지만, 앱의 기존 자동 동기화 동작은 그대로 유지됩니다.';
  note.style.cssText='font-size:12px;color:#ccc';
  panel.appendChild(title);panel.appendChild(status);panel.appendChild(check);panel.appendChild(receiptButton);panel.appendChild(reveal);panel.appendChild(secretArea);panel.appendChild(compare);panel.appendChild(comparison);panel.appendChild(close);panel.appendChild(note);
  var host=document.getElementById('memory-sync-diagnostic-settings');
  if(!host)return;
  host.appendChild(button);host.appendChild(panel);showSyncStatus();
  function localStatus(){
    var count=Object.keys(snapshot()).length;
    return '앱 동기화 코드: '+(syncCode?'등록됨':'미등록')+'\n로컬 학습 저장 항목: '+count+' / '+DATA_KEYS.length+'\n서버: 아직 조회하지 않음';
  }
  function hideSecret(){secretInput.value='';secretInput.type='password';toggle.textContent='보기';secretArea.style.display='none';secretMsg.textContent='';}
  button.addEventListener('click',function(){hideSecret();panel.style.display='block';button.setAttribute('aria-expanded','true');status.textContent=localStatus();});
  reveal.addEventListener('click',function(){
    if(!syncCode){secretArea.style.display='block';secretMsg.textContent='등록된 동기화 코드가 없습니다.';return;}
    if(!window.confirm('현재 PWA의 동기화 코드를 이 기기에서 확인하거나 복사합니다. 화면 공유나 스크린샷에 코드가 노출되지 않도록 주의하세요. 계속할까요?'))return;
    secretInput.value=syncCode;secretInput.type='password';toggle.textContent='보기';secretArea.style.display='block';
    secretMsg.textContent='이 코드를 Codex 설정에만 입력하세요. 채팅에는 붙여넣지 마세요.';
  });
  toggle.addEventListener('click',function(){secretInput.type=secretInput.type==='password'?'text':'password';toggle.textContent=secretInput.type==='password'?'보기':'숨기기';});
  copy.addEventListener('click',function(){
    if(!secretInput.value)return;
    if(!navigator.clipboard||!navigator.clipboard.writeText){secretMsg.textContent='자동 복사가 지원되지 않습니다. 보기 버튼으로 확인하세요.';return;}
    navigator.clipboard.writeText(secretInput.value).then(function(){secretMsg.textContent='복사됨. Codex에 입력한 후 다른 내용을 복사해 클립보드를 지우세요.';}).catch(function(){secretMsg.textContent='복사 실패. 보기 버튼으로 확인하세요.';});
  });
  close.addEventListener('click',function(){hideSecret();receipt=null;receiptButton.hidden=true;panel.style.display='none';button.setAttribute('aria-expanded','false');button.focus();});
  function settled(){
    return !localDirty&&!dirtyKeys.size&&!readLocal(DIRTY_KEY,[]).length&&
      syncStatus.result==='ok'&&!!syncStatus.lastSuccessAt;
  }
  check.addEventListener('click',async function(){
    receipt=null;receiptButton.hidden=true;
    if(!syncCode||!settled()){
      status.textContent='검증 중단 · 동기화 성공 확인 및 미전송 데이터 해소가 필요합니다.';return;
    }
    check.disabled=true;status.textContent='Worker와 기기 데이터를 읽기 전용으로 비교 중…';
    try{
      var before=signature(snapshot()),response=await request('get');
      if(!completeSnapshot(response.data))throw Error('Snapshot version');
      var local=window.SyncIntegrity.inspect(snapshot()),remote=window.SyncIntegrity.inspect(response.data);
      if(local.canonical!==remote.canonical){
        status.textContent='불일치 · 기기와 Worker의 저장 데이터가 다릅니다.';return;
      }
      if(local.conflictCount){
        status.textContent='검증 중단 · 해결되지 않은 수정 충돌이 있습니다.';return;
      }
      var digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(local.canonical));
      if(!settled()||before!==signature(snapshot())){
        status.textContent='검증 중단 · 검사 중 기기 상태가 변경되었습니다.';return;
      }
      receiptSignature=before;
      receipt={version:1,snapshotVersion:1,hashVersion:1,storageKeyCount:DATA_KEYS.length,
        pending:false,checkedAt:new Date().toISOString(),lastSuccessAt:syncStatus.lastSuccessAt,
        snapshotSha256:Array.from(new Uint8Array(digest),function(byte){return byte.toString(16).padStart(2,'0');}).join('')};
      status.textContent='일치 · 저장 항목 7개 · 마지막 동기화 성공 '+new Date(receipt.lastSuccessAt).toLocaleString();
      receiptButton.hidden=panel.style.display==='none';
    }catch(e){
      status.textContent='검증 실패 · Worker 응답 또는 필수 저장 항목을 확인할 수 없습니다.';
    }finally{check.disabled=false;}
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installSyncDiagnostics,{once:true});else installSyncDiagnostics();

function start(){if(!syncCode){if(studyProtected()){loadApp();return;}showCodeEntry();return;}connectAndLoad();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
