(function(){
  'use strict';

  // ---------- constants ----------
  var ONE_MIN = 60*1000;
  var FIFTEEN_MIN = 15*ONE_MIN;
  var ONE_DAY = 24*60*60*1000;
  var WRONG_INTERVALS_DAYS = [1,3,7,15];
  var STORAGE_KEY = 'srs_cards_v1';
  var SETTINGS_KEY = 'srs_settings_v1';

  var seedDeck = [
    { ko: "도와주셔서 감사합니다", en: "thank you for your help" },
    { ko: "이건 제 잘못이었어요", en: "this was my fault" },
    { ko: "다시 한 번 말씀해 주시겠어요?", en: "could you say that again" },
    { ko: "오늘 회의는 취소되었습니다", en: "today's meeting has been cancelled" },
    { ko: "이 부분에 대해 검토해 주세요", en: "please review this part" },
    { ko: "마감일을 연장할 수 있을까요?", en: "can we extend the deadline" },
    { ko: "예상보다 시간이 더 걸렸어요", en: "it took longer than expected" },
    { ko: "다음 주까지 끝내겠습니다", en: "i will finish it by next week" }
  ];

  // ---------- state ----------
  var cards = [];
  var nextId = 1;

  var sessionQueue = [];
  var sessionUniqueIds = [];
  var sessionDoneCount = 0;
  var streak = 0;
  var current = null;
  var chosenCount = 10;
  var hintLevel = 0;
  var pendingDiff = null;
  var sessionMissedIds = [];

  var settings = { volume: 100, newCardRatio: 5 }; // volume 0-200 (%), newCardRatio: 1 new card per N questions

  // ---------- persistence ----------
  function loadCards(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        var parsed = JSON.parse(raw);
        if(parsed && Array.isArray(parsed.cards)){
          cards = parsed.cards;
          // migrate older saved data that doesn't have everAnswered:
          // infer it from stage>0 (already progressed past the first correct answer)
          cards.forEach(function(c){
            if(typeof c.everAnswered !== 'boolean'){
              c.everAnswered = (c.stage || 0) > 0;
            }
          });
          nextId = parsed.nextId || (cards.reduce(function(m,c){ return Math.max(m, c.id); }, 0) + 1);
          return;
        }
      }
    }catch(e){}
    // first run: seed with sample deck
    cards = seedDeck.map(function(d){
      return { id: nextId++, ko: d.ko, en: d.en, stage: 0, dueAt: Date.now(), bookmarked: false, everAnswered: false };
    });
    saveCards();
  }

  function saveCards(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cards: cards, nextId: nextId }));
    }catch(e){}
  }

  function loadSettings(){
    try{
      var raw = localStorage.getItem(SETTINGS_KEY);
      if(raw){
        var parsed = JSON.parse(raw);
        if(parsed){
          if(typeof parsed.volume === 'number') settings.volume = parsed.volume;
          if(typeof parsed.newCardRatio === 'number') settings.newCardRatio = parsed.newCardRatio;
        }
      }
    }catch(e){}
  }

  function saveSettings(){
    try{
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }catch(e){}
  }

  function now(){ return Date.now(); }

  // ---------- grading helpers ----------
  function normalizeForCompare(s){
    return s.trim().toLowerCase().replace(/[.,!?;:'"()\-]/g, '').replace(/\s+/g, ' ').trim();
  }

  function levenshtein(a, b){
    var m = a.length, n = b.length;
    var dp = [];
    for(var i=0;i<=m;i++){ dp.push([i]); }
    for(var j=0;j<=n;j++){ dp[0][j] = j; }
    for(i=1;i<=m;i++){
      for(j=1;j<=n;j++){
        if(a[i-1]===b[j-1]) dp[i][j] = dp[i-1][j-1];
        else dp[i][j] = 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
      }
    }
    return dp[m][n];
  }

  function isWordwiseAnagramMatch(your, ans){
    var yWords = your.split(' ').filter(Boolean);
    var aWords = ans.split(' ').filter(Boolean);
    if(yWords.length !== aWords.length) return false;
    var anyDifferent = false;
    for(var i=0;i<yWords.length;i++){
      var yw = yWords[i], aw = aWords[i];
      if(yw === aw) continue;
      var ySorted = yw.split('').sort().join('');
      var aSorted = aw.split('').sort().join('');
      if(ySorted !== aSorted) return false;
      anyDifferent = true;
    }
    return anyDifferent;
  }

  function diffHighlight(your, ans){
    var maxLen = Math.max(your.length, ans.length);
    var yourHtml = '', ansHtml = '';
    for(var i=0;i<maxLen;i++){
      var yc = your[i] || '';
      var ac = ans[i] || '';
      if(yc === ac){ yourHtml += escapeHtml(yc); ansHtml += escapeHtml(ac); }
      else {
        yourHtml += yc ? '<span class="diff-wrong">'+escapeHtml(yc)+'</span>' : '';
        ansHtml += ac ? '<span class="diff-right">'+escapeHtml(ac)+'</span>' : '';
      }
    }
    return { yourHtml: yourHtml, ansHtml: ansHtml };
  }

  function escapeHtml(s){
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function availableCards(){
    var t = now();
    return cards.filter(function(c){ return c.dueAt <= t; });
  }

  function findCard(id){
    for(var i=0;i<cards.length;i++) if(cards[i].id===id) return cards[i];
    return null;
  }

  // ---------- review status display helper ----------
  function formatDuration(ms){
    if(ms <= 0) return '지금';
    var mins = Math.round(ms / ONE_MIN);
    if(mins < 60) return mins + '분 후';
    var hours = Math.round(ms / (60*ONE_MIN));
    if(hours < 24) return hours + '시간 후';
    var days = Math.round(ms / ONE_DAY);
    return days + '일 후';
  }

  function reviewStatusInfo(c){
    if(!c.everAnswered){
      return { text: '새 카드', cls: 'due-new' };
    }
    var remaining = c.dueAt - now();
    var stageLabel = c.stage > 0
      ? WRONG_INTERVALS_DAYS[Math.min(c.stage-1, WRONG_INTERVALS_DAYS.length-1)] + '일 주기'
      : '당일 주기';
    if(remaining <= 0){
      return { text: stageLabel + ' · 지금 복습 가능', cls: 'due-now' };
    }
    var soon = remaining <= ONE_DAY;
    return { text: stageLabel + ' · ' + formatDuration(remaining) + ' 복습', cls: soon ? 'due-soon' : 'due-later' };
  }

  // ---------- DOM refs ----------
  var $ = function(id){ return document.getElementById(id); };

  // Defensive binding: if an element is missing (e.g. stale cached HTML mismatched
  // with a newer app.js), skip it instead of throwing and silently breaking every
  // listener registered after it. Logs a warning to the console for diagnosis.
  function on(id, event, handler){
    var el = $(id);
    if(!el){
      console.warn('[srs-app] element #' + id + ' not found - skipping listener. ' +
        'This usually means a cached old version of index.html is loaded; hard-refresh or reinstall the app.');
      return;
    }
    el.addEventListener(event, handler);
  }

  // ---------- tabs ----------
  function setTab(which){
    $('quizSetupPane').classList.toggle('active', which==='quiz');
    $('bookmarkPane').classList.toggle('active', which==='bookmark');
    $('settingsPane').classList.toggle('active', which==='settings');
    $('tabQuiz').classList.toggle('active', which==='quiz');
    $('tabBookmark').classList.toggle('active', which==='bookmark');
    $('tabSettings').classList.toggle('active', which==='settings');
    if(which === 'bookmark') renderBookmarkList();
    if(which === 'settings') renderSettingsPane();
  }
  on('tabQuiz', 'click', function(){ setTab('quiz'); });
  on('tabBookmark', 'click', function(){ setTab('bookmark'); });
  on('tabSettings', 'click', function(){ setTab('settings'); });

  // ---------- bookmark + card list rendering ----------
  function renderBookmarkList(){
    var listEl = $('bookmarkList');
    var emptyEl = $('bookmarkEmpty');
    var marked = cards.filter(function(c){ return c.bookmarked; });
    $('bookmarkTabCount').textContent = marked.length;
    listEl.innerHTML = '';
    if(marked.length === 0){ emptyEl.style.display = 'block'; return; }
    emptyEl.style.display = 'none';
    marked.slice().reverse().forEach(function(c){
      var row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML =
        '<div class="text"><div class="ko">'+escapeHtml(c.ko)+'</div><div class="en">'+escapeHtml(c.en)+'</div></div>' +
        '<div class="btns"><button type="button" class="icon-btn unbm" aria-label="북마크 해제">★</button></div>';
      row.querySelector('.unbm').addEventListener('click', function(){
        c.bookmarked = false;
        saveCards();
        renderBookmarkList();
        renderCardList();
      });
      listEl.appendChild(row);
    });
  }

  function renderCardList(){
    var listEl = $('cardList');
    listEl.innerHTML = '';
    $('cardListCount').textContent = cards.length;
    cards.slice().reverse().forEach(function(c){
      var status = reviewStatusInfo(c);
      var row = document.createElement('div');
      row.className = 'list-row with-due';
      row.innerHTML =
        '<div class="text2"><div class="ko">'+escapeHtml(c.ko)+' → '+escapeHtml(c.en)+'</div></div>' +
        '<span class="due-tag '+status.cls+'">'+escapeHtml(status.text)+'</span>' +
        '<div class="btns">' +
          '<button type="button" class="icon-btn bm '+(c.bookmarked?'bookmarked':'')+'" aria-label="북마크">'+(c.bookmarked?'★':'☆')+'</button>' +
          '<button type="button" class="icon-btn del" aria-label="삭제">🗑</button>' +
        '</div>';
      row.querySelector('.bm').addEventListener('click', function(){
        c.bookmarked = !c.bookmarked;
        saveCards();
        renderCardList();
        renderBookmarkList();
      });
      row.querySelector('.del').addEventListener('click', function(){
        cards = cards.filter(function(x){ return x.id !== c.id; });
        saveCards();
        renderCardList();
        renderBookmarkList();
        refreshSetupInfo();
      });
      listEl.appendChild(row);
    });
    refreshExportTextareaIfOpen();
  }

  // ---------- setup screen: count selection ----------
  function refreshSetupInfo(){
    var avail = availableCards();
    var dueNewCount = cards.filter(function(c){ return !c.everAnswered && c.dueAt <= now(); }).length;
    var dueReviewCount = avail.length - dueNewCount;
    $('availInfo').textContent = '지금 풀 수 있는 카드: ' + avail.length + '개 (복습 ' + dueReviewCount + ' / 새 카드 ' + dueNewCount + ')';
    buildCountOptions(avail.length);
    $('customCountHint').textContent = '전체 저장된 문장: ' + cards.length + '개 (그보다 많이는 시작할 수 없어요)';
    $('newCardRatioInfo').textContent = '새 카드 ' + (settings.newCardRatio||5) + '문제당 1개씩 섞여서 출제됩니다 (설정 탭에서 조절 가능)';
  }

  function buildCountOptions(maxAvail){
    var optWrap = $('countOptions');
    optWrap.innerHTML = '';
    var fixed = [5,10,20,30,50];
    fixed.forEach(function(n){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'count-btn';
      b.textContent = n + '문제';
      var disabled = n > maxAvail;
      if(disabled){ b.disabled = true; }
      b.addEventListener('click', function(){
        if(disabled) return;
        chosenCount = n;
        Array.prototype.forEach.call(optWrap.children, function(el){ el.classList.remove('active'); });
        b.classList.add('active');
        $('startBtn').disabled = false;
      });
      optWrap.appendChild(b);
    });
    var firstEnabled = Array.prototype.find.call(optWrap.children, function(el){ return !el.disabled; });
    if(firstEnabled) firstEnabled.click();
    $('startBtn').disabled = maxAvail === 0;
  }

  on('customCountBtn', 'click', function(){
    var inp = $('customCountInput');
    var val = parseInt(inp.value, 10);
    var avail = availableCards();
    if(!val || val < 1){
      inp.style.borderColor = 'var(--danger)';
      return;
    }
    if(val > cards.length){
      inp.style.borderColor = 'var(--danger)';
      $('customCountHint').textContent = '저장된 문장(' + cards.length + '개)보다 많이 입력할 수 없어요';
      $('customCountHint').style.color = 'var(--danger-text)';
      return;
    }
    inp.style.borderColor = '';
    $('customCountHint').style.color = '';
    chosenCount = Math.min(val, avail.length);
    Array.prototype.forEach.call($('countOptions').children, function(el){ el.classList.remove('active'); });
    if(avail.length === 0){
      $('startBtn').disabled = true;
    } else {
      $('startBtn').disabled = false;
    }
    if(val > avail.length){
      $('customCountHint').textContent = '지금 풀 수 있는 카드는 ' + avail.length + '개라 그만큼만 출제돼요';
      $('customCountHint').style.color = '';
    } else {
      $('customCountHint').textContent = val + '문제로 시작합니다';
    }
  });

  // ---------- add card form: toggle open/close ----------
  on('addToggle', 'click', function(){
    var form = $('addForm');
    var chevron = $('addChevron');
    var isOpen = form.style.display === 'block';
    form.style.display = isOpen ? 'none' : 'block';
    chevron.classList.toggle('open', !isOpen);
  });

  // ---------- export all cards for Excel (duplicate-checking) ----------
  on('exportToggle', 'click', function(){
    var pane = $('exportPane');
    var chevron = $('exportChevron');
    var isOpen = pane.style.display === 'block';
    pane.style.display = isOpen ? 'none' : 'block';
    chevron.classList.toggle('open', !isOpen);
    if(!isOpen) refreshExportTextarea();
  });

  function refreshExportTextarea(){
    var lines = cards.map(function(c){ return c.ko + '\t' + c.en; });
    $('exportTextarea').value = lines.join('\n');
  }
  function refreshExportTextareaIfOpen(){
    var pane = $('exportPane');
    if(pane && pane.style.display === 'block') refreshExportTextarea();
  }

  on('exportCopyBtn', 'click', function(){
    var ta = $('exportTextarea');
    refreshExportTextarea();
    ta.focus();
    ta.select();
    var fb = $('exportCopyFeedback');
    var done = false;
    try{
      done = document.execCommand && document.execCommand('copy');
    }catch(e){ done = false; }
    if(!done && navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(ta.value).then(function(){
        fb.textContent = '복사되었습니다 (' + cards.length + '개 문장)';
        fb.style.color = 'var(--success-text)';
      }).catch(function(){
        fb.textContent = '자동 복사에 실패했어요. 텍스트를 직접 선택해서 복사해주세요';
        fb.style.color = 'var(--danger-text)';
      });
      return;
    }
    if(done){
      fb.textContent = '복사되었습니다 (' + cards.length + '개 문장)';
      fb.style.color = 'var(--success-text)';
    } else {
      fb.textContent = '자동 복사에 실패했어요. 텍스트를 직접 선택해서 복사해주세요';
      fb.style.color = 'var(--danger-text)';
    }
    setTimeout(function(){ fb.textContent = ''; }, 2500);
  });

  // ---------- add card form: mode tabs ----------
  on('addModeSingle', 'click', function(){
    $('addModeSingle').classList.add('active');
    $('addModeBulk').classList.remove('active');
    $('addPaneSingle').classList.add('active');
    $('addPaneBulk').classList.remove('active');
  });
  on('addModeBulk', 'click', function(){
    $('addModeBulk').classList.add('active');
    $('addModeSingle').classList.remove('active');
    $('addPaneBulk').classList.add('active');
    $('addPaneSingle').classList.remove('active');
  });

  on('addCardBtn', 'click', function(){
    var koInp = $('newKo'), enInp = $('newEn'), bmInp = $('newBookmark'), fb = $('addFeedback');
    var ko = koInp.value.trim(), en = enInp.value.trim();
    if(!ko || !en){
      fb.textContent = '한국어 뜻과 영어 정답을 모두 입력해주세요';
      fb.style.color = 'var(--danger-text)';
      return;
    }
    cards.push({ id: nextId++, ko: ko, en: en, stage: 0, dueAt: now(), bookmarked: bmInp.checked, everAnswered: false });
    saveCards();
    koInp.value = ''; enInp.value = ''; bmInp.checked = false;
    fb.textContent = '카드가 추가되었습니다';
    fb.style.color = 'var(--success-text)';
    renderCardList(); renderBookmarkList(); refreshSetupInfo();
    setTimeout(function(){ fb.textContent = ''; }, 1800);
  });

  // ---------- bulk paste add (from Excel / Google Sheets) ----------
  function parseBulkInput(raw){
    var lines = raw.split(/\r\n|\r|\n/);
    var added = [];
    var skipped = 0;
    lines.forEach(function(line){
      if(!line.trim()) return;
      // split on tab first (Excel/Sheets paste), fallback to 2+ spaces, then comma
      var parts;
      if(line.indexOf('\t') !== -1){
        parts = line.split('\t');
      } else if(/ {2,}/.test(line)){
        parts = line.split(/ {2,}/);
      } else if(line.indexOf(',') !== -1){
        parts = line.split(',');
      } else {
        parts = [line];
      }
      var ko = (parts[0] || '').trim();
      var en = (parts[1] || '').trim();
      if(!ko || !en){ skipped++; return; }
      added.push({ ko: ko, en: en });
    });
    return { added: added, skipped: skipped };
  }

  on('bulkAddBtn', 'click', function(){
    var ta = $('bulkInput');
    var resultEl = $('bulkResult');
    var raw = ta.value;
    if(!raw.trim()){
      resultEl.textContent = '붙여넣은 내용이 없어요';
      resultEl.style.color = 'var(--danger-text)';
      return;
    }
    var parsed = parseBulkInput(raw);
    if(parsed.added.length === 0){
      resultEl.textContent = '인식된 문장이 없어요. 형식을 확인해주세요 (한국어 [탭] 영어, 한 줄에 하나씩)';
      resultEl.style.color = 'var(--danger-text)';
      return;
    }
    parsed.added.forEach(function(item){
      cards.push({ id: nextId++, ko: item.ko, en: item.en, stage: 0, dueAt: now(), bookmarked: false, everAnswered: false });
    });
    saveCards();
    ta.value = '';
    var msg = parsed.added.length + '개 추가 완료';
    if(parsed.skipped > 0) msg += ' (형식이 안 맞아 건너뛴 줄 ' + parsed.skipped + '개)';
    resultEl.textContent = msg;
    resultEl.style.color = 'var(--success-text)';
    renderCardList(); renderBookmarkList(); refreshSetupInfo();
  });

  // ---------- cancel session modal ----------
  on('cancelSessionBtn', 'click', function(){
    $('cancelModal').classList.add('show');
  });
  on('cancelModalBack', 'click', function(){
    $('cancelModal').classList.remove('show');
  });
  on('cancelModalConfirm', 'click', function(){
    $('cancelModal').classList.remove('show');
    // cards already answered this session already had their schedule saved at answer time.
    // unanswered cards in sessionQueue keep their pre-existing dueAt/stage untouched.
    current = null;
    pendingDiff = null;
    $('quizScreen').style.display = 'none';
    $('setupScreen').style.display = 'block';
    refreshSetupInfo();
    renderCardList();
  });

  // ---------- session flow ----------
  on('startBtn', 'click', startSession);
  on('restartBtn', 'click', function(){
    $('doneScreen').style.display = 'none';
    $('setupScreen').style.display = 'block';
    refreshSetupInfo();
    renderCardList();
  });

  // Build a session queue mixing due review cards with never-answered "new" cards,
  // at roughly 1 new card per `settings.newCardRatio` questions.
  function buildSessionSelection(n){
    var t = now();
    var dueReview = cards.filter(function(c){ return c.everAnswered && c.dueAt <= t; });
    var dueNew = cards.filter(function(c){ return !c.everAnswered && c.dueAt <= t; });
    dueReview.sort(function(a,b){ return a.dueAt - b.dueAt; });
    dueNew.sort(function(a,b){ return a.dueAt - b.dueAt; });

    var ratio = Math.max(1, settings.newCardRatio || 5);
    var result = [];
    var ri = 0, ni = 0;
    var slot = 0;
    while(result.length < n && (ri < dueReview.length || ni < dueNew.length)){
      slot++;
      var wantNew = (slot % ratio === 0);
      if(wantNew && ni < dueNew.length){
        result.push(dueNew[ni++]);
      } else if(ri < dueReview.length){
        result.push(dueReview[ri++]);
      } else if(ni < dueNew.length){
        result.push(dueNew[ni++]);
      }
    }
    return result;
  }

  function availableCardsCount(){
    return availableCards().length;
  }

  function startSession(){
    var chosen = buildSessionSelection(chosenCount);
    sessionQueue = chosen.map(function(c){ return c.id; });
    sessionUniqueIds = chosen.map(function(c){ return c.id; });
    sessionDoneCount = 0;
    streak = 0;
    sessionMissedIds = [];
    $('setupScreen').style.display = 'none';
    $('quizScreen').style.display = 'block';
    loadNext();
  }

  function updateStats(){
    var total = sessionUniqueIds.length;
    $('progressCount').textContent = sessionDoneCount + '/' + total;
    $('streakCount').textContent = streak;
    $('remainingCount').textContent = Math.max(total - sessionDoneCount, 0);
  }

  function maskWord(word, level){
    return word.split('').map(function(ch, idx){
      if(!/[a-zA-Z]/.test(ch)) return level >= 3 ? ch : '';
      if(level >= 3) return ch;
      if(level === 2 && idx === 0) return ch;
      return '_';
    }).join('');
  }
  function buildHint(en, level){
    return en.split(' ').map(function(w){ return maskWord(w, level); }).join('   ');
  }
  function hintLabelText(level){
    if(level === 1) return '실루엣 힌트';
    if(level === 2) return '첫 글자 힌트';
    if(level === 3) return '전체 정답';
    return '';
  }
  function showHint(level){
    var hintTextEl = $('hintText'), hintLabelEl = $('hintLabel');
    if(level <= 0){ hintTextEl.style.display = 'none'; hintLabelEl.style.display = 'none'; return; }
    hintTextEl.textContent = buildHint(current.en, level);
    hintTextEl.style.color = level >= 3 ? 'var(--danger-text)' : 'var(--warning)';
    hintTextEl.style.display = 'block';
    hintLabelEl.textContent = hintLabelText(level);
    hintLabelEl.style.display = 'block';
  }
  function boxLabel(stage, hint){
    if(hint === 1) return '실루엣 힌트';
    if(hint === 2) return '첫 글자 힌트';
    if(hint === 3) return '전체 노출';
    if(stage === 0) return '새 카드 / 당일 사이클';
    var d = WRONG_INTERVALS_DAYS[Math.min(stage-1, WRONG_INTERVALS_DAYS.length-1)];
    return d + '일 간격';
  }

  function resetInputUI(){
    var inp = $('answerInput');
    inp.value = '';
    inp.disabled = false;
    $('checkBtn').style.display = 'block';
    $('nextBtn').style.display = 'none';
    $('diffPanel').style.display = 'none';
    pendingDiff = null;
    setTimeout(function(){ inp.focus(); }, 50);
  }

  function loadNext(){
    var koreanEl = $('koreanText');
    koreanEl.style.color = '';
    hintLevel = 0;
    resetInputUI();
    if(sessionQueue.length === 0){ finishSession(); return; }
    var id = sessionQueue.shift();
    current = findCard(id);
    $('boxBadge').textContent = boxLabel(current.stage, 0);
    koreanEl.textContent = current.ko;
    showHint(0);
    updateStats();
  }

  function finishSession(){
    $('quizScreen').style.display = 'none';
    $('doneScreen').style.display = 'block';
    $('doneSummary').textContent = sessionUniqueIds.length + '개 전부 정답 처리 완료';

    var missedWrap = $('missedWrap'), missedList = $('missedList');
    missedList.innerHTML = '';
    var uniqueMissed = Array.from(new Set(sessionMissedIds)).map(findCard).filter(Boolean);
    if(uniqueMissed.length === 0){
      missedWrap.style.display = 'none';
    } else {
      missedWrap.style.display = 'block';
      uniqueMissed.forEach(function(c){
        var row = document.createElement('div');
        row.className = 'list-row';
        row.innerHTML =
          '<div class="text"><div class="ko">'+escapeHtml(c.ko)+'</div><div class="en">'+escapeHtml(c.en)+'</div></div>' +
          '<div class="btns"><button type="button" class="icon-btn bm '+(c.bookmarked?'bookmarked':'')+'" aria-label="북마크">'+(c.bookmarked?'★':'☆')+'</button></div>';
        var bmBtn = row.querySelector('.bm');
        bmBtn.addEventListener('click', function(){
          c.bookmarked = !c.bookmarked;
          saveCards();
          bmBtn.textContent = c.bookmarked ? '★' : '☆';
          bmBtn.classList.toggle('bookmarked', c.bookmarked);
        });
        missedList.appendChild(row);
      });
    }
    renderCardList();
    renderBookmarkList();
  }

  // ---------- audio ----------
  var audioCtx = null;
  function getAudioCtx(){
    if(!audioCtx){
      try{ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return null; }
    }
    if(audioCtx.state === 'suspended'){ audioCtx.resume(); }
    return audioCtx;
  }
  // Master compressor so louder volume settings don't clip/distort when several
  // overlapping notes play at once - lets us push raw gain much higher safely.
  var masterCompressor = null;
  function getMasterChain(ctx){
    if(!masterCompressor || masterCompressor.context !== ctx){
      masterCompressor = ctx.createDynamicsCompressor();
      masterCompressor.threshold.value = -12;
      masterCompressor.knee.value = 18;
      masterCompressor.ratio.value = 8;
      masterCompressor.attack.value = 0.002;
      masterCompressor.release.value = 0.15;
      masterCompressor.connect(ctx.destination);
    }
    return masterCompressor;
  }

  function tone(freq, startTime, duration, type, gainPeak){
    var ctx = getAudioCtx();
    if(!ctx) return;
    // volume slider goes 0-200%, so volMul can exceed 1.0 for a real loudness boost
    var volPct = (settings.volume==null ? 100 : settings.volume);
    var volMul = Math.max(0, volPct / 100) * 2.4; // 100% slider -> 2.4x base gain, much louder than before
    if(volMul <= 0) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'triangle';
    osc.frequency.value = freq;
    var peak = Math.min((gainPeak || 0.2) * volMul, 1.6); // compressor handles the ceiling
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    var chain = getMasterChain(ctx);
    osc.connect(gain); gain.connect(chain);
    osc.start(startTime); osc.stop(startTime + duration + 0.02);
  }
  // Bright, punchy "correct" sound: a fast major arpeggio plus a high bell-like
  // overtone on the last note for extra sparkle. Scales further with streaks.
  // Plays a single bell-like chime: a fundamental tone plus a quiet octave
  // overtone for a metallic "ding" character, similar to a doorbell/notification chime.
  function chimeNote(freq, startTime, duration, gainPeak){
    var ctx = getAudioCtx();
    if(!ctx) return;
    tone(freq, startTime, duration, 'sine', gainPeak);
    tone(freq * 2, startTime, duration * 0.6, 'sine', gainPeak * 0.35);
    tone(freq * 2.76, startTime, duration * 0.4, 'sine', gainPeak * 0.15);
  }

  // "Ding-dong" two-note notification chime (high note then a slightly lower note),
  // similar in spirit to a ride-hailing app's match alert or a doorbell.
  function playCorrectSound(big){
    var ctx = getAudioCtx();
    if(!ctx) return;
    var t = ctx.currentTime;
    // E6 (ding) -> C6 (dong) - bright, clean interval, classic doorbell feel
    chimeNote(1318.5, t, 0.5, 0.9);
    chimeNote(1046.5, t + 0.16, 0.6, 0.85);
    if(big){
      // on a streak, add a quick high sparkle echo after the main ding-dong
      chimeNote(1568.0, t + 0.34, 0.35, 0.4);
    }
  }
  // Wrong answers are intentionally silent per user preference - no sound, no
  // negative audio feedback. Visual shake + NG text + red flash communicate it instead.
  function playWrongSound(){
    // intentionally no-op
  }

  // ---------- settings pane ----------
  function renderSettingsPane(){
    $('volumeSlider').value = settings.volume;
    $('volumeValue').textContent = settings.volume + '%';
    $('ratioValue').textContent = settings.newCardRatio + '문제당 1개';
  }
  on('volumeSlider', 'input', function(e){
    settings.volume = parseInt(e.target.value, 10) || 0;
    $('volumeValue').textContent = settings.volume + '%';
    saveSettings();
  });
  on('volumeSlider', 'change', function(){
    // play a short preview tone so the user can hear the new volume immediately
    playCorrectSound(false);
  });
  on('ratioMinus', 'click', function(){
    settings.newCardRatio = Math.max(2, settings.newCardRatio - 1);
    $('ratioValue').textContent = settings.newCardRatio + '문제당 1개';
    saveSettings();
    refreshSetupInfo();
  });
  on('ratioPlus', 'click', function(){
    settings.newCardRatio = Math.min(50, settings.newCardRatio + 1);
    $('ratioValue').textContent = settings.newCardRatio + '문제당 1개';
    saveSettings();
    refreshSetupInfo();
  });

  // ---------- visual effects ----------
  function getCardRect(){
    var c = $('quizCard');
    return { w: c.clientWidth, h: c.clientHeight };
  }
  var SVGNS = 'http://www.w3.org/2000/svg';

  function leafPath(size){
    var s = size;
    return 'M0,'+s+' C'+(s*0.15)+','+(s*0.3)+' '+(s*0.5)+',0 '+s+',0 C'+(s*0.5)+','+(s*0.15)+' '+(s*0.3)+','+(s*0.5)+' 0,'+s+' Z';
  }
  function makeFlower(size, color){
    var g = document.createElementNS(SVGNS,'g');
    for(var i=0;i<5;i++){
      var petal = document.createElementNS(SVGNS,'ellipse');
      petal.setAttribute('cx', 0); petal.setAttribute('cy', -size*0.55);
      petal.setAttribute('rx', size*0.32); petal.setAttribute('ry', size*0.55);
      petal.setAttribute('fill', color);
      petal.setAttribute('transform', 'rotate('+(72*i)+')');
      g.appendChild(petal);
    }
    var center = document.createElementNS(SVGNS,'circle');
    center.setAttribute('r', size*0.28); center.setAttribute('fill', '#FAC775');
    g.appendChild(center);
    return g;
  }
  function bloomEffect(){
    var svg = $('fxLayer');
    var rect = getCardRect();
    var greens = ['#1D9E75','#5DCAA5','#639922','#97C459'];
    var pinks = ['#ED93B1','#D4537E','#F0997B'];
    for(var i=0;i<34;i++){
      var x = Math.random()*rect.w, y = Math.random()*rect.h;
      var isFlower = Math.random() < 0.35;
      var size = isFlower ? (10+Math.random()*10) : (16+Math.random()*16);
      var el = isFlower ? makeFlower(size, pinks[Math.floor(Math.random()*pinks.length)]) : document.createElementNS(SVGNS,'path');
      if(!isFlower){
        el.setAttribute('d', leafPath(size));
        el.setAttribute('fill', greens[Math.floor(Math.random()*greens.length)]);
      }
      var startRot = Math.random()*360;
      el.setAttribute('transform', 'translate('+x+','+y+') scale(0) rotate('+startRot+')');
      el.style.opacity = '0';
      svg.appendChild(el);
      var start = null, delay = Math.random()*120;
      var driftX = (Math.random()-0.5)*40, driftY = (Math.random()-0.5)*40 - 10;
      var endRot = startRot + (Math.random()-0.5)*120;
      (function(el,x,y,driftX,driftY,startRot,endRot,delay){
        function step(ts){
          if(!start) start = ts;
          var elapsed = ts-start-delay;
          if(elapsed < 0){ requestAnimationFrame(step); return; }
          var p = Math.min(elapsed/900, 1);
          var growP = Math.min(elapsed/280, 1);
          var scale = growP < 1 ? Math.sin(growP*Math.PI/2)*1.15 : Math.max(0, 1.15 - (p-0.3)/0.7*1.15);
          var cx = x + driftX*p, cy = y + driftY*p + p*p*30;
          var rot = startRot + (endRot-startRot)*p;
          el.setAttribute('transform', 'translate('+cx+','+cy+') scale('+scale.toFixed(2)+') rotate('+rot.toFixed(0)+')');
          el.style.opacity = growP < 1 ? String(growP) : String(Math.max(0, 1-(p-0.3)/0.7));
          if(p<1) requestAnimationFrame(step); else el.remove();
        }
        requestAnimationFrame(step);
      })(el,x,y,driftX,driftY,startRot,endRot,delay);
    }
    var wash = document.createElementNS(SVGNS,'rect');
    wash.setAttribute('x',0); wash.setAttribute('y',0);
    wash.setAttribute('width', rect.w); wash.setAttribute('height', rect.h);
    wash.setAttribute('fill', '#9FE1CB'); wash.style.opacity = '0';
    svg.insertBefore(wash, svg.firstChild);
    var wStart = null;
    function washStep(ts){
      if(!wStart) wStart = ts;
      var p = Math.min((ts-wStart)/500,1);
      wash.style.opacity = p < 0.25 ? String(p/0.25*0.35) : String(Math.max(0, 0.35*(1-(p-0.25)/0.75)));
      if(p<1) requestAnimationFrame(washStep); else wash.remove();
    }
    requestAnimationFrame(washStep);
  }

  function bigText(label, color){
    var svg = $('fxLayer');
    var rect = getCardRect();
    var t = document.createElementNS(SVGNS,'text');
    t.setAttribute('x', rect.w/2); t.setAttribute('y', rect.h/2);
    t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','middle');
    t.setAttribute('font-size', '0'); t.setAttribute('font-weight','600'); t.setAttribute('fill', color);
    t.textContent = label;
    svg.appendChild(t);
    var start = null;
    function step(ts){
      if(!start) start = ts;
      var p = Math.min((ts-start)/750, 1);
      var scale = p < 0.35 ? 56 * (1.5 - 0.5*Math.cos((p/0.35)*Math.PI)) : 56;
      t.setAttribute('font-size', scale.toFixed(1));
      t.style.opacity = p < 0.55 ? '1' : String(Math.max(0, 1-(p-0.55)/0.45));
      if(p<1) requestAnimationFrame(step); else t.remove();
    }
    requestAnimationFrame(step);
  }

  function shakeScreen(){
    var card = $('quizCard');
    var frames = [0,-10,10,-8,8,-5,5,-2,2,0];
    var i=0;
    function step(){
      if(i>=frames.length){ card.style.transform = ''; return; }
      card.style.transform = 'translateX('+frames[i]+'px)';
      i++; setTimeout(step,35);
    }
    step();
  }

  function flashColorPulse(color, big){
    var card = $('quizCard');
    card.style.transition = 'none';
    card.style.boxShadow = '0 0 0 ' + (big?4:3) + 'px ' + color + ' inset';
    card.style.transform = 'scale(' + (big?1.04:1.02) + ')';
    requestAnimationFrame(function(){
      card.style.transition = 'box-shadow 0.5s ease, transform 0.4s cubic-bezier(.34,1.56,.64,1)';
      card.style.boxShadow = '0 0 0 0px transparent inset';
      card.style.transform = 'scale(1)';
    });
  }

  // ---------- scheduling ----------
  function scheduleCorrect(card, classification){
    card.everAnswered = true;
    if(classification === 'easy'){
      card.stage = 0;
      card.dueAt = now() + FIFTEEN_MIN;
    } else {
      card.stage = Math.min((card.stage||0) + 1, WRONG_INTERVALS_DAYS.length);
      var days = WRONG_INTERVALS_DAYS[Math.min(card.stage-1, WRONG_INTERVALS_DAYS.length-1)];
      card.dueAt = now() + days*ONE_DAY;
    }
    saveCards();
  }

  function finalizeCorrect(fromDiffAuto){
    var classification = hintLevel >= 2 ? 'hard' : 'easy';
    scheduleCorrect(current, classification);
    sessionDoneCount++;
    if(classification === 'hard'){ sessionMissedIds.push(current.id); streak = 0; }
    else { streak++; }

    var koreanEl = $('koreanText');
    koreanEl.style.color = 'var(--success-text)';
    var big = streak >= 3;
    flashColorPulse('var(--success)', big || classification==='hard');
    bloomEffect();
    bigText('OK', '#085041');
    playCorrectSound(big);

    $('answerInput').disabled = true;
    $('checkBtn').style.display = 'none';
    $('diffPanel').style.display = 'none';
    updateStats();

    if(fromDiffAuto){
      $('nextBtn').style.display = 'none';
      setTimeout(function(){ loadNext(); }, 900);
    } else {
      $('nextBtn').style.display = 'block';
      setTimeout(function(){ $('nextBtn').focus(); }, 50);
    }
  }

  function escalateWrong(){
    streak = 0;
    var koreanEl = $('koreanText');
    koreanEl.style.color = 'var(--danger-text)';
    flashColorPulse('var(--danger)', true);
    shakeScreen();
    bigText('NG', '#791F1F');
    playWrongSound();

    hintLevel = Math.min(hintLevel + 1, 3);
    showHint(hintLevel);
    $('boxBadge').textContent = boxLabel(current.stage, hintLevel);

    var inp = $('answerInput');
    inp.value = ''; inp.disabled = false;
    $('diffPanel').style.display = 'none';
    $('checkBtn').style.display = 'block';
    pendingDiff = null;
    setTimeout(function(){ inp.focus(); }, 350);
    updateStats();
  }

  function showDiffPhase(yourRaw, ansRaw){
    pendingDiff = { yourRaw: yourRaw, ansRaw: ansRaw };
    var d = diffHighlight(yourRaw, ansRaw);
    $('diffYour').innerHTML = '입력: ' + d.yourHtml;
    $('diffAns').innerHTML = '정답: ' + d.ansHtml;
    $('diffPanel').style.display = 'block';
    $('checkBtn').style.display = 'none';
    $('answerInput').disabled = true;
    setTimeout(function(){ $('markCorrectBtn').focus(); }, 50);
  }

  on('markCorrectBtn', 'click', function(){ finalizeCorrect(true); });
  on('markWrongBtn', 'click', function(){ escalateWrong(); });

  function checkAnswer(){
    if(!current) return;
    if(pendingDiff){ finalizeCorrect(true); return; }
    var inp = $('answerInput');
    var val = normalizeForCompare(inp.value);
    var ans = normalizeForCompare(current.en);

    if(val.length === 0){ escalateWrong(); return; }
    if(val === ans){ finalizeCorrect(false); return; }

    var dist = levenshtein(val, ans);
    if(dist === 1 || isWordwiseAnagramMatch(val, ans)){
      showDiffPhase(val, ans);
      return;
    }
    escalateWrong();
  }

  on('checkBtn', 'click', checkAnswer);
  on('nextBtn', 'click', loadNext);

  document.addEventListener('keydown', function(e){
    if(e.key !== 'Enter') return;
    if($('quizScreen').style.display === 'none') return;
    if(pendingDiff){ e.preventDefault(); finalizeCorrect(true); return; }
    if($('nextBtn').style.display === 'block'){ e.preventDefault(); loadNext(); return; }
    if($('checkBtn').style.display === 'block'){ e.preventDefault(); checkAnswer(); return; }
  });

  // ---------- PWA install prompt ----------
  var deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferredInstallPrompt = e;
    $('installBanner').style.display = 'flex';
  });
  on('installBtn', 'click', function(){
    if(!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.finally(function(){
      deferredInstallPrompt = null;
      $('installBanner').style.display = 'none';
    });
  });
  window.addEventListener('appinstalled', function(){
    $('installBanner').style.display = 'none';
  });

  // ---------- service worker ----------
  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('service-worker.js').catch(function(){});
    });
  }

  // ---------- init ----------
  (function checkRequiredElements(){
    var requiredIds = [
      'setupScreen','quizScreen','doneScreen','cancelModal','cancelSessionBtn',
      'cancelModalBack','cancelModalConfirm','startBtn','checkBtn','nextBtn',
      'koreanText','answerInput','diffPanel','markCorrectBtn','markWrongBtn',
      'tabSettings','settingsPane','volumeSlider','ratioMinus','ratioPlus',
      'exportToggle','exportPane','exportTextarea','exportCopyBtn'
    ];
    var missing = requiredIds.filter(function(id){ return !$(id); });
    if(missing.length){
      console.warn('[srs-app] Missing elements detected: ' + missing.join(', ') +
        '. This usually means index.html is an older cached version that does not match app.js. ' +
        'Try a hard refresh, or delete and reinstall the home screen app.');
    }
  })();

  loadSettings();
  loadCards();
  setTab('quiz');
  renderCardList();
  renderBookmarkList();
  refreshSetupInfo();
})();
