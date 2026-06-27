(function(){
'use strict';

var ONE_MIN=60*1000,FIFTEEN_MIN=15*ONE_MIN,ONE_DAY=24*60*60*1000;
// Stage intervals in days: stage 1~9
var STAGE_DAYS=[1,3,7,15,30,60,120,240,360];
var CARDS_KEY='srs_cards_v2',CHAPTERS_KEY='srs_chapters_v1',SETTINGS_KEY='srs_settings_v1';
var NOTES_KEY='srs_notes_v1';    // {cardId: [{id,date,q,a,summary}]}
var TRENDS_KEY='srs_trends_v1';  // [{date, result}]
var APIKEY_KEY='srs_apikey_v1';

var cards=[],chapters=[],settings={volume:100,newCardRatio:5};
var nextCardId=1,nextChapterId=1;

var sessionQueue=[],sessionUniqueIds=[],sessionDoneCount=0,streak=0;
var current=null,hintLevel=0,pendingDiff=null,autoAdvanceToken=0;
var sessionMissedIds=[],retryQueue=[];
var currentIsRetry=false; // 현재 풀고 있는 카드가 세션 내 재도전 카드인지 여부

var acSort='added',acShowKo=true,acShowEn=true,acSearch='';
var acChapterFilter=null,acCheckedIds={};
var acReverse=false; // 역순 여부
var acBmOnly=false;  // 북마크만 보기
var acHasNoteOnly=false; // 질문 있는 문장만

var quizOrder='added'; // 'added'|'reverse'|'alpha'|'random'
var quizBmOnly=false;

// QA 시스템
var notes={};   // {cardId: [{id,date,q,a,summary}]}
var trends=[];  // [{date,result}]
var apiKey='';
var quizMarkedIds={}; // 퀴즈 중 질문 표시한 카드 id
var askTargetCardId=null; // 현재 질문 모달 대상 카드
var selectedChapterIds={};
var chosenCount=10;

function now(){return Date.now();}
var $=function(id){return document.getElementById(id);};
function on(id,evt,fn){var el=$(id);if(!el){console.warn('[srs] missing #'+id);return;}el.addEventListener(evt,fn);}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function norm(s){return s.trim().toLowerCase().replace(/[.,!?;:'"()\-]/g,'').replace(/\s+/g,' ').trim();}

// Expand all contractions to their full forms so that
// "I'm" and "I am", "won't" and "will not", etc. are treated as identical.
function expandContractions(s){
  s=s.toLowerCase();
  // negative contractions first (order matters: won't before 'll etc.)
  s=s.replace(/\bwon't\b/g,'will not');
  s=s.replace(/\bcan't\b/g,'cannot');
  s=s.replace(/\bcannot\b/g,'cannot');
  s=s.replace(/\baint\b/g,'are not');        // informal
  s=s.replace(/\bisn't\b/g,'is not');
  s=s.replace(/\baren't\b/g,'are not');
  s=s.replace(/\bwasn't\b/g,'was not');
  s=s.replace(/\bweren't\b/g,'were not');
  s=s.replace(/\bdon't\b/g,'do not');
  s=s.replace(/\bdoesn't\b/g,'does not');
  s=s.replace(/\bdidn't\b/g,'did not');
  s=s.replace(/\bwouldn't\b/g,'would not');
  s=s.replace(/\bcouldn't\b/g,'could not');
  s=s.replace(/\bshouldn't\b/g,'should not');
  s=s.replace(/\bhaven't\b/g,'have not');
  s=s.replace(/\bhasn't\b/g,'has not');
  s=s.replace(/\bhadn't\b/g,'had not');
  s=s.replace(/\bmightn't\b/g,'might not');
  s=s.replace(/\bmustn't\b/g,'must not');
  s=s.replace(/\bneedn't\b/g,'need not');
  // positive contractions
  s=s.replace(/\bi'm\b/g,'i am');
  s=s.replace(/\byou're\b/g,'you are');
  s=s.replace(/\bhe's\b/g,'he is');          // covers he has too — normalised same
  s=s.replace(/\bshe's\b/g,'she is');
  s=s.replace(/\bit's\b/g,'it is');
  s=s.replace(/\bwe're\b/g,'we are');
  s=s.replace(/\bthey're\b/g,'they are');
  s=s.replace(/\bthat's\b/g,'that is');
  s=s.replace(/\bwhat's\b/g,'what is');
  s=s.replace(/\bthere's\b/g,'there is');
  s=s.replace(/\bhere's\b/g,'here is');
  s=s.replace(/\bwho's\b/g,'who is');
  s=s.replace(/\bhow's\b/g,'how is');
  s=s.replace(/\bi'll\b/g,'i will');
  s=s.replace(/\byou'll\b/g,'you will');
  s=s.replace(/\bhe'll\b/g,'he will');
  s=s.replace(/\bshe'll\b/g,'she will');
  s=s.replace(/\bit'll\b/g,'it will');
  s=s.replace(/\bwe'll\b/g,'we will');
  s=s.replace(/\bthey'll\b/g,'they will');
  s=s.replace(/\bthat'll\b/g,'that will');
  s=s.replace(/\bi've\b/g,'i have');
  s=s.replace(/\byou've\b/g,'you have');
  s=s.replace(/\bwe've\b/g,'we have');
  s=s.replace(/\bthey've\b/g,'they have');
  s=s.replace(/\bi'd\b/g,'i would');         // covers i had too
  s=s.replace(/\byou'd\b/g,'you would');
  s=s.replace(/\bhe'd\b/g,'he would');
  s=s.replace(/\bshe'd\b/g,'she would');
  s=s.replace(/\bwe'd\b/g,'we would');
  s=s.replace(/\bthey'd\b/g,'they would');
  s=s.replace(/\bi'd've\b/g,'i would have');
  s=s.replace(/\blet's\b/g,'let us');
  s=s.replace(/\bthey'd\b/g,'they would');
  return s.replace(/\s+/g,' ').trim();
}

// Normalise then expand — expand contractions BEFORE stripping punctuation
// so apostrophes are still present when the regex runs.
function normExpand(s){
  var expanded=expandContractions(s.trim().toLowerCase());
  return expanded.replace(/[.,!?;:'"()\-]/g,'').replace(/\s+/g,' ').trim();
}



function lev(a,b){
  var m=a.length,n=b.length,dp=[],i,j;
  for(i=0;i<=m;i++)dp.push([i]);
  for(j=0;j<=n;j++)dp[0][j]=j;
  for(i=1;i<=m;i++)for(j=1;j<=n;j++)
    dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j-1],dp[i-1][j],dp[i][j-1]);
  return dp[m][n];
}
function anagram(y,a){
  var yw=y.split(' ').filter(Boolean),aw=a.split(' ').filter(Boolean);
  if(yw.length!==aw.length)return false;
  var diff=false;
  for(var i=0;i<yw.length;i++){
    if(yw[i]===aw[i])continue;
    if(yw[i].split('').sort().join('')!==aw[i].split('').sort().join(''))return false;
    diff=true;
  }return diff;
}
function diffHL(y,a){
  var max=Math.max(y.length,a.length),yh='',ah='';
  for(var i=0;i<max;i++){
    var yc=y[i]||'',ac=a[i]||'';
    if(yc===ac){yh+=esc(yc);ah+=esc(ac);}
    else{
      yh+=yc?'<span style="background:var(--danger-bg);color:var(--danger-text);border-radius:2px;">'+esc(yc)+'</span>':'';
      ah+=ac?'<span style="background:var(--success-bg);color:var(--success-text);border-radius:2px;">'+esc(ac)+'</span>':'';
    }
  }return{y:yh,a:ah};
}

/* ---------- persistence ---------- */
function saveCards(){try{localStorage.setItem(CARDS_KEY,JSON.stringify({cards:cards,nextId:nextCardId}));}catch(e){}}
function saveChapters(){try{localStorage.setItem(CHAPTERS_KEY,JSON.stringify({chapters:chapters,nextId:nextChapterId}));}catch(e){}}
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify({volume:settings.volume,newCardRatio:settings.newCardRatio,acSort:acSort,quizOrder:quizOrder}));}catch(e){}}
function loadAll(){
  try{var cr=localStorage.getItem(CHAPTERS_KEY);if(cr){var cp=JSON.parse(cr);if(cp&&Array.isArray(cp.chapters)){chapters=cp.chapters;nextChapterId=cp.nextId||(chapters.reduce(function(m,c){return Math.max(m,c.id);},0)+1);}}}catch(e){}
  try{var raw=localStorage.getItem(CARDS_KEY);if(raw){var p=JSON.parse(raw);if(p&&Array.isArray(p.cards)){cards=p.cards;cards.forEach(function(c){if(typeof c.everAnswered!=='boolean')c.everAnswered=(c.stage||0)>0;if(typeof c.ngCount!=='number')c.ngCount=0;if(typeof c.chapterId==='undefined')c.chapterId=null;});nextCardId=p.nextId||(cards.reduce(function(m,c){return Math.max(m,c.id);},0)+1);}}}catch(e){}
  try{var sr=localStorage.getItem(SETTINGS_KEY);if(sr){var sp=JSON.parse(sr);if(sp){
    if(typeof sp.volume==='number')settings.volume=sp.volume;
    if(typeof sp.newCardRatio==='number')settings.newCardRatio=sp.newCardRatio;
    if(typeof sp.acSort==='string')acSort=sp.acSort;
    if(typeof sp.quizOrder==='string')quizOrder=sp.quizOrder;
  }}}catch(e){}
  try{var nr=localStorage.getItem(NOTES_KEY);if(nr)notes=JSON.parse(nr)||{};}catch(e){}
  try{var tr=localStorage.getItem(TRENDS_KEY);if(tr)trends=JSON.parse(tr)||[];}catch(e){}
  try{var ak=localStorage.getItem(APIKEY_KEY);if(ak)apiKey=ak;}catch(e){}
}
function saveNotes(){try{localStorage.setItem(NOTES_KEY,JSON.stringify(notes));}catch(e){}}
function saveTrends(){try{localStorage.setItem(TRENDS_KEY,JSON.stringify(trends));}catch(e){}}

/* ---------- chapter helpers ---------- */
function findChapter(id){return chapters.find(function(c){return c.id===id;})||null;}
function chapterName(id){var c=findChapter(id);return c?c.name:'(미분류)';}
function chapterCardCount(id){return cards.filter(function(c){return c.chapterId===id;}).length;}
function availableCards(chapterIds){
  var t=now();
  return cards.filter(function(c){
    if(c.dueAt>t)return false;
    if(!chapterIds||!chapterIds.length)return true;
    return chapterIds.indexOf(c.chapterId)!==-1;
  });
}
function findCard(id){return cards.find(function(c){return c.id===id;})||null;}

/* ---------- review status ---------- */
function fmtDur(ms){
  if(ms<=0)return'지금';
  var m=Math.round(ms/ONE_MIN);if(m<60)return m+'분 후';
  var h=Math.round(ms/(60*ONE_MIN));if(h<24)return h+'시간 후';
  return Math.round(ms/ONE_DAY)+'일 후';
}
function reviewStatus(c){
  if(!c.everAnswered)return{text:'새 카드',cls:'due-new'};
  var rem=c.dueAt-now();
  var stageLabel=c.stage>0?'Lv'+c.stage+' ('+STAGE_DAYS[Math.min(c.stage-1,STAGE_DAYS.length-1)]+'일)':'15분 사이클';
  if(rem<=0)return{text:stageLabel+' · 지금 복습 가능',cls:'due-now'};
  return{text:stageLabel+' · '+fmtDur(rem)+' 복습',cls:rem<=ONE_DAY?'due-soon':'due-later'};
}

/* ---------- tabs ---------- */
var TABS=[{btn:'tabQuiz',pane:'quizPane'},{btn:'tabAllCards',pane:'allCardsPane'},{btn:'tabAdd',pane:'addPane'},{btn:'tabSettings',pane:'settingsPane'}];
function setTab(which){
  TABS.forEach(function(t){
    $(t.btn).classList.toggle('active',t.btn===which);
    $(t.pane).classList.toggle('active',t.btn===which);
  });
  if(which==='tabAllCards')renderAllCards();
  if(which==='tabAdd')refreshAddSelects();
  if(which==='tabSettings')renderSettingsPane();
}
TABS.forEach(function(t){on(t.btn,'click',function(){setTab(t.btn);});});

/* ---------- urgency ---------- */
function refreshUrgency(){
  var t=now();
  $('overdueCount').textContent=cards.filter(function(c){return c.dueAt<=t;}).length;
  $('dueSoonCount').textContent=cards.filter(function(c){return c.dueAt>t&&c.dueAt<=t+ONE_DAY;}).length;
}

/* ---------- chapter selector (quiz pane) ---------- */
function renderChapterSelector(){
  var el=$('chapterSelectList');el.innerHTML='';
  if(chapters.length===0){el.innerHTML='<p class="muted" style="padding:8px 0;">챕터 없음 — 설정 탭에서 만들어주세요.</p>';return;}
  var t=now();
  function availCount(chId){return cards.filter(function(c){return c.chapterId===chId&&c.dueAt<=t;}).length;}
  var totalAvail=cards.filter(function(c){return c.dueAt<=t;}).length;
  var allSel=Object.keys(selectedChapterIds).length===0;
  var allRow=document.createElement('label');allRow.className='chapter-select-row';
  var allCb=document.createElement('input');allCb.type='checkbox';allCb.checked=allSel;
  allCb.addEventListener('change',function(){selectedChapterIds={};renderChapterSelector();refreshSetupInfo();});
  allRow.appendChild(allCb);
  allRow.innerHTML+='<span class="ch-name">전체</span><span class="ch-count">지금 풀 수 있는 카드 '+totalAvail+'개</span>';
  el.appendChild(allRow);
  chapters.forEach(function(ch){
    var row=document.createElement('label');row.className='chapter-select-row';
    var cb=document.createElement('input');cb.type='checkbox';cb.checked=!!selectedChapterIds[ch.id];
    cb.addEventListener('change',function(){if(cb.checked)selectedChapterIds[ch.id]=true;else delete selectedChapterIds[ch.id];renderChapterSelector();refreshSetupInfo();});
    row.appendChild(cb);
    row.innerHTML+='<span class="ch-name">'+esc(ch.name)+'</span><span class="ch-count">지금 '+availCount(ch.id)+'개 / 전체 '+chapterCardCount(ch.id)+'개</span>';
    el.appendChild(row);
  });
}

/* ---------- setup info ---------- */
function refreshSetupInfo(){
  var selIds=Object.keys(selectedChapterIds).map(Number);
  var avail=availableCards(selIds.length?selIds:null);
  var dueNew=avail.filter(function(c){return!c.everAnswered;}).length;
  $('availInfo').textContent='지금 풀 수 있는 카드: '+avail.length+'개 (복습 '+(avail.length-dueNew)+' / 새 카드 '+dueNew+')';
  buildCountOptions(avail.length);
  $('customCountHint').textContent='전체 저장된 문장: '+cards.length+'개';
  var orderLabel={'added':'추가순','reverse':'역순','alpha':'알파벳순','random':'랜덤'}[quizOrder]||quizOrder;
  $('newCardRatioInfo').textContent='복습 카드는 기한 임박순 · 새 카드는 '+orderLabel+' · '+(settings.newCardRatio||5)+'문제당 1개 섞기';
  refreshNgFilterInfo();refreshUrgency();
}
function refreshNgFilterInfo(){
  var chk=$('ngFilterCheck'),el=$('ngFilterInfo');if(!chk||!el)return;
  if(!chk.checked){el.textContent='';return;}
  var min=parseInt($('ngFilterCount').value,10)||1;
  var n=cards.filter(function(c){return(c.ngCount||0)>=min;}).length;
  el.textContent='해당 카드: '+n+'개';el.style.color=n>0?'var(--success-text)':'var(--danger-text)';
}
function buildCountOptions(maxAvail){
  var wrap=$('countOptions');wrap.innerHTML='';
  [5,10,20,30,50].forEach(function(n){
    var b=document.createElement('button');b.type='button';b.className='count-btn';b.textContent=n+'문제';b.style.fontWeight='500';
    var dis=n>maxAvail;if(dis)b.disabled=true;
    b.addEventListener('click',function(){if(dis)return;chosenCount=n;Array.from(wrap.children).forEach(function(el){el.classList.remove('active');});b.classList.add('active');$('startBtn').disabled=false;});
    wrap.appendChild(b);
  });
  var first=Array.from(wrap.children).find(function(el){return!el.disabled;});if(first)first.click();
  $('startBtn').disabled=maxAvail===0;
}
on('customCountBtn','click',function(){
  var v=parseInt($('customCountInput').value,10);
  var selIds=Object.keys(selectedChapterIds).map(Number);
  var avail=availableCards(selIds.length?selIds:null);
  if(!v||v<1){$('customCountInput').style.borderColor='var(--danger)';return;}
  if(v>cards.length){$('customCountInput').style.borderColor='var(--danger)';$('customCountHint').textContent='저장된 문장보다 많이 입력할 수 없어요';$('customCountHint').style.color='var(--danger-text)';return;}
  $('customCountInput').style.borderColor='';$('customCountHint').style.color='';
  chosenCount=Math.min(v,avail.length);
  Array.from($('countOptions').children).forEach(function(el){el.classList.remove('active');});
  $('startBtn').disabled=avail.length===0;
  $('customCountHint').textContent=v>avail.length?'풀 수 있는 카드는 '+avail.length+'개라 그만큼만 출제돼요':v+'문제로 시작합니다';
});
on('ngFilterCheck','change',function(){refreshNgFilterInfo();});
on('ngFilterCount','input',function(){if($('ngFilterCheck').checked)refreshNgFilterInfo();});
on('bmFilterCheck','change',function(){quizBmOnly=$('bmFilterCheck').checked;refreshSetupInfo();});
['orderAdded','orderReverse','orderAlpha','orderRandom'].forEach(function(id){
  on(id,'click',function(){
    quizOrder=id.replace('order','').toLowerCase();
    ['orderAdded','orderReverse','orderAlpha','orderRandom'].forEach(function(bid){$(bid).classList.remove('active');});
    $(id).classList.add('active');
    saveSettings();
    refreshSetupInfo();
  });
});

// practice mode flag - when true, correct answers do NOT update schedules
var practiceMode=false;

on('practiceBtn','click',function(){
  startSessionWith(true);
});

/* ---------- session ---------- */
function buildSession(n,chIds){
  var t=now();
  var pool=cards.filter(function(c){return!chIds||!chIds.length||chIds.indexOf(c.chapterId)!==-1;});

  // 복습 카드: 기한이 된 카드, 항상 기한 임박순 (quizOrder와 무관)
  var dueRev=pool.filter(function(c){return c.everAnswered&&c.dueAt<=t;});
  dueRev.sort(function(a,b){return a.dueAt-b.dueAt;});

  // 새 카드: 한 번도 안 푼 카드, quizOrder에 따라 정렬
  var newCards=pool.filter(function(c){return!c.everAnswered;});
  if(quizOrder==='reverse'){
    newCards.sort(function(a,b){return b.id-a.id;}); // 최근 추가 역순
  } else if(quizOrder==='alpha'){
    newCards.sort(function(a,b){return a.en.localeCompare(b.en);});
  } else if(quizOrder==='random'){
    shuffleArray(newCards);
  } else {
    // added: 기존 추가순 (id 오름차순, dueAt 순)
    newCards.sort(function(a,b){return a.dueAt-b.dueAt;});
  }

  // 비율 로직: N문제당 1개 새 카드 섞기
  // 복습 카드가 없으면 전부 새 카드로 채움 (비율 의미 없음)
  var ratio=Math.max(1,settings.newCardRatio||5);
  var result=[],ri=0,ni=0,slot=0;
  while(result.length<n&&(ri<dueRev.length||ni<newCards.length)){
    slot++;
    if(slot%ratio===0&&ni<newCards.length){
      result.push(newCards[ni++]);
    } else if(ri<dueRev.length){
      result.push(dueRev[ri++]);
    } else if(ni<newCards.length){
      // 복습 카드 소진 → 새 카드로만 채움
      result.push(newCards[ni++]);
    }
  }
  return result;
}
function buildNgSession(min,n){
  var f=cards.filter(function(c){return(c.ngCount||0)>=min;});
  f.sort(function(a,b){return(b.ngCount||0)-(a.ngCount||0);});return f.slice(0,n);
}
on('startBtn','click',function(){
  practiceMode=false;
  startSessionWith(false);
});

function startSessionWith(isPractice){
  practiceMode=isPractice;
  var selIds=Object.keys(selectedChapterIds).map(Number);
  var useNg=$('ngFilterCheck').checked;
  var minNg=parseInt($('ngFilterCount').value,10)||1;
  var chosen;
  if(useNg){
    chosen=buildNgSession(minNg,chosenCount);
  } else {
    chosen=buildSession(chosenCount,selIds.length?selIds:null);
  }
  // 북마크 필터 (buildSession 이후 추가 필터링)
  if(quizBmOnly) chosen=chosen.filter(function(c){return c.bookmarked;});
  if(!chosen.length){$('ngFilterInfo').textContent='해당 카드 없음';$('ngFilterInfo').style.color='var(--danger-text)';return;}
  sessionQueue=chosen.map(function(c){return c.id;});sessionUniqueIds=chosen.map(function(c){return c.id;});
  sessionDoneCount=0;streak=0;sessionMissedIds=[];retryQueue=[];currentIsRetry=false;quizMarkedIds={};
  $('setupScreen').style.display='none';$('quizScreen').style.display='block';
  loadNext();
}

function shuffleArray(arr){
  for(var i=arr.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=arr[i];arr[i]=arr[j];arr[j]=t;}
  return arr;
}

/* ---------- all-cards tab ---------- */
function renderAcFilter(){
  var el=$('acChapterFilter');el.innerHTML='';
  var all=document.createElement('button');all.type='button';all.className='chip'+(acChapterFilter===null?' active':'');all.textContent='전체';
  all.addEventListener('click',function(){acChapterFilter=null;renderAllCards();});el.appendChild(all);
  chapters.forEach(function(ch){
    var chip=document.createElement('button');chip.type='button';chip.className='chip'+(acChapterFilter===ch.id?' active':'');chip.textContent=ch.name;
    chip.addEventListener('click',function(){acChapterFilter=ch.id;renderAllCards();});el.appendChild(chip);
  });
}
function renderAllCards(){
  renderAcFilter();
  $('allCardsCount').textContent=cards.length;
  var q=acSearch.trim().toLowerCase();
  var vis=cards.slice().filter(function(c){
    if(acChapterFilter!==null&&c.chapterId!==acChapterFilter)return false;
    if(acBmOnly&&!c.bookmarked)return false;
    if(acHasNoteOnly&&!(notes[c.id]&&notes[c.id].length))return false;
    if(!q)return true;
    return c.ko.toLowerCase().indexOf(q)!==-1||c.en.toLowerCase().indexOf(q)!==-1;
  });
  if(acSort==='added')vis.reverse();
  else if(acSort==='ng')vis.sort(function(a,b){return(b.ngCount||0)-(a.ngCount||0);});
  else if(acSort==='alpha')vis.sort(function(a,b){return a.en.localeCompare(b.en);});
  else if(acSort==='random')shuffleArray(vis);
  if(acReverse)vis.reverse();
  var listEl=$('allCardsList'),emptyEl=$('allCardsEmpty');
  listEl.innerHTML='';
  emptyEl.style.display=vis.length?'none':'block';
  emptyEl.textContent=cards.length===0?'저장된 문장이 없어요':'검색 결과가 없어요';
  vis.forEach(function(c){
    var st=reviewStatus(c),ng=c.ngCount||0;
    var row=document.createElement('div');row.className='fc-row';
    var cbDiv=document.createElement('div');cbDiv.className='fc-cb';
    var cb=document.createElement('input');cb.type='checkbox';cb.checked=!!acCheckedIds[c.id];
    cb.addEventListener('change',function(){if(cb.checked)acCheckedIds[c.id]=true;else delete acCheckedIds[c.id];updateBulkBar();});
    cbDiv.appendChild(cb);
    var body=document.createElement('div');body.className='fc-body';
    body.innerHTML+='<div class="fc-ko" style="color:'+(acShowKo?'':'transparent')+';">'+esc(c.ko)+'</div>';
    body.innerHTML+='<div class="fc-en" style="color:'+(acShowEn?'':'transparent')+';">'+esc(c.en)+'</div>';
    var meta='<div class="fc-meta"><span class="due-tag '+st.cls+'">'+esc(st.text)+'</span>';
    if(ng>0)meta+='<span class="due-tag ng-badge">재도전 '+ng+'회</span>';
    var ch=findChapter(c.chapterId);if(ch)meta+='<span class="due-tag due-later">'+esc(ch.name)+'</span>';
    if(c.bookmarked)meta+='<span class="due-tag" style="background:var(--warning-bg);color:var(--warning);">★</span>';
    meta+='</div>';body.innerHTML+=meta;
    var btns=document.createElement('div');btns.className='fc-btns';
    var bm=document.createElement('button');bm.type='button';bm.className='icon-btn bm'+(c.bookmarked?' on':'');bm.innerHTML=c.bookmarked?'★':'☆';
    bm.addEventListener('click',function(e){e.stopPropagation();c.bookmarked=!c.bookmarked;saveCards();renderAllCards();});
    var schBtn=document.createElement('button');schBtn.type='button';schBtn.className='icon-btn';
    schBtn.title='복습 스케줄 설정';schBtn.style.fontSize='13px';
    schBtn.textContent=c.stage===0?'⏱':'Lv'+c.stage;
    schBtn.addEventListener('click',function(e){e.stopPropagation();openScheduleModal(c);});
    var askBtn=document.createElement('button');askBtn.type='button';askBtn.className='icon-btn';
    askBtn.title='질문하기';askBtn.textContent='💬';askBtn.style.fontSize='13px';
    askBtn.addEventListener('click',function(e){e.stopPropagation();openAskModal(c.id);});
    var noteBtn=document.createElement('button');noteBtn.type='button';noteBtn.className='icon-btn';
    noteBtn.title='질문 이력';noteBtn.textContent='📋';noteBtn.style.fontSize='13px';
    if(notes[c.id]&&notes[c.id].length) noteBtn.style.color='var(--accent)';
    noteBtn.addEventListener('click',function(e){e.stopPropagation();openNotesModal(c.id);});
    btns.appendChild(bm);btns.appendChild(schBtn);btns.appendChild(askBtn);btns.appendChild(noteBtn);
    row.appendChild(cbDiv);row.appendChild(body);row.appendChild(btns);listEl.appendChild(row);
  });
  updateBulkBar();
}
function updateBulkBar(){
  var n=Object.keys(acCheckedIds).length;
  $('ngBulkBtn').disabled=n===0;
  $('editBulkBtn').disabled=n===0;
  $('delBulkBtn').disabled=n===0;
}

on('sortAdded','click',function(){acSort='added';['sortAdded','sortNg','sortAlpha','sortRandom'].forEach(function(id){$(id).classList.remove('active');});$('sortAdded').classList.add('active');saveSettings();renderAllCards();});
on('sortNg','click',function(){acSort='ng';['sortAdded','sortNg','sortAlpha','sortRandom'].forEach(function(id){$(id).classList.remove('active');});$('sortNg').classList.add('active');saveSettings();renderAllCards();});
on('sortAlpha','click',function(){acSort='alpha';['sortAdded','sortNg','sortAlpha','sortRandom'].forEach(function(id){$(id).classList.remove('active');});$('sortAlpha').classList.add('active');saveSettings();renderAllCards();});
on('sortRandom','click',function(){acSort='random';['sortAdded','sortNg','sortAlpha','sortRandom'].forEach(function(id){$(id).classList.remove('active');});$('sortRandom').classList.add('active');saveSettings();renderAllCards();});
on('sortReverse','click',function(){acReverse=!acReverse;$('sortReverse').classList.toggle('active',acReverse);renderAllCards();});
on('filterBm','click',function(){acBmOnly=!acBmOnly;$('filterBm').classList.toggle('active',acBmOnly);renderAllCards();});
on('filterHasNote','click',function(){acHasNoteOnly=!acHasNoteOnly;$('filterHasNote').classList.toggle('active',acHasNoteOnly);renderAllCards();});
on('toggleKo','click',function(){acShowKo=!acShowKo;$('toggleKo').classList.toggle('active',acShowKo);renderAllCards();});
on('toggleEn','click',function(){acShowEn=!acShowEn;$('toggleEn').classList.toggle('active',acShowEn);renderAllCards();});
on('allCardsSearch','input',function(e){acSearch=e.target.value;renderAllCards();});

on('selectAllBtn','click',function(){
  // select all currently visible cards
  var q=acSearch.trim().toLowerCase();
  cards.filter(function(c){
    if(acChapterFilter!==null&&c.chapterId!==acChapterFilter)return false;
    if(!q)return true;
    return c.ko.toLowerCase().indexOf(q)!==-1||c.en.toLowerCase().indexOf(q)!==-1;
  }).forEach(function(c){acCheckedIds[c.id]=true;});
  renderAllCards();
});
on('deselectAllBtn','click',function(){
  acCheckedIds={};renderAllCards();
});

on('deselectAllBtn','click',function(){
  acCheckedIds={};renderAllCards();
});

/* ---------- schedule picker modal ---------- */
var schedulingCard=null;
function openScheduleModal(c){
  schedulingCard=c;
  $('scheduleModalKo').textContent=c.ko;
  // set current value
  var sel=$('scheduleSelect');
  if(!c.everAnswered||c.stage===0){sel.value='15min';}
  else{sel.value=String(c.stage);}
  $('scheduleModal').classList.add('show');
}
on('scheduleCancel','click',function(){$('scheduleModal').classList.remove('show');schedulingCard=null;});
on('scheduleConfirm','click',function(){
  if(!schedulingCard)return;
  var val=$('scheduleSelect').value;
  var c=schedulingCard;
  if(val==='none'){
    // push dueAt far into future so it never shows in normal sessions
    c.dueAt=now()+365*10*ONE_DAY;c.everAnswered=true;c.stage=9;
  } else if(val==='15min'){
    c.stage=0;c.dueAt=now()+FIFTEEN_MIN;c.everAnswered=true;
  } else {
    var st=parseInt(val,10);
    c.stage=st;c.everAnswered=true;
    c.dueAt=now()+STAGE_DAYS[st-1]*ONE_DAY;
  }
  saveCards();
  $('scheduleModal').classList.remove('show');schedulingCard=null;
  renderAllCards();refreshSetupInfo();
});

/* ---------- memorize mode ---------- */
var memShowKo=true,memShowEn=true;
var memVisCards=[];

function memGetVisible(){
  var q=acSearch.trim().toLowerCase();
  var vis=cards.filter(function(c){
    if(acChapterFilter!==null&&c.chapterId!==acChapterFilter)return false;
    if(!q)return true;
    return c.ko.toLowerCase().indexOf(q)!==-1||c.en.toLowerCase().indexOf(q)!==-1;
  });
  if(acSort==='added')vis=vis.slice().reverse();
  else if(acSort==='ng')vis=vis.slice().sort(function(a,b){return(b.ngCount||0)-(a.ngCount||0);});
  else if(acSort==='alpha')vis=vis.slice().sort(function(a,b){return a.en.localeCompare(b.en);});
  return vis;
}

function showMemToast(msg){
  var t=$('memToast');if(!t)return;
  t.textContent=msg;t.style.display='block';t.style.opacity='1';
  clearTimeout(t._timer);
  t._timer=setTimeout(function(){
    t.style.transition='opacity 0.4s';t.style.opacity='0';
    setTimeout(function(){t.style.display='none';t.style.transition='';},400);
  },1500);
}

function renderMemCards(vis){
  memVisCards=vis;
  var list=$('memCardList');list.innerHTML='';
  if(!vis.length){list.innerHTML='<p class="muted" style="text-align:center;padding:40px 0;">표시할 문장이 없어요</p>';return;}
  vis.forEach(function(c){
    var row=document.createElement('div');row.className='fc-row';
    var cbDiv=document.createElement('div');cbDiv.className='fc-cb';
    var body=document.createElement('div');body.className='fc-body';
    var st=reviewStatus(c);
    body.innerHTML=
      '<div class="fc-ko" data-mem="ko" style="color:'+(memShowKo?'':'transparent')+';">'+esc(c.ko)+'</div>'+
      '<div class="fc-en" data-mem="en" style="color:'+(memShowEn?'var(--text-2)':'transparent')+';">'+esc(c.en)+'</div>'+
      '<div class="fc-meta"><span class="due-tag '+st.cls+'">'+esc(st.text)+'</span>'+(c.ngCount?'<span class="due-tag ng-badge">재도전 '+c.ngCount+'회</span>':'')+'</div>';

    var btns=document.createElement('div');btns.className='fc-btns';

    var bm=document.createElement('button');bm.type='button';bm.className='icon-btn bm'+(c.bookmarked?' on':'');
    bm.innerHTML=c.bookmarked?'★':'☆';
    (function(c,bm){bm.addEventListener('click',function(){c.bookmarked=!c.bookmarked;saveCards();bm.innerHTML=c.bookmarked?'★':'☆';bm.style.color=c.bookmarked?'var(--warning)':'';});})(c,bm);

    var ngBtn=document.createElement('button');ngBtn.type='button';ngBtn.className='icon-btn';
    ngBtn.style.color='var(--danger)';ngBtn.textContent='NG';
    (function(c,body){ngBtn.addEventListener('click',function(){
      c.ngCount=(c.ngCount||0)+1;c.everAnswered=true;
      c.stage=Math.min((c.stage||0)+1,STAGE_DAYS.length);
      c.dueAt=now()+STAGE_DAYS[Math.min(c.stage-1,STAGE_DAYS.length-1)]*ONE_DAY;
      saveCards();showMemToast('복습 스케줄에 추가되었습니다');
      var st2=reviewStatus(c);
      body.querySelector('.fc-meta').innerHTML='<span class="due-tag '+st2.cls+'">'+esc(st2.text)+'</span>'+(c.ngCount?'<span class="due-tag ng-badge">재도전 '+c.ngCount+'회</span>':'');
    });})(c,body);

    var askBtn=document.createElement('button');askBtn.type='button';askBtn.className='icon-btn';
    askBtn.textContent='💬';
    (function(cid){askBtn.addEventListener('click',function(){openAskModal(cid);});})(c.id);

    var noteBtn=document.createElement('button');noteBtn.type='button';noteBtn.className='icon-btn';
    noteBtn.textContent='📋';
    if(notes[c.id]&&notes[c.id].length) noteBtn.style.color='var(--accent-text)';
    (function(cid){noteBtn.addEventListener('click',function(){openNotesModal(cid);});})(c.id);

    btns.appendChild(bm);btns.appendChild(ngBtn);btns.appendChild(askBtn);btns.appendChild(noteBtn);
    row.appendChild(cbDiv);row.appendChild(body);row.appendChild(btns);
    list.appendChild(row);
  });
}
function openMemMode(){
  renderMemCards(memGetVisible());
  $('memModeOverlay').style.display='flex';
  document.body.style.overflow='hidden';
}

on('memModeBtn','click',function(){openMemMode();});
on('memModeClose','click',function(){
  $('memModeOverlay').style.display='none';
  document.body.style.overflow='';
  renderAllCards();
});
on('memToggleKo','click',function(){
  memShowKo=!memShowKo;
  $('memToggleKo').classList.toggle('active',memShowKo);
  // 재렌더링 없이 DOM에서 ko 줄 color만 직접 변경 → 스크롤 고정
  var koEls=$('memCardList').querySelectorAll('[data-mem="ko"]');
  koEls.forEach(function(el){el.style.color=memShowKo?'':'transparent';});
});
on('memToggleEn','click',function(){
  memShowEn=!memShowEn;
  $('memToggleEn').classList.toggle('active',memShowEn);
  var enEls=$('memCardList').querySelectorAll('[data-mem="en"]');
  enEls.forEach(function(el){el.style.color=memShowEn?'var(--text-2)':'transparent';});
});

on('ngBulkBtn','click',function(){
  var ids=Object.keys(acCheckedIds).map(Number);
  if(!ids.length)return;
  if(!confirm(ids.length+'개 문장을 오답 처리할까요?\n\n재도전 횟수 +1, 1일 뒤 복습 스케줄로 등록됩니다.'))return;
  ids.forEach(function(id){
    var c=findCard(id);if(!c)return;
    c.ngCount=(c.ngCount||0)+1;c.everAnswered=true;
    c.stage=Math.min((c.stage||0)+1,STAGE_DAYS.length);
    c.dueAt=now()+STAGE_DAYS[Math.min(c.stage-1,STAGE_DAYS.length-1)]*ONE_DAY;
  });
  saveCards();acCheckedIds={};renderAllCards();refreshSetupInfo();
});
on('delBulkBtn','click',function(){
  var ids=Object.keys(acCheckedIds).map(Number);
  if(!ids.length)return;
  if(!confirm(ids.length+'개 문장을 삭제할까요?'))return;
  var s={};ids.forEach(function(id){s[id]=true;});
  cards=cards.filter(function(c){return!s[c.id];});
  saveCards();acCheckedIds={};
  renderAllCards();refreshSetupInfo();
});

on('editBulkBtn','click',function(){
  var ids=Object.keys(acCheckedIds).map(Number);
  if(!ids.length)return;
  openEditModal(ids);
});

/* ---------- bulk edit modal ---------- */
var editingSnapshots=[]; // [{id, origKo, origEn}] - 편집 전 원본

function openEditModal(ids){
  editingSnapshots=[];
  var list=$('editCardList');
  list.innerHTML='';
  ids.forEach(function(id){
    var c=findCard(id);if(!c)return;
    editingSnapshots.push({id:id,origKo:c.ko,origEn:c.en});

    var wrap=document.createElement('div');
    wrap.style.cssText='background:var(--surface-2);border:1.5px solid var(--border);border-radius:var(--r-lg);padding:14px;';

    var koLabel=document.createElement('div');
    koLabel.style.cssText='font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:5px;';
    koLabel.textContent='한국어';

    var koInput=document.createElement('input');
    koInput.type='text';
    koInput.value=c.ko;
    koInput.dataset.id=id;
    koInput.dataset.field='ko';
    koInput.style.marginBottom='10px';
    koInput.placeholder='한국어 뜻';

    var enLabel=document.createElement('div');
    enLabel.style.cssText='font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:5px;';
    enLabel.textContent='영어';

    var enInput=document.createElement('input');
    enInput.type='text';
    enInput.value=c.en;
    enInput.dataset.id=id;
    enInput.dataset.field='en';
    enInput.placeholder='영어 정답';

    wrap.appendChild(koLabel);wrap.appendChild(koInput);
    wrap.appendChild(enLabel);wrap.appendChild(enInput);
    list.appendChild(wrap);
  });
  $('editModal').classList.add('show');
}

on('editCancelBtn','click',function(){
  $('editModal').classList.remove('show');
  editingSnapshots=[];
});

on('editSaveBtn','click',function(){
  // 변경사항 수집
  var inputs=$('editCardList').querySelectorAll('input');
  var changes={}; // id -> {ko, en}
  inputs.forEach(function(inp){
    var id=parseInt(inp.dataset.id,10);
    if(!changes[id]) changes[id]={};
    changes[id][inp.dataset.field]=inp.value.trim();
  });

  // 실제로 변경된 카드만 필터
  var diffs=[];
  editingSnapshots.forEach(function(snap){
    var ch=changes[snap.id];
    if(!ch)return;
    var koChanged=ch.ko!==snap.origKo;
    var enChanged=ch.en!==snap.origEn;
    if(koChanged||enChanged){
      diffs.push({id:snap.id,origKo:snap.origKo,origEn:snap.origEn,newKo:ch.ko,newEn:ch.en,koChanged:koChanged,enChanged:enChanged});
    }
  });

  if(diffs.length===0){
    $('editModal').classList.remove('show');
    editingSnapshots=[];
    return;
  }

  // 확인 모달로 변경 내용 보여주기
  $('editModal').classList.remove('show');
  showEditConfirm(diffs);
});

var pendingEdits=[];
function showEditConfirm(diffs){
  pendingEdits=diffs;
  var list=$('editDiffList');
  list.innerHTML='';
  diffs.forEach(function(d){
    var block=document.createElement('div');
    block.style.cssText='background:var(--surface-2);border-radius:var(--r-md);padding:12px;border:1.5px solid var(--border);';
    var html='';
    if(d.koChanged){
      html+='<div style="font-size:12px;font-weight:700;color:var(--text-3);margin-bottom:3px;">한국어</div>';
      html+='<div style="font-size:13px;color:var(--danger);text-decoration:line-through;margin-bottom:2px;">'+esc(d.origKo)+'</div>';
      html+='<div style="font-size:13px;color:var(--success);margin-bottom:6px;">'+esc(d.newKo)+'</div>';
    }
    if(d.enChanged){
      html+='<div style="font-size:12px;font-weight:700;color:var(--text-3);margin-bottom:3px;">영어</div>';
      html+='<div style="font-size:13px;color:var(--danger);text-decoration:line-through;margin-bottom:2px;">'+esc(d.origEn)+'</div>';
      html+='<div style="font-size:13px;color:var(--success);">'+esc(d.newEn)+'</div>';
    }
    block.innerHTML=html;
    list.appendChild(block);
  });
  $('editConfirmModal').classList.add('show');
}

on('editConfirmCancel','click',function(){
  $('editConfirmModal').classList.remove('show');
  pendingEdits=[];
});

on('editConfirmApply','click',function(){
  pendingEdits.forEach(function(d){
    var c=findCard(d.id);if(!c)return;
    if(d.koChanged)c.ko=d.newKo;
    if(d.enChanged)c.en=d.newEn;
  });
  saveCards();
  acCheckedIds={};
  $('editConfirmModal').classList.remove('show');
  pendingEdits=[];
  editingSnapshots=[];
  renderAllCards();
});


/* ---------- add card ---------- */
// 챕터 화살표 네비게이터
var bulkChapterIdx=0;
function refreshAddSelects(){
  // 화살표 네비 업데이트
  updateBulkChapterNav();
}
function updateBulkChapterNav(){
  var disp=$('bulkChapterDisplay');
  var hiddenInput=$('bulkChapterSelect');
  if(!disp||!hiddenInput)return;
  if(chapters.length===0){
    disp.textContent='챕터 없음 — 설정 탭에서 먼저 만들어주세요';
    hiddenInput.value='';
    return;
  }
  bulkChapterIdx=((bulkChapterIdx%chapters.length)+chapters.length)%chapters.length;
  var ch=chapters[bulkChapterIdx];
  disp.textContent=ch.name+' ('+chapterCardCount(ch.id)+'개)';
  hiddenInput.value=String(ch.id);
}
function parseChId(selId){
  // hidden input 방식
  var s=$(selId);if(!s)return null;
  var v=parseInt(s.value,10);return isNaN(v)?null:v;
}
on('bulkChapterPrev','click',function(){bulkChapterIdx--;updateBulkChapterNav();});
on('bulkChapterNext','click',function(){bulkChapterIdx++;updateBulkChapterNav();});


on('bulkAddBtn','click',function(){
  var raw=$('bulkInput').value,fb=$('bulkResult'),chId=parseChId('bulkChapterSelect'),added=0,skipped=0;
  raw.split(/\r\n|\r|\n/).forEach(function(line){
    if(!line.trim())return;
    var parts=line.indexOf('\t')!==-1?line.split('\t'):line.split(/,\s*|  +/);
    var ko=(parts[0]||'').trim(),en=(parts[1]||'').trim();
    if(!ko||!en){skipped++;return;}
    cards.push({id:nextCardId++,ko:ko,en:en,chapterId:chId,stage:0,dueAt:now(),bookmarked:false,everAnswered:false,ngCount:0});added++;
  });
  if(!added){fb.textContent='인식된 문장이 없어요';fb.style.color='var(--danger-text)';return;}
  saveCards();$('bulkInput').value='';
  fb.textContent=added+'개 추가'+(skipped?' (건너뜀 '+skipped+'줄)':'');fb.style.color='var(--success-text)';refreshSetupInfo();
});

on('exportToggle','click',function(){
  var p=$('exportPane'),ch=$('exportChevron'),open=p.style.display==='block';
  p.style.display=open?'none':'block';ch.classList.toggle('open',!open);
  if(!open)$('exportTextarea').value=cards.map(function(c){return c.ko+'\t'+c.en;}).join('\n');
});
on('exportCopyBtn','click',function(){
  $('exportTextarea').value=cards.map(function(c){return c.ko+'\t'+c.en;}).join('\n');
  var ta=$('exportTextarea'),fb=$('exportCopyFeedback');ta.focus();ta.select();
  var ok=false;try{ok=document.execCommand('copy');}catch(e){}
  if(!ok&&navigator.clipboard){navigator.clipboard.writeText(ta.value).then(function(){fb.textContent='복사 완료 ('+cards.length+'개)';fb.style.color='var(--success-text)';}).catch(function(){fb.textContent='직접 선택해서 복사해주세요';fb.style.color='var(--danger-text)';});return;}
  fb.textContent=ok?'복사 완료 ('+cards.length+'개)':'직접 선택해서 복사해주세요';fb.style.color=ok?'var(--success-text)':'var(--danger-text)';setTimeout(function(){fb.textContent='';},2000);
});

/* ---------- chapters manager ---------- */
function renderChapterManager(){
  var el=$('chapterManagerList');el.innerHTML='';
  if(!chapters.length){el.innerHTML='<p class="muted">챕터가 없어요. 아래에서 추가해주세요.</p>';return;}
  chapters.forEach(function(ch){
    var row=document.createElement('div');row.className='ch-row';
    var ns=document.createElement('span');ns.className='ch-name-text';ns.textContent=ch.name;
    var cs=document.createElement('span');cs.className='ch-cnt';cs.textContent=chapterCardCount(ch.id)+'개';
    var renBtn=document.createElement('button');renBtn.type='button';renBtn.style.cssText='font-size:12px;padding:5px 8px;';renBtn.textContent='이름 변경';
    renBtn.addEventListener('click',function(){openRename(ch);});
    var delBtn=document.createElement('button');delBtn.type='button';delBtn.style.cssText='font-size:12px;padding:5px 8px;color:var(--danger);border-color:var(--danger);';delBtn.textContent='삭제';
    delBtn.addEventListener('click',function(){deleteChapter(ch);});
    row.appendChild(ns);row.appendChild(cs);row.appendChild(renBtn);row.appendChild(delBtn);el.appendChild(row);
  });
}
on('addChapterBtn','click',function(){
  var inp=$('newChapterName'),name=inp.value.trim(),fb=$('chapterFeedback');
  if(!name){fb.textContent='이름을 입력해주세요';fb.style.color='var(--danger-text)';return;}
  chapters.push({id:nextChapterId++,name:name});saveChapters();inp.value='';
  fb.textContent='챕터 추가됨';fb.style.color='var(--success-text)';
  renderChapterManager();renderChapterSelector();refreshAddSelects();renderAcFilter();
  setTimeout(function(){fb.textContent='';},1600);
});
var renamingCh=null;
function openRename(ch){renamingCh=ch;$('renameInput').value=ch.name;$('renameModal').classList.add('show');setTimeout(function(){$('renameInput').focus();$('renameInput').select();},50);}
on('renameCancel','click',function(){$('renameModal').classList.remove('show');});
on('renameConfirm','click',function(){
  if(!renamingCh)return;var n=$('renameInput').value.trim();if(!n)return;
  renamingCh.name=n;saveChapters();$('renameModal').classList.remove('show');
  renderChapterManager();renderChapterSelector();refreshAddSelects();renderAcFilter();renderAllCards();
});
on('renameInput','keydown',function(e){if(e.key==='Enter')$('renameConfirm').click();});
function deleteChapter(ch){
  if(!confirm('"'+ch.name+'" 챕터 삭제? 소속 카드는 미분류 상태가 됩니다.'))return;
  chapters=chapters.filter(function(c){return c.id!==ch.id;});
  cards.forEach(function(c){if(c.chapterId===ch.id)c.chapterId=null;});
  saveChapters();saveCards();
  if(acChapterFilter===ch.id)acChapterFilter=null;delete selectedChapterIds[ch.id];
  renderChapterManager();renderChapterSelector();refreshAddSelects();renderAcFilter();renderAllCards();refreshSetupInfo();
}

/* ---------- settings ---------- */
function renderSettingsPane(){
  $('volumeSlider').value=settings.volume;$('volumeValue').textContent=settings.volume+'%';
  $('ratioValue').textContent=settings.newCardRatio+'문제당 1개';renderChapterManager();
  loadApiKeyUI();
}
on('volumeSlider','input',function(e){settings.volume=parseInt(e.target.value,10)||0;$('volumeValue').textContent=settings.volume+'%';saveSettings();});
on('volumeSlider','change',function(){playCorrectSound(false);});
on('ratioMinus','click',function(){settings.newCardRatio=Math.max(2,settings.newCardRatio-1);$('ratioValue').textContent=settings.newCardRatio+'문제당 1개';saveSettings();refreshSetupInfo();});
on('ratioPlus','click',function(){settings.newCardRatio=Math.min(50,settings.newCardRatio+1);$('ratioValue').textContent=settings.newCardRatio+'문제당 1개';saveSettings();refreshSetupInfo();});

/* ---------- audio ---------- */
var audioCtx=null,masterComp=null,audioUnlocked=false;

function unlockAudio(){
  if(audioUnlocked)return;
  var ctx=getACtx();if(!ctx)return;
  // iOS Safari: 무음 버퍼를 한 번 재생해야 스피커가 활성화됨
  var buf=ctx.createBuffer(1,1,22050);
  var src=ctx.createBufferSource();
  src.buffer=buf;src.connect(ctx.destination);src.start(0);
  ctx.resume().then(function(){audioUnlocked=true;});
}
// 첫 터치/클릭 시 unlock (이어폰 없어도 스피커 작동)
document.addEventListener('touchstart',unlockAudio,{once:false,passive:true});
document.addEventListener('touchend',unlockAudio,{once:false,passive:true});
document.addEventListener('click',unlockAudio,{once:false,passive:true});

function getACtx(){
  if(!audioCtx){
    try{audioCtx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){return null;}
  }
  if(audioCtx.state==='suspended')audioCtx.resume();
  return audioCtx;
}
function getMC(ctx){if(!masterComp||masterComp.context!==ctx){masterComp=ctx.createDynamicsCompressor();masterComp.threshold.value=-12;masterComp.knee.value=18;masterComp.ratio.value=8;masterComp.attack.value=0.002;masterComp.release.value=0.15;masterComp.connect(ctx.destination);}return masterComp;}
function tone(freq,t0,dur,type,gp){
  var ctx=getACtx();if(!ctx)return;
  var vm=Math.max(0,(settings.volume==null?100:settings.volume)/100)*2.4;if(vm<=0)return;
  var o=ctx.createOscillator(),g=ctx.createGain();
  o.type=type||'triangle';o.frequency.value=freq;
  var pk=Math.min((gp||0.2)*vm,1.6);
  g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(pk,t0+0.008);g.gain.exponentialRampToValueAtTime(0.001,t0+dur);
  o.connect(g);g.connect(getMC(ctx));o.start(t0);o.stop(t0+dur+0.02);
}
function chime(freq,t0,dur,gp){tone(freq,t0,dur,'sine',gp);tone(freq*2,t0,dur*0.6,'sine',gp*0.35);tone(freq*2.76,t0,dur*0.4,'sine',gp*0.15);}
function playCorrectSound(big){var ctx=getACtx();if(!ctx)return;var t=ctx.currentTime;chime(1318.5,t,0.5,0.9);chime(1046.5,t+0.16,0.6,0.85);if(big)chime(1568,t+0.34,0.35,0.4);}
function playWrongSound(){}

/* ---------- visuals ---------- */
var SVGNS='http://www.w3.org/2000/svg';
function getCardRect(){var c=$('quizCard');return{w:c.clientWidth,h:c.clientHeight};}

/* ─── BALLOON BURST ─── */
function bloomEffect(onDone){
  var vw=window.innerWidth, vh=window.innerHeight;
  var svg=$('fxLayer');

  var colors=[
    '#FF2DF7','#39FF14','#FFE600','#FF1744','#CCFF00',
    '#FF69D9','#B0FF00','#FFD000','#FF3DFF','#5FFF20',
    '#FF0080','#00FF41','#FFB300','#FF40A0','#80FF00',
    '#FF2DF7','#39FF14','#FFE600','#FF6600','#AAFF00',
    '#FF00AA','#40FF20','#FFD600','#FF50E0','#60FF00',
    '#FF1080','#20FF60','#FFCC00','#FF30F0','#50FF30'
  ];

  var total=0, done=0, launched=false;

  function spawnBalloon(delay){
    total++;
    setTimeout(function(){
      var g=document.createElementNS('http://www.w3.org/2000/svg','g');
      var color=colors[Math.floor(Math.random()*colors.length)];
      var r=9+Math.random()*17;
      var bx=Math.random()*vw;
      var extra=5+Math.random()*50;
      var by=vh+extra;
      var driftX=(Math.random()-0.5)*90;
      var wobbleAmp=12+Math.random()*28;
      var wobbleFreq=1.6+Math.random()*2;
      var dur=420+Math.random()*280; // 빠르게: 420~700ms

      var body=document.createElementNS('http://www.w3.org/2000/svg','ellipse');
      body.setAttribute('cx','0');body.setAttribute('cy','0');
      body.setAttribute('rx',String(r));body.setAttribute('ry',String(r*1.28));
      body.setAttribute('fill',color);

      var shine=document.createElementNS('http://www.w3.org/2000/svg','ellipse');
      shine.setAttribute('cx',String(-r*0.28));shine.setAttribute('cy',String(-r*0.35));
      shine.setAttribute('rx',String(r*0.21));shine.setAttribute('ry',String(r*0.28));
      shine.setAttribute('fill','rgba(255,255,255,0.5)');

      var str=document.createElementNS('http://www.w3.org/2000/svg','line');
      str.setAttribute('x1','0');str.setAttribute('y1',String(r*1.28));
      str.setAttribute('x2',String((Math.random()-0.5)*5));
      str.setAttribute('y2',String(r*1.28+12));
      str.setAttribute('stroke',color);str.setAttribute('stroke-width','1.4');
      str.setAttribute('opacity','0.5');

      g.appendChild(body);g.appendChild(str);g.appendChild(shine);
      svg.appendChild(g);

      var t0=null;
      (function step(ts){
        if(!t0)t0=ts;
        var p=Math.min((ts-t0)/dur,1);
        var ease=1-Math.pow(1-p,2.0);
        var cx=bx+driftX*ease+Math.sin(p*Math.PI*wobbleFreq)*wobbleAmp*(1-p);
        var cy=by-(vh+r*3+extra)*ease;
        g.setAttribute('transform','translate('+cx.toFixed(1)+','+cy.toFixed(1)+')');
        var op=p<0.06?p/0.06:p>0.78?Math.max(0,(1-p)/0.22):1;
        g.style.opacity=op.toFixed(3);
        if(p<1){ requestAnimationFrame(step); }
        else {
          g.remove(); done++;
          if(done>=total&&launched&&onDone) onDone();
        }
      })(performance.now());
    }, delay);
  }

  // 500개: 3 웨이브, 0~300ms 안에 전부 발사
  var i;
  for(i=0;i<280;i++) spawnBalloon(Math.random()*250);
  for(i=0;i<140;i++) spawnBalloon(20+Math.random()*200);
  for(i=0;i<80;i++)  spawnBalloon(50+Math.random()*150);

  setTimeout(function(){ launched=true; }, 20);
}


/* ─── COMBO TEXT ─── */
function showComboText(n){
  if(n<2)return;
  var colors=['#FF2DF7','#39FF14','#FFE600'];
  var color=colors[Math.min(n-2,colors.length-1)];
  var label=n+' COMBO'+(n>=3?'!!':'!');
  var svg=$('fxLayer');
  var cx=window.innerWidth/2, cy=window.innerHeight*0.36;
  var t=document.createElementNS(SVGNS,'text');
  t.setAttribute('x',cx);t.setAttribute('y',cy);
  t.setAttribute('text-anchor','middle');t.setAttribute('dominant-baseline','middle');
  t.setAttribute('font-size','0');t.setAttribute('font-weight','800');
  t.setAttribute('font-family',"'Nunito',sans-serif");
  t.setAttribute('fill',color);
  t.style.filter='drop-shadow(0 2px 8px '+color+')';
  t.textContent=label;svg.appendChild(t);
  var s=null;
  function step(ts){
    if(!s)s=ts;var p=Math.min((ts-s)/850,1);
    var sc=p<0.28?60*(1.6-0.6*Math.cos((p/0.28)*Math.PI)):60;
    t.setAttribute('font-size',sc.toFixed(1));
    t.setAttribute('y',(cy-p*14).toFixed(1));
    t.style.opacity=p<0.22?'1':p>0.62?String(Math.max(0,1-(p-0.62)/0.38)):'1';
    if(p<1)requestAnimationFrame(step);else t.remove();
  }
  requestAnimationFrame(step);
}

function bigText(label,color){
  var svg=$('fxLayer');
  var cx=window.innerWidth/2,cy=window.innerHeight/2;
  var t=document.createElementNS(SVGNS,'text');
  t.setAttribute('x',cx);t.setAttribute('y',cy);
  t.setAttribute('text-anchor','middle');t.setAttribute('dominant-baseline','middle');
  t.setAttribute('font-size','0');t.setAttribute('font-weight','800');
  t.setAttribute('font-family',"'Nunito',sans-serif");
  t.setAttribute('fill',color);
  t.style.filter='drop-shadow(0 2px 10px '+color+')';
  t.textContent=label;svg.appendChild(t);
  var s=null;function step(ts){
    if(!s)s=ts;var p=Math.min((ts-s)/600,1);
    var sc=p<0.35?62*(1.5-0.5*Math.cos((p/0.35)*Math.PI)):62;
    t.setAttribute('font-size',sc.toFixed(1));
    t.style.opacity=p<0.5?'1':String(Math.max(0,1-(p-0.5)/0.5));
    if(p<1)requestAnimationFrame(step);else t.remove();
  }requestAnimationFrame(step);
}
function shakeScreen(){
  var card=$('quizCard'),fr=[0,-10,10,-8,8,-5,5,-2,2,0],i=0;
  function step(){if(i>=fr.length){card.style.transform='';return;}card.style.transform='translateX('+fr[i++]+'px)';setTimeout(step,35);}step();
}
function flashCP(color,big){
  var card=$('quizCard');card.style.transition='none';
  card.style.boxShadow='0 0 0 '+(big?4:3)+'px '+color+' inset';
  card.style.transform='scale('+(big?1.04:1.02)+')';
  requestAnimationFrame(function(){
    card.style.transition='box-shadow 0.5s ease,transform 0.4s cubic-bezier(.34,1.56,.64,1)';
    card.style.boxShadow='0 0 0 0px transparent inset';
    card.style.transform='scale(1)';
  });
}

/* ---------- scheduling ---------- */
function scheduleCorrect(card,cls){
  card.everAnswered=true;
  if(cls==='easy'){
    if(currentIsRetry){
      // 세션 내 재도전에서 맞춰도 stage 승급 없음
      // 15분 뒤 다른 세션에서 맞춰야 비로소 stage 1 진입
      card.stage=0;
      card.dueAt=now()+FIFTEEN_MIN;
    } else {
      // 일반 출제에서 정답 → stage 승급
      card.stage=Math.min((card.stage||0)+1, STAGE_DAYS.length);
      card.dueAt=now()+STAGE_DAYS[card.stage-1]*ONE_DAY;
    }
  } else {
    // 오답 → 15분 후 재시험, stage 리셋
    card.stage=0;
    card.dueAt=now()+FIFTEEN_MIN;
  }
  saveCards();
}

/* ---------- quiz UI ---------- */
function updateStats(){$('progressCount').textContent=sessionDoneCount+'/'+sessionUniqueIds.length;$('streakCount').textContent=streak;$('remainingCount').textContent=Math.max(sessionUniqueIds.length-sessionDoneCount,0)+retryQueue.length;}
function maskWord(w,lv){return w.split('').map(function(ch,i){if(!/[a-zA-Z]/.test(ch))return lv>=3?ch:'';if(lv>=3)return ch;if(lv===2&&i===0)return ch;return'_';}).join('');}
function buildHint(en,lv){return en.split(' ').map(function(w){return maskWord(w,lv);}).join('   ');}
function showHint(lv){var ht=$('hintText'),hl=$('hintLabel');if(lv<=0){ht.style.display='none';hl.style.display='none';return;}ht.textContent=buildHint(current.en,lv);ht.style.color=lv>=3?'var(--danger-text)':'var(--warning)';ht.style.display='block';hl.textContent=['','실루엣 힌트','첫 글자 힌트','전체 정답'][lv]||'';hl.style.display='block';}

function resetInputUI(){var inp=$('answerInput');inp.value='';inp.disabled=false;$('checkBtn').style.display='block';$('nextBtn').style.display='none';$('diffPanel').style.display='none';pendingDiff=null;setTimeout(function(){inp.focus();},50);}

function loadNext(){
  autoAdvanceToken++;
  // clear any leftover balloon/fx elements from previous card
  var svg=$('fxLayer');
  while(svg.firstChild) svg.removeChild(svg.firstChild);
  $('koreanText').style.color='';hintLevel=0;resetInputUI();
  var id=null,isRetry=false;
  if(sessionQueue.length)id=sessionQueue.shift();
  else if(retryQueue.length){id=retryQueue.shift();isRetry=true;}
  else{finishSession();return;}
  current=findCard(id);
  currentIsRetry=isRetry;
  // 질문 표시 체크박스 상태 반영
  var qmc=$('quizMarkCheck');
  if(qmc) qmc.checked=!!quizMarkedIds[current.id];
  updateQuizStar();
  $('boxBadge').textContent=isRetry?'재도전':(current.stage===0?'새 카드':'Lv'+current.stage+' · '+STAGE_DAYS[Math.min(current.stage-1,STAGE_DAYS.length-1)]+'일');
  $('koreanText').textContent=current.ko;showHint(0);updateStats();
}

function finishSession(){
  $('quizScreen').style.display='none';$('doneScreen').style.display='block';
  var practiceNote=practiceMode?' (연습 모드 — 복습 스케줄 미반영)':'';
  $('doneSummary').textContent=sessionUniqueIds.length+'개 완료'+practiceNote;
  $('progressCount').style.color='';
  practiceMode=false;
  var mw=$('missedWrap'),ml=$('missedList');ml.innerHTML='';
  var unique=Array.from(new Set(sessionMissedIds)).map(findCard).filter(Boolean);
  mw.style.display=unique.length?'block':'none';
  unique.forEach(function(c){
    var row=document.createElement('div');row.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;background:var(--surface-2);border-radius:var(--r-md);margin-bottom:6px;';
    row.innerHTML='<div style="font-size:13px;"><div style="font-weight:500;">'+esc(c.ko)+'</div><div style="color:var(--text-2);font-size:12px;">'+esc(c.en)+'</div></div>';
    var bm=document.createElement('button');bm.type='button';bm.innerHTML=c.bookmarked?'★':'☆';bm.style.cssText='font-size:16px;padding:4px 10px;'+(c.bookmarked?'color:var(--warning);':'');
    bm.addEventListener('click',function(){c.bookmarked=!c.bookmarked;saveCards();bm.innerHTML=c.bookmarked?'★':'☆';bm.style.color=c.bookmarked?'var(--warning)':'';});
    row.appendChild(bm);ml.appendChild(row);
  });

  // 퀴즈 중 질문 표시한 카드가 있으면 종료 화면에 표시
  var markedSection=$('doneMarkedSection');
  var markedList=$('doneMarkedList');
  var markedIds=Object.keys(quizMarkedIds).map(Number);
  if(markedSection&&markedList){
    if(markedIds.length){
      markedSection.style.display='block';
      markedList.innerHTML='';
      markedIds.forEach(function(id){
        var c=findCard(id);if(!c)return;
        var row=document.createElement('div');
        row.style.cssText='background:var(--surface-2);border-radius:var(--r-md);padding:8px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px;';
        var txt=document.createElement('div');txt.style.flex='1';
        txt.innerHTML='<div style="font-size:13px;font-weight:700;">'+esc(c.ko)+'</div><div style="font-size:12px;color:var(--text-2);">'+esc(c.en)+'</div>';
        var ab=document.createElement('button');ab.type='button';ab.style.cssText='font-size:11px;padding:4px 8px;color:var(--accent-text);border-color:var(--accent);flex-shrink:0;';
        ab.textContent='💬 질문';(function(cid){ab.addEventListener('click',function(){openAskModal(cid);});})(id);
        row.appendChild(txt);row.appendChild(ab);markedList.appendChild(row);
      });
    } else {
      markedSection.style.display='none';
    }
  }

  // 이번 테스트 전체 문장 목록 렌더
  doneCheckedIds={};
  renderDoneCardList(false);

  refreshSetupInfo();
}

var doneEditMode=false;
var doneCheckedIds={};

function renderDoneCardList(editMode){
  doneEditMode=editMode;
  var allCards=sessionUniqueIds.map(findCard).filter(Boolean);
  $('doneCardCount').textContent=allCards.length;
  $('doneEditToggleBtn').textContent=editMode?'💾 저장':'✏️ 편집';
  var list=$('doneCardList');list.innerHTML='';
  allCards.forEach(function(c){
    var row=document.createElement('div');
    row.style.cssText='background:var(--surface-2);border:1.5px solid var(--border);border-radius:var(--r-md);padding:10px 12px;';
    var missed=sessionMissedIds.indexOf(c.id)!==-1;
    if(editMode){
      row.innerHTML=
        '<div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">한국어</div>'+
        '<input type="text" data-done-id="'+c.id+'" data-done-field="ko" value="'+esc(c.ko)+'" style="margin-bottom:8px;" />'+
        '<div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">영어</div>'+
        '<input type="text" data-done-id="'+c.id+'" data-done-field="en" value="'+esc(c.en)+'" />';
    } else {
      var cb=document.createElement('input');
      cb.type='checkbox';cb.style.cssText='width:18px;height:18px;flex-shrink:0;accent-color:var(--accent);cursor:pointer;margin-top:2px;';
      cb.checked=!!doneCheckedIds[c.id];
      (function(c,cb){
        cb.addEventListener('change',function(){if(cb.checked)doneCheckedIds[c.id]=true;else delete doneCheckedIds[c.id];});
      })(c,cb);
      var content_=document.createElement('div');content_.style.flex='1';
      content_.innerHTML=
        '<div style="font-size:14px;font-weight:700;margin-bottom:2px;">'+esc(c.ko)+'</div>'+
        '<div style="font-size:13px;color:var(--text-2);">'+esc(c.en)+'</div>';
      var rightBadge=missed?'<span class="due-tag ng-badge" style="font-size:11px;flex-shrink:0;">오답</span>':'';
      var wrap=document.createElement('div');
      wrap.style.cssText='display:flex;align-items:flex-start;gap:10px;';
      wrap.appendChild(cb);wrap.appendChild(content_);
      if(missed){var bd=document.createElement('span');bd.className='due-tag ng-badge';bd.style.cssText='font-size:11px;flex-shrink:0;';bd.textContent='오답';wrap.appendChild(bd);}
      row.appendChild(wrap);
    }
    list.appendChild(row);
  });
}

on('doneCopyBtn','click',function(){
  var allCards=sessionUniqueIds.map(findCard).filter(Boolean);
  var sel=allCards.filter(function(c){return doneCheckedIds[c.id];});
  if(!sel.length) sel=allCards; // 아무것도 선택 안 하면 전체 복사
  var text=sel.map(function(c){return c.ko+'\t'+c.en;}).join('\n');
  var btn=$('doneCopyBtn'),orig=btn.textContent;
  function onDone(){btn.textContent='✓ 복사됨 ('+sel.length+'개)';setTimeout(function(){btn.textContent=orig;},1800);}
  if(navigator.clipboard){navigator.clipboard.writeText(text).then(onDone).catch(function(){});}
  else{var ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0;';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(e){}document.body.removeChild(ta);onDone();}
});

on('doneEditToggleBtn','click',function(){
  if(doneEditMode){
    // 저장 - 변경사항 수집
    var inputs=$('doneCardList').querySelectorAll('input');
    var changed=false;
    inputs.forEach(function(inp){
      var id=parseInt(inp.dataset.doneId,10);
      var field=inp.dataset.doneField;
      var val=inp.value.trim();
      var c=findCard(id);
      if(c&&val&&c[field]!==val){c[field]=val;changed=true;}
    });
    if(changed) saveCards();
    renderDoneCardList(false);
  } else {
    renderDoneCardList(true);
  }
});

on('restartBtn','click',function(){$('doneScreen').style.display='none';$('setupScreen').style.display='block';refreshSetupInfo();});

function finalizeCorrect(){
  var cls=hintLevel>=2?'hard':'easy';
  if(!practiceMode){
    scheduleCorrect(current,cls);
    if(cls==='hard'){
      // ngCount는 이 세션에서 이 카드가 첫 오답일 때만 +1 (재도전에서 또 틀려도 추가 안 됨)
      var alreadyMissed=sessionMissedIds.indexOf(current.id)!==-1;
      if(!alreadyMissed) current.ngCount=(current.ngCount||0)+1;
      sessionMissedIds.push(current.id);
    }
  }
  sessionDoneCount++;
  if(cls==='hard'){streak=0;retryQueue.push(current.id);}
  else streak++;
  var big=streak>=3;
  $('koreanText').style.color='var(--success)';
  flashCP('var(--success)',true);
  bigText('OK','#34A96E');
  if(cls==='easy'&&streak>=2) showComboText(Math.min(streak,3));
  playCorrectSound(big);
  updateStats();
  // 풍선은 백그라운드에서 날리고, 즉시 다음 문제로 전환
  bloomEffect(null); // onDone 없이 - 풍선은 그냥 날아감
  var token=++autoAdvanceToken;
  // 짧은 딜레이(150ms)만 주고 바로 다음 문제 - OK 텍스트 잠깐 보이는 정도
  setTimeout(function(){
    if(token===autoAdvanceToken) loadNext();
  }, 150);
}
function escalateWrong(){
  streak=0;$('koreanText').style.color='var(--danger)';flashCP('var(--danger)',true);shakeScreen();bigText('NG','#FF4D6D');playWrongSound();
  hintLevel=Math.min(hintLevel+1,3);showHint(hintLevel);
  $('boxBadge').textContent=['','실루엣 힌트','첫 글자 힌트','전체 노출'][hintLevel]||$('boxBadge').textContent;
  var inp=$('answerInput');inp.value='';inp.disabled=false;$('diffPanel').style.display='none';$('checkBtn').style.display='block';pendingDiff=null;
  setTimeout(function(){inp.focus();},350);updateStats();
}
function showDiff(y,a){
  pendingDiff={y:y,a:a};var d=diffHL(y,a);$('diffYour').innerHTML='입력: '+d.y;$('diffAns').innerHTML='정답: '+d.a;
  $('diffPanel').style.display='block';$('checkBtn').style.display='none';$('answerInput').disabled=true;
  setTimeout(function(){$('markCorrectBtn').focus();},50);
}
function checkAnswer(){
  if(!current)return;if(pendingDiff){finalizeCorrect();return;}
  var raw=$('answerInput').value;
  if(!raw.trim()){escalateWrong();return;}
  var val=norm(raw), ans=norm(current.en);
  var valE=normExpand(raw), ansE=normExpand(current.en);
  // 1) 완전 일치 (그대로 or 구두점만 다를 때)
  if(val===ans){finalizeCorrect();return;}
  // 2) 축약형↔원형 정규화 후 일치 (I'm == I am, can't == cannot 등)
  if(valE===ansE){finalizeCorrect();return;}
  // 3) 오타 1글자 차이 또는 철자 순서 바뀜 → 판정 패널
  if(lev(val,ans)===1||anagram(val,ans)){showDiff(raw,current.en);return;}
  // 4) 축약형 정규화 후에도 오타 1글자 차이
  if(lev(valE,ansE)===1||anagram(valE,ansE)){showDiff(raw,current.en);return;}
  escalateWrong();
}
on('checkBtn','click',checkAnswer);on('nextBtn','click',loadNext);
on('markCorrectBtn','click',finalizeCorrect);on('markWrongBtn','click',escalateWrong);
on('cancelSessionBtn','click',function(){$('cancelModal').classList.add('show');});

on('failAllBtn','click',function(){
  // 바로 모달 표시 (confirm 없음)on('failAllBtn','click',function(){
  // 남은 카드 목록 보여주고 확인 받기
  var remaining=[];
  if(current) remaining.push(current.id);
  sessionQueue.forEach(function(id){remaining.push(id);});
  retryQueue.forEach(function(id){if(remaining.indexOf(id)===-1)remaining.push(id);});
  var list=$('failAllList');list.innerHTML='';
  remaining.forEach(function(id){
    var c=findCard(id);if(!c)return;
    var row=document.createElement('div');
    row.style.cssText='background:var(--surface-2);border-radius:var(--r-md);padding:8px 12px;font-size:13px;';
    row.innerHTML='<div style="font-weight:700;">'+esc(c.ko)+'</div><div style="color:var(--text-2);font-size:12px;">'+esc(c.en)+'</div>';
    list.appendChild(row);
  });
  $('failAllModal').classList.add('show');
});
on('failAllCancel','click',function(){$('failAllModal').classList.remove('show');});
on('failAllConfirm','click',function(){
  $('failAllModal').classList.remove('show');
  var remaining=[];
  if(current) remaining.push(current.id);
  sessionQueue.forEach(function(id){remaining.push(id);});
  retryQueue.forEach(function(id){if(remaining.indexOf(id)===-1)remaining.push(id);});
  var now_=now();
  remaining.forEach(function(id){
    var c=findCard(id);if(!c)return;
    if(sessionMissedIds.indexOf(id)===-1) c.ngCount=(c.ngCount||0)+1;
    sessionMissedIds.push(id);
    c.everAnswered=true;c.stage=0;c.dueAt=now_+FIFTEEN_MIN;
  });
  saveCards();sessionQueue=[];retryQueue=[];current=null;
  finishSession();
});

/* ---------- 퀴즈 중 질문 표시 체크박스 ---------- */
on('quizMarkCheck','click',function(){
  if(!current)return;
  if($('quizMarkCheck').checked) quizMarkedIds[current.id]=true;
  else delete quizMarkedIds[current.id];
  updateQuizStar();
});
// 별표 label 클릭 시 체크박스 토글
$('quizMarkStar').parentElement.addEventListener('click',function(){
  if(!current)return;
  var cb=$('quizMarkCheck');cb.checked=!cb.checked;
  if(cb.checked)quizMarkedIds[current.id]=true;else delete quizMarkedIds[current.id];
  updateQuizStar();
});
function updateQuizStar(){
  var star=$('quizMarkStar');if(!star)return;
  var marked=current&&quizMarkedIds[current.id];
  star.textContent=marked?'★':'☆';
  star.style.color=marked?'var(--warning)':'var(--text-3)';
}
on('quizAskBtn','click',function(){if(current)openAskModal(current.id);});
on('quizNotesBtn','click',function(){if(current)openNotesModal(current.id);});

/* ---------- API 키 설정 ---------- */
function loadApiKeyUI(){
  if(apiKey) $('apiKeyInput').value='';  // 마스킹 - 실제값 표시 안 함
  $('apiKeyStatus').textContent=apiKey?'✓ API 키가 저장되어 있어요':'API 키가 없어요. 입력 후 저장해주세요.';
  $('apiKeyStatus').style.color=apiKey?'var(--success-text)':'var(--text-3)';
}
on('apiKeySaveBtn','click',function(){
  var val=$('apiKeyInput').value.trim();
  if(!val||!val.startsWith('sk-')){
    $('apiKeyStatus').textContent='올바른 API 키를 입력해주세요 (sk-ant-... 형식)';
    $('apiKeyStatus').style.color='var(--danger-text)';return;
  }
  apiKey=val;
  try{localStorage.setItem(APIKEY_KEY,apiKey);}catch(e){}
  $('apiKeyInput').value='';
  loadApiKeyUI();
});
on('apiKeyClearBtn','click',function(){
  if(!confirm('저장된 API 키를 삭제할까요?'))return;
  apiKey='';
  try{localStorage.removeItem(APIKEY_KEY);}catch(e){}
  $('apiKeyInput').value='';
  loadApiKeyUI();
});

/* ---------- 질문하기 모달 ---------- */
var QUICK_PROMPTS=[
  '이 표현을 쓸 수 있는 다른 상황을 예시로 보여줘',
  '비슷한 뜻의 다른 표현들도 알려줘',
  '이 문장에서 문법적으로 주의할 점은?',
  '원어민이 실제로 이렇게 말하나요?',
  '이 단어/표현의 뉘앙스 차이를 설명해줘',
];

var lastAskCardId=null;
var askConversation=[]; // [{role:'user',content:''},{role:'assistant',content:''}]
var askSavedCount=0;    // 이미 저장한 턴 수 (갱신 저장용)

function openAskModal(cardId){
  var c=findCard(cardId);if(!c)return;
  if(!apiKey){alert('먼저 설정 탭에서 API 키를 입력해주세요.');setTab('tabSettings');return;}
  askTargetCardId=cardId;
  askConversation=[];
  askSavedCount=0;
  $('askCardPreview').innerHTML='<strong>'+esc(c.ko)+'</strong><br><span style="color:var(--text-3);">'+esc(c.en)+'</span>';
  $('askInput').value='';
  $('askAnswer').style.display='none';$('askAnswer').innerHTML='';
  $('askLoading').style.display='none';
  $('askSaveBtn').style.display='none';
  $('askSendBtn').style.display='block';$('askSendBtn').disabled=false;
  $('askSendBtn').textContent='질문하기';
  var qb=$('askQuickBtns');qb.innerHTML='';
  QUICK_PROMPTS.forEach(function(p){
    var btn=document.createElement('button');btn.type='button';
    btn.style.cssText='font-size:11px;padding:4px 9px;border-radius:var(--r-full);';
    btn.textContent=p;
    btn.addEventListener('click',function(){$('askInput').value=p;$('askInput').focus();});
    qb.appendChild(btn);
  });
  $('askModal').classList.add('show');
  setTimeout(function(){$('askInput').focus();},100);
}

function renderConversation(){
  var box=$('askAnswer');
  box.style.display='block';
  box.innerHTML='';
  askConversation.forEach(function(msg){
    var div=document.createElement('div');
    if(msg.role==='user'){
      div.style.cssText='background:var(--accent-light);border-radius:var(--r-md);padding:8px 12px;margin-bottom:8px;font-size:13px;font-weight:700;color:var(--accent-text);';
      div.textContent='Q: '+msg.content;
    } else {
      div.style.cssText='background:var(--surface-2);border-radius:var(--r-md);padding:8px 12px;margin-bottom:8px;font-size:13px;line-height:1.7;white-space:pre-wrap;';
      div.textContent=msg.content;
    }
    box.appendChild(div);
  });
  box.scrollTop=box.scrollHeight;
}

function closeAskModal(){
  $('askModal').classList.remove('show');
  askTargetCardId=null;askConversation=[];askSavedCount=0;
}
on('askModalClose','click',closeAskModal);
on('askModalClose2','click',closeAskModal);

on('askSendBtn','click',function(){
  var q=$('askInput').value.trim();
  if(!q)return;
  var c=findCard(askTargetCardId);if(!c)return;
  $('askLoading').style.display='block';
  $('askSendBtn').disabled=true;

  // 대화 메시지 구성 (카드 컨텍스트는 system에)
  var systemPrompt='당신은 영어 학습을 돕는 선생님입니다. 사용자는 다음 영어 표현을 외우고 있습니다.\n한국어: '+c.ko+'\n영어: '+c.en+'\n\n질문에 한국어로 명확하고 친절하게 답해주세요. 답변은 3-5문장 이내로 간결하게.';

  // 이전 대화 + 새 질문 추가
  var msgs=askConversation.slice();
  msgs.push({role:'user',content:q});

  fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:800,system:systemPrompt,messages:msgs})
  }).then(function(r){return r.json();}).then(function(data){
    $('askLoading').style.display='none';
    $('askSendBtn').disabled=false;
    if(data.error){
      var errDiv=document.createElement('div');
      errDiv.style.cssText='color:var(--danger);font-size:13px;padding:8px;';
      errDiv.textContent='오류: '+data.error.message;
      $('askAnswer').style.display='block';$('askAnswer').appendChild(errDiv);
      return;
    }
    var answer=(data.content&&data.content[0]&&data.content[0].text)||'(답변 없음)';
    // 대화 기록에 추가
    askConversation.push({role:'user',content:q});
    askConversation.push({role:'assistant',content:answer});
    $('askInput').value='';
    renderConversation();
    $('askSaveBtn').style.display='block';
    $('askSaveBtn').textContent=askSavedCount>0?'💾 저장 갱신':'💾 저장';
    $('askSendBtn').textContent='추가 질문하기';
    setTimeout(function(){$('askInput').focus();},100);
  }).catch(function(err){
    $('askLoading').style.display='none';$('askSendBtn').disabled=false;
    var errDiv=document.createElement('div');
    errDiv.style.cssText='color:var(--danger);font-size:13px;padding:8px;';
    errDiv.textContent='네트워크 오류: '+err.message;
    $('askAnswer').style.display='block';$('askAnswer').appendChild(errDiv);
  });
});

on('askSaveBtn','click',function(){
  if(!askConversation.length||!askTargetCardId)return;
  var c=findCard(askTargetCardId);if(!c)return;
  $('askSaveBtn').disabled=true;$('askSaveBtn').textContent='저장 중...';

  // 전체 대화를 하나의 텍스트로
  var fullText=askConversation.map(function(m){return(m.role==='user'?'Q: ':'A: ')+m.content;}).join('\n\n');
  var firstQ=askConversation[0]?askConversation[0].content:'';
  var lastA=askConversation.filter(function(m){return m.role==='assistant';}).slice(-1)[0];
  lastA=lastA?lastA.content:'';

  var summaryPrompt='다음 대화를 원인-질문요약-결론 세 가지로 각각 한 문장씩 한국어로 요약해줘. JSON 형식으로만: {"cause":"...","question":"...","conclusion":"..."}';
  fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:300,messages:[{role:'user',content:summaryPrompt+'\n\n'+fullText}]})
  }).then(function(r){return r.json();}).then(function(data){
    var raw=(data.content&&data.content[0]&&data.content[0].text)||'{}';
    var summary={cause:'',question:firstQ.length>30?firstQ.substring(0,30)+'...':firstQ,conclusion:''};
    try{var p=JSON.parse(raw.replace(/```json|```/g,'').trim());if(p)summary=p;}catch(e){}
    saveNoteEntry(c,firstQ,fullText,summary);
  }).catch(function(){
    var summary={cause:'',question:firstQ.length>30?firstQ.substring(0,30)+'...':firstQ,conclusion:''};
    saveNoteEntry(c,firstQ,fullText,summary);
  });
});

function saveNoteEntry(c,firstQ,fullText,summary){
  var date=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  // 같은 세션의 이전 저장이 있으면 갱신, 없으면 새로 추가
  if(!notes[askTargetCardId])notes[askTargetCardId]=[];
  // sessionNoteId로 같은 대화 재저장 여부 판단
  var existing=notes[askTargetCardId].find(function(n){return n.sessionId===askSessionId;});
  var entry={id:existing?existing.id:Date.now(),sessionId:askSessionId,date:date,q:firstQ,a:fullText,summary:summary,cardKo:c.ko,cardEn:c.en,turns:askConversation.length/2};
  if(existing){
    var idx=notes[askTargetCardId].indexOf(existing);
    notes[askTargetCardId][idx]=entry;
  } else {
    notes[askTargetCardId].unshift(entry);
  }
  saveNotes();
  $('askSaveBtn').disabled=false;$('askSaveBtn').textContent='✓ 저장됨';
  askSavedCount++;
  setTimeout(function(){
    $('askSaveBtn').textContent='💾 저장 갱신';
    renderAllCards();
  },1200);
}

// 세션 ID: 모달 열릴 때마다 새 ID
var askSessionId=0;
var _origOpenAsk=openAskModal;
openAskModal=function(cardId){askSessionId=Date.now();_origOpenAsk(cardId);};

/* ---------- 질문 이력 모달 ---------- */
function openNotesModal(cardId){
  var c=findCard(cardId);
  $('notesCardPreview').innerHTML=c?('<strong>'+esc(c.ko)+'</strong><br><span style="color:var(--text-3);">'+esc(c.en)+'</span>'):'';
  var list=$('notesList'),empty=$('notesEmpty');
  list.innerHTML='';
  var cardNotes=notes[cardId]||[];
  if(!cardNotes.length){empty.style.display='block';list.style.display='none';}
  else{
    empty.style.display='none';list.style.display='flex';
    cardNotes.forEach(function(n){
      var block=document.createElement('div');
      block.style.cssText='background:var(--surface-2);border:1.5px solid var(--border);border-radius:var(--r-md);padding:12px;';
      var summary=n.summary||{};
      block.innerHTML=
        '<div style="font-size:11px;color:var(--text-3);font-weight:700;margin-bottom:6px;">'+esc(n.date||'')+'</div>'+
        (summary.cause?'<div style="font-size:12px;margin-bottom:3px;"><span style="color:var(--text-3);font-weight:700;">원인 </span>'+esc(summary.cause)+'</div>':'')+
        '<div style="font-size:12px;margin-bottom:3px;"><span style="color:var(--text-3);font-weight:700;">질문 </span>'+esc(summary.question||n.q)+'</div>'+
        (summary.conclusion?'<div style="font-size:12px;margin-bottom:6px;"><span style="color:var(--text-3);font-weight:700;">결론 </span>'+esc(summary.conclusion)+'</div>':'')+
        '<details style="margin-top:6px;"><summary style="font-size:12px;color:var(--accent-text);font-weight:700;cursor:pointer;">전체 내용 보기</summary>'+
        '<div style="margin-top:8px;font-size:13px;line-height:1.7;white-space:pre-wrap;border-top:1px solid var(--border);padding-top:8px;">'+
        '<div style="font-weight:700;margin-bottom:4px;color:var(--text-3);">Q</div><div style="margin-bottom:8px;">'+esc(n.q)+'</div>'+
        '<div style="font-weight:700;margin-bottom:4px;color:var(--text-3);">A</div><div>'+esc(n.a)+'</div></div></details>';
      // 삭제 버튼
      var delBtn=document.createElement('button');delBtn.type='button';
      delBtn.style.cssText='font-size:11px;padding:3px 8px;color:var(--danger);border-color:var(--danger);margin-top:8px;';
      delBtn.textContent='삭제';
      (function(noteId,cid){delBtn.addEventListener('click',function(){
        notes[cid]=notes[cid].filter(function(x){return x.id!==noteId;});
        saveNotes();openNotesModal(cid);renderAllCards();
      });})(n.id,cardId);
      block.appendChild(delBtn);
      list.appendChild(block);
    });
  }
  $('notesModal').classList.add('show');
}
on('notesModalClose','click',function(){$('notesModal').classList.remove('show');});

/* ---------- 암기 모드에서 질문 버튼 (renderMemCards에서 호출) ---------- */
function makeMemAskBtns(cardId){
  var wrap=document.createElement('div');wrap.style.cssText='display:flex;gap:6px;margin-top:8px;';
  var ab=document.createElement('button');ab.type='button';
  ab.style.cssText='font-size:11px;padding:4px 9px;color:var(--accent-text);border-color:var(--accent);';
  ab.textContent='💬 질문';ab.addEventListener('click',function(){openAskModal(cardId);});
  var nb=document.createElement('button');nb.type='button';
  nb.style.cssText='font-size:11px;padding:4px 9px;color:var(--text-2);';
  nb.textContent='📋 이력';nb.addEventListener('click',function(){openNotesModal(cardId);});
  if(notes[cardId]&&notes[cardId].length) nb.style.color='var(--accent-text)';
  wrap.appendChild(ab);wrap.appendChild(nb);
  return wrap;
}

/* ---------- 질문 경향 분석 ---------- */
on('trendOpenBtn','click',function(){
  // 전체 이력 표시
  var hist=$('trendHistory');hist.innerHTML='';
  if(trends.length){
    trends.forEach(function(t){
      var block=document.createElement('div');
      block.style.cssText='background:var(--surface-2);border-radius:var(--r-md);padding:10px 12px;font-size:13px;';
      block.innerHTML='<div style="font-size:11px;color:var(--text-3);font-weight:700;margin-bottom:4px;">'+esc(t.date)+'</div>'+
        '<div style="white-space:pre-wrap;line-height:1.6;">'+esc(t.result)+'</div>';
      hist.appendChild(block);
    });
  } else {
    hist.innerHTML='<p class="muted">아직 분석 이력이 없어요</p>';
  }
  $('trendResult').style.display='none';
  $('trendModal').classList.add('show');
});
on('trendModalClose','click',function(){$('trendModal').classList.remove('show');});
on('trendRunBtn','click',function(){
  if(!apiKey){alert('설정 탭에서 API 키를 먼저 입력해주세요.');return;}
  // 전체 노트 수집
  var allNotes=[];
  Object.keys(notes).forEach(function(cardId){
    (notes[cardId]||[]).forEach(function(n){
      allNotes.push('카드: '+n.cardKo+' / '+n.cardEn+'\n질문: '+n.q+'\n요약: '+(n.summary?n.summary.conclusion:''));
    });
  });
  if(!allNotes.length){alert('아직 질문 이력이 없어요.');return;}
  $('trendLoading').style.display='block';$('trendResult').style.display='none';$('trendRunBtn').disabled=true;
  var prompt='다음은 영어 학습자의 질문 이력입니다. 이 학습자가 어떤 영역에서 어려움을 겪고 있는지, 어떤 패턴의 질문을 반복하는지 분석해서 한국어로 설명해주세요. 실용적인 학습 조언도 2-3가지 포함해주세요.\n\n'+allNotes.join('\n---\n');
  fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:1000,messages:[{role:'user',content:prompt}]})
  }).then(function(r){return r.json();}).then(function(data){
    $('trendLoading').style.display='none';$('trendRunBtn').disabled=false;
    var result=(data.content&&data.content[0]&&data.content[0].text)||'(결과 없음)';
    var date=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'});
    trends.unshift({date:date,result:result});
    if(trends.length>20)trends=trends.slice(0,20);
    saveTrends();
    $('trendResult').style.display='block';$('trendResult').textContent=result;
    // 이력 목록 갱신
    var hist=$('trendHistory');
    var block=document.createElement('div');
    block.style.cssText='background:var(--surface-2);border-radius:var(--r-md);padding:10px 12px;font-size:13px;';
    block.innerHTML='<div style="font-size:11px;color:var(--text-3);font-weight:700;margin-bottom:4px;">'+esc(date)+' (방금)</div>'+
      '<div style="white-space:pre-wrap;line-height:1.6;">'+esc(result)+'</div>';
    hist.insertBefore(block,hist.firstChild);
  }).catch(function(err){
    $('trendLoading').style.display='none';$('trendRunBtn').disabled=false;
    $('trendResult').style.display='block';$('trendResult').textContent='오류: '+err.message;
  });
});

on('cancelModalBack','click',function(){$('cancelModal').classList.remove('show');});
on('cancelModalConfirm','click',function(){$('cancelModal').classList.remove('show');current=null;pendingDiff=null;$('quizScreen').style.display='none';$('setupScreen').style.display='block';refreshSetupInfo();});

document.addEventListener('keydown',function(e){
  if(e.key!=='Enter')return;
  if($('quizScreen').style.display!=='block')return;
  if(pendingDiff){e.preventDefault();finalizeCorrect();return;}
  if($('nextBtn').style.display==='block'){e.preventDefault();loadNext();return;}
  if($('checkBtn').style.display==='block'){e.preventDefault();checkAnswer();return;}
});

if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('service-worker.js').catch(function(){});});}

/* ---------- init ---------- */
loadAll();
// 저장된 정렬/출제순서 버튼 활성화 상태 복원
(function(){
  // 전체문장 정렬
  var sortBtns={added:'sortAdded',ng:'sortNg',alpha:'sortAlpha',random:'sortRandom'};
  Object.keys(sortBtns).forEach(function(k){if($( sortBtns[k]))$(sortBtns[k]).classList.toggle('active',acSort===k);});
  // 출제순서
  var orderBtns={added:'orderAdded',reverse:'orderReverse',alpha:'orderAlpha',random:'orderRandom'};
  Object.keys(orderBtns).forEach(function(k){if($(orderBtns[k]))$(orderBtns[k]).classList.toggle('active',quizOrder===k);});
})();
renderChapterSelector();refreshAddSelects();renderAcFilter();
refreshSetupInfo();renderAllCards();
})();
