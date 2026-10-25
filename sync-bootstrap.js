(function(){
'use strict';

var API = 'https://toeic-cloud-sync.tsta32.workers.dev/';
var CODE_KEY = 'memory_sync_code_v1';
var DATA_KEYS = [
  'srs_cards_v2',
  'srs_chapters_v1',
  'srs_settings_v1',
  'srs_notes_v1',
  'srs_trends_v1',
  'srs_biz_sessions_v1'
];
var applyingRemote = false;
var localDirty = false;
var pushTimer = null;
var lastSnapshot = '';

function validCode(value) {
  return /^[A-Za-z0-9_-]{12,80}$/.test(value);
}
function snapshot() {
  var data = {};
  DATA_KEYS.forEach(function(key) {
    var value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  });
  return data;
}
function signature(data) {
  return JSON.stringify(data || {});
}
function hasData(data) {
  return !!data && Object.keys(data).length > 0;
}
function request(action, data) {
  var payload = { action: action, code: syncCode };
  if (action === 'set') payload.data = data;
  return fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function(response) {
    return response.json().then(function(json) {
      if (!response.ok || json.error) {
        throw new Error(json.error || ('HTTP ' + response.status));
      }
      return json;
    });
  });
}
function pushLocal() {
  if (applyingRemote || !syncCode) return;
  clearTimeout(pushTimer);
  localDirty = true;
  pushTimer = setTimeout(function() {
    var data = snapshot();
    request('set', data).then(function() {
      lastSnapshot = signature(data);
      localDirty = false;
    }).catch(function(error) {
      console.warn('[Memory sync] Save failed; local data remains safe.', error);
    });
  }, 1200);
}
function installStorageHooks() {
  var originalSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    originalSet.call(this, key, value);
    if (DATA_KEYS.indexOf(String(key)) !== -1) pushLocal();
  };
  var originalRemove = Storage.prototype.removeItem;
  Storage.prototype.removeItem = function(key) {
    originalRemove.call(this, key);
    if (DATA_KEYS.indexOf(String(key)) !== -1) pushLocal();
  };
}
function loadApp() {
  var script = document.createElement('script');
  script.src = 'app.js';
  script.onerror = function() {
    console.error('[Memory sync] Could not load app.js');
  };
  document.body.appendChild(script);
}
function applyRemote(data) {
  applyingRemote = true;
  DATA_KEYS.forEach(function(key) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      localStorage.setItem(key, data[key]);
    } else {
      localStorage.removeItem(key);
    }
  });
  applyingRemote = false;
  lastSnapshot = signature(snapshot());
  localDirty = false;
}
function startPolling() {
  window.setInterval(function() {
    if (document.visibilityState === 'hidden' || localDirty) return;
    request('get').then(function(result) {
      if (!hasData(result.data)) return;
      var remoteSig = signature(result.data);
      var localSig = signature(snapshot());
      if (remoteSig !== localSig && remoteSig !== lastSnapshot) {
        applyRemote(result.data);
        // Reload app state so its in-memory data reflects the remote snapshot.
        window.location.reload();
      }
    }).catch(function(error) {
      console.warn('[Memory sync] Background check failed; continuing locally.', error);
    });
  }, 20000);
}

var syncCode = localStorage.getItem(CODE_KEY) || '';
function start() {
  if (!syncCode) {
    var entered = window.prompt(
      'Memory 클라우드 동기화 코드\\n\\n' +
      '처음 사용하는 기기에서는 영문/숫자 조합 12자 이상의 코드를 정하세요.\\n' +
      '다른 기기에서는 반드시 같은 코드를 입력하세요.\\n' +
      '코드는 두 기기만 공유하고 다른 사람에게 알려주지 마세요.'
    );
    if (!entered) {
      loadApp();
      return;
    }
    syncCode = entered.trim();
    if (!validCode(syncCode)) {
      window.alert('코드는 영문/숫자/_/- 조합으로 12~80자여야 합니다. 다시 열어 입력해 주세요.');
      loadApp();
      return;
    }
    localStorage.setItem(CODE_KEY, syncCode);
  }

  installStorageHooks();
  request('get').then(function(result) {
    if (hasData(result.data)) {
      applyRemote(result.data);
      loadApp();
      startPolling();
    } else {
      var initial = snapshot();
      return request('set', initial).then(function() {
        lastSnapshot = signature(initial);
        loadApp();
        startPolling();
      });
    }
  }).catch(function(error) {
    console.warn('[Memory sync] Server unavailable; opening local data.', error);
    loadApp();
    startPolling();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
})();