(function(){
'use strict';
var API='https://toeic-cloud-sync.tsta32.workers.dev/';
var CODE_KEY='memory_sync_code_v1';
var DATA_KEYS=['srs_cards_v2','srs_chapters_v1','srs_settings_v1','srs_notes_v1','srs_trends_v1','srs_biz_sessions_v1'];
var applyingRemote=false, localDirty=false, pushTimer=null, lastSnapshot='';
var syncCode=localStorage.getItem(CODE_KEY)||'';

function validCode(v){return /^[A-Za-z0-9_-]{12,80}$/.test(v);}
function snapshot(){var d={};DATA_KEYS.forEach(function(k){var v=localStorage.getItem(k);if(v!==null)d[k]=v;});return d;}
function signature(d){return JSON.stringify(d||{});}
function hasData(d){return !!d&&Object.keys(d).length>0;}
function request(action,data){
  var payload={action:action,code:syncCode};
  if(action==='set')payload.data=data;
  return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    .then(function(r){return r.json().then(function(j){if(!r.ok||j.error)throw new Error(j.error||('HTTP '+r.status));return j;});});
}
function pushLocal(){
  if(applyingRemote||!syncCode)return;
  clearTimeout(pushTimer);localDirty=true;
  pushTimer=setTimeout(function(){
    var d=snapshot();
    request('set',d).then(function(){lastSnapshot=signature(d);localDirty=false;})
      .catch(function(e){console.warn('[Memory sync] Save failed; local data remains safe.',e);});
  },1200);
}
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
  applyingRemote=true;
  try{DATA_KEYS.forEach(function(k){if(Object.prototype.hasOwnProperty.call(d,k))localStorage.setItem(k,d[k]);else localStorage.removeItem(k);});}
  finally{applyingRemote=false;}
  lastSnapshot=signature(snapshot());localDirty=false;
}
function startPolling(){
  window.setInterval(function(){
    if(document.visibilityState==='hidden'||localDirty)return;
    request('get').then(function(r){
      if(!hasData(r.data))return;
      var remote=signature(r.data),local=signature(snapshot());
      if(remote!==local&&remote!==lastSnapshot){applyRemote(r.data);window.location.reload();}
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
    if(hasData(r.data)){applyRemote(r.data);loadApp();startPolling();}
    else{var d=snapshot();return request('set',d).then(function(){lastSnapshot=signature(d);loadApp();startPolling();});}
  }).catch(function(e){console.warn('[Memory sync] Server unavailable; opening local data.',e);loadApp();startPolling();});
}
function start(){if(!syncCode){showCodeEntry();return;}connectAndLoad();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
