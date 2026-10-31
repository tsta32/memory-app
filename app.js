(function(){
'use strict';

var ONE_MIN=60*1000,FIFTEEN_MIN=15*ONE_MIN,ONE_DAY=24*60*60*1000;
// Stage intervals in days: stage 1~9
var STAGE_DAYS=[1,3,7,15,30,60,120,240,360];
var CARDS_KEY='srs_cards_v2',CHAPTERS_KEY='srs_chapters_v1',SETTINGS_KEY='srs_settings_v1';
var NOTES_KEY='srs_notes_v1';    // {cardId: [{id,date,q,a,summary}]}
var TRENDS_KEY='srs_trends_v1';  // [{date, result}]
var APIKEY_KEY='srs_apikey_v1'; // 구버전 백업 호환용; 실제 키는 서버에서 관리
var BIZ_SESSIONS_KEY='srs_biz_sessions_v1'; // [{date,passRate,avgTime,totalSteps,steps:[{stepKo,userAnswer,pass,min,ideal}]}]
var ERROR_HISTORY_KEY='srs_error_history_v1';
var GRAMMAR_OPTION_DEFAULTS={tense:true,number:true,modal:true,article:true,preposition:true};
var GRAMMAR_OPTION_LABELS={tense:'시제',number:'단수·복수 및 수 일치',modal:'조동사',article:'관사',preposition:'전치사',spelling:'철자',meaning:'의미·문맥',vocabulary:'어휘'};

var cards=[],chapters=[],settings={volume:100,newCardRatio:5,grammarOptions:Object.assign({},GRAMMAR_OPTION_DEFAULTS)};
var nextCardId=1,nextChapterId=1;
var errorHistory=[],errorHistoryWritable=true;

var sessionQueue=[],sessionUniqueIds=[],sessionDoneCount=0,streak=0;
var current=null,hintLevel=0,pendingDiff=null,autoAdvanceToken=0;
var sessionMissedIds=[],retryQueue=[];
var sessionCompletedIds=[]; // 정답/오답 확정된 카드 id (완료)
var sessionSkippedIds=[];   // 오답처리 건너뛴 카드 id
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
var apiKey='worker'; // AI는 Cloudflare Worker 경유

// Cloudflare Worker를 통해 OpenAI를 호출합니다. API 키는 브라우저에 저장하지 않습니다.
function openAICompatRequest(maxTokens, messages, systemPrompt){
  var allMessages=[];
  if(systemPrompt) allMessages.push({role:'system',content:systemPrompt});
  allMessages=allMessages.concat(messages||[]);
  return fetch('https://lively-wave-a149.tsta32.workers.dev/',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({messages:allMessages,max_tokens:maxTokens,model:'gpt-4o-mini'})
  }).then(function(response){
    return response.json().then(function(data){
      if(!response.ok){
        var message=data&&data.error?data.error:'Worker/OpenAI API 오류 ('+response.status+')';
        throw new Error(typeof message==='string'?message:JSON.stringify(message));
      }
      // 앱의 기존 AI 응답 처리 코드와 호환
      if(data&&data.content&&data.content[0]&&typeof data.content[0].text==='string') return {json:function(){return Promise.resolve(data);}};
      var content=data&&data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content;
      if(typeof content!=='string') throw new Error('Worker에서 답변을 받지 못했습니다.');
      return {json:function(){return Promise.resolve({content:[{text:content}]});}};
    });
  });
}

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
  // 's = is 또는 has 양쪽 처리: has도 is로 통일
  s=s.replace(/\bhe has\b/g,'he is');
  s=s.replace(/\bshe has\b/g,'she is');
  s=s.replace(/\bit has\b/g,'it is');
  s=s.replace(/\bthat has\b/g,'that is');
  s=s.replace(/\bwhat has\b/g,'what is');
  s=s.replace(/\bthere has\b/g,'there is');
  s=s.replace(/\bhe's\b/g,'he is');
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

// Deterministic answer comparison. Grammar differences are ignored only when
// their corresponding option is OFF; spelling tolerance is limited to one
// single-character edit or adjacent transposition in one multi-letter word.
var ARTICLE_WORDS={a:1,an:1,the:1};
var MODAL_WORDS={can:1,could:1,will:1,would:1,shall:1,should:1,may:1,might:1,must:1};
var PREPOSITION_WORDS={about:1,above:1,across:1,after:1,against:1,along:1,among:1,around:1,at:1,before:1,behind:1,below:1,beneath:1,beside:1,between:1,beyond:1,by:1,despite:1,down:1,during:1,for:1,from:1,in:1,inside:1,into:1,near:1,of:1,off:1,on:1,onto:1,out:1,outside:1,over:1,through:1,to:1,toward:1,under:1,until:1,up:1,upon:1,with:1,within:1,without:1};
var IRREGULAR_FORMS={
  be:['am','is','are','was','were','been','being'], have:['has','had','having'], do:['does','did','done','doing'], go:['goes','went','gone','going'], get:['gets','got','gotten','getting'], make:['makes','made','making'], take:['takes','took','taken','taking'], come:['comes','came','coming'], see:['sees','saw','seen','seeing'], say:['says','said','saying'], tell:['tells','told','telling'], give:['gives','gave','given','giving'], find:['finds','found','finding'], think:['thinks','thought','thinking'], buy:['buys','bought','buying'], bring:['brings','brought','bringing'], write:['writes','wrote','written','writing'], read:['reads','read','reading'], speak:['speaks','spoke','spoken','speaking'], leave:['leaves','left','leaving'], meet:['meets','met','meeting'], send:['sends','sent','sending'], keep:['keeps','kept','keeping'], feel:['feels','felt','feeling'], run:['runs','ran','run','running'], eat:['eats','ate','eaten','eating'], drink:['drinks','drank','drunk','drinking'], know:['knows','knew','known','knowing'], choose:['chooses','chose','chosen','choosing'], begin:['begins','began','begun','beginning'], become:['becomes','became','becoming'], hold:['holds','held','holding'], pay:['pays','paid','paying'], stand:['stands','stood','standing'], sit:['sits','sat','sitting'], win:['wins','won','winning'], work:['works','worked','working']
};
var IRREGULAR_PAST_FORMS={be:['was','were','been'],have:['had'],do:['did','done'],go:['went','gone'],get:['got','gotten'],make:['made'],take:['took','taken'],come:['came'],see:['saw','seen'],say:['said'],tell:['told'],give:['gave','given'],find:['found'],think:['thought'],buy:['bought'],bring:['brought'],write:['wrote','written'],speak:['spoke','spoken'],leave:['left'],meet:['met'],send:['sent'],keep:['kept'],feel:['felt'],run:['ran'],eat:['ate','eaten'],drink:['drank','drunk'],know:['knew','known'],choose:['chose','chosen'],begin:['began','begun'],become:['became'],hold:['held'],pay:['paid'],stand:['stood'],sit:['sat'],win:['won'],work:['worked']};
var IRREGULAR_NOUNS={child:'children',man:'men',woman:'women',person:'people',mouse:'mice',goose:'geese',foot:'feet',tooth:'teeth'};
function answerTokens(s){
  s=String(s||'').toLowerCase();
  var contractions={"won't":'will not',"can't":'cannot',"cannot":'cannot',"don't":'do not',"doesn't":'does not',"didn't":'did not',"isn't":'is not',"aren't":'are not',"wasn't":'was not',"weren't":'were not',"wouldn't":'would not',"couldn't":'could not',"shouldn't":'should not',"haven't":'have not',"hasn't":'has not',"hadn't":'had not',"mustn't":'must not',"mightn't":'might not',"i'm":'i am',"you're":'you are',"we're":'we are',"they're":'they are',"he's":'he is',"she's":'she is',"it's":'it is',"i'll":'i will',"you'll":'you will',"he'll":'he will',"she'll":'she will',"we'll":'we will',"they'll":'they will',"i've":'i have',"you've":'you have',"we've":'we have',"they've":'they have'};
  Object.keys(contractions).forEach(function(k){s=s.replace(new RegExp('\\b'+k.replace("'","\\'")+'\\b','g'),contractions[k]);});
  // Apostrophe-s is inherently ambiguous; use the common copula form. The
  // explicit contraction table above covers unambiguous forms such as don't.
  s=s.replace(/\b(he|she|it|that|there|what|who|here)'s\b/g,'$1 is');
  s=s.replace(/\b(i|you|he|she|it|we|they|that)'d\b/g,'$1 would');
  return s.replace(/[.,!?;:'"()[\]{}\-—–…]/g,' ').replace(/[^a-z0-9\s]/g,' ').trim().split(/\s+/).filter(Boolean);
}
function morphologyCategory(a,b){
  if(a===b)return null;
  if(IRREGULAR_NOUNS[a]===b||IRREGULAR_NOUNS[b]===a)return 'number';
  if(MODAL_WORDS[a]&&MODAL_WORDS[b])return 'modal';
  if(ARTICLE_WORDS[a]&&ARTICLE_WORDS[b])return 'article';
  if(PREPOSITION_WORDS[a]&&PREPOSITION_WORDS[b])return 'preposition';
  function stemFor(word){
    if(IRREGULAR_FORMS[word])return word;
    for(var base in IRREGULAR_FORMS)if(IRREGULAR_FORMS[base].indexOf(word)!==-1)return base;
    if(word.length>4&&word.slice(-3)==='ies')return word.slice(0,-3)+'y';
    if(word.length>4&&word.slice(-3)==='ied')return word.slice(0,-3)+'y';
    if(word.length>4&&word.slice(-2)==='ed'){var past=word.slice(0,-2);return past.length>2&&past[past.length-1]===past[past.length-2]?past.slice(0,-1):past;}
    if(word.length>4&&word.slice(-3)==='ing'){var gerund=word.slice(0,-3);if(gerund.length>2&&gerund[gerund.length-1]===gerund[gerund.length-2])gerund=gerund.slice(0,-1);return gerund;}
    if(word.length>3&&word.slice(-1)==='s'&&!/(ss|us|is|ous|ness|ics)$/.test(word))return word.slice(0,-1);
    return word;
  }
  var sa=stemFor(a),sb=stemFor(b);
  if(sa+'e'===sb||sb+'e'===sa){sa=sa+'e';sb=sb+'e';}
  if(sa===sb){
    // Work/works is agreement (number); work/worked is tense.
    var aThird=a===sa+'s'||a===sa+'es'||a===sa+'ies'||(IRREGULAR_FORMS[sa]&&IRREGULAR_FORMS[sa][0]===a);
    var bThird=b===sb+'s'||b===sb+'es'||b===sb+'ies'||(IRREGULAR_FORMS[sb]&&IRREGULAR_FORMS[sb][0]===b);
    if(sa==='be'&&['be','am','is','are'].indexOf(a)!==-1&&['be','am','is','are'].indexOf(b)!==-1)return 'number';
    var aPast=/ed$/.test(a)||!!(IRREGULAR_PAST_FORMS[sa]&&IRREGULAR_PAST_FORMS[sa].indexOf(a)!==-1);
    var bPast=/ed$/.test(b)||!!(IRREGULAR_PAST_FORMS[sb]&&IRREGULAR_PAST_FORMS[sb].indexOf(b)!==-1);
    if(aPast!==bPast)return 'tense';
    if(aThird!==bThird)return 'number';
    if(/ing$/.test(a)!==/ing$/.test(b))return 'tense';
  }
  var tensePairs={};
  Object.keys(IRREGULAR_FORMS).forEach(function(base){IRREGULAR_FORMS[base].forEach(function(form){tensePairs[base+'|'+form]=true;tensePairs[form+'|'+base]=true;});});
  if(tensePairs[a+'|'+b])return 'tense';
  function pluralBase(word){
    if(IRREGULAR_NOUNS[word])return Object.keys(IRREGULAR_NOUNS).filter(function(k){return IRREGULAR_NOUNS[k]===word;})[0];
    if(/ies$/.test(word))return word.slice(0,-3)+'y';
    if(/(ches|shes|xes|zes|ses)$/.test(word))return word.slice(0,-2);
    if(/s$/.test(word)&&!/ss$/.test(word))return word.slice(0,-1);
    return null;
  }
  if(pluralBase(a)===b||pluralBase(b)===a)return 'number';
  return null;
}
function oneSpellingError(a,b){
  if(a.length<2||b.length<2)return false;
  if(a===b)return false;
  if(lev(a,b)===1)return true;
  if(a.length!==b.length)return false;
  for(var i=0;i<a.length-1;i++)if(a[i]!==b[i]&&a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2))return true;
  return false;
}
// Some irregular past forms look like one-character typos (build/built,
// feed/fed). Route these narrow ending patterns to the irregular-only review
// before applying the ordinary spelling allowance.
function possibleIrregularSpellingCollision(a,b){
  function dTSwap(x,y){return x.replace(/d$/,'t')===y||y.replace(/d$/,'t')===x;}
  function removeRepeatedChar(x,y){for(var i=1;i<x.length;i++)if(x[i]===x[i-1]&&x.slice(0,i)+x.slice(i+1)===y)return true;return false;}
  function vowelSubstitution(x,y){if(x.length!==y.length)return false;var mismatch=-1;for(var i=0;i<x.length;i++)if(x[i]!==y[i]){if(mismatch!==-1||'aeiou'.indexOf(x[i])===-1||'aeiou'.indexOf(y[i])===-1)return false;mismatch=i;}return mismatch!==-1;}
  return dTSwap(a,b)||removeRepeatedChar(a,b)||removeRepeatedChar(b,a)||vowelSubstitution(a,b);
}
function deterministicGrade(reference,answer,options){
  var a=answerTokens(reference),b=answerTokens(answer),memo={};
  options=normalizeGrammarOptions(options);
  function combine(tail,errors,typo){return{errors:errors.concat(tail.errors),typo:typo||tail.typo};}
  function rank(result){return result.errors.length*100+(result.typo?1:0);}
  function solve(i,j,typo){
    var key=i+','+j+','+(typo?1:0);if(memo[key])return memo[key];
    if(i===a.length&&j===b.length)return memo[key]={errors:[],typo:typo};
    var candidates=[];
    function add(ni,nj,nt,errs){var tail=solve(ni,nj,nt);candidates.push(combine(tail,errs||[],nt));}
    if(i<a.length&&j<b.length&&a[i]===b[j])add(i+1,j+1,typo,[]);
    if(i<a.length&&j<b.length&&a[i]!==b[j]){
      var category=morphologyCategory(a[i],b[j]);
      if(category)add(i+1,j+1,typo,options[category]? [{type:category,reason:'문법 옵션 '+GRAMMAR_OPTION_LABELS[category]+'이(가) ON인데 형태가 다릅니다: “'+a[i]+'” → “'+b[j]+'”.'}]:[]);
      else if(!typo&&oneSpellingError(a[i],b[j])&&!possibleIrregularSpellingCollision(a[i],b[j]))add(i+1,j+1,true,[]);
      else add(i+1,j+1,typo,[{type:'vocabulary',reason:'허용된 철자 차이를 넘는 어휘 차이입니다: “'+a[i]+'” → “'+b[j]+'”.'}]);
    }
    if(i<a.length){var ca=ARTICLE_WORDS[a[i]]?'article':PREPOSITION_WORDS[a[i]]?'preposition':MODAL_WORDS[a[i]]?'modal':null;if(ca)add(i+1,j,typo,options[ca]?[{type:ca,reason:'문법 옵션 '+GRAMMAR_OPTION_LABELS[ca]+'이(가) ON인데 해당 표현이 빠졌습니다: “'+a[i]+'”.'}]:[]);else add(i+1,j,typo,[{type:'vocabulary',reason:'모범 답안의 핵심 단어가 빠졌습니다: “'+a[i]+'”.'}]);}
    if(j<b.length){var cb=ARTICLE_WORDS[b[j]]?'article':PREPOSITION_WORDS[b[j]]?'preposition':MODAL_WORDS[b[j]]?'modal':null;if(cb)add(i,j+1,typo,options[cb]?[{type:cb,reason:'문법 옵션 '+GRAMMAR_OPTION_LABELS[cb]+'이(가) ON인데 다른 표현이 추가되었습니다: “'+b[j]+'”.'}]:[]);else add(i,j+1,typo,[{type:'vocabulary',reason:'학습자 답변에 모범 답안에 없는 핵심 단어가 추가되었습니다: “'+b[j]+'”.'}]);}
    candidates.sort(function(x,y){return rank(x)-rank(y);});
    return memo[key]=candidates[0]||{errors:[{type:'vocabulary',reason:'두 문장의 단어 구성이 다릅니다.'}],typo:typo};
  }
  var result=solve(0,0,false),unique=[],seen={};
  result.errors.forEach(function(e){var k=e.type+'|'+e.reason;if(!seen[k]){seen[k]=true;unique.push(e);}});
  return{pass:unique.length===0,errors:unique,typo:result.typo};
}
// A narrow second pass may reclassify only an exact deterministic vocabulary
// mismatch as an irregular verb or noun form. It never decides whole-answer
// correctness and fails closed when the response is missing or uncertain.
var SECOND_PASS_IRREGULAR_VERBS={
  teach:['teaches','taught','teaching'], build:['builds','built','building'], arise:['arises','arose','arisen','arising'], awake:['awakes','awoke','awoken','awaking'], beat:['beats','beat','beaten','beating'], bend:['bends','bent','bending'], bite:['bites','bit','bitten','biting'], bleed:['bleeds','bled','bleeding'], blow:['blows','blew','blown','blowing'], breed:['breeds','bred','breeding'], cling:['clings','clung','clinging'], creep:['creeps','crept','creeping'], deal:['deals','dealt','dealing'], dig:['digs','dug','digging'], feed:['feeds','fed','feeding'], flee:['flees','fled','fleeing'], forbid:['forbids','forbade','forbidden','forbidding'], grind:['grinds','ground','grinding'], hang:['hangs','hung','hanged','hanging'], lay:['lays','laid','laying'], lead:['leads','led','leading'], lend:['lends','lent','lending'], lie:['lies','lay','lain','lying'], light:['lights','lit','lighted','lighting'], mean:['means','meant','meaning'], seek:['seeks','sought','seeking'], sew:['sews','sewed','sewn','sewing'], shrink:['shrinks','shrank','shrunk','shrinking'], sink:['sinks','sank','sunk','sinking'], slide:['slides','slid','sliding'], smell:['smells','smelled','smelt','smelling'], spell:['spells','spelled','spelt','spelling'], spill:['spills','spilled','spilt','spilling'], spin:['spins','spun','spinning'], spit:['spits','spat','spitting'], split:['splits','split','splitting'], spread:['spreads','spread','spreading'], spring:['springs','sprang','sprung','springing'], sweep:['sweeps','swept','sweeping'], tear:['tears','tore','torn','tearing'], weave:['weaves','wove','woven','weaving'], weep:['weeps','wept','weeping'], withdraw:['withdraws','withdrew','withdrawn','withdrawing'], withstand:['withstands','withstood','withstanding']
};
var SECOND_PASS_IRREGULAR_NOUNS={cactus:'cacti',fungus:'fungi',nucleus:'nuclei',analysis:'analyses',basis:'bases',crisis:'crises',diagnosis:'diagnoses',thesis:'theses',axis:'axes',index:'indices',matrix:'matrices',appendix:'appendices',criterion:'criteria',phenomenon:'phenomena',datum:'data'};
function isVerifiedIrregularPair(a,b,type){
  var families=type==='tense'?Object.assign({},IRREGULAR_FORMS,SECOND_PASS_IRREGULAR_VERBS):Object.assign({},IRREGULAR_NOUNS,SECOND_PASS_IRREGULAR_NOUNS);
  for(var base in families){var forms=families[base];if(type==='tense'&&(a===base&&forms.indexOf(b)!==-1||b===base&&forms.indexOf(a)!==-1||forms.indexOf(a)!==-1&&forms.indexOf(b)!==-1))return true;if(type==='number'&&(a===base&&forms===b||b===base&&forms===a))return true;}
  return false;
}
function verifiedAiIrregularPair(a,b,type,lemma){
  if(isVerifiedIrregularPair(a,b,type))return true;
  if(!lemma||lemma!==a&&lemma!==b)return false;
  function pluralStem(word){
    if(IRREGULAR_NOUNS[word])return word;
    for(var singular in IRREGULAR_NOUNS)if(IRREGULAR_NOUNS[singular]===word)return singular;
    if(SECOND_PASS_IRREGULAR_NOUNS[ word ])return word;
    for(var special in SECOND_PASS_IRREGULAR_NOUNS)if(SECOND_PASS_IRREGULAR_NOUNS[special]===word)return special;
    if(/ies$/.test(word))return word.slice(0,-3)+'y';
    if(/(ches|shes|xes|zes|ses)$/.test(word))return word.slice(0,-2);
    if(/s$/.test(word)&&!/ss$/.test(word))return word.slice(0,-1);
    return null;
  }
  var aBase=pluralStem(a),bBase=pluralStem(b);
  if(aBase&&bBase&&aBase!==bBase)return false;
  if(type==='tense')return true;
  var other=lemma===a?b:a,otherBase=pluralStem(other);
  if(otherBase&&otherBase!==lemma)return false;
  return true;
}
function extractIrregularResultsJson(raw){
  raw=String(raw||'').trim();
  function validResults(value){return value&&typeof value==='object'&&!Array.isArray(value)&&Array.isArray(value.results)?value:null;}
  function parseCandidate(candidate){try{return validResults(JSON.parse(String(candidate||'').trim()));}catch(e){return null;}}
  var direct=parseCandidate(raw);if(direct)return direct;
  var fence=/```(?:json)?\s*([\s\S]*?)```/gi,match;
  while((match=fence.exec(raw))!==null){var fenced=parseCandidate(match[1]);if(fenced)return fenced;}
  // Worker replies can prepend prose to a JSON object. Scan balanced object
  // boundaries while respecting quoted strings and escapes, then parse each.
  for(var start=0;start<raw.length;start++){
    if(raw[start]!=='{')continue;
    var depth=0,inString=false,escaped=false;
    for(var i=start;i<raw.length;i++){
      var ch=raw[i];
      if(inString){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')inString=false;continue;}
      if(ch==='"'){inString=true;continue;}
      if(ch==='{')depth++;
      else if(ch==='}'&&--depth===0){var embedded=parseCandidate(raw.slice(start,i+1));if(embedded)return embedded;break;}
    }
  }
  return null;
}
function recheckIrregularGrammar(reference,answer,options,result){
  var candidates=[];
  (result.errors||[]).forEach(function(error){
    if(!error||error.type!=='vocabulary')return;
    var match=String(error.reason||'').match(/“([^”]+)”\s*→\s*“([^”]+)”/);
    if(match)candidates.push({reference:match[1],answer:match[2]});
  });
  if(!candidates.length)return Promise.resolve(result);
  var prompt='다음 단어 쌍마다 동일한 어휘의 불규칙 문법 활용인지 여부만 판별하라. 전체 문장 정답, 문맥, 의도, 의미 동등성은 판정하지 마라. 같은 어휘의 동사 활용이면 tense, 같은 명사의 단수·복수면 number다. materials↔books처럼 서로 다른 어휘는 isIrregular=false다. 확실하지 않으면 certain=false로 하라. 각 입력 단어 쌍의 철자를 그대로 복사하고, 실제 어휘 원형을 lemma에 넣어라. JSON 객체만 응답하라: {"results":[{"reference":"기준 문장 단어","answer":"학습자 단어","isIrregular":true,"type":"tense 또는 number 또는 null","lemma":"어휘 원형","certain":true}]}\n단어 쌍: '+JSON.stringify(candidates);
  var timeoutId,request=openAICompatRequest(180,[{role:'user',content:prompt}],null),timeout=new Promise(function(resolve,reject){timeoutId=setTimeout(function(){reject(new Error('불규칙 형태 판별 시간 초과'));},12000);});
  return Promise.race([request,timeout]).then(function(response){return response.json();}).then(function(data){
    var raw=(data.content&&data.content[0]&&data.content[0].text)||'';
    var parsed=extractIrregularResultsJson(raw);
    if(!parsed)return result;
    var confirmed={},spellingAccepted={};
    parsed.results.forEach(function(pair){
      if(!pair||pair.certain!==true)return;
      var key=String(pair.reference||'').toLowerCase()+'|'+String(pair.answer||'').toLowerCase();
      if(!candidates.some(function(candidate){return candidate.reference+'|'+candidate.answer===key;}))return;
      var a=String(pair.reference||'').toLowerCase(),b=String(pair.answer||'').toLowerCase();
      if(pair.isIrregular===false){var knownMorphology=isVerifiedIrregularPair(a,b,'tense')||isVerifiedIrregularPair(a,b,'number');if(!knownMorphology&&!result.typo&&oneSpellingError(a,b))spellingAccepted[key]=true;return;}
      if(pair.isIrregular===true&&['tense','number'].indexOf(pair.type)!==-1&&verifiedAiIrregularPair(a,b,pair.type,String(pair.lemma||'').toLowerCase()))confirmed[key]=pair.type;
    });
    if(!Object.keys(confirmed).length&&!Object.keys(spellingAccepted).length)return result;
    var opts=normalizeGrammarOptions(options),remaining=[];
    (result.errors||[]).forEach(function(error){
      if(error&&error.type==='vocabulary'){
        var match=String(error.reason||'').match(/“([^”]+)”\s*→\s*“([^”]+)”/);
        var key=match&&match[1].toLowerCase()+'|'+match[2].toLowerCase();
        var type=key&&confirmed[key];
        if(type){if(opts[type])remaining.push({type:type,reason:'문법 옵션 '+GRAMMAR_OPTION_LABELS[type]+'이(가) ON인데 불규칙 형태가 다릅니다: “'+match[1]+'” → “'+match[2]+'”.'});return;}
        if(key&&spellingAccepted[key])return;
      }
      remaining.push(error);
    });
    return{pass:remaining.length===0,errors:remaining};
  }).catch(function(){return result;}).then(function(refined){clearTimeout(timeoutId);return refined;});
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
function normalizeGrammarOptions(saved){
  var out=Object.assign({},GRAMMAR_OPTION_DEFAULTS,saved&&typeof saved==='object'?saved:{});
  Object.keys(GRAMMAR_OPTION_DEFAULTS).forEach(function(k){if(typeof out[k]!=='boolean')out[k]=GRAMMAR_OPTION_DEFAULTS[k];});
  return out;
}
function buildSettingsObject(raw){
  var saved={};
  if(raw){try{saved=JSON.parse(raw);if(!saved||typeof saved!=='object'||Array.isArray(saved))return null;}catch(e){return null;}}
  saved.volume=settings.volume;saved.newCardRatio=settings.newCardRatio;
  saved.acSort=acSort;saved.quizOrder=quizOrder;
  saved.bizChapterIds=Object.keys(bizChapterIds).map(Number);
  saved.grammarOptions=normalizeGrammarOptions(settings.grammarOptions);
  return saved;
}
function saveSettings(){
  try{
    var saved=buildSettingsObject(localStorage.getItem(SETTINGS_KEY));if(!saved)return;
    settings.grammarOptions=saved.grammarOptions;
    localStorage.setItem(SETTINGS_KEY,JSON.stringify(saved));
  }catch(e){}
}
function mergeRestoredSettings(backupRaw,currentRaw){
  var backup,current;
  try{backup=JSON.parse(backupRaw);if(!backup||typeof backup!=='object'||Array.isArray(backup))return currentRaw;}catch(e){return currentRaw;}
  try{current=currentRaw?JSON.parse(currentRaw):{};if(!current||typeof current!=='object'||Array.isArray(current))current={};}catch(e){return currentRaw;}
  var merged=Object.assign({},current,backup);
  merged.grammarOptions=normalizeGrammarOptions(Object.assign({},current.grammarOptions||{},backup.grammarOptions||{}));
  return JSON.stringify(merged);
}
function mergeErrorHistoryData(a,b){
  function recordsOf(value){
    if(!value)return [];
    try{var p=typeof value==='string'?JSON.parse(value):value;return Array.isArray(p)?p:(p&&Array.isArray(p.records)?p.records:[]);}catch(e){return null;}
  }
  var ar=recordsOf(a),br=recordsOf(b);
  if(ar===null)return b||a||null;
  if(br===null)return a||b||null;
  var map={};
  ar.concat(br).forEach(function(r){
    if(!r||r.cardId==null||!r.errorType)return;
    var id=r.id||JSON.stringify([r.cardId,r.errorType]);
    if(!map[id])map[id]={id:id,cardId:r.cardId,errorType:r.errorType,referenceAnswer:r.referenceAnswer||'',actualAnswer:r.actualAnswer||'',count:0,firstAt:r.firstAt||0,lastAt:r.lastAt||0,occurrences:[]};
    var target=map[id],seen={};
    function eventKey(x){return x&&x.id?'id:'+x.id:'anon:'+JSON.stringify([x&&x.at,x&&x.referenceAnswer,x&&x.actualAnswer,x&&x.reason]);}
    target.occurrences.forEach(function(x){seen[eventKey(x)]=true;});
    (Array.isArray(r.occurrences)?r.occurrences:[]).forEach(function(x){if(x){var key=eventKey(x);if(!seen[key]){seen[key]=true;target.occurrences.push(x);}}});
    if(!target.referenceAnswer||(r.firstAt&&r.firstAt<target.firstAt)){target.referenceAnswer=r.referenceAnswer||target.referenceAnswer;}
    if((r.lastAt||0)>=(target.lastAt||0)){target.actualAnswer=r.actualAnswer||target.actualAnswer;target.lastAt=r.lastAt||target.lastAt;}
    if(r.firstAt&&(!target.firstAt||r.firstAt<target.firstAt))target.firstAt=r.firstAt;
    if(r.lastAt&&r.lastAt>target.lastAt)target.lastAt=r.lastAt;
    target.count=Math.max(target.count||0,r.count||0);
  });
  var records=Object.keys(map).map(function(id){
    var r=map[id];r.occurrences.sort(function(x,y){return(x.at||0)-(y.at||0);});
    if(r.occurrences.length){r.count=Math.max(r.count||0,r.occurrences.length);r.firstAt=r.occurrences[0].at||r.firstAt;r.lastAt=r.occurrences[r.occurrences.length-1].at||r.lastAt;r.referenceAnswer=r.occurrences[0].referenceAnswer||r.referenceAnswer;r.actualAnswer=r.occurrences[r.occurrences.length-1].actualAnswer||r.actualAnswer;}
    return r;
  });
  return JSON.stringify({version:1,records:records});
}
function saveErrorHistory(records){
  if(!errorHistoryWritable)return false;
  try{localStorage.setItem(ERROR_HISTORY_KEY,JSON.stringify({version:1,records:records||errorHistory}));return true;}catch(e){return false;}
}
function recordAnswerErrors(cardId,referenceAnswer,actualAnswer,errors){
  if(!errorHistoryWritable||cardId==null)return false;
  var nextHistory;
  try{nextHistory=JSON.parse(JSON.stringify(errorHistory));}catch(e){return false;}
  var seen={};
  (errors||[]).forEach(function(error){
    var type=error&&error.type;
    if(!Object.prototype.hasOwnProperty.call(GRAMMAR_OPTION_LABELS,type)||seen[type])return;
    seen[type]=true;
    var id=JSON.stringify([cardId,type]),record=nextHistory.find(function(r){return r.id===id;});
    if(!record){record={id:id,cardId:cardId,errorType:type,referenceAnswer:referenceAnswer,actualAnswer:actualAnswer,count:0,firstAt:0,lastAt:0,occurrences:[]};nextHistory.push(record);}
    var at=Date.now(),event={id:(typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():(at+'-'+Math.random().toString(36).slice(2)),at:at,referenceAnswer:referenceAnswer,actualAnswer:actualAnswer,reason:error.reason||''};
    record.occurrences=Array.isArray(record.occurrences)?record.occurrences:[];
    record.occurrences.push(event);record.count=record.occurrences.length;
    if(!record.firstAt)record.firstAt=at;record.lastAt=at;
    record.actualAnswer=actualAnswer;
  });
  if(!saveErrorHistory(nextHistory))return false;
  errorHistory=nextHistory;renderGrammarErrorStats();return true;
}
function loadAll(){
  try{var cr=localStorage.getItem(CHAPTERS_KEY);if(cr){var cp=JSON.parse(cr);if(cp&&Array.isArray(cp.chapters)){chapters=cp.chapters;nextChapterId=cp.nextId||(chapters.reduce(function(m,c){return Math.max(m,c.id);},0)+1);}}}catch(e){}
  try{var raw=localStorage.getItem(CARDS_KEY);if(raw){var p=JSON.parse(raw);if(p&&Array.isArray(p.cards)){cards=p.cards;cards.forEach(function(c){if(typeof c.everAnswered!=='boolean')c.everAnswered=(c.stage||0)>0;if(typeof c.ngCount!=='number')c.ngCount=0;if(typeof c.chapterId==='undefined')c.chapterId=null;if(typeof c.lastTestedAt==='undefined')c.lastTestedAt=0;});nextCardId=p.nextId||(cards.reduce(function(m,c){return Math.max(m,c.id);},0)+1);}}}catch(e){}
  try{var sr=localStorage.getItem(SETTINGS_KEY);if(sr){var sp=JSON.parse(sr);if(sp){
    if(typeof sp.volume==='number')settings.volume=sp.volume;
    if(typeof sp.newCardRatio==='number')settings.newCardRatio=sp.newCardRatio;
    if(typeof sp.acSort==='string')acSort=sp.acSort;
    if(typeof sp.quizOrder==='string')quizOrder=sp.quizOrder;
    settings.grammarOptions=normalizeGrammarOptions(sp.grammarOptions);
    if(Array.isArray(sp.bizChapterIds))sp.bizChapterIds.forEach(function(id){bizChapterIds[id]=true;});
  }}}catch(e){}
  try{var nr=localStorage.getItem(NOTES_KEY);if(nr)notes=JSON.parse(nr)||{};}catch(e){}
  try{var tr=localStorage.getItem(TRENDS_KEY);if(tr)trends=JSON.parse(tr)||[];}catch(e){}
  // API 키는 Worker Secret에만 보관합니다. 구버전 localStorage 키는 읽지 않습니다.
  try{localStorage.removeItem(APIKEY_KEY);}catch(e){}
  try{var bs=localStorage.getItem(BIZ_SESSIONS_KEY);if(bs)bizSessions=JSON.parse(bs)||[];}catch(e){}
  try{var eh=localStorage.getItem(ERROR_HISTORY_KEY);if(eh){var ep=JSON.parse(eh);errorHistory=Array.isArray(ep)?ep:(ep&&Array.isArray(ep.records)?ep.records:[]);if(!Array.isArray(ep)&&(!ep||!Array.isArray(ep.records)))errorHistoryWritable=false;}}catch(e){errorHistoryWritable=false;}
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
  // 다른 탭으로 이동하면 펼치기 모드 해제
  if(which!=='tabAllCards'&&memExpanded) collapseMemMode();
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

var allName=document.createElement('span');
allName.className='ch-name';
allName.textContent='전체';

var allCount=document.createElement('span');
allCount.className='ch-count';
allCount.textContent='지금 풀 수 있는 카드 '+totalAvail+'개';

allRow.appendChild(allName);
allRow.appendChild(allCount);
  el.appendChild(allRow);
  chapters.forEach(function(ch){
    var row=document.createElement('label');row.className='chapter-select-row';
    var cb=document.createElement('input');cb.type='checkbox';cb.checked=!!selectedChapterIds[ch.id];
    cb.addEventListener('change',function(){if(cb.checked)selectedChapterIds[ch.id]=true;else delete selectedChapterIds[ch.id];renderChapterSelector();refreshSetupInfo();});
    row.appendChild(cb);

var name=document.createElement('span');
name.className='ch-name';
name.textContent=ch.name;

var count=document.createElement('span');
count.className='ch-count';
count.textContent='지금 '+availCount(ch.id)+'개 / 전체 '+chapterCardCount(ch.id)+'개';

row.appendChild(name);
row.appendChild(count);
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
    if(selIds.length) {
      chosen=chosen.filter(function(c){
        return selIds.indexOf(c.chapterId)!==-1;
      });
    }
    chosen=chosen.slice(0,chosenCount);
  } else {
    chosen=buildSession(chosenCount,selIds.length?selIds:null);
  }
  // 북마크 필터 (buildSession 이후 추가 필터링)
  if(quizBmOnly) chosen=chosen.filter(function(c){return c.bookmarked;});
  if(!chosen.length){$('ngFilterInfo').textContent='해당 카드 없음';$('ngFilterInfo').style.color='var(--danger-text)';return;}
  sessionQueue=chosen.map(function(c){return c.id;});sessionUniqueIds=chosen.map(function(c){return c.id;});
  sessionDoneCount=0;streak=0;sessionMissedIds=[];retryQueue=[];currentIsRetry=false;quizMarkedIds={};
  sessionCompletedIds=[];sessionSkippedIds=[];
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
  else if(acSort==='recent')vis.sort(function(a,b){return(b.lastTestedAt||0)-(a.lastTestedAt||0);});
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

on('sortAdded','click',function(){acSort='added';['sortAdded','sortNg','sortAlpha','sortRandom','sortRecent'].forEach(function(id){$(id).classList.remove('active');});$('sortAdded').classList.add('active');saveSettings();renderAllCards();});
on('sortNg','click',function(){acSort='ng';['sortAdded','sortNg','sortAlpha','sortRandom','sortRecent'].forEach(function(id){$(id).classList.remove('active');});$('sortNg').classList.add('active');saveSettings();renderAllCards();});
on('sortAlpha','click',function(){acSort='alpha';['sortAdded','sortNg','sortAlpha','sortRandom','sortRecent'].forEach(function(id){$(id).classList.remove('active');});$('sortAlpha').classList.add('active');saveSettings();renderAllCards();});
on('sortRandom','click',function(){acSort='random';['sortAdded','sortNg','sortAlpha','sortRandom','sortRecent'].forEach(function(id){$(id).classList.remove('active');});$('sortRandom').classList.add('active');saveSettings();renderAllCards();});
on('sortRecent','click',function(){acSort='recent';['sortAdded','sortNg','sortAlpha','sortRandom','sortRecent'].forEach(function(id){$(id).classList.remove('active');});$('sortRecent').classList.add('active');saveSettings();renderAllCards();});
on('sortReverse','click',function(){acReverse=!acReverse;$('sortReverse').classList.toggle('active',acReverse);renderAllCards();});
on('filterBm','click',function(){acBmOnly=!acBmOnly;$('filterBm').classList.toggle('active',acBmOnly);renderAllCards();});
on('filterHasNote','click',function(){acHasNoteOnly=!acHasNoteOnly;$('filterHasNote').classList.toggle('active',acHasNoteOnly);renderAllCards();});
on('toggleKo','click',function(){
  acShowKo=!acShowKo;
  $('toggleKo').classList.toggle('active',acShowKo);
  $('allCardsList').querySelectorAll('.fc-ko').forEach(function(el){el.style.color=acShowKo?'':'transparent';});
});
on('toggleEn','click',function(){
  acShowEn=!acShowEn;
  $('toggleEn').classList.toggle('active',acShowEn);
  $('allCardsList').querySelectorAll('.fc-en').forEach(function(el){el.style.color=acShowEn?'var(--text-2)':'transparent';});
});
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
// 펼치기 모드 - 메뉴 전부 숨기고 카드만 보이게
var memExpanded=false;
// 펼쳤을 때 숨길 요소들 (탭바, 툴바, 검색, 챕터칩 등)
var MEM_HIDE_SELECTORS=['.main-tabs','.ac-toolbar','#allCardsSearch','.chip-row',
  'div[style*="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px"]'];

function expandMemMode(){
  memExpanded=true;
  var pane=$('allCardsPane');
  var card=pane.querySelector('.card');
  var children=card.children;
  // 보존할 요소: 카드목록, 빈상태, 한국어/영어 토글 버튼이 담긴 두 번째 줄
  var keepIds=['allCardsList','allCardsEmpty','toggleKo','toggleEn'];
  for(var i=0;i<children.length;i++){
    var el=children[i];
    // 이 요소 안에 toggleKo/toggleEn이 있으면 남기기
    if(el.querySelector&&(el.querySelector('#toggleKo')||el.querySelector('#toggleEn'))) continue;
    // 직접 카드목록/빈상태면 남기기
    if(keepIds.indexOf(el.id)!==-1) continue;
    el.dataset.memHidden='1';
    el.style.display='none';
  }
  // 탭 바, urgency-grid도 숨기기
  var tabs=document.querySelector('.main-tabs');
  if(tabs){tabs.dataset.memHidden='1';tabs.style.display='none';}
  var urgency=$('urgencyDetails');
  if(urgency){urgency.dataset.memHidden='1';urgency.style.display='none';}
  // 앱 제목도 숨기기
  var h1=document.querySelector('#app h1');
  if(h1&&h1.parentElement){h1.parentElement.dataset.memHidden='1';h1.parentElement.style.display='none';}
  $('memCollapseBtn').style.display='block';
  $('memModeBtn').style.display='none';
}

function collapseMemMode(){
  memExpanded=false;
  var pane=$('allCardsPane');
  var card=pane.querySelector('.card');
  var children=card.children;
  for(var i=0;i<children.length;i++){
    var el=children[i];
    if(el.dataset.memHidden){el.style.display='';delete el.dataset.memHidden;}
  }
  var tabs=document.querySelector('.main-tabs');
  if(tabs&&tabs.dataset.memHidden){tabs.style.display='';delete tabs.dataset.memHidden;}
  var urgency=$('urgencyDetails');
  if(urgency&&urgency.dataset.memHidden){urgency.style.display='';delete urgency.dataset.memHidden;}
  var h1=document.querySelector('#app h1');
  if(h1&&h1.parentElement&&h1.parentElement.dataset.memHidden){h1.parentElement.style.display='';delete h1.parentElement.dataset.memHidden;}
  $('memCollapseBtn').style.display='none';
  $('memModeBtn').style.display='';
}

on('memModeBtn','click',function(){
  // 이미 전체문장 탭이면 재렌더링 없이 바로 펼치기
  if($('allCardsPane').classList.contains('active')){
    expandMemMode();
  } else {
    setTab('tabAllCards');
    setTimeout(expandMemMode,50);
  }
});
on('memCollapseBtn','click',collapseMemMode);

// 한국어/영어 토글은 전체문장 탭의 toggleKo/toggleEn 그대로 사용
// (별도 memToggleKo/En 핸들러 불필요)


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
  updateBulkChapterNav();
  updateMoveChapterNav();
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

/* ---------- 챕터 이동 ---------- */
var moveChapterIdx=0;
var moveCheckedIds={};

function updateMoveChapterNav(){
  var disp=$('moveChapterDisplay');var hidden=$('moveChapterSelect');
  if(!disp||!hidden)return;
  if(!chapters.length){disp.textContent='챕터 없음';hidden.value='';renderMoveCardList();return;}
  moveChapterIdx=((moveChapterIdx%chapters.length)+chapters.length)%chapters.length;
  var ch=chapters[moveChapterIdx];
  disp.textContent=ch.name;hidden.value=String(ch.id);
  renderMoveCardList();
}

function renderMoveCardList(){
  var list=$('moveCardList');if(!list)return;
  var q=($('moveCardSearch')&&$('moveCardSearch').value||'').trim().toLowerCase();
  var visible=cards.filter(function(c){
    if(q&&c.ko.toLowerCase().indexOf(q)===-1&&c.en.toLowerCase().indexOf(q)===-1)return false;
    return true;
  });
  list.innerHTML='';
  visible.forEach(function(c){
    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface-2);border-radius:var(--r-md);border:1.5px solid var(--border);cursor:pointer;';
    var cb=document.createElement('input');cb.type='checkbox';cb.style.cssText='width:17px;height:17px;accent-color:var(--accent);flex-shrink:0;';
    cb.checked=!!moveCheckedIds[c.id];
    var txt=document.createElement('div');txt.style.flex='1';
    // 현재 챕터 표시
    var chName='미분류';
    if(c.chapterId!==null){var ch=chapters.find(function(x){return x.id===c.chapterId;});if(ch)chName=ch.name;}
    txt.innerHTML='<div style="font-size:13px;font-weight:700;">'+esc(c.ko)+'</div>'+
      '<div style="font-size:11px;color:var(--text-3);">'+esc(c.en)+'</div>'+
      '<div style="font-size:11px;color:var(--accent-text);margin-top:2px;">현재: '+esc(chName)+'</div>';
    (function(c,cb,row){
      function toggle(){cb.checked=!cb.checked;if(cb.checked)moveCheckedIds[c.id]=true;else delete moveCheckedIds[c.id];$('moveCardApplyBtn').disabled=Object.keys(moveCheckedIds).length===0;}
      cb.addEventListener('change',function(){if(cb.checked)moveCheckedIds[c.id]=true;else delete moveCheckedIds[c.id];$('moveCardApplyBtn').disabled=Object.keys(moveCheckedIds).length===0;});
      row.addEventListener('click',function(e){if(e.target===cb)return;toggle();});
    })(c,cb,row);
    row.appendChild(cb);row.appendChild(txt);
    list.appendChild(row);
  });
  if(!visible.length)list.innerHTML='<p class="muted" style="text-align:center;padding:16px 0;">해당하는 카드가 없어요</p>';
}

on('moveChapterPrev','click',function(){moveChapterIdx--;updateMoveChapterNav();});
on('moveChapterNext','click',function(){moveChapterIdx++;updateMoveChapterNav();});
on('moveCardSearch','input',function(){renderMoveCardList();});
on('moveCardApplyBtn','click',function(){
  var targetId=parseInt($('moveChapterSelect').value,10);
  if(isNaN(targetId))return;
  var ids=Object.keys(moveCheckedIds).map(Number);
  if(!ids.length)return;
  ids.forEach(function(id){var c=findCard(id);if(c)c.chapterId=targetId;});
  saveCards();moveCheckedIds={};
  $('moveCardApplyBtn').disabled=true;
  $('moveCardResult').textContent='✓ '+ids.length+'개 카드를 이동했어요';
  $('moveCardResult').style.color='var(--success-text)';
  setTimeout(function(){$('moveCardResult').textContent='';},2000);
  renderMoveCardList();refreshSetupInfo();renderAllCards();
});




// 입력 모드: 엑셀 일괄 붙여넣기 / 한국어·영어 직접 입력
(function setupBulkInputModes(){
  var ta=$('bulkInput'), addBtn=$('bulkAddBtn');
  if(!ta || !addBtn || $('bulkInputModeSwitch')) return;
  var pasteHint=ta.previousElementSibling;
  if(pasteHint && /엑셀|두 열을 복사/.test(pasteHint.textContent||'')) pasteHint.dataset.bulkPasteHint='1';
  var wrap=document.createElement('div');
  wrap.id='bulkInputModeSwitch';
  wrap.style.cssText='display:flex;gap:8px;margin:10px 0 12px;';
  function makeModeButton(id,label){
    var b=document.createElement('button'); b.type='button'; b.id=id; b.textContent=label;
    b.style.cssText='flex:1;min-height:42px;border:1px solid var(--border);border-radius:12px;padding:8px 10px;background:var(--surface-2);color:var(--text-2);font-weight:700;';
    wrap.appendChild(b); return b;
  }
  var bulkBtn=makeModeButton('bulkModeBtn','엑셀 붙여넣기');
  var manualBtn=makeModeButton('manualModeBtn','직접 입력');
  ta.parentNode.insertBefore(wrap,ta);
  var manual=document.createElement('div'); manual.id='manualCardFields';
  manual.style.cssText='display:none;margin:0 0 12px;';
  manual.innerHTML='<label for="manualKoInput" style="display:block;margin:8px 0 6px;font-weight:700;">한국어</label><input id="manualKoInput" type="text" placeholder="한국어 단어 또는 문장" style="box-sizing:border-box;width:100%;min-height:46px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2);color:var(--text-2);font:inherit;"><label for="manualEnInput" style="display:block;margin:12px 0 6px;font-weight:700;">영어</label><input id="manualEnInput" type="text" placeholder="English word or sentence" style="box-sizing:border-box;width:100%;min-height:46px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2);color:var(--text-2);font:inherit;">';
  ta.parentNode.insertBefore(manual,ta);
  var originalPlaceholder=ta.placeholder;
  function setMode(mode){
    var isManual=mode==='manual';
    ta.style.display=isManual?'none':'';
    manual.style.display=isManual?'block':'none';
    if(pasteHint && pasteHint.dataset.bulkPasteHint==='1') pasteHint.style.display=isManual?'none':'';
    bulkBtn.style.background=isManual?'var(--surface-2)':'var(--accent)';
    bulkBtn.style.color=isManual?'var(--text-2)':'#fff';
    manualBtn.style.background=isManual?'var(--accent)':'var(--surface-2)';
    manualBtn.style.color=isManual?'#fff':'var(--text-2)';
    var replace=$('replaceAllCardsBtn'), help=$('replaceAllCardsHelp');
    if(replace)replace.style.display=isManual?'none':'';
    if(help)help.style.display=isManual?'none':'';
    addBtn.textContent=isManual?'단어 추가하기':'추가하기';
    addBtn.dataset.inputMode=mode;
  }
  bulkBtn.addEventListener('click',function(){setMode('bulk');});
  manualBtn.addEventListener('click',function(){setMode('manual');$('manualKoInput').focus();});
  $('manualEnInput').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();addBtn.click();}});
  $('manualKoInput').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();$('manualEnInput').focus();}});
  setMode('bulk');
})();

on('bulkAddBtn','click',function(){
  var fb=$('bulkResult'),chId=parseChId('bulkChapterSelect');
  if($('bulkAddBtn').dataset.inputMode==='manual'){
    var ko=$('manualKoInput').value.trim(), en=$('manualEnInput').value.trim();
    if(!ko||!en){fb.textContent='한국어와 영어를 모두 입력해주세요.';fb.style.color='var(--danger-text)';return;}
    cards.push({id:nextCardId++,ko:ko,en:en,chapterId:chId,stage:0,dueAt:now(),bookmarked:false,everAnswered:false,ngCount:0});
    saveCards();$('manualKoInput').value='';$('manualEnInput').value='';
    fb.textContent='✓ 1개 추가';fb.style.color='var(--success-text)';refreshSetupInfo();$('manualKoInput').focus();return;
  }
  var raw=$('bulkInput').value,added=0,skipped=0;
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

// 전체 카드 교체: 한국어<TAB>영어 형식의 문장 묶음을 붙여넣어 기존 카드를 교체합니다.
(function addReplaceAllButton(){
  var addBtn=$('bulkAddBtn');
  if(!addBtn || $('replaceAllCardsBtn')) return;
  var btn=document.createElement('button');
  btn.id='replaceAllCardsBtn'; btn.type='button'; btn.className=addBtn.className;
  btn.textContent='전체 카드 교체';
  btn.style.marginTop='8px'; btn.style.background='var(--danger)'; btn.style.color='#fff';
  addBtn.parentNode.insertBefore(btn,addBtn.nextSibling);
  var help=document.createElement('div');
  help.id='replaceAllCardsHelp';
  help.textContent='선택한 챕터의 카드만 교체합니다. 다른 챕터의 카드와 학습 기록은 유지됩니다.';
  help.style.cssText='font-size:12px;color:var(--text-3);margin-top:6px;line-height:1.5;';
  btn.parentNode.insertBefore(help,btn.nextSibling);
  btn.addEventListener('click',function(){
    var raw=$('bulkInput').value, parsed=[], skipped=0;
    raw.split(/\r\n|\r|\n/).forEach(function(line){
      if(!line.trim()) return;
      var parts=line.indexOf('\t')!==-1 ? line.split('\t') : line.split(/\s*\|\s*/);
      var ko=(parts[0]||'').trim(), en=(parts[1]||'').trim();
      if(!ko||!en){skipped++;return;}
      parsed.push({ko:ko,en:en});
    });
    if(!parsed.length){$('bulkResult').textContent='교체할 문장을 찾지 못했어요. 한국어와 영어 사이가 탭으로 구분되어 있는지 확인해 주세요.';$('bulkResult').style.color='var(--danger-text)';return;}
    var chId=parseChId('bulkChapterSelect');
    var targetCards=cards.filter(function(c){return c.chapterId===chId;});
    var chapterName='선택한 챕터';
    var selectedOption=$('bulkChapterSelect').options[$('bulkChapterSelect').selectedIndex];
    if(selectedOption && selectedOption.textContent) chapterName=selectedOption.textContent.trim();
    if(!confirm('챕터「'+chapterName+'」의 카드 '+targetCards.length+'개를 새 문장 '+parsed.length+'개로 교체할까요?\n\n다른 챕터의 카드는 유지됩니다. 선택한 챕터에서 삭제되는 카드의 복습 단계, 북마크, 오답 횟수 및 카드별 질문 기록은 초기화됩니다.')) return;
    var removedIds={};
    targetCards.forEach(function(c){removedIds[c.id]=true;});
    cards=cards.filter(function(c){return c.chapterId!==chId;});
    parsed.forEach(function(item){cards.push({id:nextCardId++,ko:item.ko,en:item.en,chapterId:chId,stage:0,dueAt:now(),bookmarked:false,everAnswered:false,ngCount:0});});
    Object.keys(removedIds).forEach(function(id){delete notes[id];});
    saveNotes(); saveCards(); $('bulkInput').value='';
    $('bulkResult').textContent='완료: '+chapterName+' 챕터를 '+parsed.length+'개 카드로 교체했습니다. 다른 챕터는 유지되었습니다.'+(skipped?' (형식이 맞지 않아 건너뛴 줄 '+skipped+'개)':'');
    $('bulkResult').style.color='var(--success-text)';
    acCheckedIds={}; refreshSetupInfo(); renderAllCards(); renderDoneCardList(false);
  });
})();

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
  renderGrammarOptions();renderGrammarErrorStats();
  loadApiKeyUI();
}
function renderGrammarOptions(){
  settings.grammarOptions=normalizeGrammarOptions(settings.grammarOptions);
  document.querySelectorAll('[data-grammar-option]').forEach(function(input){
    var key=input.getAttribute('data-grammar-option');input.checked=!!settings.grammarOptions[key];
  });
}
document.querySelectorAll('[data-grammar-option]').forEach(function(input){
  input.addEventListener('change',function(){
    var key=input.getAttribute('data-grammar-option');
    if(!Object.prototype.hasOwnProperty.call(GRAMMAR_OPTION_DEFAULTS,key))return;
    settings.grammarOptions[key]=input.checked;saveSettings();
  });
});
function renderGrammarErrorStats(){
  var root=$('grammarErrorStats');if(!root)return;
  root.textContent='';
  if(!errorHistoryWritable){var warning=document.createElement('p');warning.className='muted';warning.textContent='오류 이력 저장소를 읽을 수 없어 기존 내용을 보존하고 새 기록을 저장하지 않았습니다.';root.appendChild(warning);return;}
  var totals={};Object.keys(GRAMMAR_OPTION_LABELS).forEach(function(k){totals[k]=0;});
  errorHistory.forEach(function(r){if(Object.prototype.hasOwnProperty.call(totals,r.errorType))totals[r.errorType]+=r.count||0;});
  Object.keys(GRAMMAR_OPTION_LABELS).forEach(function(k){
    var row=document.createElement('div');row.className='muted';row.style.cssText='display:flex;justify-content:space-between;padding:3px 0;';
    var name=document.createElement('span');name.textContent=GRAMMAR_OPTION_LABELS[k];
    var count=document.createElement('strong');count.textContent=String(totals[k]||0)+'회';row.appendChild(name);row.appendChild(count);root.appendChild(row);
  });
  if(!errorHistory.length){var empty=document.createElement('p');empty.className='muted';empty.style.marginTop='6px';empty.textContent='저장된 오류 이력이 없습니다.';root.appendChild(empty);return;}
  var recent=errorHistory.slice().sort(function(a,b){return(b.lastAt||0)-(a.lastAt||0);}).slice(0,20);
  recent.forEach(function(r){
    var item=document.createElement('details');item.style.cssText='border-top:1px solid var(--border);padding:7px 0;';
    var summary=document.createElement('summary');summary.style.cssText='cursor:pointer;font-size:12px;';
    summary.textContent=(GRAMMAR_OPTION_LABELS[r.errorType]||r.errorType)+' · 카드 '+r.cardId+' · '+(r.count||0)+'회';item.appendChild(summary);
    var body=document.createElement('div');body.style.cssText='font-size:12px;line-height:1.6;margin-top:6px;';
    var reference=document.createElement('div');reference.textContent='모범 답안: '+(r.referenceAnswer||'');
    var actual=document.createElement('div');actual.textContent='최근 입력: '+(r.actualAnswer||'');
    var dates=document.createElement('div');dates.className='muted';dates.textContent='최초: '+(r.firstAt?new Date(r.firstAt).toLocaleString('ko-KR'):'-')+' · 최근: '+(r.lastAt?new Date(r.lastAt).toLocaleString('ko-KR'):'-');
    body.appendChild(reference);body.appendChild(actual);body.appendChild(dates);item.appendChild(body);root.appendChild(item);
  });
}
function closeGradeGuide(){
  var modal=$('gradeGuideModal');if(!modal)return;
  modal.classList.remove('show');modal.setAttribute('aria-hidden','true');
  var trigger=$('gradeGuideOpenBtn');if(trigger)trigger.focus();
}
on('gradeGuideOpenBtn','click',function(){
  var modal=$('gradeGuideModal');if(!modal)return;
  modal.classList.add('show');modal.setAttribute('aria-hidden','false');$('gradeGuideCloseBtn').focus();
});
on('gradeGuideCloseBtn','click',closeGradeGuide);
on('gradeGuideModal','click',function(e){if(e.target===$('gradeGuideModal'))closeGradeGuide();});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&$('gradeGuideModal').classList.contains('show'))closeGradeGuide();});
on('volumeSlider','input',function(e){settings.volume=parseInt(e.target.value,10)||0;$('volumeValue').textContent=settings.volume+'%';saveSettings();});
on('volumeSlider','change',function(){playCorrectSound(false);});
on('ratioMinus','click',function(){settings.newCardRatio=Math.max(1,settings.newCardRatio-1);$('ratioValue').textContent=settings.newCardRatio+'문제당 1개';saveSettings();refreshSetupInfo();});
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
  var fh=$('footerHint');if(fh){fh.textContent='Enter로 확인 · 다음 카드로 이동';fh.style.color='';}
  var id=null,isRetry=false;
  if(sessionQueue.length)id=sessionQueue.shift();
  else if(retryQueue.length){id=retryQueue.shift();isRetry=true;}
  else{finishSession();return;}
  current=findCard(id);
  currentIsRetry=isRetry;
  // 질문 표시 체크박스 상태 반영
  var qmc=$('quizMarkCheck');
  if(qmc) qmc.checked=!!quizMarkedIds[current.id];
  updateQuizBmBtn();
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
    var sentenceBox=document.createElement('div');sentenceBox.style.cssText='flex:1;min-width:0;';appendAskableText(sentenceBox,'',c.ko,'font-size:13px;font-weight:500;',c.id,'ask');appendAskableText(sentenceBox,'',c.en,'font-size:12px;color:var(--text-2);',c.id,'history');
    var bm=document.createElement('button');bm.type='button';bm.innerHTML=c.bookmarked?'★':'☆';bm.style.cssText='font-size:16px;padding:4px 10px;'+(c.bookmarked?'color:var(--warning);':'');
    bm.addEventListener('click',function(){c.bookmarked=!c.bookmarked;saveCards();bm.innerHTML=c.bookmarked?'★':'☆';bm.style.color=c.bookmarked?'var(--warning)':'';});
    row.insertBefore(sentenceBox,row.firstChild);row.appendChild(bm);ml.appendChild(row);
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
        row.style.cssText='background:var(--surface-2);border-radius:var(--r-md);padding:8px 12px;display:flex;align-items:center;gap:8px;';
        var txt=document.createElement('div');txt.style.flex='1';
        txt.innerHTML='';appendAskableText(txt,'',c.ko,'font-size:13px;font-weight:700;',c.id,'ask');appendAskableText(txt,'',c.en,'font-size:12px;color:var(--text-2);',c.id,'history');
        // 북마크
        var bm=document.createElement('button');bm.type='button';
        bm.style.cssText='font-size:18px;padding:2px 5px;background:transparent;border:none;cursor:pointer;flex-shrink:0;';
        bm.textContent=c.bookmarked?'★':'☆';bm.style.color=c.bookmarked?'var(--warning)':'var(--text-3)';
        (function(c,btn){btn.addEventListener('click',function(){c.bookmarked=!c.bookmarked;saveCards();btn.textContent=c.bookmarked?'★':'☆';btn.style.color=c.bookmarked?'var(--warning)':'var(--text-3)';});})(c,bm);
        row.appendChild(txt);row.appendChild(bm);
        markedList.appendChild(row);
      });
    } else {
      markedSection.style.display='none';
    }
  }
  // 체크 표시는 이번 테스트용이므로 결과 표시 후 초기화
  quizMarkedIds={};

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
      content_.innerHTML='';appendAskableText(content_,'',c.ko,'font-size:14px;font-weight:700;margin-bottom:2px;',c.id,'ask');appendAskableText(content_,'',c.en,'font-size:13px;color:var(--text-2);',c.id,'history');
      var bmBtn=document.createElement('button');bmBtn.type='button';
      bmBtn.style.cssText='font-size:20px;padding:2px 6px;background:transparent;border:none;flex-shrink:0;cursor:pointer;line-height:1;';
      bmBtn.textContent=c.bookmarked?'★':'☆';
      bmBtn.style.color=c.bookmarked?'var(--warning)':'var(--text-3)';
      (function(c,btn){btn.addEventListener('click',function(){
        c.bookmarked=!c.bookmarked;saveCards();
        btn.textContent=c.bookmarked?'★':'☆';
        btn.style.color=c.bookmarked?'var(--warning)':'var(--text-3)';
      });})(c,bmBtn);
      var wrap=document.createElement('div');
      wrap.style.cssText='display:flex;align-items:flex-start;gap:10px;';
      wrap.appendChild(cb);wrap.appendChild(content_);
      if(missed){var bd=document.createElement('span');bd.className='due-tag ng-badge';bd.style.cssText='font-size:11px;flex-shrink:0;margin-top:2px;';bd.textContent='오답';wrap.appendChild(bd);}
      wrap.appendChild(bmBtn);
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
    // 변경사항 수집
    var inputs=$('doneCardList').querySelectorAll('input');
    var diffs=[];
    inputs.forEach(function(inp){
      var id=parseInt(inp.dataset.doneId,10);
      var field=inp.dataset.doneField;
      var val=inp.value.trim();
      var c=findCard(id);
      if(c&&val&&c[field]!==val){
        var existing=diffs.find(function(d){return d.id===id;});
        if(!existing){existing={id:id,origKo:c.ko,origEn:c.en,newKo:c.ko,newEn:c.en};diffs.push(existing);}
        if(field==='ko')existing.newKo=val;
        if(field==='en')existing.newEn=val;
      }
    });
    if(!diffs.length){renderDoneCardList(false);return;}
    // 변경점 확인 모달 표시
    var list=$('editDiffList');list.innerHTML='';
    diffs.forEach(function(d){
      var block=document.createElement('div');
      block.style.cssText='background:var(--surface-2);border-radius:var(--r-md);padding:12px;border:1.5px solid var(--border);';
      var html='';
      if(d.newKo!==d.origKo){
        html+='<div style="font-size:12px;font-weight:700;color:var(--text-3);margin-bottom:3px;">한국어</div>';
        html+='<div style="font-size:13px;color:var(--danger);text-decoration:line-through;margin-bottom:2px;">'+esc(d.origKo)+'</div>';
        html+='<div style="font-size:13px;color:var(--success-text);margin-bottom:6px;">'+esc(d.newKo)+'</div>';
      }
      if(d.newEn!==d.origEn){
        html+='<div style="font-size:12px;font-weight:700;color:var(--text-3);margin-bottom:3px;">영어</div>';
        html+='<div style="font-size:13px;color:var(--danger);text-decoration:line-through;margin-bottom:2px;">'+esc(d.origEn)+'</div>';
        html+='<div style="font-size:13px;color:var(--success-text);">'+esc(d.newEn)+'</div>';
      }
      block.innerHTML=html;list.appendChild(block);
    });
    // editConfirmModal 재활용
    var pendingDoneEdits=diffs;
    $('editConfirmModal').classList.add('show');
    // 기존 핸들러 교체를 위해 클론
    var applyBtn=$('editConfirmApply');
    var newApply=applyBtn.cloneNode(true);
    applyBtn.parentNode.replaceChild(newApply,applyBtn);
    newApply.addEventListener('click',function(){
      pendingDoneEdits.forEach(function(d){
        var c=findCard(d.id);if(!c)return;
        c.ko=d.newKo;c.en=d.newEn;
      });
      saveCards();
      $('editConfirmModal').classList.remove('show');
      renderDoneCardList(false);
    });
    var cancelBtn=$('editConfirmCancel');
    var newCancel=cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel,cancelBtn);
    newCancel.addEventListener('click',function(){
      $('editConfirmModal').classList.remove('show');
      renderDoneCardList(false);
    });
  } else {
    renderDoneCardList(true);
  }
});

on('restartBtn','click',function(){$('doneScreen').style.display='none';$('setupScreen').style.display='block';refreshSetupInfo();});

/* ========== 실전 비즈니스 게임 ========== */
var bizTimer=null;
var bizResumeTimer=false;
var bizTimeLeft=40;
var BIZ_TIME=40;
var bizStepResults=[]; // 현재 문제 결과
var bizAllResults=[]; // 이번 테스트 전체 결과
var bizFinalized=false;
var bizStepStartTime=0;
var bizSessions=[];
var bizCurrentKo=''; // 현재 한국어 지시문
var bizCurrentSourceCardId=null;
var bizChapterIds={};
var bizTemplateCursor=Math.floor(Math.random()*8);
var bizRecentTemplateKeys=[];
var BIZ_TEST_TEMPLATES=[
  {key:'meeting',title:'회의 일정',guide:'회의 시간을 제안·변경·확정하는 문장'},
  {key:'status',title:'진행 상황',guide:'업무 진행 상황을 짧게 보고하는 문장'},
  {key:'request',title:'자료 요청',guide:'필요한 자료나 정보를 정중히 요청하는 문장'},
  {key:'followup',title:'회신 요청',guide:'상대방에게 회신이나 확인을 부탁하는 문장'},
  {key:'review',title:'검토 요청',guide:'문서·초안을 검토해 달라고 요청하는 문장'},
  {key:'apology',title:'사과와 안내',guide:'지연이나 실수에 사과하고 다음 조치를 알리는 문장'},
  {key:'approval',title:'승인 요청',guide:'결정이나 비용에 대한 승인을 요청하는 문장'},
  {key:'handoff',title:'업무 인계',guide:'업무 인수인계나 담당자 변경을 알리는 문장'}
];
function saveBizSessions(){try{localStorage.setItem(BIZ_SESSIONS_KEY,JSON.stringify(bizSessions));}catch(e){}}

function renderBizChapterSelector(){
  var list=$('bizChapterSelectList'),hint=$('bizChapterHint');if(!list||!hint)return;
  list.innerHTML='';
  if(!chapters.length){hint.textContent='챕터가 없으면 저장된 모든 문장을 참고합니다.';return;}
  if(!Object.keys(bizChapterIds).length){chapters.forEach(function(ch){bizChapterIds[ch.id]=true;});saveSettings();}
  chapters.forEach(function(ch){
    var row=document.createElement('label');row.className='chapter-select-row';
    var cb=document.createElement('input');cb.type='checkbox';cb.checked=!!bizChapterIds[ch.id];
    cb.addEventListener('change',function(){if(cb.checked)bizChapterIds[ch.id]=true;else delete bizChapterIds[ch.id];saveSettings();renderBizChapterSelector();});
    var count=cards.filter(function(c){return c.chapterId===ch.id&&c.en&&c.ko;}).length;
    row.appendChild(cb);row.innerHTML+='<span class="ch-name">'+esc(ch.name)+'</span><span class="ch-count">참고 문장 '+count+'개</span>';
    list.appendChild(row);
  });
  hint.textContent='선택한 챕터의 문장과 다양한 실무 템플릿을 함께 참고합니다.';
}
function bizReferenceCards(){
  var ids=Object.keys(bizChapterIds).map(Number);
  var pool=cards.filter(function(c){return c.en&&c.ko&&(!chapters.length||ids.indexOf(c.chapterId)!==-1);});
  return pool;
}
function nextBizTemplate(){
  var candidates=BIZ_TEST_TEMPLATES.filter(function(t){return bizRecentTemplateKeys.indexOf(t.key)===-1;});
  if(!candidates.length)candidates=BIZ_TEST_TEMPLATES.slice();
  var template=candidates[bizTemplateCursor%candidates.length];bizTemplateCursor++;
  bizRecentTemplateKeys.push(template.key);if(bizRecentTemplateKeys.length>4)bizRecentTemplateKeys.shift();
  return template;
}

function getOrCreatePracticeChapter(){
  var ch=chapters.find(function(c){return c.name==='실전연습';});
  if(ch)return ch.id;
  var id=nextChapterId++;
  chapters.push({id:id,name:'실전연습'});
  saveChapters();
  renderChapterManager();renderChapterSelector();refreshAddSelects();renderAcFilter();
  return id;
}

on('bizStartBtn','click',function(){
  if(!apiKey){alert('설정 탭에서 API 키를 먼저 입력해주세요.');return;}
  renderBizChapterSelector();
  if(chapters.length&&!Object.keys(bizChapterIds).length){alert('참조할 챕터를 하나 이상 선택해주세요.');return;}
  if(!bizReferenceCards().length){alert('선택한 챕터에 참고할 문장이 없어요.');return;}
  bizAllResults=[];bizStepResults=[];bizFinalized=false;bizResumeTimer=false;
  bizRecentTemplateKeys=[];bizTemplateCursor=Math.floor(Math.random()*BIZ_TEST_TEMPLATES.length);
  $('bizDoneBtn').style.display='block';$('bizEndBtn').style.display='block';
  $('setupScreen').style.display='none';
  $('bizScreen').style.display='block';
  bizLoadNext();
});
function bizReturnHome(){
  clearInterval(bizTimer);bizTimer=null;bizResumeTimer=false;$('bizEndModal').classList.remove('show');
  $('bizScreen').style.display='none';$('bizEndBtn').style.display='none';$('bizResultCard').style.display='none';$('bizQuestionCard').style.display='block';
  $('setupScreen').style.display='block';refreshSetupInfo();
}
on('bizBackBtn','click',function(){bizFinalized=true;bizReturnHome();});
on('bizDoneBtn','click',function(){if(bizFinalized)bizReturnHome();else bizRequestFinish();});
on('bizEndBtn','click',function(){bizRequestFinish();});
on('bizEndCancelBtn','click',function(){$('bizEndModal').classList.remove('show');if(bizResumeTimer&&!bizFinalized&&$('bizAnswer').disabled===false){bizResumeTimer=false;bizStartTimer(false);}});
on('bizEndConfirmBtn','click',function(){bizFinishTest();});
function bizRequestFinish(){
  bizResumeTimer=!!bizTimer&&$('bizAnswer').disabled===false;
  clearInterval(bizTimer);bizTimer=null;
  $('bizEndConfirmText').textContent='채점된 '+bizAllResults.length+'문제의 결과만 저장하고 테스트를 종료할까요? 제출하지 않은 답변은 저장되지 않습니다.';
  $('bizEndModal').classList.add('show');
}

function bizLoadNext(){
  clearInterval(bizTimer);bizTimer=null;
  $('bizResultCard').style.display='none';
  $('bizQuestionCard').style.display='block';
  $('bizAnswer').value='';$('bizAnswer').disabled=true;
  $('bizSubmitBtn').style.display='none';$('bizLoading').style.display='block';
  $('bizStepInfo').textContent='';
  $('bizBadge').textContent='문제 생성 중...';
  $('bizSituation').textContent='';
  var pool=bizReferenceCards();
  if(!pool.length){$('bizLoading').style.display='none';alert('참고할 카드가 없어요. 먼저 문장을 추가해주세요.');return;}
  var template=nextBizTemplate();
  var sample=shuffleArray(pool.slice()).slice(0,Math.min(12,pool.length));
  var sampleText=sample.map(function(c){return '- '+c.ko+' / '+c.en;}).join('\n');
  openAICompatRequest(450,[{role:'user',content:
    '당신은 일반 회사 업무 영어 트레이너입니다. 아래 출제 템플릿과 참고 표현을 바탕으로 실무 영어 문제를 1개 만드세요.\n\n이번 출제 템플릿: '+template.title+' — '+template.guide+'\n최근에 사용한 템플릿: '+(bizRecentTemplateKeys.slice(0,-1).join(', ')||'없음')+'\n\n참고 표현:\n'+sampleText+
    '\n\n규칙: 이번 템플릿의 의도만 출제하고, 최근 문제의 의미를 단어만 바꿔 반복하지 마세요. 참고 표현은 어휘와 말투만 참고합니다. 전문 분야 지식은 요구하지 않습니다. 문제는 하나의 의사소통 목적만 담은 짧은 한국어 한 문장으로 씁니다. 긴 배경 설명·복수 요청·영어 힌트·괄호 설명은 금지합니다.\nJSON만 응답: {"ko":"짧은 한국어 한 문장"}'}],null).then(function(r){return r.json();}).then(function(data){
    if(bizFinalized)return;
    var raw=(data.content&&data.content[0]&&data.content[0].text)||'{}',q;
    try{q=JSON.parse(raw.replace(/```json|```/g,'').trim());}catch(e){q={ko:'회의 시간을 확인해 주세요'};}
    var questionText=(q.ko||'자료를 검토해 주세요').replace(/\s*\((?:힌트|hint)\s*:\s*\[[^\]]*\]\)\s*$/i,'').trim();
    var item={ko:questionText,sourceCardId:sample[0].id,templateKey:template.key};
    bizStepResults=[null];window._bizItems=[item];window._bizItemIdx=0;
    bizShowItem(item, bizAllResults.length, bizAllResults.length+1);
  }).catch(function(){
    if(bizFinalized)return;
    $('bizLoading').style.display='none';$('bizBadge').textContent='오류';$('bizSituation').textContent='네트워크 오류가 발생했어요. 다시 시도해주세요.';
    $('bizAnswer').disabled=false;
  });
}

function bizShowItem(item,idx,total){
  bizCurrentKo=item.ko;
  bizCurrentSourceCardId=item.sourceCardId||null;
  $('bizBadge').textContent='누적 '+(idx+1)+'번째 문제';
  $('bizSituation').innerHTML='<div style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">영어로 표현하세요</div>'+
    '<div style="font-size:18px;font-weight:700;color:var(--text);line-height:1.6;">'+esc(item.ko)+'</div>';
  $('bizAnswer').value='';$('bizAnswer').disabled=false;
  $('bizSubmitBtn').disabled=false;$('bizSubmitBtn').style.display='block';
  $('bizLoading').style.display='none';
  $('bizStepInfo').innerHTML='';
  bizStepStartTime=Date.now();
  bizStartTimer();
  setTimeout(function(){$('bizAnswer').focus();},100);
}

function bizStartTimer(reset){
  clearInterval(bizTimer);bizTimer=null;
  if(reset!==false)bizTimeLeft=BIZ_TIME;
  var initialElapsed=BIZ_TIME-bizTimeLeft;
  $('bizTimerFill').style.width=Math.max(0,(bizTimeLeft/BIZ_TIME)*100)+'%';
  $('bizTimerFill').style.background=initialElapsed<=20?'#34A96E':initialElapsed<=30?'#D97706':'#E05555';
  $('bizTimerText').textContent=bizTimeLeft+'초';
  $('bizTimerText').style.color=initialElapsed<=20?'var(--text-3)':initialElapsed<=30?'#D97706':'#E05555';
  bizTimer=setInterval(function(){
    bizTimeLeft--;
    var elapsed=BIZ_TIME-bizTimeLeft;
    var pct=Math.max(0,(bizTimeLeft/BIZ_TIME)*100);
    $('bizTimerFill').style.width=pct+'%';
    $('bizTimerFill').style.background=elapsed<=20?'#34A96E':elapsed<=30?'#D97706':'#E05555';
    $('bizTimerText').textContent=bizTimeLeft+'초';
    $('bizTimerText').style.color=elapsed<=20?'var(--text-3)':elapsed<=30?'#D97706':'#E05555';
    if(bizTimeLeft<=0){clearInterval(bizTimer);bizSubmitItem(true);}
  },1000);
}

on('bizSubmitBtn','click',function(){bizSubmitItem(false);});
on('bizAnswer','keydown',function(e){
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(!$('bizSubmitBtn').disabled&&$('bizSubmitBtn').style.display!=='none')bizSubmitItem(false);}
});

function bizSubmitItem(timeUp){
  clearInterval(bizTimer);bizTimer=null;
  var answer=($('bizAnswer').value||'').trim();
  $('bizAnswer').disabled=true;$('bizSubmitBtn').style.display='none';
  $('bizLoading').style.display='block';

  var ko=bizCurrentKo;
  var elapsed=timeUp?BIZ_TIME:Math.round((Date.now()-bizStepStartTime)/1000);

  var prompt='비즈니스 영어 평가자입니다.\n\n전달해야 할 한국어 내용: "'+ko+'"\n학습자가 입력한 영어: "'+(answer||'(미응답)')+(timeUp&&answer?' [시간초과]':timeUp?' [시간초과]':'')+
    '"\n\n평가 기준:\n- 한국어 요청의 핵심 목적이 영어로 명확히 전달됐는가\n- 일반적인 회사 업무에 자연스럽고 정중한 표현인가\n- 너무 informal하거나 의미가 불명확하면 불합격\n\nJSON으로만 응답:\n{"pass":true/false,"feedback":"한국어 1~2문장","min":"합격 기준 최소 표현 (영어)","min_ko":"합격기준 한국어","ideal":"이상적인 표현 (영어)","ideal_ko":"이상적인 한국어"}';

  openAICompatRequest(400, [{role:'user',content:prompt}], null).then(function(r){return r.json();}).then(function(data){
    if(bizFinalized)return;
    $('bizLoading').style.display='none';
    var raw=(data.content&&data.content[0]&&data.content[0].text)||'{}';
    var res;try{res=JSON.parse(raw.replace(/```json|```/g,'').trim());}catch(e){res={pass:false,feedback:'평가 오류',min:'',min_ko:'',ideal:'',ideal_ko:''};}
    res.ko=ko;res.userAnswer=answer;res.elapsed=elapsed;res.timeUp=timeUp;res.sourceCardId=bizCurrentSourceCardId;
    var idx=window._bizItemIdx||0;
    bizStepResults[idx]=res;

    // 결과 인라인 표시
    var pass=res.pass&&!timeUp;
    var resultHtml='<div style="margin-top:10px;padding:10px 12px;border-radius:var(--r-md);background:var(--surface-2);border:1.5px solid '+(pass?'#34A96E':'#E05555')+';">'+
      '<div style="font-weight:800;color:'+(pass?'#34A96E':'#E05555')+';">'+(timeUp&&!answer?'⏰ 시간 초과':pass?'✅ 합격':'❌ 불합격')+'</div>'+
      '<div style="font-size:12px;color:var(--text-2);margin-top:3px;">'+esc(res.feedback||'')+'</div>'+
      '<div style="font-size:12px;margin-top:5px;"><span style="color:var(--text-3);font-weight:700;">합격기준 </span>'+esc(res.min||'')+'</div>'+
      '<div style="font-size:12px;margin-top:2px;"><span style="color:var(--text-3);font-weight:700;">이상적 </span>'+esc(res.ideal||'')+'</div>'+
      '</div>';
    $('bizStepInfo').innerHTML=resultHtml;

    // 문제 하나를 기록하고 다음 문제를 계속 출제한다. 완료는 사용자가 누른다.
    bizAllResults.push(res);
    if($('bizEndModal').classList.contains('show'))$('bizEndConfirmText').textContent='채점된 '+bizAllResults.length+'문제의 결과만 저장하고 테스트를 종료할까요? 제출하지 않은 답변은 저장되지 않습니다.';
    var nb=document.createElement('button');nb.type='button';
    nb.style.cssText='width:100%;margin-top:10px;font-weight:700;border-color:var(--accent);color:var(--accent-text);';
    nb.textContent='다음 문제 →';
    nb.onclick=function(){bizLoadNext();};
    $('bizStepInfo').appendChild(nb);
  }).catch(function(){
    if(bizFinalized)return;
    $('bizLoading').style.display='none';
    $('bizSubmitBtn').style.display='block';$('bizAnswer').disabled=false;
    alert('네트워크 오류. 다시 시도해주세요.');
  });
}

function bizFinishTest(){
  if(bizFinalized)return;
  bizResumeTimer=false;clearInterval(bizTimer);bizTimer=null;
  bizFinalized=true;
  $('bizEndModal').classList.remove('show');
  if(!bizAllResults.length){bizReturnHome();return;}
  bizShowFinalResult();
}

function bizShowFinalResult(){
  clearInterval(bizTimer);bizTimer=null;
  $('bizScreen').style.display='block';
  $('bizQuestionCard').style.display='none';
  $('bizEndBtn').style.display='none';
  $('bizResultCard').style.display='block';
  $('setupScreen').style.display='none';
  var results=bizAllResults.slice();
  var passCount=results.filter(function(r){return r.pass&&!r.timeUp;}).length;
  var total=results.length;
  var avgTime=total?Math.round(results.reduce(function(s,r){return s+(r.elapsed||0);},0)/total):0;
  var session={date:new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}),passRate:total?Math.round(passCount/total*100):0,avgTime:avgTime,totalSteps:total,situation:'사용자가 테스트 완료를 눌러 종료',steps:results.map(function(r){return {stepKo:r.ko,userAnswer:r.userAnswer,pass:!!(r.pass&&!r.timeUp),elapsed:r.elapsed,min:r.min,min_ko:r.min_ko,ideal:r.ideal,ideal_ko:r.ideal_ko,feedback:r.feedback,timeUp:r.timeUp,bookmarked:!!r.bookmarked,sourceCardId:r.sourceCardId||null};})};
  bizSessions.unshift(session);if(bizSessions.length>100)bizSessions=bizSessions.slice(0,100);saveBizSessions();
  $('bizVerdict').textContent=passCount+'/'+total+' 합격';
  $('bizVerdict').style.color=passCount===total?'var(--success-text)':'var(--warning)';
  $('bizFeedback').textContent='평균 입력 시간: '+avgTime+'초 · 총 '+total+'문장';
  var cont=$('bizStepResultList');cont.innerHTML='';
  results.forEach(function(res,i){
    var block=document.createElement('div');block.style.cssText='background:var(--surface-2);border-radius:var(--r-md);padding:10px 12px;margin-bottom:8px;';
    var top=document.createElement('div');top.style.cssText='display:flex;align-items:flex-start;gap:8px;';
    var cb=document.createElement('input');cb.type='checkbox';cb.className='bizTemplateCheck';cb.style.cssText='margin-top:4px;flex-shrink:0;';cb.dataset.idx=String(i);
    var head=document.createElement('div');head.style.cssText='flex:1;min-width:0;';
    head.innerHTML='';var number=document.createElement('div');number.style.cssText='font-size:12px;font-weight:800;color:var(--text-3);margin-bottom:4px;';number.textContent=(i+1)+'.';head.appendChild(number);appendBizResultAction(head,'',res.ko||'',res.sourceCardId,'ask');
    var tools=document.createElement('div');tools.style.cssText='display:flex;gap:4px;flex-shrink:0;';
    var star=document.createElement('button');star.type='button';star.className='icon-btn';star.textContent=res.bookmarked?'★':'☆';star.title='별표';star.style.color=res.bookmarked?'var(--warning)':'var(--text-3)';
    star.onclick=function(){res.bookmarked=!res.bookmarked;star.textContent=res.bookmarked?'★':'☆';star.style.color=res.bookmarked?'var(--warning)':'var(--text-3)';session.steps[i].bookmarked=res.bookmarked;saveBizSessions();};
    tools.appendChild(star);top.appendChild(cb);top.appendChild(head);top.appendChild(tools);block.appendChild(top);
    var details=document.createElement('div');details.style.cssText='font-size:12px;line-height:1.55;margin-top:6px;';
    details.innerHTML='<div style="color:'+(res.pass&&!res.timeUp?'var(--success-text)':'var(--danger-text)')+';font-weight:800;margin-bottom:5px;">'+(res.pass&&!res.timeUp?'합격':'불합격')+'</div>';
    appendBizResultText(details,'내 답변',res.userAnswer||'(미응답)');
    appendBizResultText(details,'피드백',res.feedback||'');
    appendBizResultText(details,'합격 기준',res.min||'');
    appendBizResultAction(details,'이상적 표현',res.ideal||'',res.sourceCardId,'history');
    block.appendChild(details);cont.appendChild(block);
  });
  var old=$('bizTemplateAddBtn');if(old)old.remove();
  var add=document.createElement('button');add.id='bizTemplateAddBtn';add.type='button';add.className=$('bizDoneBtn').className;add.style.cssText='width:100%;margin:10px 0;font-weight:800;';add.textContent='☑ 체크한 문장을 미분류 템플릿 카드로 추가';
  add.onclick=function(){var checks=Array.from(cont.querySelectorAll('.bizTemplateCheck:checked'));if(!checks.length){alert('추가할 문장을 체크해주세요.');return;}var added=0;checks.forEach(function(cb){var r=results[Number(cb.dataset.idx)];var en=r.ideal||r.min||r.userAnswer;if(!r.ko||!en)return;cards.push({id:nextCardId++,ko:r.ko,en:en,chapterId:0,stage:0,dueAt:now(),bookmarked:!!r.bookmarked,everAnswered:false,ngCount:0,lastTestedAt:0});added++;});saveCards();alert(added+'개 문장을 미분류 템플릿 카드로 추가했어요.');};
  cont.parentNode.insertBefore(add,cont);
  $('bizResultCard').style.display='block';
  $('bizDoneBtn').style.display='none';
}

on('bizNextBtn','click',function(){bizAllResults=[];bizStepResults=[];bizFinalized=false;$('bizDoneBtn').style.display='block';$('bizEndBtn').style.display='block';$('bizResultCard').style.display='none';$('bizScreen').style.display='block';bizLoadNext();});





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
  if(sessionCompletedIds.indexOf(current.id)===-1) sessionCompletedIds.push(current.id);
  current.lastTestedAt=now(); // 최근 테스트 시간 기록
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
function finishWrongAnswer(cardId,reference,raw,result,extraHint){
  var historySaved=recordAnswerErrors(cardId,reference,raw,result.errors);
  escalateWrong();
  var reason=result.errors.map(function(e){return e.reason;}).filter(Boolean).join(' ');
  var hint=$('footerHint');
  if(hint){hint.textContent=(reason?'오답: '+reason:'오답으로 판정했습니다.')+(extraHint?' · '+extraHint:'')+(historySaved?'':' · 오답 이력 저장에 실패했습니다.');hint.style.color='var(--danger-text)';}
}
function checkAnswer(){
  if(!current||$('checkBtn').disabled)return;
  var raw=$('answerInput').value;
  if(!raw.trim()){escalateWrong();return;}
  var cardId=current.id,reference=current.en,options=Object.assign({},settings.grammarOptions);
  var result=deterministicGrade(reference,raw,options);
  // Accepted answers never incur an AI request.
  if(result.pass){finalizeCorrect();return;}
  $('answerInput').disabled=true;
  $('checkBtn').disabled=true;
  $('checkBtn').textContent='확인 중...';
  recheckIrregularGrammar(reference,raw,options,result).then(function(refined){
    $('answerInput').disabled=false;
    $('checkBtn').disabled=false;
    $('checkBtn').textContent='확인';
    if(refined.pass){finalizeCorrect();return;}
    finishWrongAnswer(cardId,reference,raw,refined);
  }).catch(function(){
    $('answerInput').disabled=false;
    $('checkBtn').disabled=false;
    $('checkBtn').textContent='확인';
    finishWrongAnswer(cardId,reference,raw,result,'2차 판별에 실패해 기존 오답 판정을 유지했습니다.');
  });
}

on('checkBtn','click',checkAnswer);on('nextBtn','click',loadNext);
// The old manual diff override is no longer part of answer grading.
on('markWrongBtn','click',escalateWrong);
on('cancelSessionBtn','click',function(){$('cancelModal').classList.add('show');});

// 오답처리하고 건너뛰기 (세션 재출제 없음)
on('skipFailBtn','click',function(){
  if(!current)return;
  var c=current;
  // ngCount +1 (이 세션에서 첫 번째만)
  if(sessionMissedIds.indexOf(c.id)===-1) c.ngCount=(c.ngCount||0)+1;
  sessionMissedIds.push(c.id);
  sessionSkippedIds.push(c.id);
  if(sessionCompletedIds.indexOf(c.id)===-1) sessionCompletedIds.push(c.id);
  // 15분 후 복습 예약
  c.everAnswered=true;c.stage=0;c.dueAt=now()+FIFTEEN_MIN;
  saveCards();
  sessionDoneCount++;
  streak=0;
  updateStats();
  // retryQueue에서 이 카드 제거 (재출제 방지)
  retryQueue=retryQueue.filter(function(id){return id!==c.id;});
  var token=++autoAdvanceToken;
  setTimeout(function(){if(token===autoAdvanceToken)loadNext();},150);
});

// 테스트 현황 모달
on('failAllBtn','click',function(){
  renderTestStatusModal();
  $('testStatusModal').classList.add('show');
});
on('testStatusClose','click',function(){$('testStatusModal').classList.remove('show');});

function renderTestStatusModal(){
  var cont=$('testStatusContent');cont.innerHTML='';

  // 미완료: 아직 sessionQueue + retryQueue + current (completedIds에 없는 것)
  var remaining=[];
  if(current&&sessionCompletedIds.indexOf(current.id)===-1) remaining.push(current.id);
  sessionQueue.forEach(function(id){if(remaining.indexOf(id)===-1)remaining.push(id);});
  retryQueue.forEach(function(id){if(remaining.indexOf(id)===-1)remaining.push(id);});

  // 완료: completedIds
  var completed=sessionCompletedIds.slice();

  function makeCardRow(id, statusLabel, statusColor){
    var c=findCard(id);if(!c)return null;
    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:flex-start;gap:8px;padding:10px 12px;background:var(--surface-2);border-radius:var(--r-md);border:1.5px solid var(--border);';
    var body=document.createElement('div');body.style.flex='1';
    var missed=sessionMissedIds.indexOf(id)!==-1;
    var skipped=sessionSkippedIds.indexOf(id)!==-1;
    var resultTag=skipped?'오답처리':missed?'오답':'정답';
    var resultColor=missed?'var(--danger-text)':'var(--success-text)';
    body.innerHTML=
      '<div style="font-size:13px;font-weight:700;margin-bottom:2px;">'+esc(c.ko)+'</div>'+
      '<div style="font-size:12px;color:var(--text-2);margin-bottom:4px;">'+esc(c.en)+'</div>'+
      '<div style="display:flex;gap:5px;flex-wrap:wrap;">'+
      '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:'+statusColor+'22;color:'+statusColor+';">'+statusLabel+'</span>'+
      (statusLabel==='완료'?'<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:var(--surface);color:'+resultColor+';">'+resultTag+'</span>':'')+
      '</div>';
    // 버튼들
    var btns=document.createElement('div');btns.style.cssText='display:flex;flex-direction:column;gap:4px;flex-shrink:0;';
    // 북마크
    var bmBtn=document.createElement('button');bmBtn.type='button';bmBtn.className='icon-btn bm'+(c.bookmarked?' on':'');
    bmBtn.innerHTML=c.bookmarked?'★':'☆';bmBtn.style.fontSize='15px';
    (function(c,btn){btn.addEventListener('click',function(){c.bookmarked=!c.bookmarked;saveCards();btn.innerHTML=c.bookmarked?'★':'☆';btn.style.color=c.bookmarked?'var(--warning)':'';});})(c,bmBtn);
    // 질문
    var askBtn=document.createElement('button');askBtn.type='button';askBtn.className='icon-btn';
    askBtn.textContent='💬';askBtn.style.fontSize='13px';
    (function(cid){askBtn.addEventListener('click',function(){$('testStatusModal').classList.remove('show');openAskModal(cid);});})(id);
    // 이력
    var noteBtn=document.createElement('button');noteBtn.type='button';noteBtn.className='icon-btn';
    noteBtn.textContent='📋';noteBtn.style.fontSize='13px';
    if(notes[id]&&notes[id].length) noteBtn.style.color='var(--accent-text)';
    (function(cid){noteBtn.addEventListener('click',function(){$('testStatusModal').classList.remove('show');openNotesModal(cid);});})(id);
    btns.appendChild(bmBtn);btns.appendChild(askBtn);btns.appendChild(noteBtn);
    row.appendChild(body);row.appendChild(btns);
    return row;
  }

  // 미완료 섹션
  if(remaining.length){
    var hdr=document.createElement('div');
    hdr.style.cssText='font-size:12px;font-weight:800;color:var(--warning);text-transform:uppercase;letter-spacing:0.05em;padding:4px 0;';
    hdr.textContent='미완료 '+remaining.length+'개';
    cont.appendChild(hdr);
    remaining.forEach(function(id){var row=makeCardRow(id,'미완료','var(--warning)');if(row)cont.appendChild(row);});
  }

  // 완료 섹션
  if(completed.length){
    var hdr2=document.createElement('div');
    hdr2.style.cssText='font-size:12px;font-weight:800;color:var(--success-text);text-transform:uppercase;letter-spacing:0.05em;padding:4px 0;margin-top:'+(remaining.length?'14px':'4px')+';';
    hdr2.textContent='완료 '+completed.length+'개';
    cont.appendChild(hdr2);
    completed.forEach(function(id){var row=makeCardRow(id,'완료','var(--success-text)');if(row)cont.appendChild(row);});
  }

  if(!remaining.length&&!completed.length){
    cont.innerHTML='<p class="muted" style="text-align:center;padding:20px 0;">카드가 없어요</p>';
  }
}

// 완료만 반영하고 종료 (미완료는 원상복구)
on('testStatusFailAll','click',function(){
  $('testStatusModal').classList.remove('show');
  // 미완료 카드들 원상복구 (세션 시작 전 상태로)
  // sessionQueue + retryQueue에 남은 카드들 = 미완료
  var remaining=[];
  if(current&&sessionCompletedIds.indexOf(current.id)===-1) remaining.push(current.id);
  sessionQueue.forEach(function(id){if(remaining.indexOf(id)===-1)remaining.push(id);});
  retryQueue.forEach(function(id){if(remaining.indexOf(id)===-1)remaining.push(id);});
  remaining.forEach(function(id){
    var c=findCard(id);if(!c)return;
    // ngCount 되돌리기 (이 세션에서 증가했으면)
    if(sessionMissedIds.indexOf(id)!==-1){
      c.ngCount=Math.max(0,(c.ngCount||1)-1);
    }
    // dueAt 원상복구 (지금 시점으로 - 즉시 다시 출제 가능하게)
    c.dueAt=now();
  });
  saveCards();
  sessionQueue=[];retryQueue=[];current=null;
  finishSession();
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
});

// 북마크 버튼 (별표) - 전체문장 북마크와 연동
on('quizBmBtn','click',function(){
  if(!current)return;
  current.bookmarked=!current.bookmarked;
  saveCards();
  updateQuizBmBtn();
});
function updateQuizBmBtn(){
  var btn=$('quizBmBtn');if(!btn||!current)return;
  btn.textContent=current.bookmarked?'★':'☆';
  btn.style.color=current.bookmarked?'var(--warning)':'var(--text-3)';
}

on('quizAskBtn','click',function(){if(current)openAskModal(current.id);});
on('quizNotesBtn','click',function(){if(current)openNotesModal(current.id);});

/* ---------- API 키 설정 ---------- */
function loadApiKeyUI(){
  if($('apiKeyInput')) $('apiKeyInput').value='';
  $('apiKeyStatus').textContent='✓ Cloudflare Worker를 통해 OpenAI에 연결합니다. API 키는 서버에서 관리됩니다.';
  $('apiKeyStatus').style.color='var(--success-text)';
}
/* ---------- 데이터 백업 / 복원 ---------- */
on('backupBtn','click',function(){
  var currentSettingsRaw=localStorage.getItem(SETTINGS_KEY);
  var settingsForBackup=buildSettingsObject(currentSettingsRaw);
  var data={
    cards:    localStorage.getItem(CARDS_KEY),
    chapters: localStorage.getItem(CHAPTERS_KEY),
    settings: settingsForBackup?JSON.stringify(settingsForBackup):currentSettingsRaw,
    notes:    localStorage.getItem(NOTES_KEY),
    trends:   localStorage.getItem(TRENDS_KEY),
    bizSessions: localStorage.getItem(BIZ_SESSIONS_KEY),
    errorHistory: localStorage.getItem(ERROR_HISTORY_KEY),
    exported: new Date().toLocaleString('ko-KR')
  };
  var json=JSON.stringify(data, null, 2);
  var blob=new Blob([json], {type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;
  var d=new Date();
  a.download='memory-backup-'+d.getFullYear()+('0'+(d.getMonth()+1)).slice(-2)+('0'+d.getDate()).slice(-2)+'.json';
  a.click();
  URL.revokeObjectURL(url);
  $('backupStatus').textContent='✓ 백업 파일이 다운로드됐어요';
  $('backupStatus').style.color='var(--success-text)';
  setTimeout(function(){$('backupStatus').textContent='';},3000);
});

on('restoreBtn','click',function(){
  $('restoreFile').value='';
  $('restoreFile').click();
});

$('restoreFile').addEventListener('change',function(e){
  var file=e.target.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(ev){
    try{
      var data=JSON.parse(ev.target.result);
      if(!data.cards){
        $('backupStatus').textContent='❌ 올바른 백업 파일이 아니에요';
        $('backupStatus').style.color='var(--danger-text)';return;
      }
      if(!confirm('현재 데이터가 백업 파일로 교체됩니다. 계속할까요?'))return;
      if(data.cards)    localStorage.setItem(CARDS_KEY,    data.cards);
      if(data.chapters) localStorage.setItem(CHAPTERS_KEY, data.chapters);
      if(data.settings) localStorage.setItem(SETTINGS_KEY, mergeRestoredSettings(data.settings,localStorage.getItem(SETTINGS_KEY))||data.settings);
      if(data.notes)    localStorage.setItem(NOTES_KEY,    data.notes);
      if(data.trends)   localStorage.setItem(TRENDS_KEY,   data.trends);
      if(data.bizSessions) localStorage.setItem(BIZ_SESSIONS_KEY,data.bizSessions);
      if(data.errorHistory&&errorHistoryWritable){
        var mergedHistory=mergeErrorHistoryData(localStorage.getItem(ERROR_HISTORY_KEY),data.errorHistory);
        if(mergedHistory){localStorage.setItem(ERROR_HISTORY_KEY,mergedHistory);try{var restoredHistory=JSON.parse(mergedHistory);errorHistory=restoredHistory.records||[];}catch(e){}}
      }
      localStorage.removeItem(APIKEY_KEY);
      
$('backupStatus').textContent='バックアップデータを保存しています...';
$('backupStatus').style.color='var(--success-text)';

var flush = (typeof window.memorySyncFlush === 'function')
  ? window.memorySyncFlush()
  : Promise.resolve({ok:true});

Promise.resolve(flush).then(function(result){
  if(result && result.ok === false){
    $('backupStatus').textContent='❌ 백업은 기기에 복원됐지만 클라우드 저장에 실패했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요. 이 화면을 닫거나 새로고침하지 마세요.';
    $('backupStatus').style.color='var(--danger-text)';
    return;
  }

  $('backupStatus').textContent='✓ 복원 완료! 앱을 다시 시작합니다...';
  setTimeout(function(){
    window.location.reload();
  },500);
}).catch(function(err){
  $('backupStatus').textContent='❌ 클라우드 저장 오류: '+err.message+' (이 화면을 새로고침하지 마세요)';
  $('backupStatus').style.color='var(--danger-text)';
});
    }catch(err){
      $('backupStatus').textContent='❌ 파일 읽기 오류: '+err.message;
      $('backupStatus').style.color='var(--danger-text)';
    }
  };
  reader.readAsText(file);
});

on('apiKeySaveBtn','click',function(){
  $('apiKeyInput').value='';
  $('apiKeyStatus').textContent='API 키는 여기에 입력하지 마세요. Cloudflare의 OPENAI_API_KEY Secret에서 관리합니다.';
  $('apiKeyStatus').style.color='var(--text-3)';
});
on('apiKeyClearBtn','click',function(){
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
var askContextOverride=null;
var askConversation=[]; // [{role:'user',content:''},{role:'assistant',content:''}]
var askSavedCount=0;    // 이미 저장한 턴 수 (갱신 저장용)

function openAskModal(cardId,sentenceOverride){
  var c=sentenceOverride?{ko:String(sentenceOverride),en:String(sentenceOverride)}:findCard(cardId);if(!c)return;
  if(!apiKey){alert('AI 질문을 사용할 수 없습니다. 연결 설정을 확인해주세요.');return;}
  askTargetCardId=cardId||null;
  askContextOverride=sentenceOverride?String(sentenceOverride):null;
  askConversation=[];
  askSavedCount=0;
  $('askCardPreview').innerHTML=sentenceOverride?'<strong>'+esc(sentenceOverride)+'</strong>':'<strong>'+esc(c.ko)+'</strong><br><span style="color:var(--text-3);">'+esc(c.en)+'</span>';
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

function appendAskableText(container,label,text,bodyStyle,cardId,action){
  if(!text)return;
  var parts=String(text).match(/[^.!?。！？]+[.!?。！？]?/g)||[String(text)];
  parts.forEach(function(part){
    var sentence=part.trim();if(!sentence)return;
    var row=document.createElement('div');row.style.cssText='display:flex;align-items:flex-start;gap:6px;margin-top:4px;';
    var body=document.createElement('span');body.style.cssText='flex:1;min-width:0;'+(bodyStyle||'');body.textContent=(label?label+': ':'')+sentence;
    row.appendChild(body);row.appendChild(makeSentenceActionButton(cardId,action||'ask',sentence));container.appendChild(row);
  });
}

function appendBizResultText(container,label,text){
  if(!text)return;
  var row=document.createElement('div');row.style.cssText='margin-top:4px;';
  row.textContent=(label?label+': ':'')+text;container.appendChild(row);
}
function appendBizResultAction(container,label,text,cardId,action){
  if(!text)return;
  var row=document.createElement('div');row.style.cssText='display:flex;align-items:flex-start;gap:6px;margin-top:4px;';
  var body=document.createElement('span');body.style.cssText='flex:1;min-width:0;';body.textContent=(label?label+': ':'')+text;
  row.appendChild(body);row.appendChild(makeSentenceActionButton(cardId,action,text));container.appendChild(row);
}

function makeSentenceActionButton(cardId,action,sentence){
  var btn=document.createElement('button');btn.type='button';btn.style.cssText='font-size:11px;padding:4px 9px;flex-shrink:0;';
  if(action==='history'&&cardId){
    btn.style.cssText+='color:var(--text-2);';btn.textContent='📋 이력';btn.title='질문 이력';
    if(notes[cardId]&&notes[cardId].length)btn.style.color='var(--accent-text)';
    btn.addEventListener('click',function(){openNotesModal(cardId);});
  }else{
    btn.style.cssText+='color:var(--accent-text);border-color:var(--accent);';btn.textContent='💬 질문';btn.title='질문하기';
    btn.addEventListener('click',function(){if(cardId)openAskModal(cardId,sentence);else openAskModal(null,sentence);});
  }
  return btn;
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
  askTargetCardId=null;askContextOverride=null;askConversation=[];askSavedCount=0;
}
on('askModalClose','click',closeAskModal);
on('askModalClose2','click',closeAskModal);

on('askSendBtn','click',function(){
  var q=$('askInput').value.trim();
  if(!q)return;
  var c=askContextOverride?null:findCard(askTargetCardId);if(!c&&!askContextOverride)return;
  $('askLoading').style.display='block';
  $('askSendBtn').disabled=true;

  // 대화 메시지 구성 (카드 컨텍스트는 system에)
  var systemPrompt=askContextOverride?'당신은 영어 학습을 돕는 선생님입니다. 사용자가 화면에서 선택한 대상 문장에 대해 질문합니다.\n대상 문장: '+askContextOverride+'\n\n질문에서 이 문장을 대상으로 삼아 한국어로 친절하게 답해주세요. 답변은 3-5문장 이내로 간결하게.':'당신은 영어 학습을 돕는 선생님입니다. 사용자는 다음 영어 표현을 외우고 있습니다.\n한국어: '+c.ko+'\n영어: '+c.en+'\n\n질문에 한국어로 명확하고 친절하게 답해주세요. 답변은 3-5문장 이내로 간결하게.';

  // 이전 대화 + 새 질문 추가
  var msgs=askConversation.slice();
  msgs.push({role:'user',content:q});

  openAICompatRequest(800, msgs, systemPrompt).then(function(r){return r.json();}).then(function(data){
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
    $('askSaveBtn').style.display=askTargetCardId?'block':'none';
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
  openAICompatRequest(300, [{role:'user',content:summaryPrompt+'\n\n'+fullText}], null).then(function(r){return r.json();}).then(function(data){
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
openAskModal=function(cardId,sentenceOverride){askSessionId=Date.now();_origOpenAsk(cardId,sentenceOverride);};

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
  var ab=makeSentenceActionButton(cardId,'ask');
  var nb=makeSentenceActionButton(cardId,'history');
  wrap.appendChild(ab);wrap.appendChild(nb);
  return wrap;
}

/* ---------- 질문 경향 분석 ---------- */
/* ---------- 실전 테스트 이력 ---------- */
on('bizHistoryBtn','click',function(){
  var list=$('bizHistoryList'),empty=$('bizHistoryEmpty');
  list.innerHTML='';
  if(!bizSessions.length){list.style.display='none';empty.style.display='block';}
  else{
    list.style.display='flex';empty.style.display='none';
    bizSessions.forEach(function(s,i){
      var block=document.createElement('div');
      block.style.cssText='background:var(--surface-2);border-radius:var(--r-md);padding:12px;border:1.5px solid var(--border);';
      var passColor=s.passRate>=80?'var(--success-text)':s.passRate>=50?'var(--warning)':'var(--danger-text)';
      block.innerHTML=
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'+
        '<span style="font-size:11px;color:var(--text-3);font-weight:700;">'+esc(s.date)+'</span>'+
        '<span style="font-size:16px;font-weight:800;color:'+passColor+';">'+s.passRate+'%</span>'+
        '</div>'+
        '<div style="display:flex;gap:12px;font-size:12px;color:var(--text-3);margin-bottom:6px;">'+
        '<span>📝 '+s.totalSteps+'문장</span>'+
        '<span>⏱ 평균 '+s.avgTime+'초</span>'+
        '</div>'+
        '<div style="font-size:12px;color:var(--text-2);">'+esc(s.situation||'')+'</div>';
      // 상세 토글
      var detail=document.createElement('details');
      detail.style.marginTop='6px';
      var summary=document.createElement('summary');
      summary.style.cssText='font-size:12px;color:var(--accent-text);font-weight:700;cursor:pointer;';
      summary.textContent='문장별 결과 보기';
      detail.appendChild(summary);
      (s.steps||[]).forEach(function(step,j){
        var sr=document.createElement('div');
        sr.style.cssText='margin-top:6px;padding:6px 8px;background:var(--surface);border-radius:var(--r-sm);font-size:12px;';
        sr.innerHTML='<div style="font-weight:700;color:'+(step.pass?'var(--success-text)':'var(--danger-text)')+';">'+(j+1)+'. '+esc(step.stepKo||'')+'</div>'+
          '<div style="color:var(--text-3);margin-top:2px;">내 답변: '+esc(step.userAnswer||'(미응답)')+'</div>'+
          (step.ideal?'<div style="color:var(--accent-text);margin-top:2px;">이상적: '+esc(step.ideal)+'</div>':'');
        detail.appendChild(sr);
      });
      block.appendChild(detail);
      list.appendChild(block);
    });
  }
  $('bizHistoryModal').classList.add('show');
});
on('bizHistoryClose','click',function(){$('bizHistoryModal').classList.remove('show');});

/* ---------- 약점 분석 ---------- */
on('bizWeaknessBtn','click',function(){
  // 이전 분석 이력 (trends에서 biz_ prefix로 구분)
  var prev=$('bizWeaknessPrev');prev.innerHTML='';
  var bizTrends=trends.filter(function(t){return t.type==='biz_weakness';});
  if(bizTrends.length){
    bizTrends.slice(0,3).forEach(function(t){
      var block=document.createElement('div');
      block.style.cssText='background:var(--surface-2);border-radius:var(--r-md);padding:10px 12px;font-size:12px;';
      block.innerHTML='<div style="color:var(--text-3);font-weight:700;margin-bottom:4px;">'+esc(t.date)+'</div>'+
        '<div style="white-space:pre-wrap;line-height:1.6;color:var(--text-2);">'+esc(t.result)+'</div>';
      prev.appendChild(block);
    });
  } else {
    prev.innerHTML='<p class="muted">아직 분석 이력이 없어요</p>';
  }
  $('bizWeaknessResult').style.display='none';
  $('bizWeaknessModal').classList.add('show');
});
on('bizWeaknessClose','click',function(){$('bizWeaknessModal').classList.remove('show');});
on('bizWeaknessRunBtn','click',function(){
  if(!apiKey){alert('설정 탭에서 API 키를 먼저 입력해주세요.');return;}
  if(!bizSessions.length){alert('실전 테스트 이력이 없어요. 먼저 실전 테스트를 풀어보세요.');return;}
  $('bizWeaknessLoading').style.display='block';
  $('bizWeaknessResult').style.display='none';
  $('bizWeaknessRunBtn').disabled=true;

  // 최근 30세션의 오답 데이터 수집
  var failedSteps=[];
  bizSessions.slice(0,30).forEach(function(s){
    (s.steps||[]).forEach(function(step){
      if(!step.pass){
        failedSteps.push('상황: '+s.situation+'\n지시: '+step.stepKo+'\n내 답변: '+step.userAnswer+'\n피드백: '+step.feedback+'\n이상적: '+step.ideal);
      }
    });
  });

  var overallStats='총 '+bizSessions.length+'세션, 평균 정답률: '+
    Math.round(bizSessions.reduce(function(s,x){return s+x.passRate;},0)/bizSessions.length)+'%, '+
    '평균 입력시간: '+Math.round(bizSessions.reduce(function(s,x){return s+x.avgTime;},0)/bizSessions.length)+'초';

  var prompt='비즈니스 영어 코치입니다. 아래는 학습자의 실전 테스트 결과입니다.\n\n전체 통계: '+overallStats+'\n\n오답 사례:\n'+failedSteps.slice(0,20).join('\n---\n')+'\n\n분석 요청:\n1. 학습자의 약한 부분을 구체적으로 3~5가지 리스트로 정리해주세요\n2. 각 약점에 대한 실용적인 대처법을 1~2문장으로 붙여주세요\n3. 앞으로 테스트에서 특히 신경써야 할 포인트를 요약해주세요\n\n한국어로 답변해주세요.';

  openAICompatRequest(1200, [{role:'user',content:prompt}], null).then(function(r){return r.json();}).then(function(data){
    $('bizWeaknessLoading').style.display='none';$('bizWeaknessRunBtn').disabled=false;
    var result=(data.content&&data.content[0]&&data.content[0].text)||'(결과 없음)';
    $('bizWeaknessResult').style.display='block';
    $('bizWeaknessResult').textContent=result;
    // 이력 저장
    var date=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'});
    trends.unshift({type:'biz_weakness',date:date,result:result});
    if(trends.length>40)trends=trends.slice(0,40);
    saveTrends();
    // 이전 분석 목록 갱신
    var prev=$('bizWeaknessPrev');
    var block=document.createElement('div');
    block.style.cssText='background:var(--surface-2);border-radius:var(--r-md);padding:10px 12px;font-size:12px;';
    block.innerHTML='<div style="color:var(--text-3);font-weight:700;margin-bottom:4px;">'+esc(date)+' (방금)</div>'+
      '<div style="white-space:pre-wrap;line-height:1.6;color:var(--text-2);">'+esc(result)+'</div>';
    prev.insertBefore(block,prev.firstChild);
  }).catch(function(err){
    $('bizWeaknessLoading').style.display='none';$('bizWeaknessRunBtn').disabled=false;
    $('bizWeaknessResult').style.display='block';$('bizWeaknessResult').textContent='오류: '+err.message;
  });
});

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
on('checkUpdateBtn','click',function(){
  var status=$('checkUpdateStatus');
  status.textContent='확인 중...';status.style.color='var(--text-3)';
  if(!('serviceWorker' in navigator)){
    status.textContent='서비스워커를 지원하지 않는 환경이에요';return;
  }
  navigator.serviceWorker.getRegistration().then(function(reg){
    if(!reg){status.textContent='서비스워커가 없어요';return;}
    reg.update().then(function(){
      // update() 후 약간 기다렸다가 상태 확인
      setTimeout(function(){
        if(reg.waiting){
          showUpdateBanner(reg.waiting);
          status.textContent='새 버전이 있어요! 배너에서 업데이트하세요';
          status.style.color='var(--success-text)';
        } else if(reg.installing){
          status.textContent='새 버전 다운로드 중...';
          status.style.color='var(--warning)';
          reg.installing.addEventListener('statechange',function(e){
            if(e.target.state==='installed'&&navigator.serviceWorker.controller){
              showUpdateBanner(e.target);
              status.textContent='새 버전 준비됐어요! 배너에서 업데이트하세요';
              status.style.color='var(--success-text)';
            }
          });
        } else {
          status.textContent='✓ 현재 최신 버전이에요';
          status.style.color='var(--success-text)';
          setTimeout(function(){status.textContent='';},3000);
        }
      }, 500);
    }).catch(function(e){
      status.textContent='확인 실패: 네트워크를 확인해주세요';
      status.style.color='var(--danger-text)';
    });
  });
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
  openAICompatRequest(1000, [{role:'user',content:prompt}], null).then(function(r){return r.json();}).then(function(data){
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
  if($('nextBtn').style.display==='block'){e.preventDefault();loadNext();return;}
  if($('checkBtn').style.display==='block'){e.preventDefault();checkAnswer();return;}
});

/* 서비스워커 등록 + 업데이트 감지 */
if ('serviceWorker' in navigator) {
  function registerMemoryServiceWorker() {
    navigator.serviceWorker.register('./service-worker.js')
      .then(function(reg) {
        if (reg.waiting) showUpdateBanner(reg.waiting);

        reg.addEventListener('updatefound', function() {
          var newSW = reg.installing;
          if (!newSW) return;

          newSW.addEventListener('statechange', function() {
            if (
              newSW.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              showUpdateBanner(newSW);
            }
          });
        });
      })
      .catch(function(err) {
        console.warn(
          '[Memory] Service worker registration failed:',
          err
        );
      });
  }

  if (document.readyState === 'complete') {
    registerMemoryServiceWorker();
  } else {
    window.addEventListener(
      'load',
      registerMemoryServiceWorker,
      { once: true }
    );
  }

  var refreshing = false;
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    function() {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    }
  );
}
function showUpdateBanner(sw){
  var banner = $('updateBanner');
  if(!banner) return;
  banner.style.display = 'flex';

  $('updateBtn').onclick = function(){
    banner.style.display = 'none';
    sw.postMessage({type: 'SKIP_WAITING'});
  };
  $('updateDismiss').onclick = function(){
    banner.style.display = 'none';
  };
}

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
renderChapterSelector();renderBizChapterSelector();refreshAddSelects();renderAcFilter();
refreshSetupInfo();renderAllCards();
})();
