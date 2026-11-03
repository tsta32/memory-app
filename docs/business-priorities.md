# 영어업무(일반) 필수 표현 선정 기준 및 커버리지

## 선정 기준

1. 실제 직장에서 자주 사용되는가?
2. 대체하기 어려울 만큼 중요하며, 없으면 업무 진행에 영향이 있는가?
3. 하나의 표현으로 여러 업무 상황에 대응할 수 있는가?
4. 표현을 모르면 업무 진행이나 조율이 실질적으로 어려워지는가?
5. 기존 필수 표현과 의사소통 목적이 중복되지 않는가?
6. 업무 시작부터 완료까지 전체 과정을 균형 있게 다루는가?

기준을 바꾸면 `business-priorities.js`의 구조화 데이터, 이 문서, `tests/business-priorities.test.js`를 함께 수정한다. 필수 수는 고정하지 않는다. 빈도만으로 겹치는 표현을 여러 개 선정하지 않고, 업무 시작부터 결과 전달까지의 의사소통 목적을 비교한다.

기본 템플릿 평가: 필수 40개 / 중요 127개 / 보조 33개. 실제 설정 화면의 수와 목록은 매번 현재 앱 카드 데이터를 기준으로 계산한다. 사용자별 카드 수와 등급은 이 정적 문서로 대체하지 않는다.

## 필수 표현 및 선정 이유

|원본 번호|영어|문맥|업무 영역|선정 이유|
|---:|---|---|---|---|
|1|Are you available to talk now?|현재대화 가능여부확인|기본 대화·의사소통|대화 시작 전 상대의 여유를 확인하며 통화·방문·즉석 문의에 두루 쓰이므로 특정 주간 가능 여부(94)보다 대표성이 높다.|
|9|Please wait a moment.|잠시대기 요청|기본 대화·의사소통|확인·준비·연결 등 여러 이유로 잠시 기다려 달라고 할 수 있어 특정 조치를 약속하는 표현보다 넓게 재사용된다.|
|11|Could you say that again?|상대발언 반복요청|기본 대화·의사소통|못 듣거나 놓친 말을 복구하는 직접적인 요청으로 원인 설명(5·6)만으로 해결되지 않는 의사소통을 회복한다.|
|12|Could you speak a little more slowly?|발화속도 감속요청|기본 대화·의사소통|발화를 다시 듣는 것(11)과 달리 이후 설명의 속도를 바꿔 달라는 요청이며 통화·교육·회의에 두루 적용된다.|
|29|Do you have any questions?|질문사항 유무확인|기본 대화·의사소통|설명 뒤 질문을 받는 직접적이고 폭넓은 표현으로 중간 점검(61)·자유 질문(66)·비동기 문의(151)를 포괄하는 기본형이다.|
|31|What do you think?|업무방안 의견질문|의견 교환·의사결정|대안·계획·결과물에 대한 상대의 견해를 직접 물으며 회의용 comments 질문(30)보다 대화·협업 전반에 쓰기 쉽다.|
|33|Sorry to interrupt.|발언중단 사과표현|감사·사과|끼어들며 예의를 표시하는 관용적 문구로 회의·통화·상담에서 쓰며 허락 질문(34)보다 즉시 발언에 연결하기 쉽다.|
|35|I want to make sure I understood correctly.|상대설명 이해확인|기본 대화·의사소통|상대의 설명을 정확히 이해했는지 점검하겠다는 목적을 명확히 하며 미완성 인용형(36)보다 독립적으로 쓸 수 있다.|
|38|Could you explain that part a little more?|해당부분 추가설명요청|기본 대화·의사소통|이해되지 않은 부분을 더 설명해 달라고 직접 요청하며 예시 요청(39)처럼 설명 방식을 한 가지로 제한하지 않는다.|
|40|I'm not sure about that yet.|해당사항 불확실성표명|의견 교환·의사결정|근거·계획·판단에 아직 확신이 없음을 유보적으로 말할 수 있어 원인 미확정(164) 등 특정 대상 보고보다 넓다.|
|41|I’ll check and reply.|문의내용 확인후회신|진행 상황 보고|즉답 대신 확인과 후속 회신을 함께 약속해 대화·메시지·이메일을 연결하며 거의 같은 120과 일정 한정형 107 대신 대표로 삼는다.|
|42|I agree with that.|상대의견 동의표현|의견 교환·의사결정|의견·판단에 동의한다는 입장을 직접 전달하며 아이디어 칭찬(43)보다 평가 대상을 넓게 잡을 수 있다.|
|45|We could consider another option.|다른대안 검토제안|의견 교환·의사결정|기존 방안을 단정적으로 거부하지 않고 다른 선택지도 검토하자고 제안해 일정·기술·절차 등 다양한 논의에 적용된다.|
|57|Who is responsible for this?|업무책임자 질문|업무 지시·협업|사안의 담당자를 물어 업무 연결점을 찾으며 this task로 대상을 좁힌 중복 표현(182)보다 다양한 대상에 쓰기 쉽다.|
|58|When do we need to finish this?|업무기한 질문|일정·기한 조정|업무를 언제까지 끝내야 하는지 묻는 핵심 질문으로 자료 발송 시점(137)보다 범위가 넓다.|
|75|Let me briefly summarize this.|해당내용 간략요약예고|회의 진행, 완료·결과 보고|논의·문서·설명 내용을 간단히 정리할 때 쓰며 전송 약속까지 포함하는 50보다 즉석 대화에서 범용적이다.|
|80|Let’s end here for today.|오늘논의 종료제안|회의 진행|회의뿐 아니라 작업 논의·면담을 오늘 여기서 마칠 때 쓰며 거의 같은 49와 회의 한정형 54 대신 대표로 삼는다.|
|81|Could we adjust the schedule?|업무일정 변경제안|일정·기한 조정|회의·납기·작업 일정의 변경 가능성을 폭넓게 물으며 구체적 이동 방향이나 분량을 고정하지 않는다.|
|82|That time works for me.|제안시간 수락표현|일정·기한 조정|상대가 제안한 시간을 수락하는 관용적인 회신으로 단순 시작 준비 질문과 다르고, 반대 의사인 83으로 대체할 수 없다.|
|83|That time doesn't work for me.|제안시간 불가표현|일정·기한 조정|제안한 시간을 받아들일 수 없음을 이유를 꾸미지 않고 전달한다. 충돌 이유를 단정하는 105·106보다 넓고 수락(82)과는 반대 목적이다.|
|95|What time works best for you?|최적시간 질문|일정·기한 조정|상대에게 가장 편한 시간을 개방적으로 물어 일정 조율을 시작하며 새 시간(92)·여러 후보(96)로 답을 제한하지 않는다.|
|112|I've attached the file.|업무파일 첨부완료알림|자료·이메일, 완료·결과 보고|업무 파일 전달에서 첨부 사실을 간결하게 명시하는 관용적 안내로 수정본(132) 등 상태를 덧붙인 변형보다 기본형이다.|
|114|I can't open the file.|파일열기 불가알림|자료·이메일, 문제 발생·해결|문서·견적·보고서 등 받은 파일을 사용할 수 없음을 직접 알려 조치를 유도하며 링크·편집 권한 한정형보다 기본적인 장애 보고다.|
|122|Please review it and share your comments.|검토의견 공유요청|자료·이메일|문서·기획안·작업물을 검토하고 의견을 달라는 행동과 결과를 함께 요청하며 첨부·문서 위치를 고정하는 변형보다 넓다.|
|142|I've updated the file.|업무파일 갱신완료알림|자료·이메일, 완료·결과 보고|수정한 파일 상태를 명시해 자료 작업의 완료와 전달 여부를 상대가 판단하게 한다. 파일 자체의 변경 완료는 다른 업무 전반에 쓰이는 진행 알림과 구별되며, 다음 조치에 필요한 산출물 상태를 직접 보고한다.|
|154|Thank you for your help.|업무도움 감사표현|감사·사과|상대의 도움에 감사를 표하며 협조·문제 해결·지원에 두루 쓰이므로 시간·참석·확인 등 사유별 감사 대신 대표로 삼는다.|
|156|Sorry for the inconvenience.|불편초래 사과표현|감사·사과|문제 처리·지연·실수로 끼친 불편에 폭넓게 사과하며 회신 지연(118)·혼란(157) 등 사유별 문구보다 일반적인 대표다.|
|159|I’ll revise it and send it again.|해당자료 수정후재전송약속|자료·이메일, 문제 발생·해결, 완료·결과 보고|문서·계획·요청 등을 고쳐 다시 보내겠다는 복구 행동을 약속하며 재심사를 전제하는 197보다 전달 대상과 절차가 넓다.|
|163|I’m investigating the cause.|문제원인 조사중보고|문제 발생·해결|문제가 발생한 뒤 원인을 조사 중이라고 알리면 상대의 해결 기대와 후속 대응을 조율할 수 있다. 원인을 아직 단정하지 않으면서 문제 대응의 핵심 단계를 분명히 보고하는 표현이다.|
|165|It's taking longer than expected.|업무진행 지연보고|진행 상황 보고|작업·검토·승인 등이 예상보다 오래 걸림을 과도한 사유 단정 없이 알리며 일정 지연(166)·오늘 미완료(170)보다 넓다.|
|167|So far, the work is progressing as planned.|현재업무 계획대로진행보고|진행 상황 보고|업무가 계획대로 진행 중이라는 상태를 간결하게 알려 일정 점검과 협업자의 판단을 돕는다. 진행 정상 여부는 단순 업데이트 약속이나 지연 통보로 대체되지 않는 대표적인 상태 보고다.|
|170|I may not be able to finish today.|오늘완료 불가가능성알림|진행 상황 보고|오늘 끝내지 못할 가능성을 미리 알려 마감 기대와 대체 계획을 조정하게 한다. 이미 발생한 일반 지연 보고와 달리 완료 전 위험을 앞서 알리는 목적이 뚜렷하다.|
|171|Could we extend the deadline?|업무기한 연장요청|일정·기한 조정|지연 사실을 알리는 것(165)과 달리 마감일 변경이라는 상대의 조치를 직접 요청해 작업·검토·제출에 두루 쓰인다.|
|172|I’ll provide an update.|업무진행 후속보고|진행 상황 보고|특정 사건을 고정하지 않고 업무 현황을 알려주겠다고 약속하며 일정·완료·결정 알림(97·175·198)보다 대상이 넓다.|
|181|I'd like to set the order of the tasks.|작업순서 설정의향|의견 교환·의사결정|여러 업무의 처리 순서를 정하겠다는 의사를 전달하는 표현이다.|
|184|Could you handle this task?|업무담당 요청|업무 지시·협업|상대에게 업무를 맡아줄 수 있는지 정중히 요청하며 잠깐 도움 요청(186)과 달리 일의 수행 책임을 부탁한다.|
|186|Could you help me for a moment?|업무지원 요청|기본 대화·의사소통, 업무 지시·협업|동료에게 잠시 도와 달라고 직접 정중히 요청해 다양한 문제 해결에 쓸 수 있으며 필요 상태만 말하는 185 대신 대표로 삼는다.|
|189|Can we proceed with this method?|해당방법 진행가능여부확인|의견 교환·의사결정|업무 방안대로 진행해도 되는지 상대의 동의를 확인하며 단순 진행 선언(190)과 달리 허락·합의가 필요한 시점에 쓰인다.|
|194|Could you approve this?|업무내용 승인요청|업무 지시·협업|상대에게 승인을 직접 요청하는 기본형으로 필요성 안내(193)·결과 보고(195·196)와 달리 다음 업무를 가능하게 하는 행동을 구한다.|
|200|I’ll forward this to the person responsible.|해당내용 담당자전달약속|업무 지시·협업|직접 처리할 수 없는 문의·요청·자료를 담당자에게 연결하겠다는 건설적인 약속으로 단순 담당 부인(199)보다 다음 행동을 명확히 한다.|

## 업무 상황 커버리지

각 표현은 여러 영역에 중복 분류될 수 있다. 영역별 수는 해당 영역에 등록된 필수 표현의 수이며, 전체 필수 수는 카드 ID 기준으로 중복 없이 센다. 앱에서는 현재 카드의 영어·한국어·문맥·등급을 실시간으로 사용한다. 영어가 원본과 달라 구조화 분류를 그대로 적용할 수 없거나 분류 근거가 없으면 `분류 검토 필요`로 표시한다.

|영역|표현 수|등록된 필수 표현|미커버 목적|
|---|---:|---|---|
|기본 대화·의사소통|8|1. Are you available to talk now?<br>9. Please wait a moment.<br>11. Could you say that again?<br>12. Could you speak a little more slowly?<br>29. Do you have any questions?<br>35. I want to make sure I understood correctly.<br>38. Could you explain that part a little more?<br>186. Could you help me for a moment?|등록 목적 모두 커버|
|회의 진행|2|75. Let me briefly summarize this.<br>80. Let’s end here for today.|회의 시작 · 안건·항목 전환|
|의견 교환·의사결정|6|31. What do you think?<br>40. I'm not sure about that yet.<br>42. I agree with that.<br>45. We could consider another option.<br>181. I'd like to set the order of the tasks.<br>189. Can we proceed with this method?|등록 목적 모두 커버|
|일정·기한 조정|6|58. When do we need to finish this?<br>81. Could we adjust the schedule?<br>82. That time works for me.<br>83. That time doesn't work for me.<br>95. What time works best for you?<br>171. Could we extend the deadline?|등록 목적 모두 커버|
|자료·이메일|5|112. I've attached the file.<br>114. I can't open the file.<br>122. Please review it and share your comments.<br>142. I've updated the file.<br>159. I’ll revise it and send it again.|이메일 수신 확인|
|업무 지시·협업|5|57. Who is responsible for this?<br>184. Could you handle this task?<br>186. Could you help me for a moment?<br>194. Could you approve this?<br>200. I’ll forward this to the person responsible.|등록 목적 모두 커버|
|진행 상황 보고|5|41. I’ll check and reply.<br>165. It's taking longer than expected.<br>167. So far, the work is progressing as planned.<br>170. I may not be able to finish today.<br>172. I’ll provide an update.|등록 목적 모두 커버|
|문제 발생·해결|3|114. I can't open the file.<br>159. I’ll revise it and send it again.<br>163. I’m investigating the cause.|문제 해결 조치 요청|
|완료·결과 보고|4|75. Let me briefly summarize this.<br>112. I've attached the file.<br>142. I've updated the file.<br>159. I’ll revise it and send it again.|일반 업무 완료 보고|
|감사·사과|3|33. Sorry to interrupt.<br>154. Thank you for your help.<br>156. Sorry for the inconvenience.|등록 목적 모두 커버|

## 검토한 승격·강등

승격: 142 `I've updated the file.` (자료 수정 완료와 결과 상태 보고), 163 `I'm investigating the cause.` (원인 조사 상태 보고), 167 `So far, the work is progressing as planned.` (정상 진행 보고), 170 `I may not be able to finish today.` (당일 완료 위험 사전 보고).

강등: 13 `Could you share your screen?` (온라인 화면 공유에 한정), 27 `Let's move to the next item.` (회의 안건 전환에 한정), 37 `Did I miss anything?` (누락 점검에 유용하지만 질문·검토 표현으로 대체 가능).

중요 등급 유지: 150 추가 정보 제공 제안은 유용하나 질문 기회 제공과 겹치고 특정 후속 안내에 가까움. 78 확인 약속은 필수 41의 회신 약속보다 범위가 좁음. 174 완료 임박 알림은 완료 보고가 아닌 부분 진행 상태. 117 이메일 수신 확인은 채널 한정. 12 속도 조정 요청은 반복 요청과 다른 접근성 목적. 80 오늘 논의 종료는 회의뿐 아니라 대화 종료에도 적용되어 유지.

## 데이터 및 개발 규칙

- 등급 선정 이유, 업무 영역, 목적 분류는 `business-priorities.js`에 구조화한다. 설명 텍스트를 앱 화면에 복사해 고정하지 않는다.
- 설정 페이지는 현재 `cards` 및 `chapters` 상태를 읽어 매 렌더마다 개수·목록·업무 커버리지를 계산한다. 등급·영어·문맥 수정, 카드 추가·삭제 후 다시 렌더링한다.
- 사용자 문장·등급·학습 데이터는 템플릿 기본값보다 우선한다. 이전 템플릿 기준값과 같은 미수정 필드만 기본값 갱신을 받을 수 있다. 영어·한국어를 직접 고친 카드의 우선순위 기본값 갱신은 유보해 사용자의 표현 의미를 이전 템플릿 평가로 덮지 않는다.
- 신규 필수 카드에 선정 이유/영역/목적 구조가 없으면 이를 추론하지 않고 `분류 검토 필요`로 둔다.
- 선정 기준 변경 시 이 문서, `business-priorities.js`의 `selectionCriteria`, 자동 계산 테스트를 같은 변경에 포함한다.
- SRS, 오답 기록, 통계, 카드 ID 및 진행 중 세션은 우선순위 메타데이터 변경으로 초기화하거나 변경하지 않는다.
