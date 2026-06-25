(function(){
'use strict';

var ONE_MIN=60*1000,FIFTEEN_MIN=15*ONE_MIN,ONE_DAY=24*60*60*1000;
// Stage intervals in days: stage 1~9
var STAGE_DAYS=[1,3,7,15,30,60,120,240,360];
var CARDS_KEY='srs_cards_v2',CHAPTERS_KEY='srs_chapters_v1',SETTINGS_KEY='srs_settings_v1';

var cards=[],chapters=[],settings={volume:100,newCardRatio:5};
var nextCardId=1,nextChapterId=1;

var sessionQueue=[],sessionUniqueIds=[],sessionDoneCount=0,streak=0;
var current=null,hintLevel=0,pendingDiff=null,autoAdvanceToken=0;
var sessionMissedIds=[],retryQueue=[];

var acSort='added',acShowKo=true,acShowEn=true,acSearch='';
var acChapterFilter=null,acCheckedIds={};
var selectedChapterIds={};
var chosenCount=10;

function now(){return Date.now();}
var $=function(id){return document.getElementById(id);};
function on(id,evt,fn){var el=$(id);if(!el){console.warn('[srs] missing #'+id);return;}el.addEventListener(evt,fn);}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function norm(s){return s.trim().toLowerCase().replace(/[.,!?;:'"()\-]/g,'').replace(/\s+/g,' ').trim();}

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
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch(e){}}
function loadAll(){
  try{var cr=localStorage.getItem(CHAPTERS_KEY);if(cr){var cp=JSON.parse(cr);if(cp&&Array.isArray(cp.chapters)){chapters=cp.chapters;nextChapterId=cp.nextId||(chapters.reduce(function(m,c){return Math.max(m,c.id);},0)+1);}}}catch(e){}
  try{var raw=localStorage.getItem(CARDS_KEY);if(raw){var p=JSON.parse(raw);if(p&&Array.isArray(p.cards)){cards=p.cards;cards.forEach(function(c){if(typeof c.everAnswered!=='boolean')c.everAnswered=(c.stage||0)>0;if(typeof c.ngCount!=='number')c.ngCount=0;if(typeof c.chapterId==='undefined')c.chapterId=null;});nextCardId=p.nextId||(cards.reduce(function(m,c){return Math.max(m,c.id);},0)+1);}}}catch(e){}
  try{var sr=localStorage.getItem(SETTINGS_KEY);if(sr){var sp=JSON.parse(sr);if(sp){if(typeof sp.volume==='number')settings.volume=sp.volume;if(typeof sp.newCardRatio==='number')settings.newCardRatio=sp.newCardRatio;}}}catch(e){}
}

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
  $('newCardRatioInfo').textContent='새 카드 '+(settings.newCardRatio||5)+'문제당 1개씩 섞여서 출제됩니다';
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

// practice mode flag - when true, correct answers do NOT update schedules
var practiceMode=false;

on('practiceBtn','click',function(){
  var selIds=Object.keys(selectedChapterIds).map(Number);
  var useNg=$('ngFilterCheck').checked;
  var minNg=parseInt($('ngFilterCount').value,10)||1;
  var chosen=useNg?buildNgSession(minNg,chosenCount):buildSession(chosenCount,selIds.length?selIds:null);
  if(!chosen.length){alert('풀 수 있는 카드가 없어요.');return;}
  practiceMode=true;
  sessionQueue=chosen.map(function(c){return c.id;});sessionUniqueIds=chosen.map(function(c){return c.id;});
  sessionDoneCount=0;streak=0;sessionMissedIds=[];retryQueue=[];
  $('setupScreen').style.display='none';$('quizScreen').style.display='block';
  // show practice indicator in the stats bar
  $('progressCount').style.color='var(--warning)';
  loadNext();
});

/* ---------- session ---------- */
function buildSession(n,chIds){
  var t=now();
  var pool=cards.filter(function(c){return!chIds||!chIds.length||chIds.indexOf(c.chapterId)!==-1;});
  var dueRev=pool.filter(function(c){return c.everAnswered&&c.dueAt<=t;});
  var dueNew=pool.filter(function(c){return!c.everAnswered&&c.dueAt<=t;});
  dueRev.sort(function(a,b){return a.dueAt-b.dueAt;});dueNew.sort(function(a,b){return a.dueAt-b.dueAt;});
  var ratio=Math.max(1,settings.newCardRatio||5),result=[],ri=0,ni=0,slot=0;
  while(result.length<n&&(ri<dueRev.length||ni<dueNew.length)){
    slot++;
    if(slot%ratio===0&&ni<dueNew.length)result.push(dueNew[ni++]);
    else if(ri<dueRev.length)result.push(dueRev[ri++]);
    else if(ni<dueNew.length)result.push(dueNew[ni++]);
  }return result;
}
function buildNgSession(min,n){
  var f=cards.filter(function(c){return(c.ngCount||0)>=min;});
  f.sort(function(a,b){return(b.ngCount||0)-(a.ngCount||0);});return f.slice(0,n);
}
on('startBtn','click',function(){
  practiceMode=false;
  var selIds=Object.keys(selectedChapterIds).map(Number);
  var useNg=$('ngFilterCheck').checked;
  var minNg=parseInt($('ngFilterCount').value,10)||1;
  var chosen=useNg?buildNgSession(minNg,chosenCount):buildSession(chosenCount,selIds.length?selIds:null);
  if(!chosen.length){$('ngFilterInfo').textContent='해당 카드 없음';$('ngFilterInfo').style.color='var(--danger-text)';return;}
  sessionQueue=chosen.map(function(c){return c.id;});sessionUniqueIds=chosen.map(function(c){return c.id;});
  sessionDoneCount=0;streak=0;sessionMissedIds=[];retryQueue=[];
  $('setupScreen').style.display='none';$('quizScreen').style.display='block';
  loadNext();
});

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
    if(!q)return true;
    return c.ko.toLowerCase().indexOf(q)!==-1||c.en.toLowerCase().indexOf(q)!==-1;
  });
  if(acSort==='added')vis.reverse();
  else if(acSort==='ng')vis.sort(function(a,b){return(b.ngCount||0)-(a.ngCount||0);});
  else if(acSort==='alpha')vis.sort(function(a,b){return a.en.localeCompare(b.en);});
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
    if(acShowKo)body.innerHTML+='<div class="fc-ko">'+esc(c.ko)+'</div>';
    if(acShowEn)body.innerHTML+='<div class="fc-en">'+esc(c.en)+'</div>';
    var meta='<div class="fc-meta"><span class="due-tag '+st.cls+'">'+esc(st.text)+'</span>';
    if(ng>0)meta+='<span class="due-tag ng-badge">재도전 '+ng+'회</span>';
    var ch=findChapter(c.chapterId);if(ch)meta+='<span class="due-tag due-later">'+esc(ch.name)+'</span>';
    if(c.bookmarked)meta+='<span class="due-tag" style="background:var(--warning-bg);color:var(--warning);">★</span>';
    meta+='</div>';body.innerHTML+=meta;
    var btns=document.createElement('div');btns.className='fc-btns';
    var bm=document.createElement('button');bm.type='button';bm.className='icon-btn bm'+(c.bookmarked?' on':'');bm.innerHTML=c.bookmarked?'★':'☆';
    bm.addEventListener('click',function(e){e.stopPropagation();c.bookmarked=!c.bookmarked;saveCards();renderAllCards();});
    // schedule button instead of delete
    var schBtn=document.createElement('button');schBtn.type='button';schBtn.className='icon-btn';
    schBtn.title='복습 스케줄 설정';schBtn.style.fontSize='13px';
    schBtn.textContent=c.stage===0?'⏱':'Lv'+c.stage;
    schBtn.addEventListener('click',function(e){e.stopPropagation();openScheduleModal(c);});
    btns.appendChild(bm);btns.appendChild(schBtn);
    row.appendChild(cbDiv);row.appendChild(body);row.appendChild(btns);listEl.appendChild(row);
  });
  updateBulkBar();
}
function updateBulkBar(){
  var n=Object.keys(acCheckedIds).length;
  $('ngBulkBtn').disabled=n===0;$('delBulkBtn').disabled=n===0;
}

on('sortAdded','click',function(){acSort='added';['sortAdded','sortNg','sortAlpha'].forEach(function(id){$(id).classList.remove('active');});$('sortAdded').classList.add('active');renderAllCards();});
on('sortNg','click',function(){acSort='ng';['sortAdded','sortNg','sortAlpha'].forEach(function(id){$(id).classList.remove('active');});$('sortNg').classList.add('active');renderAllCards();});
on('sortAlpha','click',function(){acSort='alpha';['sortAdded','sortNg','sortAlpha'].forEach(function(id){$(id).classList.remove('active');});$('sortAlpha').classList.add('active');renderAllCards();});
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
    var wrap=document.createElement('div');
    wrap.style.cssText='background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 20px;display:flex;align-items:flex-start;gap:12px;';
    var body=document.createElement('div');body.style.flex='1';
    var ko='',en='';
    if(memShowKo) ko='<div style="font-size:20px;font-weight:500;line-height:1.6;margin-bottom:'+(memShowEn?'8px':'0')+';">'+esc(c.ko)+'</div>';
    if(memShowEn) en='<div style="font-size:17px;color:var(--text-2);line-height:1.6;">'+esc(c.en)+'</div>';
    var st=reviewStatus(c);
    var badge='<div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap;"><span class="due-tag '+st.cls+'" style="font-size:12px;">'+esc(st.text)+'</span>'+(c.ngCount?'<span class="due-tag ng-badge" style="font-size:12px;">재도전 '+c.ngCount+'회</span>':'')+'</div>';
    body.innerHTML=ko+en+badge;
    var ngBtn=document.createElement('button');
    ngBtn.type='button';
    ngBtn.style.cssText='flex-shrink:0;font-size:12px;padding:6px 10px;color:var(--danger);border-color:var(--danger);margin-top:2px;';
    ngBtn.textContent='오답';
    (function(c,body){
      ngBtn.addEventListener('click',function(){
        c.ngCount=(c.ngCount||0)+1;
        c.everAnswered=true;
        c.stage=Math.min((c.stage||0)+1,STAGE_DAYS.length);
        c.dueAt=now()+STAGE_DAYS[Math.min(c.stage-1,STAGE_DAYS.length-1)]*ONE_DAY;
        saveCards();
        showMemToast('복습 스케줄에 추가되었습니다');
        var st2=reviewStatus(c);
        body.innerHTML=
          (memShowKo?'<div style="font-size:20px;font-weight:500;line-height:1.6;margin-bottom:'+(memShowEn?'8px':'0')+';">'+esc(c.ko)+'</div>':'')+
          (memShowEn?'<div style="font-size:17px;color:var(--text-2);line-height:1.6;">'+esc(c.en)+'</div>':'')+
          '<div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap;"><span class="due-tag '+st2.cls+'" style="font-size:12px;">'+esc(st2.text)+'</span>'+(c.ngCount?'<span class="due-tag ng-badge" style="font-size:12px;">재도전 '+c.ngCount+'회</span>':'')+'</div>';
      });
    })(c,body);
    wrap.appendChild(body);wrap.appendChild(ngBtn);
    list.appendChild(wrap);
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
  memShowKo=!memShowKo;$('memToggleKo').classList.toggle('active',memShowKo);
  renderMemCards(memVisCards);
});
on('memToggleEn','click',function(){
  memShowEn=!memShowEn;$('memToggleEn').classList.toggle('active',memShowEn);
  renderMemCards(memVisCards);
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
  if(!confirm(ids.length+'개 문장을 삭제할까요?\n이 작업은 되돌릴 수 없습니다.'))return;
  var s={};ids.forEach(function(id){s[id]=true;});
  cards=cards.filter(function(c){return!s[c.id];});
  saveCards();acCheckedIds={};renderAllCards();refreshSetupInfo();
});

/* ---------- add card ---------- */
function refreshAddSelects(){
  ['addChapterSelect','bulkChapterSelect'].forEach(function(sid){
    var sel=$(sid);if(!sel)return;sel.innerHTML='';
    if(!chapters.length){var opt=document.createElement('option');opt.value='';opt.textContent='(챕터 없음 — 설정 탭에서 먼저 만들기)';sel.appendChild(opt);}
    else chapters.forEach(function(ch){var opt=document.createElement('option');opt.value=ch.id;opt.textContent=ch.name;sel.appendChild(opt);});
  });
}
function parseChId(selId){var s=$(selId);if(!s||!s.value)return null;return parseInt(s.value,10)||null;}

on('addModeSingle','click',function(){$('addModeSingle').classList.add('active');$('addModeBulk').classList.remove('active');$('addPaneSingle').classList.add('active');$('addPaneBulk').classList.remove('active');});
on('addModeBulk','click',function(){$('addModeBulk').classList.add('active');$('addModeSingle').classList.remove('active');$('addPaneBulk').classList.add('active');$('addPaneSingle').classList.remove('active');});

on('addCardBtn','click',function(){
  var ko=$('newKo').value.trim(),en=$('newEn').value.trim(),fb=$('addFeedback');
  if(!ko||!en){fb.textContent='한국어 뜻과 영어 정답을 입력해주세요';fb.style.color='var(--danger-text)';return;}
  cards.push({id:nextCardId++,ko:ko,en:en,chapterId:parseChId('addChapterSelect'),stage:0,dueAt:now(),bookmarked:$('newBookmark').checked,everAnswered:false,ngCount:0});
  saveCards();$('newKo').value='';$('newEn').value='';$('newBookmark').checked=false;
  fb.textContent='카드가 추가되었습니다';fb.style.color='var(--success-text)';refreshSetupInfo();
  setTimeout(function(){fb.textContent='';},1800);
});
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
}
on('volumeSlider','input',function(e){settings.volume=parseInt(e.target.value,10)||0;$('volumeValue').textContent=settings.volume+'%';saveSettings();});
on('volumeSlider','change',function(){playCorrectSound(false);});
on('ratioMinus','click',function(){settings.newCardRatio=Math.max(2,settings.newCardRatio-1);$('ratioValue').textContent=settings.newCardRatio+'문제당 1개';saveSettings();refreshSetupInfo();});
on('ratioPlus','click',function(){settings.newCardRatio=Math.min(50,settings.newCardRatio+1);$('ratioValue').textContent=settings.newCardRatio+'문제당 1개';saveSettings();refreshSetupInfo();});

/* ---------- audio ---------- */
var audioCtx=null,masterComp=null;
function getACtx(){if(!audioCtx){try{audioCtx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){return null;}}if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx;}
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

/* ─── BALLOON BURST: natural dense rise covering full screen ───
   3 rapid waves totalling ~300 balloons, random positions & timing.
   onDone() fires once the last balloon has left the screen.          */
function bloomEffect(onDone){
  var vw=window.innerWidth, vh=window.innerHeight;
  var svg=$('fxLayer');

  // Warm palette only — no blue/purple
  var colors=['#FF8FAB','#FFB347','#FFD966','#A8E6A3','#F4A261',
              '#FCA5A5','#6EE7B7','#FDE68A','#FBCFE8','#D9F99D',
              '#FCD34D','#86EFAC','#FDA4AF','#FED7AA','#BBF7D0',
              '#FECACA','#FEF08A','#D1FAE5','#FFE4E6','#ECFCCB'];

  var total=0, done=0, launched=false;

  function spawnBalloon(delay){
    total++;
    setTimeout(function(){
      var g=document.createElementNS('http://www.w3.org/2000/svg','g');
      var color=colors[Math.floor(Math.random()*colors.length)];
      var r=10+Math.random()*16;
      var bx=Math.random()*vw;
      var extra=10+Math.random()*80;
      var by=vh+extra;
      var driftX=(Math.random()-0.5)*110;
      var wobbleAmp=14+Math.random()*32;
      var wobbleFreq=1.4+Math.random()*2;
      var dur=950+Math.random()*700;

      var body=document.createElementNS('http://www.w3.org/2000/svg','ellipse');
      body.setAttribute('cx','0');body.setAttribute('cy','0');
      body.setAttribute('rx',String(r));body.setAttribute('ry',String(r*1.28));
      body.setAttribute('fill',color);

      var shine=document.createElementNS('http://www.w3.org/2000/svg','ellipse');
      shine.setAttribute('cx',String(-r*0.28));shine.setAttribute('cy',String(-r*0.35));
      shine.setAttribute('rx',String(r*0.21));shine.setAttribute('ry',String(r*0.28));
      shine.setAttribute('fill','rgba(255,255,255,0.48)');

      var str=document.createElementNS('http://www.w3.org/2000/svg','line');
      str.setAttribute('x1','0');str.setAttribute('y1',String(r*1.28));
      str.setAttribute('x2',String((Math.random()-0.5)*5));
      str.setAttribute('y2',String(r*1.28+13));
      str.setAttribute('stroke',color);str.setAttribute('stroke-width','1.4');
      str.setAttribute('opacity','0.5');

      g.appendChild(body);g.appendChild(str);g.appendChild(shine);
      svg.appendChild(g);

      var t0=null;
      (function step(ts){
        if(!t0)t0=ts;
        var p=Math.min((ts-t0)/dur,1);
        var ease=1-Math.pow(1-p,2.3);
        var cx=bx+driftX*ease+Math.sin(p*Math.PI*wobbleFreq)*wobbleAmp*(1-p);
        var cy=by-(vh+r*3+extra)*ease;
        g.setAttribute('transform','translate('+cx.toFixed(1)+','+cy.toFixed(1)+')');
        var op=p<0.08?p/0.08:p>0.80?Math.max(0,(1-p)/0.20):1;
        g.style.opacity=op.toFixed(3);
        if(p<1){ requestAnimationFrame(step); }
        else {
          g.remove(); done++;
          if(done>=total&&launched&&onDone) onDone();
        }
      })(performance.now());
    }, delay);
  }

  // Wave 1 (main burst): 180 balloons, 0-350ms
  var i;
  for(i=0;i<180;i++) spawnBalloon(Math.random()*350);
  // Wave 2 (fill gaps): 80 balloons, 30-300ms
  for(i=0;i<80;i++)  spawnBalloon(30+Math.random()*300);
  // Wave 3 (stragglers): 40 balloons, 80-240ms
  for(i=0;i<40;i++)  spawnBalloon(80+Math.random()*240);

  setTimeout(function(){ launched=true; }, 30);
}


/* ─── COMBO TEXT ─── */
function showComboText(n){
  if(n<2)return;
  var colors=['#FF6BB5','#3CB878','#F59E0B'];
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
    // Promote to next stage: 0→1 (1day), 1→2 (3day), ... 9 stays at 9
    card.stage=Math.min((card.stage||0)+1, STAGE_DAYS.length);
    card.dueAt=now()+STAGE_DAYS[card.stage-1]*ONE_DAY;
  } else {
    // Wrong: reset to 15-minute retry cycle
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
  autoAdvanceToken++;$('koreanText').style.color='';hintLevel=0;resetInputUI();
  var id=null,isRetry=false;
  if(sessionQueue.length)id=sessionQueue.shift();
  else if(retryQueue.length){id=retryQueue.shift();isRetry=true;}
  else{finishSession();return;}
  current=findCard(id);
  $('boxBadge').textContent=isRetry?'재도전':(current.stage===0?'새 카드 / 15분 사이클':'Lv'+current.stage+' ('+STAGE_DAYS[Math.min(current.stage-1,STAGE_DAYS.length-1)]+'일)');
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
  refreshSetupInfo();
}
on('restartBtn','click',function(){$('doneScreen').style.display='none';$('setupScreen').style.display='block';refreshSetupInfo();});

function finalizeCorrect(){
  var cls=hintLevel>=2?'hard':'easy';
  if(!practiceMode){
    scheduleCorrect(current,cls);
    if(cls==='hard'){sessionMissedIds.push(current.id);current.ngCount=(current.ngCount||0)+1;}
  }
  sessionDoneCount++;
  if(cls==='hard'){streak=0;retryQueue.push(current.id);}
  else streak++;
  $('koreanText').style.color='var(--success)';
  flashCP('var(--success)',true);
  bigText('OK','#34A96E');
  if(cls==='easy'&&streak>=2) showComboText(Math.min(streak,3));
  playCorrectSound(streak>=3);
  $('answerInput').disabled=true;$('checkBtn').style.display='none';$('diffPanel').style.display='none';$('nextBtn').style.display='block';
  updateStats();
  var token=++autoAdvanceToken;
  bloomEffect(function(){
    if(token===autoAdvanceToken) loadNext();
  });
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
  var val=norm($('answerInput').value),ans=norm(current.en);
  if(!val){escalateWrong();return;}if(val===ans){finalizeCorrect();return;}
  if(lev(val,ans)===1||anagram(val,ans)){showDiff(val,ans);return;}
  escalateWrong();
}
on('checkBtn','click',checkAnswer);on('nextBtn','click',loadNext);
on('markCorrectBtn','click',finalizeCorrect);on('markWrongBtn','click',escalateWrong);
on('cancelSessionBtn','click',function(){$('cancelModal').classList.add('show');});
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
renderChapterSelector();refreshAddSelects();renderAcFilter();
refreshSetupInfo();renderAllCards();
})();
