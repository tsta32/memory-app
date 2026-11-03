/* Authored, persistent prompts for all 200 general business templates. */
(function(root){
'use strict';
var items=[
  {
    "en": "Are you available to talk now?",
    "context": "현재대화 가능여부질문"
  },
  {
    "en": "Can you see my screen?",
    "context": "공유화면 표시확인"
  },
  {
    "en": "Can you see the materials?",
    "context": "제시자료 표시확인"
  },
  {
    "en": "Can you hear me?",
    "context": "내음성 수신확인"
  },
  {
    "en": "I can't hear you well.",
    "context": "상대음성 청취불량알림"
  },
  {
    "en": "Your audio keeps cutting out.",
    "context": "상대음성 반복끊김알림"
  },
  {
    "en": "I think your microphone is muted.",
    "context": "상대마이크 음소거추정알림"
  },
  {
    "en": "Your camera is off.",
    "context": "상대카메라 꺼짐알림"
  },
  {
    "en": "Please wait a moment.",
    "context": "잠시대기 요청"
  },
  {
    "en": "I’ll reconnect.",
    "context": "접속연결 재접속예고"
  },
  {
    "en": "Could you say that again?",
    "context": "상대발언 반복요청"
  },
  {
    "en": "Could you speak a little more slowly?",
    "context": "발화속도 감속요청"
  },
  {
    "en": "Could you share your screen?",
    "context": "상대화면 공유요청"
  },
  {
    "en": "I'll share my screen.",
    "context": "내화면 공유예고"
  },
  {
    "en": "I'll send the link in the chat.",
    "context": "채팅링크 전송예고"
  },
  {
    "en": "I left a message in the chat.",
    "context": "채팅메시지 작성완료알림"
  },
  {
    "en": "My connection is unstable.",
    "context": "내접속 불안정알림"
  },
  {
    "en": "Can I start?",
    "context": "진행시작 허락요청"
  },
  {
    "en": "Is everyone here?",
    "context": "참석인원 전원도착확인"
  },
  {
    "en": "Are we ready to start?",
    "context": "시작준비 완료여부확인"
  },
  {
    "en": "Thank you for your time.",
    "context": "시간할애 감사표현"
  },
  {
    "en": "Let’s begin today’s meeting.",
    "context": "오늘회의 시작제안"
  },
  {
    "en": "Let’s review today’s agenda first.",
    "context": "오늘안건 우선검토제안"
  },
  {
    "en": "I'll share the progress first.",
    "context": "업무진행 우선공유예고"
  },
  {
    "en": "I'll briefly explain the background first.",
    "context": "관련배경 우선간략설명예고"
  },
  {
    "en": "There are two key points.",
    "context": "핵심사항 두가지안내"
  },
  {
    "en": "Let’s move to the next item.",
    "context": "다음안건 전환제안"
  },
  {
    "en": "Let’s discuss this part later.",
    "context": "해당부분 추후논의제안"
  },
  {
    "en": "Do you have any questions?",
    "context": "질문사항 유무확인"
  },
  {
    "en": "Do you have any comments?",
    "context": "의견사항 유무질문"
  },
  {
    "en": "What do you think?",
    "context": "업무방안 의견질문"
  },
  {
    "en": "Can I add one thing?",
    "context": "추가발언 허락요청"
  },
  {
    "en": "Sorry to interrupt.",
    "context": "발언중단 사과표현"
  },
  {
    "en": "May I interrupt for a moment?",
    "context": "잠시개입 허락요청"
  },
  {
    "en": "I want to make sure I understood correctly.",
    "context": "이해내용 정확성확인의향"
  },
  {
    "en": "So, do you mean that...?",
    "context": "상대발언 의미확인"
  },
  {
    "en": "Did I miss anything?",
    "context": "누락사항 확인질문"
  },
  {
    "en": "Could you explain that part a little more?",
    "context": "해당부분 추가설명요청"
  },
  {
    "en": "Could you give an example?",
    "context": "설명예시 요청"
  },
  {
    "en": "I'm not sure about that yet.",
    "context": "해당사항 확신유보표현"
  },
  {
    "en": "I’ll check and reply.",
    "context": "문의내용 확인후회신"
  },
  {
    "en": "I agree with that.",
    "context": "상대의견 동의표현"
  },
  {
    "en": "I think that's a good idea.",
    "context": "상대제안 긍정평가"
  },
  {
    "en": "We need to verify that point.",
    "context": "해당사항 검증필요안내"
  },
  {
    "en": "We could consider another option.",
    "context": "다른대안 검토제안"
  },
  {
    "en": "It may be difficult to decide now.",
    "context": "즉시결정 어려움예상"
  },
  {
    "en": "We’re nearly out of time.",
    "context": "남은시간 소진임박알림"
  },
  {
    "en": "I'll take one last question.",
    "context": "마지막질문 하나접수예고"
  },
  {
    "en": "Let's stop here for today.",
    "context": "오늘논의 중단제안"
  },
  {
    "en": "I’ll summarize the discussion and send it.",
    "context": "논의내용 요약전송약속"
  },
  {
    "en": "I'll share the meeting notes.",
    "context": "회의기록 공유예고"
  },
  {
    "en": "Let's set the next meeting.",
    "context": "다음회의 일정설정제안"
  },
  {
    "en": "Thank you for joining.",
    "context": "회의참여 감사표현"
  },
  {
    "en": "Let’s conclude the meeting.",
    "context": "회의진행 종료제안"
  },
  {
    "en": "I'll check this after the meeting.",
    "context": "해당사항 회의후확인약속"
  },
  {
    "en": "I’ll clarify who is responsible and the deadline.",
    "context": "담당자·기한 명확화약속"
  },
  {
    "en": "Who is responsible for this?",
    "context": "업무책임자 질문"
  },
  {
    "en": "When do we need to finish this?",
    "context": "업무기한 질문"
  },
  {
    "en": "I'll check after the meeting.",
    "context": "확인사항 회의후확인약속"
  },
  {
    "en": "We'll discuss this separately.",
    "context": "해당사안 별도논의예고"
  },
  {
    "en": "Any questions so far?",
    "context": "현재까지내용 질문유무확인"
  },
  {
    "en": "Let’s move to the next slide.",
    "context": "다음슬라이드 전환제안"
  },
  {
    "en": "You can see it in this document.",
    "context": "해당문서 내용확인안내"
  },
  {
    "en": "This is the key point for today.",
    "context": "오늘핵심 강조표현"
  },
  {
    "en": "That concludes my presentation.",
    "context": "내발표 종료알림"
  },
  {
    "en": "Please feel free to ask questions.",
    "context": "자유질문 권유"
  },
  {
    "en": "I'll share the presentation slides.",
    "context": "발표슬라이드 공유예고"
  },
  {
    "en": "I’ll explain this part again later.",
    "context": "해당부분 추후재설명약속"
  },
  {
    "en": "I’ll pause the screen sharing for a moment.",
    "context": "화면공유 일시중단예고"
  },
  {
    "en": "Please let me know if you can't see the screen.",
    "context": "화면미표시 알림요청"
  },
  {
    "en": "Feel free to ask questions while I speak.",
    "context": "발표도중 자유질문권유"
  },
  {
    "en": "Was that clear?",
    "context": "설명내용 명확성확인"
  },
  {
    "en": "Is any part unclear?",
    "context": "불명확부분 유무질문"
  },
  {
    "en": "We’re short on time, so let’s move on.",
    "context": "시간부족 다음진행제안"
  },
  {
    "en": "Let me briefly summarize this.",
    "context": "해당내용 간략요약예고"
  },
  {
    "en": "Here is my understanding.",
    "context": "내이해내용 제시"
  },
  {
    "en": "Please let me know if I misunderstood.",
    "context": "오해사항 알림요청"
  },
  {
    "en": "I'll check that.",
    "context": "해당사항 확인약속"
  },
  {
    "en": "I'll answer that after the meeting.",
    "context": "받은질문 회의후답변약속"
  },
  {
    "en": "Let’s end here for today.",
    "context": "오늘논의 종료제안"
  },
  {
    "en": "Could we adjust the schedule?",
    "context": "업무일정 변경제안"
  },
  {
    "en": "That time works for me.",
    "context": "제안시간 수락표현"
  },
  {
    "en": "That time doesn't work for me.",
    "context": "제안시간 불가표현"
  },
  {
    "en": "How about another time?",
    "context": "다른시간 제안"
  },
  {
    "en": "Could we start a little later?",
    "context": "시작시각 소폭연기요청"
  },
  {
    "en": "Could we postpone the meeting by 30 minutes?",
    "context": "회의시각 30분연기요청"
  },
  {
    "en": "Could we move the meeting to an earlier time?",
    "context": "회의시각 앞당김요청"
  },
  {
    "en": "We may need to revise the schedule.",
    "context": "업무일정 수정가능성안내"
  },
  {
    "en": "I’ll send a meeting invitation.",
    "context": "회의초대 발송예고"
  },
  {
    "en": "Please check the calendar invite.",
    "context": "캘린더초대 확인요청"
  },
  {
    "en": "I didn't receive the invite.",
    "context": "회의초대 미수신알림"
  },
  {
    "en": "Could you propose a new time?",
    "context": "새시간 제안요청"
  },
  {
    "en": "How about the same time tomorrow?",
    "context": "내일동일시간 제안"
  },
  {
    "en": "Would you be available this week?",
    "context": "이번주 시간가능여부질문"
  },
  {
    "en": "What time works best for you?",
    "context": "최적시간 질문"
  },
  {
    "en": "Please tell me which times work for you.",
    "context": "가능시간 알림요청"
  },
  {
    "en": "I’ll notify you once the schedule is confirmed.",
    "context": "업무일정 확정후통보약속"
  },
  {
    "en": "We may need to cancel the meeting.",
    "context": "회의취소 필요가능성안내"
  },
  {
    "en": "Could we move the meeting to next week?",
    "context": "회의일정 다음주변경요청"
  },
  {
    "en": "Please let me know if you can't attend.",
    "context": "참석불가 알림요청"
  },
  {
    "en": "I'll attend instead.",
    "context": "대신참석 의사표현"
  },
  {
    "en": "I’ll verify the meeting time.",
    "context": "회의시각 확인약속"
  },
  {
    "en": "I've added the meeting link to the invite.",
    "context": "초대링크 추가완료알림"
  },
  {
    "en": "The time has changed.",
    "context": "예정시간 변경알림"
  },
  {
    "en": "I have a scheduling conflict.",
    "context": "업무일정 중복알림"
  },
  {
    "en": "I have another meeting at that time.",
    "context": "동일시간 다른회의알림"
  },
  {
    "en": "I’ll check my schedule and reply.",
    "context": "업무일정 확인후회신약속"
  },
  {
    "en": "I’ll reply as soon as possible.",
    "context": "업무연락 신속회신약속"
  },
  {
    "en": "I've sent you an email.",
    "context": "이메일 발송완료알림"
  },
  {
    "en": "Please check your email.",
    "context": "이메일 확인요청"
  },
  {
    "en": "Please check the attached file.",
    "context": "첨부파일 확인요청"
  },
  {
    "en": "I've attached the file.",
    "context": "업무파일 첨부완료알림"
  },
  {
    "en": "I'll send the file again.",
    "context": "업무파일 재전송약속"
  },
  {
    "en": "I can't open the file.",
    "context": "파일열기 불가알림"
  },
  {
    "en": "I didn’t receive the attachment.",
    "context": "첨부파일 미수신알림"
  },
  {
    "en": "Could you attach the file again?",
    "context": "업무파일 재첨부요청"
  },
  {
    "en": "Could you confirm that you received my email?",
    "context": "내이메일 수신확인요청"
  },
  {
    "en": "Sorry for the late reply.",
    "context": "회신지연 사과표현"
  },
  {
    "en": "Thank you for your patience.",
    "context": "기다림 감사표현"
  },
  {
    "en": "I’ll reply after I check.",
    "context": "문의내용 확인후회신"
  },
  {
    "en": "Please reply when you can.",
    "context": "가능시점 회신요청"
  },
  {
    "en": "Please review it and share your comments.",
    "context": "검토의견 공유요청"
  },
  {
    "en": "I’m sending this for reference.",
    "context": "전송자료 참고목적안내"
  },
  {
    "en": "Could you forward this to the relevant people?",
    "context": "관련자 전달요청"
  },
  {
    "en": "Please reply to this email.",
    "context": "현재이메일 회신요청"
  },
  {
    "en": "I've updated the email subject.",
    "context": "이메일제목 수정완료알림"
  },
  {
    "en": "Please refer to my previous email.",
    "context": "이전이메일 참고요청"
  },
  {
    "en": "Please review the details below.",
    "context": "아래세부내용 검토요청"
  },
  {
    "en": "Please review the attached file for details.",
    "context": "첨부파일 세부내용검토요청"
  },
  {
    "en": "This is for internal review.",
    "context": "내부검토 용도안내"
  },
  {
    "en": "I'm sending the final version.",
    "context": "최종본 전송알림"
  },
  {
    "en": "I’ve attached the revised file.",
    "context": "수정파일 첨부완료알림"
  },
  {
    "en": "I’ve highlighted the changes.",
    "context": "변경사항 강조표시알림"
  },
  {
    "en": "Please check the file name.",
    "context": "파일이름 확인요청"
  },
  {
    "en": "Would you like me to send it in another format?",
    "context": "다른파일형식 전송희망여부질문"
  },
  {
    "en": "What format do you need?",
    "context": "필요파일형식 질문"
  },
  {
    "en": "When should I send the materials?",
    "context": "자료전송 시점질문"
  },
  {
    "en": "I’ll send it by the end of today.",
    "context": "자료전송 오늘내약속"
  },
  {
    "en": "I’ll send it by tomorrow.",
    "context": "자료전송 내일까지약속"
  },
  {
    "en": "I'm preparing the materials.",
    "context": "자료준비 진행보고"
  },
  {
    "en": "The materials aren't ready yet.",
    "context": "자료준비 미완료알림"
  },
  {
    "en": "I've updated the file.",
    "context": "업무파일 갱신완료알림"
  },
  {
    "en": "I'll send the link again.",
    "context": "업무링크 재전송약속"
  },
  {
    "en": "I can't access the link.",
    "context": "링크접속 불가알림"
  },
  {
    "en": "Could you verify the access permissions?",
    "context": "접근권한 확인요청"
  },
  {
    "en": "I can't edit this document.",
    "context": "문서편집 불가알림"
  },
  {
    "en": "Please leave your comments in the document.",
    "context": "문서의견 작성요청"
  },
  {
    "en": "Please check the revised parts.",
    "context": "수정부분 확인요청"
  },
  {
    "en": "I’ve incorporated your feedback.",
    "context": "상대피드백 반영완료알림"
  },
  {
    "en": "Please let me know if you need more information.",
    "context": "추가정보 필요시알림요청"
  },
  {
    "en": "Please let me know if you have any questions.",
    "context": "질문사항 발생시알림요청"
  },
  {
    "en": "Thank you for checking.",
    "context": "내용확인 감사표현"
  },
  {
    "en": "Thank you for your quick reply.",
    "context": "신속회신 감사표현"
  },
  {
    "en": "Thank you for your help.",
    "context": "업무도움 감사표현"
  },
  {
    "en": "Thank you for informing me.",
    "context": "정보전달 감사표현"
  },
  {
    "en": "Sorry for the inconvenience.",
    "context": "불편초래 사과표현"
  },
  {
    "en": "Sorry for the confusion.",
    "context": "혼란초래 사과표현"
  },
  {
    "en": "I sent the wrong file.",
    "context": "파일오전송 실수보고"
  },
  {
    "en": "I’ll revise it and send it again.",
    "context": "해당자료 수정후재전송약속"
  },
  {
    "en": "I’m sorry I missed that.",
    "context": "사항누락 사과표현"
  },
  {
    "en": "I’ll be more careful next time.",
    "context": "다음기회 주의약속"
  },
  {
    "en": "I'm checking the issue.",
    "context": "발생문제 확인중보고"
  },
  {
    "en": "I’m investigating the cause.",
    "context": "문제원인 조사중보고"
  },
  {
    "en": "I haven’t determined the exact cause yet.",
    "context": "정확한원인 미파악보고"
  },
  {
    "en": "It's taking longer than expected.",
    "context": "업무진행 지연보고"
  },
  {
    "en": "The schedule is slightly behind.",
    "context": "업무일정 소폭지연보고"
  },
  {
    "en": "So far, the work is progressing as planned.",
    "context": "현재업무 계획대로진행보고"
  },
  {
    "en": "The expected completion date is Friday.",
    "context": "예상완료일 금요일안내"
  },
  {
    "en": "I need one more day to complete it.",
    "context": "업무완료 하루추가필요안내"
  },
  {
    "en": "I may not be able to finish today.",
    "context": "오늘완료 불가가능성알림"
  },
  {
    "en": "Could we extend the deadline?",
    "context": "업무기한 연장요청"
  },
  {
    "en": "I’ll provide an update.",
    "context": "진행상황 갱신공유약속"
  },
  {
    "en": "I've completed about half of it.",
    "context": "업무진행 절반완료보고"
  },
  {
    "en": "It's almost done.",
    "context": "업무완료 임박보고"
  },
  {
    "en": "I’ll notify you as soon as it’s complete.",
    "context": "업무완료 즉시통보약속"
  },
  {
    "en": "The review isn't finished yet.",
    "context": "업무검토 미완료보고"
  },
  {
    "en": "We need to verify a few more things.",
    "context": "추가사항 확인필요안내"
  },
  {
    "en": "We need to review this part again.",
    "context": "해당부분 재검토필요안내"
  },
  {
    "en": "The next step is testing.",
    "context": "다음단계 테스트안내"
  },
  {
    "en": "I’ll prioritize this task.",
    "context": "해당업무 우선처리약속"
  },
  {
    "en": "I'd like to set the order of the tasks.",
    "context": "작업순서 결정희망"
  },
  {
    "en": "Who is responsible for this task?",
    "context": "업무담당자 질문"
  },
  {
    "en": "I’ll take responsibility for this task.",
    "context": "해당업무 책임수락"
  },
  {
    "en": "Could you handle this task?",
    "context": "업무담당 요청"
  },
  {
    "en": "I need some help.",
    "context": "업무지원 필요표현"
  },
  {
    "en": "Could you help me for a moment?",
    "context": "업무지원 요청"
  },
  {
    "en": "I’d like your advice.",
    "context": "상대조언 요청"
  },
  {
    "en": "Is there anything I've missed?",
    "context": "누락사항 유무질문"
  },
  {
    "en": "Can we proceed with this method?",
    "context": "해당방법 진행가능여부확인"
  },
  {
    "en": "I’ll proceed with this approach.",
    "context": "해당방식 진행예고"
  },
  {
    "en": "I’ll make a decision after an internal review.",
    "context": "업무결정 내부검토후결정약속"
  },
  {
    "en": "I’ll confirm this with the person responsible.",
    "context": "해당사항 담당자확인약속"
  },
  {
    "en": "We need approval.",
    "context": "업무승인 필요안내"
  },
  {
    "en": "Could you approve this?",
    "context": "업무내용 승인요청"
  },
  {
    "en": "The request has been approved.",
    "context": "제출요청 승인완료알림"
  },
  {
    "en": "I haven't received approval yet.",
    "context": "업무승인 미수령알림"
  },
  {
    "en": "I’ll revise it and resubmit it.",
    "context": "제출자료 수정후재제출약속"
  },
  {
    "en": "I’ll notify you as soon as a decision is made.",
    "context": "결정결과 즉시통보약속"
  },
  {
    "en": "This isn't my area of responsibility.",
    "context": "담당영역 해당없음안내"
  },
  {
    "en": "I’ll forward this to the person responsible.",
    "context": "해당내용 담당자전달약속"
  }
];
// Exact previously shipped defaults are the only existing strings eligible for migration.
var previousContexts=[
  "동료와 업무 이야기를 시작하기 전에 지금 대화할 여유가 있는지 물으려고 할 때.",
  "온라인 회의에서 공유 중인 내 화면이 상대방에게 보이는지 확인하려고 할 때.",
  "회의에서 제시한 자료가 상대방에게 보이는지 확인하려고 할 때.",
  "온라인 회의를 시작하며 내 목소리가 상대방에게 들리는지 확인하려고 할 때.",
  "통화 중 상대방의 목소리가 잘 들리지 않는다고 알리려고 할 때.",
  "온라인 회의 중 상대방의 음성이 반복해서 끊긴다고 알려주려고 할 때.",
  "상대방이 말하는데 소리가 들리지 않아 마이크가 음소거된 것 같다고 알려주려고 할 때.",
  "화상 회의에서 상대방의 카메라가 꺼져 있다고 알려주려고 할 때.",
  "업무 대화 중 잠시 준비할 시간이 필요해 상대방에게 기다려 달라고 요청하려고 할 때.",
  "온라인 회의 연결에 문제가 생겨 접속을 끊었다가 다시 들어오겠다고 알리려고 할 때.",
  "업무 대화에서 방금 한 말을 놓쳐 상대방에게 다시 말해 달라고 요청하려고 할 때.",
  "상대방의 설명 속도를 따라가기 어려워 조금 더 천천히 말해 달라고 요청하려고 할 때.",
  "온라인 회의에서 상대방이 보고 있는 내용을 함께 볼 수 있도록 화면 공유를 요청하려고 할 때.",
  "온라인 회의에서 내가 보고 있는 내용을 보여주기 위해 화면을 공유하겠다고 알리려고 할 때.",
  "온라인 회의에서 필요한 링크를 채팅창으로 보내겠다고 알리려고 할 때.",
  "회의 중 채팅창에 메시지를 남겼으니 그곳에 내용이 있다고 알려주려고 할 때.",
  "온라인 회의 중 내 인터넷 연결 상태가 불안정하다고 설명하려고 할 때.",
  "회의나 발표를 시작하기 전에 내가 시작해도 되는지 허락을 구하려고 할 때.",
  "회의 시작 전 참석할 사람들이 모두 들어왔는지 확인하려고 할 때.",
  "회의를 시작하기 전에 참석자들이 시작할 준비가 되었는지 확인하려고 할 때.",
  "업무 대화를 위해 시간을 내 준 상대방에게 감사하려고 할 때.",
  "회의 진행자로서 참석자들에게 오늘 회의를 시작하자고 말하려고 할 때.",
  "회의를 시작하며 본격적인 논의에 앞서 오늘의 안건부터 살펴보자고 제안하려고 할 때.",
  "회의에서 다른 내용에 앞서 업무 진행 상황부터 공유하겠다고 알리려고 할 때.",
  "업무 내용을 설명하기 전에 이해에 필요한 배경부터 간략히 설명하겠다고 알리려고 할 때.",
  "업무 설명을 하며 핵심 사항이 두 가지라는 점을 먼저 짚어주려고 할 때.",
  "회의에서 현재 안건의 논의를 마치고 다음 안건으로 넘어가자고 제안하려고 할 때.",
  "회의 중 현재 다루는 부분은 나중에 논의하자고 제안하려고 할 때.",
  "업무 설명을 한 뒤 상대방에게 질문이 있는지 물으려고 할 때.",
  "회의에서 설명한 내용에 대해 참석자들의 의견이나 논평을 받아보려고 할 때.",
  "업무 방안에 대해 상대방이 어떻게 생각하는지 의견을 물으려고 할 때.",
  "회의에서 논의 중인 내용에 한 가지를 덧붙여도 되는지 물으려고 할 때.",
  "상대방이 말하는 도중 끼어들게 되어 말을 끊는 데 대해 사과하려고 할 때.",
  "상대방의 발언 도중 잠깐 끼어들어도 되는지 정중히 허락을 구하려고 할 때.",
  "업무 설명을 들은 뒤 내가 제대로 이해했는지 확인하고 싶다는 뜻을 밝히려고 할 때.",
  "상대방의 설명을 내 말로 되짚으며 그 뜻으로 말한 것이 맞는지 확인하려고 할 때.",
  "회의 내용을 따라가며 내가 놓친 사항이 있었는지 확인하려고 할 때.",
  "업무 설명 중 충분히 이해되지 않은 부분을 조금 더 설명해 달라고 요청하려고 할 때.",
  "상대방의 업무 설명을 구체적으로 이해하기 위해 예시를 들어 달라고 요청하려고 할 때.",
  "논의 중인 사항에 대해 아직 확신하지 못하고 있다는 입장을 전하려고 할 때.",
  "업무 문의에 바로 답하기 어려워 확인한 뒤 답장하겠다고 말하려고 할 때.",
  "회의에서 상대방이 제시한 의견에 동의한다는 입장을 전하려고 할 때.",
  "상대방이 제안한 방안이 좋은 생각이라고 평가하려고 할 때.",
  "논의 중인 특정 사항은 사실 여부를 검증해야 한다고 말하려고 할 때.",
  "회의에서 현재 제시된 방안 외에 다른 대안도 검토하자고 제안하려고 할 때.",
  "논의에 필요한 판단이 충분히 서지 않아 지금 결정하기는 어려울 수 있다고 말하려고 할 때.",
  "회의가 끝날 시간이 가까워 남은 시간이 거의 없다고 참석자들에게 알리려고 할 때.",
  "회의나 발표를 마무리하며 질문을 마지막으로 하나만 더 받겠다고 알리려고 할 때.",
  "오늘 진행한 논의를 이 지점에서 멈추자고 제안하려고 할 때.",
  "회의에서 논의한 내용을 정리해서 보내겠다고 참석자들에게 약속하려고 할 때.",
  "회의 기록을 참석자들이 볼 수 있도록 공유하겠다고 말하려고 할 때.",
  "현재 회의에서 다음 회의의 일정을 잡자고 제안하려고 할 때.",
  "회의에 참석해 준 사람들에게 참여에 대한 감사를 전하려고 할 때.",
  "회의 진행자로서 회의를 마무리하자고 말하려고 할 때.",
  "회의 중 나온 특정 사항을 회의가 끝난 뒤 확인하겠다고 말하려고 할 때.",
  "후속 업무를 정리하며 담당자와 마감 기한을 명확히 하겠다고 말하려고 할 때.",
  "회의에서 언급된 일의 책임자가 누구인지 물으려고 할 때.",
  "업무를 계획하면서 해당 일을 언제까지 끝내야 하는지 물으려고 할 때.",
  "회의 중 확인이 필요한 일이 생겨 회의가 끝난 뒤 확인하겠다고 말하려고 할 때.",
  "회의 중 나온 사안은 별도의 자리에서 따로 논의하겠다고 알리려고 할 때.",
  "설명을 이어가는 중 잠시 멈춰 지금까지의 내용에 질문이 있는지 확인하려고 할 때.",
  "발표 중 현재 슬라이드의 설명을 마치고 다음 슬라이드로 넘어가자고 말하려고 할 때.",
  "업무 중 질문받은 내용을 이 문서에서 확인할 수 있다고 안내하려고 할 때.",
  "발표 중 지금 설명하는 내용이 오늘의 핵심이라고 강조하려고 할 때.",
  "준비한 발표 내용을 모두 설명했으므로 내 발표가 끝났음을 알리려고 할 때.",
  "업무 설명을 듣는 상대방에게 부담 갖지 말고 질문해 달라고 권하려고 할 때.",
  "발표에 사용한 슬라이드를 상대방에게 공유하겠다고 말하려고 할 때.",
  "발표 중 다룬 특정 부분을 나중에 다시 설명하겠다고 말하려고 할 때.",
  "온라인 회의에서 화면 공유를 잠시 중단하겠다고 참석자들에게 알리려고 할 때.",
  "온라인 회의에서 공유 화면이 보이지 않으면 나에게 알려 달라고 요청하려고 할 때.",
  "발표를 듣는 사람들이 설명 도중에도 편하게 질문할 수 있다고 안내하려고 할 때.",
  "업무 내용을 설명한 직후 방금 설명이 명확하게 전달되었는지 확인하려고 할 때.",
  "업무 설명을 마친 뒤 상대방에게 불명확하게 남은 부분이 있는지 물으려고 할 때.",
  "회의 시간이 부족하므로 현재 내용은 그만 다루고 다음으로 넘어가자고 제안하려고 할 때.",
  "논의한 내용이 길어져 이를 짧게 요약해 보겠다고 말하려고 할 때.",
  "업무 설명을 들은 뒤 내가 이해한 내용을 상대방에게 정리해 제시하려고 할 때.",
  "업무 내용에 대한 내 이해를 공유하며 잘못 이해한 점이 있으면 알려 달라고 요청하려고 할 때.",
  "업무 중 확인이 필요한 사항을 전달받아 내가 확인하겠다고 말하려고 할 때.",
  "회의 중 받은 질문에는 회의가 끝난 뒤 답하겠다고 말하려고 할 때.",
  "오늘 진행한 논의를 이 지점에서 마치자고 제안하려고 할 때.",
  "현재 잡힌 업무 일정의 변경이 가능한지 상대방에게 물으려고 할 때.",
  "상대방이 제안한 시간이 내 일정에도 괜찮다고 전달하려고 할 때.",
  "상대방이 제안한 시간에는 내가 참석하기 어렵다고 전달하려고 할 때.",
  "일정을 조율하며 현재 제안된 시간 대신 다른 시간은 어떨지 제안하려고 할 때.",
  "예정된 시작 시각보다 조금 늦게 시작할 수 있는지 요청하려고 할 때.",
  "잡혀 있는 회의의 시작 시각을 30분 뒤로 미룰 수 있는지 요청하려고 할 때.",
  "잡혀 있는 회의를 현재보다 이른 시간으로 옮길 수 있는지 요청하려고 할 때.",
  "업무 계획에 변화가 생겨 일정을 수정해야 할 수도 있다고 말하려고 할 때.",
  "회의 일정을 잡으며 참석자들에게 회의 초대를 보내겠다고 알리려고 할 때.",
  "상대방에게 보낸 캘린더 초대의 내용을 확인해 달라고 요청하려고 할 때.",
  "회의 초대를 받았는지 묻는 상대방에게 초대가 도착하지 않았다고 알리려고 할 때.",
  "회의 일정을 다시 조율하며 상대방에게 새로운 시간을 제안해 달라고 요청하려고 할 때.",
  "회의 일정을 조율하며 내일 같은 시간에 만나는 것은 어떨지 제안하려고 할 때.",
  "업무 만남을 잡기 위해 상대방이 이번 주에 시간을 낼 수 있는지 물으려고 할 때.",
  "일정을 조율하며 상대방에게 가장 편한 시간이 언제인지 물으려고 할 때.",
  "일정을 조율하며 상대방에게 가능한 시간들을 알려 달라고 요청하려고 할 때.",
  "회의 일정이 아직 정해지지 않아 확정되면 알려주겠다고 약속하려고 할 때.",
  "회의 진행 여부가 불확실해 회의를 취소해야 할 수도 있다고 알리려고 할 때.",
  "예정된 회의를 다음 주로 옮길 수 있는지 상대방에게 요청하려고 할 때.",
  "회의 참석을 안내하며 참석할 수 없으면 나에게 알려 달라고 요청하려고 할 때.",
  "참석하지 못하는 사람이 생겨 내가 대신 참석하겠다고 말하려고 할 때.",
  "회의 시각을 정확히 알아봐야 해서 시간을 확인하겠다고 말하려고 할 때.",
  "회의 초대를 준비한 뒤 초대에 접속 링크를 추가해 두었다고 알려주려고 할 때.",
  "기존에 안내한 회의나 업무 시간이 변경되었다고 상대방에게 알리려고 할 때.",
  "제안받은 일정에 다른 일정이 겹쳐 있다고 설명하려고 할 때.",
  "제안받은 시간에 이미 다른 회의가 잡혀 있다고 설명하려고 할 때.",
  "일정 문의를 받고 내 일정을 확인한 뒤 답장하겠다고 말하려고 할 때.",
  "업무 연락에 대한 답변을 기다리는 상대방에게 가능한 한 빨리 답장하겠다고 말하려고 할 때.",
  "업무 내용을 이메일로 보냈으니 이메일이 발송되었다고 상대방에게 알리려고 할 때.",
  "업무 관련 이메일을 상대방에게 확인해 달라고 요청하려고 할 때.",
  "이메일과 함께 보낸 첨부 파일을 확인해 달라고 요청하려고 할 때.",
  "업무 파일을 전달하며 파일을 첨부해 두었다고 상대방에게 알리려고 할 때.",
  "파일을 다시 전달할 필요가 생겨 같은 파일을 재전송하겠다고 말하려고 할 때.",
  "전달받은 업무 파일이 열리지 않는다고 상대방에게 알리려고 할 때.",
  "상대방이 첨부했다고 한 파일이 도착하지 않았다고 알리려고 할 때.",
  "업무 파일을 받지 못했거나 사용할 수 없어 파일을 다시 첨부해 달라고 요청하려고 할 때.",
  "내가 보낸 이메일을 상대방이 받았는지 확인해 달라고 요청하려고 할 때.",
  "업무 연락에 답장이 늦어져 상대방에게 사과하려고 할 때.",
  "업무 처리를 기다려 준 상대방에게 기다려 준 데 대한 감사를 전하려고 할 때.",
  "업무 문의에 바로 답할 수 없어 확인한 뒤 답장하겠다고 말하려고 할 때.",
  "업무 연락을 보낸 뒤 상대방이 시간 될 때 답장해 달라고 요청하려고 할 때.",
  "검토할 내용을 보내며 살펴본 뒤 의견을 공유해 달라고 요청하려고 할 때.",
  "업무 자료를 보내며 검토나 처리 요청이 아닌 참고용이라는 목적을 알리려고 할 때.",
  "업무 내용을 관련된 사람들에게 전달해 달라고 상대방에게 요청하려고 할 때.",
  "업무에 대한 회신을 현재 이메일에 답장하는 방식으로 보내 달라고 요청하려고 할 때.",
  "이메일을 정리하면서 제목을 수정해 두었다고 상대방에게 알리려고 할 때.",
  "이미 보낸 내용이 있어 이전 이메일을 참고해 달라고 안내하려고 할 때.",
  "업무 이메일에서 아래에 적은 세부 내용을 검토해 달라고 요청하려고 할 때.",
  "업무의 자세한 내용은 첨부 파일을 검토해 확인해 달라고 안내하려고 할 때.",
  "자료를 공유하며 이 자료의 용도가 내부 검토라는 점을 알리려고 할 때.",
  "자료 전달 과정에서 지금 보내는 것이 최종본이라고 명확히 알리려고 할 때.",
  "수정한 업무 자료를 보내며 수정본 파일을 첨부해 두었다고 알리려고 할 때.",
  "수정본을 공유하며 달라진 부분을 눈에 띄게 표시해 두었다고 안내하려고 할 때.",
  "업무 파일을 다루는 상대방에게 파일 이름을 확인해 달라고 요청하려고 할 때.",
  "현재 파일 형식이 적합한지 살피며 다른 형식으로 보내주기를 원하는지 물으려고 할 때.",
  "업무 파일을 준비하기 위해 상대방에게 필요한 파일 형식이 무엇인지 물으려고 할 때.",
  "업무 자료를 전달하기로 한 상대방에게 언제 보내면 되는지 물으려고 할 때.",
  "자료 전달을 기다리는 상대방에게 오늘이 끝나기 전까지 보내겠다고 약속하려고 할 때.",
  "자료 전달을 기다리는 상대방에게 내일까지 보내겠다고 약속하려고 할 때.",
  "업무 자료의 진행 상태를 묻는 상대방에게 현재 자료를 준비하고 있다고 알리려고 할 때.",
  "자료 전달을 기다리는 상대방에게 아직 자료가 준비되지 않았다고 알리려고 할 때.",
  "업무 파일에 변경 사항을 적용한 뒤 파일을 업데이트했다고 알리려고 할 때.",
  "업무 링크를 다시 전달할 필요가 생겨 링크를 재전송하겠다고 말하려고 할 때.",
  "전달받은 업무 링크에 접속할 수 없다고 상대방에게 알리려고 할 때.",
  "공유 자료의 접근에 문제가 있어 접근 권한을 확인해 달라고 요청하려고 할 때.",
  "공유받은 문서를 수정하려는데 편집할 수 없는 상태라고 알리려고 할 때.",
  "문서 검토를 부탁하며 의견을 문서 안에 남겨 달라고 요청하려고 할 때.",
  "업무 자료를 수정한 뒤 바뀐 부분을 확인해 달라고 요청하려고 할 때.",
  "상대방이 준 의견에 따라 자료를 고친 뒤 피드백을 반영했다고 알리려고 할 때.",
  "업무 자료나 설명을 전달한 뒤 추가 정보가 필요하면 알려 달라고 요청하려고 할 때.",
  "업무 내용을 전달한 뒤 궁금한 점이 생기면 알려 달라고 요청하려고 할 때.",
  "업무 내용을 확인해 준 상대방에게 확인에 대한 감사를 전하려고 할 때.",
  "업무 연락에 신속하게 답해 준 상대방에게 빠른 회신에 감사하려고 할 때.",
  "업무를 도와준 상대방에게 도움에 대한 감사를 전하려고 할 때.",
  "필요한 업무 정보를 알려준 상대방에게 알려준 데 대한 감사를 전하려고 할 때.",
  "업무 처리 과정에서 상대방에게 불편을 끼쳐 사과하려고 할 때.",
  "업무 안내나 소통으로 혼란이 생겨 상대방에게 사과하려고 할 때.",
  "자료를 전달한 뒤 잘못된 파일을 보냈다는 실수를 상대방에게 알리려고 할 때.",
  "전달한 업무 자료에 수정이 필요해 고친 뒤 다시 보내겠다고 말하려고 할 때.",
  "확인해야 할 업무 내용을 놓친 것을 알아차려 그 점을 사과하려고 할 때.",
  "업무상 실수가 생긴 뒤 다음에는 더 주의하겠다고 다짐을 전하려고 할 때.",
  "업무 문제가 보고되어 현재 해당 문제를 확인하고 있다고 알리려고 할 때.",
  "업무 문제가 발생한 뒤 현재 그 원인을 조사하고 있다고 알리려고 할 때.",
  "문제 원인을 묻는 상대방에게 아직 정확한 원인을 파악하지 못했다고 알리려고 할 때.",
  "업무 처리가 당초 예상보다 오래 걸리고 있다고 상대방에게 알리려고 할 때.",
  "업무 진행 상황을 공유하며 일정이 조금 늦어지고 있다고 알리려고 할 때.",
  "업무 진행을 점검하며 현재까지는 계획대로 진행되고 있다고 보고하려고 할 때.",
  "업무 완료 시점을 묻는 상대방에게 예상 완료일이 금요일이라고 알리려고 할 때.",
  "업무를 마치려면 지금보다 하루가 더 필요하다고 상대방에게 말하려고 할 때.",
  "오늘 완료하기로 기대되는 업무를 오늘 안에 끝내지 못할 수도 있다고 알리려고 할 때.",
  "업무를 기한 안에 마치기 어려워 마감일을 연장할 수 있는지 요청하려고 할 때.",
  "업무 진행 상황을 상대방에게 업데이트해 주겠다고 말하려고 할 때.",
  "업무 진행률을 공유하며 전체의 절반 정도를 완료했다고 보고하려고 할 때.",
  "업무 완료를 기다리는 상대방에게 거의 다 끝났다고 알리려고 할 때.",
  "업무 완료를 기다리는 상대방에게 끝나는 즉시 알려주겠다고 약속하려고 할 때.",
  "검토 결과를 기다리는 상대방에게 아직 검토가 끝나지 않았다고 알리려고 할 때.",
  "업무를 진행하거나 마무리하기 전에 몇 가지를 더 확인해야 한다고 말하려고 할 때.",
  "업무 검토 중 특정 부분을 다시 살펴봐야 한다고 말하려고 할 때.",
  "업무 진행 절차를 공유하며 다음 단계가 테스트라고 안내하려고 할 때.",
  "여러 업무를 처리하는 상황에서 이 업무를 우선해서 진행하겠다고 말하려고 할 때.",
  "여러 업무의 처리 순서를 정하기 위해 우선순위를 확인하고 싶다고 말하려고 할 때.",
  "업무를 배분하거나 확인하는 자리에서 이 업무의 담당자가 누구인지 물으려고 할 때.",
  "업무 담당을 정하는 자리에서 내가 이 업무를 책임지겠다고 말하려고 할 때.",
  "업무를 배분하는 상황에서 상대방에게 이 일을 맡아줄 수 있는지 요청하려고 할 때.",
  "업무를 혼자 처리하기 어려워 도움이 필요하다는 점을 상대방에게 알리려고 할 때.",
  "업무 중 잠깐 도움이 필요해 상대방에게 잠시 도와줄 수 있는지 요청하려고 할 때.",
  "업무 판단을 앞두고 상대방의 조언을 듣고 싶다고 말하려고 할 때.",
  "업무 내용을 점검하며 내가 빠뜨린 사항이 있는지 상대방에게 물으려고 할 때.",
  "업무 진행 방안을 정하며 이 방법으로 진행해도 되는지 확인하려고 할 때.",
  "업무 수행 방안을 정한 뒤 이 접근 방식으로 진행하겠다고 알리려고 할 때.",
  "업무상 결정을 요청받아 내부 검토를 거친 뒤 결정하겠다고 말하려고 할 때.",
  "업무 내용을 확정하기 전에 담당자에게 확인하겠다고 말하려고 할 때.",
  "업무를 진행하려면 승인이 필요하다는 점을 상대방에게 알리려고 할 때.",
  "승인이 필요한 업무나 자료를 제시하며 상대방에게 승인해 줄 수 있는지 요청하려고 할 때.",
  "제출했던 요청이 승인되었다는 결과를 상대방에게 알리려고 할 때.",
  "승인 여부를 기다리는 상대방에게 아직 승인을 받지 못했다고 알리려고 할 때.",
  "제출한 업무 자료에 보완이 필요해 수정한 뒤 다시 제출하겠다고 말하려고 할 때.",
  "결과를 기다리는 상대방에게 결정이 나는 즉시 알려주겠다고 약속하려고 할 때.",
  "업무 문의나 요청을 받았지만 그 일은 내 담당 영역이 아니라고 설명하려고 할 때.",
  "내가 받은 업무 내용이나 요청을 담당자에게 전달하겠다고 말하려고 할 때."
];
// Observed defaults outside the repository-authored v1 set. Never infer ownership
// from sentence endings: an unrecognized sentence may be a user's own prompt.
var legacyDefaults=[
  {
    "en": "When do we need to finish this?",
    "context": "그 일의 대응기한을 물으려고 할 때."
  },
  {
    "en": "I'm not sure about that yet.",
    "context": "어떤것에 대해 아직 확신하지 못하고 있다는 입장을 전하려고 할 때."
  },
  {
    "en": "We could consider another option.",
    "context": "회의에서 현재 옵션 이외에 다른 옵션의 검토를 제안할때"
  },
  {
    "en": "Could we adjust the schedule?",
    "context": "업무 일정 변경을 제안할때"
  },
  {
    "en": "I’ll provide an update.",
    "context": "어떤내용을 갱신하겠다고 할떄."
  },
  {
    "en": "I'd like to set the order of the tasks.",
    "context": "이번건의 작업순서를 정하고싶다고 말하려고 할 때."
  },
  {
    "en": "Could you handle this task?",
    "context": "상대방에게 이 업무의 담당을 요청하려고 할 때."
  }
];
function isDefault(en,context){
  var i=items.findIndex(function(x){return x.en===en;});
  return i!==-1&&(context===previousContexts[i]||legacyDefaults.some(function(x){return x.en===en&&x.context===context;}));
}
function fillMissing(cards,chapters){
  var ids=chapters.filter(function(c){return ['업무대화 일반','업무대화(일반)','영어업무(일반)'].indexOf(c.name)!==-1;}).map(function(c){return c.id;});
  var byEnglish=new Map(items.map(function(x){return [x.en,x.context];}));
  var changed=false;
  cards.forEach(function(c){
    if(ids.indexOf(c.chapterId)===-1||!byEnglish.has(c.en)||c.contextUserEdited===true)return;
    var latest=byEnglish.get(c.en);
    if(c.context==null||isDefault(c.en,c.context)){
      if(c.context!==latest){c.context=latest;changed=true;}
    }
  });
  return changed;
}
// A complete older cloud snapshot may replace records before app initialization.
// Carry only an identifiable user's context forward; leave all other remote fields alone.
function preserveUserContexts(incoming,local,chapters){
  var ids=chapters.filter(function(c){return ['업무대화 일반','업무대화(일반)','영어업무(일반)'].indexOf(c.name)!==-1;}).map(function(c){return c.id;});
  var byId=new Map(local.map(function(c){return [c.id,c];}));
  incoming.forEach(function(c){
    var prior=byId.get(c.id),template=items.find(function(x){return x.en===c.en;});
    if(!prior||prior.en!==c.en||!template||ids.indexOf(c.chapterId)===-1||c.contextUserEdited===true)return;
    var localIsUser=prior.contextUserEdited===true||(typeof prior.context==='string'&&prior.context!==template.context&&!isDefault(prior.en,prior.context));
    var remoteIsDefault=c.context==null||c.context===template.context||isDefault(c.en,c.context);
    if(localIsUser&&remoteIsDefault){c.context=prior.context;if(prior.contextUserEdited===true)c.contextUserEdited=true;}
  });
}
var api={items:items,previousContexts:previousContexts,legacyDefaults:legacyDefaults,isDefault:isDefault,preserveUserContexts:preserveUserContexts,fillMissing:fillMissing};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.BusinessContexts=api;
})(typeof window!=='undefined'?window:globalThis);
