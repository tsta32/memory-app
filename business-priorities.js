/* Authored assessment of the 200 original templates; runtime migration never replaces card text. */
(function(root){
'use strict';
var items=[
  {
    "key": "business-general-001",
    "source_line": 1,
    "en": "Are you available to talk now?",
    "ko": "지금 대화할 수 있으신가요?",
    "context": "현재대화 가능여부확인",
    "ko_before": "지금 대화(통화) 가능하신가요?",
    "priority": "essential",
    "purpose": "대화 가능 여부",
    "criteria": [
      1,
      3
    ],
    "reason": "대화 시작 전 상대의 여유를 확인하며 통화·방문·즉석 문의에 두루 쓰이므로 특정 주간 가능 여부(94)보다 대표성이 높다.",
    "coverageAreas": [
      "communication"
    ],
    "coveragePurposes": [
      "communication.conversation.start"
    ]
  },
  {
    "key": "business-general-002",
    "source_line": 2,
    "en": "Can you see my screen?",
    "ko": "제 화면을 볼 수 있으신가요?",
    "context": "공유화면 표시확인",
    "ko_before": "지금 화면 보이시나요?",
    "priority": "important",
    "purpose": "화면 수신 확인",
    "criteria": [],
    "reason": "온라인 회의에서 직접 필요한 점검이지만 화면 공유 상황에 한정되어 범용 대화 핵심보다 뒤에 둔다."
  },
  {
    "key": "business-general-003",
    "source_line": 3,
    "en": "Can you see the materials?",
    "ko": "자료를 볼 수 있으신가요?",
    "context": "제시자료 표시확인",
    "ko_before": "자료가 잘 보이시나요?",
    "priority": "supplementary",
    "purpose": "화면 수신 확인",
    "criteria": [],
    "reason": "자료가 보이는지 묻는 목적은 화면 확인(2)과 크게 겹치므로 자료 대상 변형은 예비로 둔다."
  },
  {
    "key": "business-general-004",
    "source_line": 4,
    "en": "Can you hear me?",
    "ko": "제 말을 들을 수 있으신가요?",
    "context": "내음성 수신확인",
    "ko_before": "제 목소리 들리시나요?",
    "priority": "important",
    "purpose": "음성 수신 확인",
    "criteria": [],
    "reason": "온라인 통화 시작 시 유용한 점검이나 음성 연결에 한정된 질문이다."
  },
  {
    "key": "business-general-005",
    "source_line": 5,
    "en": "I can't hear you well.",
    "ko": "당신의 말이 잘 들리지 않습니다.",
    "context": "상대음성 청취불량알림",
    "ko_before": "소리가 잘 안 들립니다.",
    "priority": "important",
    "purpose": "음성 장애 보고",
    "criteria": [],
    "reason": "잘 안 들리는 문제를 전달하는 실용성이 있으나 음성 통화 상황에 특화된다."
  },
  {
    "key": "business-general-006",
    "source_line": 6,
    "en": "Your audio keeps cutting out.",
    "ko": "당신의 오디오가 계속 끊깁니다.",
    "context": "상대음성 반복끊김알림",
    "ko_before": "목소리가 끊깁니다.",
    "priority": "important",
    "purpose": "음성 장애 보고",
    "criteria": [],
    "reason": "반복적인 음성 끊김을 정확히 설명하는 변형이어서 일반적인 청취 장애 보고(5)를 보완한다."
  },
  {
    "key": "business-general-007",
    "source_line": 7,
    "en": "I think your microphone is muted.",
    "ko": "제 생각에는 당신의 마이크가 음소거된 것 같습니다.",
    "context": "상대마이크 음소거추정알림",
    "ko_before": "음소거 상태이신 것 같습니다.",
    "priority": "important",
    "purpose": "음소거 안내",
    "criteria": [],
    "reason": "상대가 직접 해결할 수 있는 원인을 짚는 실용적 안내지만 온라인 회의의 특정 장애에 한정된다."
  },
  {
    "key": "business-general-008",
    "source_line": 8,
    "en": "Your camera is off.",
    "ko": "당신의 카메라가 꺼져 있습니다.",
    "context": "상대카메라 꺼짐알림",
    "ko_before": "카메라가 꺼져 있습니다.",
    "priority": "supplementary",
    "purpose": "카메라 안내",
    "criteria": [],
    "reason": "영상이 반드시 필요한 회의에서만 조치가 필요하며 음성·화면 공유만으로 충분한 상황도 많다."
  },
  {
    "key": "business-general-009",
    "source_line": 9,
    "en": "Please wait a moment.",
    "ko": "잠시 기다려 주세요.",
    "context": "잠시대기 요청",
    "ko_before": "잠시만 기다려 주세요.",
    "priority": "essential",
    "purpose": "잠시 대기 요청",
    "criteria": [
      1,
      3
    ],
    "reason": "확인·준비·연결 등 여러 이유로 잠시 기다려 달라고 할 수 있어 특정 조치를 약속하는 표현보다 넓게 재사용된다.",
    "coverageAreas": [
      "communication"
    ],
    "coveragePurposes": [
      "communication.pause.request"
    ]
  },
  {
    "key": "business-general-010",
    "source_line": 10,
    "en": "I’ll reconnect.",
    "ko": "제가 다시 연결하겠습니다.",
    "context": "접속연결 재접속예고",
    "ko_before": "다시 연결하겠습니다.",
    "priority": "important",
    "purpose": "재접속 안내",
    "criteria": [],
    "reason": "연결 장애를 해결하기 위한 행동 안내로 유용하나 온라인 접속 복구에 한정된다."
  },
  {
    "key": "business-general-011",
    "source_line": 11,
    "en": "Could you say that again?",
    "ko": "그것을 다시 말씀해 주시겠어요?",
    "context": "상대발언 반복요청",
    "ko_before": "다시 한번 말씀해 주시겠어요?",
    "priority": "essential",
    "purpose": "다시 말해 달라는 요청",
    "criteria": [
      1,
      3
    ],
    "reason": "못 듣거나 놓친 말을 복구하는 직접적인 요청으로 원인 설명(5·6)만으로 해결되지 않는 의사소통을 회복한다.",
    "coverageAreas": [
      "communication"
    ],
    "coveragePurposes": [
      "communication.clarification.repeat"
    ]
  },
  {
    "key": "business-general-012",
    "source_line": 12,
    "en": "Could you speak a little more slowly?",
    "ko": "조금 더 천천히 말씀해 주시겠어요?",
    "context": "발화속도 감속요청",
    "ko_before": "조금 천천히 말씀해 주시겠어요?",
    "priority": "essential",
    "purpose": "말하기 속도 조절 요청",
    "criteria": [
      1,
      3
    ],
    "reason": "발화를 다시 듣는 것(11)과 달리 이후 설명의 속도를 바꿔 달라는 요청이며 통화·교육·회의에 두루 적용된다.",
    "coverageAreas": [
      "communication"
    ],
    "coveragePurposes": [
      "communication.clarification.slow"
    ]
  },
  {
    "key": "business-general-013",
    "source_line": 13,
    "en": "Could you share your screen?",
    "ko": "화면을 공유해 주시겠어요?",
    "context": "상대화면 공유요청",
    "ko_before": "화면을 공유해 주시겠어요?",
    "priority": "important",
    "legacyPriorityDefaults": ["essential"],
    "purpose": "화면 공유 요청",
    "criteria": [
      1
    ],
    "reason": "화면 공유 요청은 온라인 회의에서 유용하지만 사용 환경이 제한적이고 파일·링크 전달 등 대체 수단이 있다. 일반 업무 전반에서 놓치면 진행이 막히는 핵심 표현보다 중요 등급이 적절하다."
  },
  {
    "key": "business-general-014",
    "source_line": 14,
    "en": "I'll share my screen.",
    "ko": "제가 제 화면을 공유하겠습니다.",
    "context": "내화면 공유예고",
    "ko_before": "제가 화면을 공유하겠습니다.",
    "priority": "important",
    "purpose": "화면 공유 요청",
    "criteria": [],
    "reason": "자기 화면을 공유하겠다는 안내는 유용하지만 공유 조율의 필수 대표(13)에 더해 익힐 통보 변형이다."
  },
  {
    "key": "business-general-015",
    "source_line": 15,
    "en": "I'll send the link in the chat.",
    "ko": "제가 채팅에 링크를 보내겠습니다.",
    "context": "채팅링크 전송예고",
    "ko_before": "링크를 채팅에 보내겠습니다.",
    "priority": "important",
    "purpose": "링크 전달 안내",
    "criteria": [],
    "reason": "회의 접속·문서 링크를 채팅에 보내는 구체적 전달 경로를 안내할 때 유용하다."
  },
  {
    "key": "business-general-016",
    "source_line": 16,
    "en": "I left a message in the chat.",
    "ko": "제가 채팅에 메시지를 남겼습니다.",
    "context": "채팅메시지 작성완료알림",
    "ko_before": "채팅에 메시지를 남겼습니다.",
    "priority": "supplementary",
    "purpose": "채팅 안내",
    "criteria": [],
    "reason": "이미 채팅에 남겼다는 사후 안내로 상황이 제한되고 채팅 전달 안내(15)와 사용 범위가 겹친다."
  },
  {
    "key": "business-general-017",
    "source_line": 17,
    "en": "My connection is unstable.",
    "ko": "제 연결 상태가 불안정합니다.",
    "context": "내접속 불안정알림",
    "ko_before": "잠시 연결이 불안정합니다.",
    "priority": "important",
    "purpose": "연결 상태 보고",
    "criteria": [],
    "reason": "내 쪽의 통신 문제를 설명해 오해를 줄이지만 온라인 회의 환경에 특화된다."
  },
  {
    "key": "business-general-018",
    "source_line": 18,
    "en": "Can I start?",
    "ko": "제가 시작해도 될까요?",
    "context": "진행시작 허락요청",
    "ko_before": "제가 먼저 시작해도 될까요?",
    "priority": "important",
    "purpose": "회의 시작 조율",
    "criteria": [],
    "reason": "발표나 보고 시작 허락을 구할 때 실용적이나 진행자의 차례 조율에 한정된다."
  },
  {
    "key": "business-general-019",
    "source_line": 19,
    "en": "Is everyone here?",
    "ko": "모두 여기 와 있나요?",
    "context": "참석인원 전원도착확인",
    "ko_before": "참석자들이 모두 들어왔나요?",
    "priority": "important",
    "purpose": "회의 시작 조율",
    "criteria": [],
    "reason": "참석자 도착 여부를 확인하는 회의 운영 질문으로 준비 여부 질문(20)과 세부 목적이 다르다."
  },
  {
    "key": "business-general-020",
    "source_line": 20,
    "en": "Are we ready to start?",
    "ko": "우리는 시작할 준비가 되었나요?",
    "context": "시작준비 완료여부확인",
    "ko_before": "시작할 준비가 되셨나요?",
    "priority": "important",
    "purpose": "회의 시작 조율",
    "criteria": [],
    "reason": "시작 준비를 확인하는 회의 운영 질문으로 유용하지만 다른 업무 목적에까지 넓게 쓰이는 표현은 아니다."
  },
  {
    "key": "business-general-021",
    "source_line": 21,
    "en": "Thank you for your time.",
    "ko": "시간을 내주셔서 감사합니다.",
    "context": "시간할애 감사표현",
    "ko_before": "시간 내주셔서 감사합니다.",
    "priority": "important",
    "purpose": "감사 표현",
    "criteria": [],
    "reason": "시간을 내 준 데 감사하는 상황에는 적절하나 감사 표현의 필수 대표(154) 외에 목적별 변형으로 둔다."
  },
  {
    "key": "business-general-022",
    "source_line": 22,
    "en": "Let’s begin today’s meeting.",
    "ko": "우리 오늘 회의를 시작합시다.",
    "context": "오늘회의 시작제안",
    "ko_before": "오늘 회의를 시작하겠습니다.",
    "priority": "important",
    "purpose": "회의 개시",
    "criteria": [],
    "reason": "회의 진행자가 공식적으로 시작할 때 유용하지만 회의 진행 역할에 특화된다."
  },
  {
    "key": "business-general-023",
    "source_line": 23,
    "en": "Let’s review today’s agenda first.",
    "ko": "우리 오늘의 안건을 먼저 검토합시다.",
    "context": "오늘안건 우선검토제안",
    "ko_before": "오늘 안건을 먼저 확인하겠습니다.",
    "priority": "important",
    "purpose": "안건 안내",
    "criteria": [],
    "reason": "논의 전에 안건을 살피자는 제안은 회의를 구조화하는 데 유용하지만 순서와 대상이 지정되어 있다."
  },
  {
    "key": "business-general-024",
    "source_line": 24,
    "en": "I'll share the progress first.",
    "ko": "제가 진행 상황을 먼저 공유하겠습니다.",
    "context": "업무진행 우선공유예고",
    "ko_before": "먼저 진행 상황을 공유하겠습니다.",
    "priority": "important",
    "purpose": "진행 상황 공유",
    "criteria": [],
    "reason": "진행 상황부터 보고하겠다는 안내로 유용하나 업데이트 약속의 대표(172)에 발표 순서를 더한 변형이다."
  },
  {
    "key": "business-general-025",
    "source_line": 25,
    "en": "I'll briefly explain the background first.",
    "ko": "제가 먼저 배경을 간단히 설명하겠습니다.",
    "context": "관련배경 우선간략설명예고",
    "ko_before": "먼저 배경을 간단히 설명하겠습니다.",
    "priority": "important",
    "purpose": "배경 설명",
    "criteria": [],
    "reason": "처음 듣는 사람에게 배경부터 설명하는 발표 구조를 안내하는 데 유용하다."
  },
  {
    "key": "business-general-026",
    "source_line": 26,
    "en": "There are two key points.",
    "ko": "두 가지 핵심 사항이 있습니다.",
    "context": "핵심사항 두가지안내",
    "ko_before": "핵심은 두 가지입니다.",
    "priority": "supplementary",
    "purpose": "핵심 요점 안내",
    "criteria": [],
    "reason": "핵심이 정확히 두 가지라는 수량이 고정된 발표 문구여서 다른 개수·설명 구조에는 조정이 필요하다."
  },
  {
    "key": "business-general-027",
    "source_line": 27,
    "en": "Let’s move to the next item.",
    "ko": "우리 다음 항목으로 넘어갑시다.",
    "context": "다음안건 전환제안",
    "ko_before": "다음 항목으로 넘어가겠습니다.",
    "priority": "important",
    "legacyPriorityDefaults": ["essential"],
    "purpose": "다음 항목 진행 제안",
    "criteria": [
      1,
      3
    ],
    "reason": "다음 항목으로 넘어가자는 말은 회의·발표의 진행자 역할에 치우친다. 안건 순서를 조율할 때 유용하지만 대부분의 업무 상황에서 필수적으로 필요한 표현은 아니다."
  },
  {
    "key": "business-general-028",
    "source_line": 28,
    "en": "Let’s discuss this part later.",
    "ko": "우리 이 부분은 나중에 논의합시다.",
    "context": "해당부분 추후논의제안",
    "ko_before": "이 부분은 나중에 다시 논의하겠습니다.",
    "priority": "important",
    "purpose": "논의 보류",
    "criteria": [],
    "reason": "현재 부분을 나중에 다루자는 구체적 진행 제안으로 별도 논의(60)와 시점·범위가 다르다."
  },
  {
    "key": "business-general-029",
    "source_line": 29,
    "en": "Do you have any questions?",
    "ko": "질문이 있으신가요?",
    "context": "질문사항 유무확인",
    "ko_before": "질문 있으신가요?",
    "priority": "essential",
    "purpose": "질문 기회 제공",
    "criteria": [
      1,
      3
    ],
    "reason": "설명 뒤 질문을 받는 직접적이고 폭넓은 표현으로 중간 점검(61)·자유 질문(66)·비동기 문의(151)를 포괄하는 기본형이다.",
    "coverageAreas": [
      "communication"
    ],
    "coveragePurposes": [
      "communication.questions.invite"
    ]
  },
  {
    "key": "business-general-030",
    "source_line": 30,
    "en": "Do you have any comments?",
    "ko": "의견이 있으신가요?",
    "context": "의견사항 유무질문",
    "ko_before": "의견 있으신가요?",
    "priority": "important",
    "purpose": "의견 요청",
    "criteria": [],
    "reason": "논평을 받는 회의식 표현이지만 상대의 견해를 폭넓게 묻는 필수 대표(31)와 목적이 겹친다."
  },
  {
    "key": "business-general-031",
    "source_line": 31,
    "en": "What do you think?",
    "ko": "당신은 어떻게 생각하시나요?",
    "context": "업무방안 의견질문",
    "ko_before": "어떻게 생각하세요?",
    "priority": "essential",
    "purpose": "의견 요청",
    "criteria": [
      1,
      3
    ],
    "reason": "대안·계획·결과물에 대한 상대의 견해를 직접 물으며 회의용 comments 질문(30)보다 대화·협업 전반에 쓰기 쉽다.",
    "coverageAreas": [
      "decision"
    ],
    "coveragePurposes": [
      "decision.opinion.request"
    ]
  },
  {
    "key": "business-general-032",
    "source_line": 32,
    "en": "Can I add one thing?",
    "ko": "제가 한 가지를 덧붙여도 될까요?",
    "context": "추가발언 허락요청",
    "ko_before": "제가 한 가지 덧붙여도 될까요?",
    "priority": "important",
    "purpose": "발언 추가",
    "criteria": [],
    "reason": "한 가지를 더하고 싶을 때 허락을 구하는 유용한 발언 관리 표현이나 추가 내용이 있는 상황에 한정된다."
  },
  {
    "key": "business-general-033",
    "source_line": 33,
    "en": "Sorry to interrupt.",
    "ko": "말을 끊어서 죄송합니다.",
    "context": "발언중단 사과표현",
    "ko_before": "말씀 중에 죄송합니다.",
    "priority": "essential",
    "purpose": "대화 중 끼어들기",
    "criteria": [
      1,
      3
    ],
    "reason": "끼어들며 예의를 표시하는 관용적 문구로 회의·통화·상담에서 쓰며 허락 질문(34)보다 즉시 발언에 연결하기 쉽다.",
    "coverageAreas": [
      "courtesy"
    ],
    "coveragePurposes": [
      "courtesy.interruption.apology"
    ]
  },
  {
    "key": "business-general-034",
    "source_line": 34,
    "en": "May I interrupt for a moment?",
    "ko": "잠시 말을 끊어도 될까요?",
    "context": "잠시개입 허락요청",
    "ko_before": "잠시만 끼어들어도 될까요?",
    "priority": "important",
    "purpose": "대화 중 끼어들기",
    "criteria": [],
    "reason": "끼어들기 전 허락을 구하는 더 격식 있는 변형으로 필수 대표(33)와 기본 목적이 겹친다."
  },
  {
    "key": "business-general-035",
    "source_line": 35,
    "en": "I want to make sure I understood correctly.",
    "ko": "제가 올바르게 이해했는지 확실히 하고 싶습니다.",
    "context": "상대설명 이해확인",
    "ko_before": "제가 올바르게 이해했는지 확인하고 싶습니다.",
    "priority": "essential",
    "purpose": "이해 확인",
    "criteria": [
      1,
      3
    ],
    "reason": "상대의 설명을 정확히 이해했는지 점검하겠다는 목적을 명확히 하며 미완성 인용형(36)보다 독립적으로 쓸 수 있다.",
    "coverageAreas": [
      "communication"
    ],
    "coveragePurposes": [
      "communication.understanding.check"
    ]
  },
  {
    "key": "business-general-036",
    "source_line": 36,
    "en": "So, do you mean that...?",
    "ko": "그러니까, 당신의 뜻은 ...라는 건가요?",
    "context": "상대발언 의미확인",
    "ko_before": "정리하면, 이 뜻인가요?",
    "priority": "important",
    "purpose": "이해 확인",
    "criteria": [],
    "reason": "상대의 뜻을 되짚는 데 유용하지만 말줄임 부분을 내용에 맞게 채워야 하므로 대표(35)의 보완형이다."
  },
  {
    "key": "business-general-037",
    "source_line": 37,
    "en": "Did I miss anything?",
    "ko": "제가 놓친 것이 있나요?",
    "context": "누락사항 확인질문",
    "ko_before": "제가 놓친 내용이 있나요?",
    "priority": "important",
    "legacyPriorityDefaults": ["essential"],
    "purpose": "누락 확인",
    "criteria": [
      1,
      3
    ],
    "reason": "놓친 내용이 있는지 확인하는 질문은 검토에 유용하다. 다만 질문 요청·추가 설명 요청으로 목적을 보완할 수 있고, 일반적인 의사소통에서 반드시 필요한 독립 목적은 아니므로 중요 등급으로 조정한다."
  },
  {
    "key": "business-general-038",
    "source_line": 38,
    "en": "Could you explain that part a little more?",
    "ko": "그 부분을 조금 더 설명해 주시겠어요?",
    "context": "해당부분 추가설명요청",
    "ko_before": "그 부분을 조금 더 설명해 주시겠어요?",
    "priority": "essential",
    "purpose": "추가 설명 요청",
    "criteria": [
      1,
      3
    ],
    "reason": "이해되지 않은 부분을 더 설명해 달라고 직접 요청하며 예시 요청(39)처럼 설명 방식을 한 가지로 제한하지 않는다.",
    "coverageAreas": [
      "communication"
    ],
    "coveragePurposes": [
      "communication.clarification.explain"
    ]
  },
  {
    "key": "business-general-039",
    "source_line": 39,
    "en": "Could you give an example?",
    "ko": "예시 하나를 들어주시겠어요?",
    "context": "설명예시 요청",
    "ko_before": "예를 하나 들어주시겠어요?",
    "priority": "important",
    "purpose": "추가 설명 요청",
    "criteria": [],
    "reason": "추상적인 설명에 예시를 요구하는 유용한 방법이지만 추가 설명 요청(38)의 구체적 전략으로 둔다."
  },
  {
    "key": "business-general-040",
    "source_line": 40,
    "en": "I'm not sure about that yet.",
    "ko": "저는 아직 그것에 대해 확신이 없습니다.",
    "context": "해당사항 불확실성표명",
    "ko_before": "지금은 답을 확실히 모르겠습니다.",
    "priority": "essential",
    "purpose": "불확실성 전달",
    "criteria": [
      1,
      3
    ],
    "reason": "근거·계획·판단에 아직 확신이 없음을 유보적으로 말할 수 있어 원인 미확정(164) 등 특정 대상 보고보다 넓다.",
    "coverageAreas": [
      "decision"
    ],
    "coveragePurposes": [
      "decision.uncertainty.express"
    ]
  },
  {
    "key": "business-general-041",
    "source_line": 41,
    "en": "I’ll check and reply.",
    "ko": "제가 확인하고 답변하겠습니다.",
    "context": "문의내용 확인후회신",
    "ko_before": "확인하고 다시 말씀드리겠습니다.",
    "priority": "essential",
    "purpose": "확인 후 회신 약속",
    "criteria": [
      1,
      3
    ],
    "reason": "즉답 대신 확인과 후속 회신을 함께 약속해 대화·메시지·이메일을 연결하며 거의 같은 120과 일정 한정형 107 대신 대표로 삼는다.",
    "coverageAreas": [
      "progress"
    ],
    "coveragePurposes": [
      "progress.check.and.reply"
    ]
  },
  {
    "key": "business-general-042",
    "source_line": 42,
    "en": "I agree with that.",
    "ko": "저는 그것에 동의합니다.",
    "context": "상대의견 동의표현",
    "ko_before": "그 의견에 동의합니다.",
    "priority": "essential",
    "purpose": "의견 동의",
    "criteria": [
      1,
      3
    ],
    "reason": "의견·판단에 동의한다는 입장을 직접 전달하며 아이디어 칭찬(43)보다 평가 대상을 넓게 잡을 수 있다.",
    "coverageAreas": [
      "decision"
    ],
    "coveragePurposes": [
      "decision.opinion.agree"
    ]
  },
  {
    "key": "business-general-043",
    "source_line": 43,
    "en": "I think that's a good idea.",
    "ko": "저는 그것이 좋은 생각이라고 생각합니다.",
    "context": "상대제안 긍정평가",
    "ko_before": "좋은 생각이라고 생각합니다.",
    "priority": "important",
    "purpose": "의견 동의",
    "criteria": [],
    "reason": "제안이 좋은 생각이라는 긍정 평가로 유용하지만 동의 대표(42)와 기능이 많이 겹친다."
  },
  {
    "key": "business-general-044",
    "source_line": 44,
    "en": "We need to verify that point.",
    "ko": "우리는 그 부분을 확인해야 합니다.",
    "context": "해당사항 검증필요안내",
    "ko_before": "그 부분은 다시 확인할 필요가 있습니다.",
    "priority": "important",
    "purpose": "추가 검증 필요",
    "criteria": [],
    "reason": "특정 지점의 사실 검증 필요성을 말하는 팀 단위 제안으로 단순 확인 약속(78)과 책임 주체가 다르다."
  },
  {
    "key": "business-general-045",
    "source_line": 45,
    "en": "We could consider another option.",
    "ko": "우리는 또 다른 선택지를 검토할 수 있습니다.",
    "context": "다른대안 검토제안",
    "ko_before": "다른 방법도 고려할 수 있습니다.",
    "priority": "essential",
    "purpose": "대안 검토 제안",
    "criteria": [
      1,
      3
    ],
    "reason": "기존 방안을 단정적으로 거부하지 않고 다른 선택지도 검토하자고 제안해 일정·기술·절차 등 다양한 논의에 적용된다.",
    "coverageAreas": [
      "decision"
    ],
    "coveragePurposes": [
      "decision.option.alternative"
    ]
  },
  {
    "key": "business-general-046",
    "source_line": 46,
    "en": "It may be difficult to decide now.",
    "ko": "지금 결정하는 것은 어려울 수도 있습니다.",
    "context": "즉시결정 어려움예상",
    "ko_before": "지금 결정하기는 어려울 것 같습니다.",
    "priority": "important",
    "purpose": "결정 유보",
    "criteria": [],
    "reason": "현재 결정하기 어렵다는 제약을 정중히 전달하는 데 유용하지만 의사결정 시점에 한정된다."
  },
  {
    "key": "business-general-047",
    "source_line": 47,
    "en": "We’re nearly out of time.",
    "ko": "우리는 시간이 거의 다 되었습니다.",
    "context": "남은시간 소진임박알림",
    "ko_before": "시간이 거의 다 됐습니다.",
    "priority": "important",
    "purpose": "시간 부족 안내",
    "criteria": [],
    "reason": "회의 종료가 가까움을 알리는 실용적 진행 문구지만 회의 시간 관리에 특화된다."
  },
  {
    "key": "business-general-048",
    "source_line": 48,
    "en": "I'll take one last question.",
    "ko": "제가 마지막 질문 하나를 받겠습니다.",
    "context": "마지막질문 하나접수예고",
    "ko_before": "마지막 질문 하나만 받겠습니다.",
    "priority": "supplementary",
    "purpose": "마지막 질문 안내",
    "criteria": [],
    "reason": "질문을 정확히 하나 더 받는 진행자의 매우 한정된 마무리 상황에 쓰인다."
  },
  {
    "key": "business-general-049",
    "source_line": 49,
    "en": "Let's stop here for today.",
    "ko": "우리 오늘은 여기서 멈춥시다.",
    "context": "오늘논의 중단제안",
    "ko_before": "오늘은 여기까지 하겠습니다.",
    "priority": "supplementary",
    "purpose": "오늘 논의 종료",
    "criteria": [],
    "reason": "오늘 여기서 마치자는 목적이 필수 대표(80)와 사실상 같아 중복 암기를 뒤로 둔다."
  },
  {
    "key": "business-general-050",
    "source_line": 50,
    "en": "I’ll summarize the discussion and send it.",
    "ko": "제가 논의 내용을 요약해서 보내겠습니다.",
    "context": "논의내용 요약전송약속",
    "ko_before": "논의 내용을 정리해 보내겠습니다.",
    "priority": "important",
    "purpose": "내용 요약",
    "criteria": [],
    "reason": "논의를 요약해 보내는 후속 행동까지 약속하는 변형으로 구두 요약의 대표(75)를 보완한다."
  },
  {
    "key": "business-general-051",
    "source_line": 51,
    "en": "I'll share the meeting notes.",
    "ko": "제가 회의록을 공유하겠습니다.",
    "context": "회의기록 공유예고",
    "ko_before": "회의록을 공유하겠습니다.",
    "priority": "important",
    "purpose": "회의 기록 공유",
    "criteria": [],
    "reason": "회의록 전달을 안내하는 실용 표현이지만 공유 대상이 회의 기록으로 정해져 있다."
  },
  {
    "key": "business-general-052",
    "source_line": 52,
    "en": "Let's set the next meeting.",
    "ko": "우리 다음 회의를 설정합시다.",
    "context": "다음회의 일정설정제안",
    "ko_before": "다음 회의 일정을 정하겠습니다.",
    "priority": "important",
    "purpose": "다음 회의 계획",
    "criteria": [],
    "reason": "후속 회의 일정을 정하자는 실용적인 제안이나 회의 주기에 한정된다."
  },
  {
    "key": "business-general-053",
    "source_line": 53,
    "en": "Thank you for joining.",
    "ko": "참석해 주셔서 감사합니다.",
    "context": "회의참여 감사표현",
    "ko_before": "참석해 주셔서 감사합니다.",
    "priority": "supplementary",
    "purpose": "감사 표현",
    "criteria": [],
    "reason": "회의 참석 감사라는 제한된 변형이며 감사 대표(154)와 시간 감사(21) 이후에 익혀도 된다."
  },
  {
    "key": "business-general-054",
    "source_line": 54,
    "en": "Let’s conclude the meeting.",
    "ko": "우리 회의를 마무리합시다.",
    "context": "회의진행 종료제안",
    "ko_before": "그럼 회의를 마치겠습니다.",
    "priority": "important",
    "purpose": "오늘 논의 종료",
    "criteria": [],
    "reason": "공식 회의 종료를 선언하는 격식 표현으로 범용 종료 대표(80)의 회의 전용 변형이다."
  },
  {
    "key": "business-general-055",
    "source_line": 55,
    "en": "I'll check this after the meeting.",
    "ko": "제가 이것을 회의 후에 확인하겠습니다.",
    "context": "해당사항 회의후확인약속",
    "ko_before": "이 내용은 회의 후에 확인하겠습니다.",
    "priority": "supplementary",
    "purpose": "확인 후 회신 약속",
    "criteria": [],
    "reason": "회의 후 확인이라는 시점만 붙은 약속으로 59와 중복되고 확인·회신 대표(41)보다 후속 소통이 덜 명시적이다."
  },
  {
    "key": "business-general-056",
    "source_line": 56,
    "en": "I’ll clarify who is responsible and the deadline.",
    "ko": "제가 책임자가 누구인지와 마감일을 명확히 하겠습니다.",
    "context": "담당자·기한 명확화약속",
    "ko_before": "담당자와 기한을 정리하겠습니다.",
    "priority": "important",
    "purpose": "담당과 기한 정리",
    "criteria": [],
    "reason": "담당자와 기한을 함께 명확히 하겠다는 후속 정리 약속으로 실무적이나 두 요소가 묶인 특정 행동이다."
  },
  {
    "key": "business-general-057",
    "source_line": 57,
    "en": "Who is responsible for this?",
    "ko": "누가 이것을 담당하나요?",
    "context": "업무책임자 질문",
    "ko_before": "누가 이 일을 담당하나요?",
    "priority": "essential",
    "purpose": "담당자 확인",
    "criteria": [
      1,
      3
    ],
    "reason": "사안의 담당자를 물어 업무 연결점을 찾으며 this task로 대상을 좁힌 중복 표현(182)보다 다양한 대상에 쓰기 쉽다.",
    "coverageAreas": [
      "collaboration"
    ],
    "coveragePurposes": [
      "collaboration.owner.identify"
    ]
  },
  {
    "key": "business-general-058",
    "source_line": 58,
    "en": "When do we need to finish this?",
    "ko": "우리는 이것을 언제까지 끝내야 하나요?",
    "context": "업무기한 질문",
    "ko_before": "언제까지 완료하면 되나요?",
    "priority": "essential",
    "purpose": "마감 기한 확인",
    "criteria": [
      1,
      3
    ],
    "reason": "업무를 언제까지 끝내야 하는지 묻는 핵심 질문으로 자료 발송 시점(137)보다 범위가 넓다.",
    "coverageAreas": [
      "schedule"
    ],
    "coveragePurposes": [
      "schedule.deadline.ask"
    ]
  },
  {
    "key": "business-general-059",
    "source_line": 59,
    "en": "I'll check after the meeting.",
    "ko": "제가 회의 후에 확인하겠습니다.",
    "context": "확인사항 회의후확인약속",
    "ko_before": "제가 회의 후에 확인하겠습니다.",
    "priority": "supplementary",
    "purpose": "확인 후 회신 약속",
    "criteria": [],
    "reason": "55와 목적이 같고 확인·회신 대표(41)에서 후속 행동을 구체화해 대응할 수 있어 예비로 둔다."
  },
  {
    "key": "business-general-060",
    "source_line": 60,
    "en": "We'll discuss this separately.",
    "ko": "우리는 이것을 별도로 논의하겠습니다.",
    "context": "해당사안 별도논의예고",
    "ko_before": "이 부분은 별도로 논의하겠습니다.",
    "priority": "important",
    "purpose": "논의 보류",
    "criteria": [],
    "reason": "현재 자리와 분리해 별도로 논의한다는 뜻으로 단순 시간 연기(28)와 다른 활용이 있다."
  },
  {
    "key": "business-general-061",
    "source_line": 61,
    "en": "Any questions so far?",
    "ko": "지금까지 질문이 있나요?",
    "context": "현재까지내용 질문유무확인",
    "ko_before": "지금까지 질문 있으신가요?",
    "priority": "important",
    "purpose": "질문 기회 제공",
    "criteria": [],
    "reason": "설명 중간까지의 질문을 받는 변형으로 질문 기회 대표(29)에 진행 시점이 추가된 형태다."
  },
  {
    "key": "business-general-062",
    "source_line": 62,
    "en": "Let’s move to the next slide.",
    "ko": "우리 다음 슬라이드로 넘어갑시다.",
    "context": "다음슬라이드 전환제안",
    "ko_before": "다음 슬라이드를 보겠습니다.",
    "priority": "supplementary",
    "purpose": "다음 항목 진행 제안",
    "criteria": [],
    "reason": "다음으로 이동하자는 대표(27)와 기능이 같고 대상이 슬라이드로 제한된다."
  },
  {
    "key": "business-general-063",
    "source_line": 63,
    "en": "You can see it in this document.",
    "ko": "당신은 이 문서에서 그것을 볼 수 있습니다.",
    "context": "해당문서 내용확인안내",
    "ko_before": "이 자료에서 확인할 수 있습니다.",
    "priority": "important",
    "purpose": "참조 위치 안내",
    "criteria": [],
    "reason": "문서 안에 답이 있음을 안내하는 실용 표현이지만 문서를 공유한 상황에 한정된다."
  },
  {
    "key": "business-general-064",
    "source_line": 64,
    "en": "This is the key point for today.",
    "ko": "이것이 오늘의 핵심 사항입니다.",
    "context": "오늘핵심 강조표현",
    "ko_before": "이것이 오늘의 핵심 내용입니다.",
    "priority": "important",
    "purpose": "핵심 요점 안내",
    "criteria": [],
    "reason": "중요한 내용을 강조하는 발표 문구로 유용하지만 오늘의 특정 핵심을 지목하는 상황에 집중된다."
  },
  {
    "key": "business-general-065",
    "source_line": 65,
    "en": "That concludes my presentation.",
    "ko": "이것으로 제 발표를 마칩니다.",
    "context": "내발표 종료알림",
    "ko_before": "이상으로 발표를 마치겠습니다.",
    "priority": "supplementary",
    "purpose": "발표 종료",
    "criteria": [],
    "reason": "발표자의 종료 선언에 한정되고 일반적인 논의 종료(80)보다 사용 범위가 좁다."
  },
  {
    "key": "business-general-066",
    "source_line": 66,
    "en": "Please feel free to ask questions.",
    "ko": "질문하는 것을 편하게 생각해 주세요.",
    "context": "자유질문 권유",
    "ko_before": "질문은 편하게 해 주세요.",
    "priority": "important",
    "purpose": "질문 기회 제공",
    "criteria": [],
    "reason": "질문을 편하게 하도록 권하는 완곡한 변형으로 직접 질문을 묻는 대표(29)를 보완한다."
  },
  {
    "key": "business-general-067",
    "source_line": 67,
    "en": "I'll share the presentation materials.",
    "ko": "제가 발표 자료를 공유하겠습니다.",
    "context": "발표슬라이드 공유예고",
    "ko_before": "발표 자료를 공유하겠습니다.",
    "priority": "important",
    "purpose": "발표 자료 공유",
    "criteria": [],
    "reason": "발표 슬라이드 전달을 안내하는 데 유용하지만 공유 대상이 지정되어 있다."
  },
  {
    "key": "business-general-068",
    "source_line": 68,
    "en": "I’ll explain this part again later.",
    "ko": "제가 이 부분을 조금 뒤에 다시 설명하겠습니다.",
    "context": "해당부분 추후재설명약속",
    "ko_before": "이 부분은 조금 뒤에 다시 설명하겠습니다.",
    "priority": "supplementary",
    "purpose": "추가 설명 요청",
    "criteria": [],
    "reason": "나중에 다시 설명하겠다는 제한된 약속으로 당장의 추가 설명(38)보다 먼저 익힐 필요는 낮다."
  },
  {
    "key": "business-general-069",
    "source_line": 69,
    "en": "I’ll pause the screen sharing for a moment.",
    "ko": "제가 잠시 화면 공유를 일시 중지하겠습니다.",
    "context": "화면공유 일시중단예고",
    "ko_before": "잠시 화면을 멈추겠습니다.",
    "priority": "supplementary",
    "purpose": "화면 공유 중단",
    "criteria": [],
    "reason": "화면 공유를 잠시 끄는 매우 구체적 회의 조작 안내다."
  },
  {
    "key": "business-general-070",
    "source_line": 70,
    "en": "Please let me know if you can't see the screen.",
    "ko": "화면이 보이지 않으면 저에게 알려주세요.",
    "context": "화면미표시 알림요청",
    "ko_before": "화면이 보이지 않으면 말씀해 주세요.",
    "priority": "important",
    "purpose": "화면 수신 확인",
    "criteria": [],
    "reason": "화면이 안 보일 때 알려 달라는 사전 안내로 즉시 수신 여부를 묻는 2와 시점이 다르다."
  },
  {
    "key": "business-general-071",
    "source_line": 71,
    "en": "Feel free to ask questions while I speak.",
    "ko": "제가 말하는 동안 자유롭게 질문해 주세요.",
    "context": "발표도중 자유질문권유",
    "ko_before": "제가 말하는 동안 질문하셔도 됩니다.",
    "priority": "supplementary",
    "purpose": "질문 기회 제공",
    "criteria": [],
    "reason": "설명 도중이라는 조건이 추가된 자유 질문 안내로 29·66과 크게 중복된다."
  },
  {
    "key": "business-general-072",
    "source_line": 72,
    "en": "Was that clear?",
    "ko": "그것은 명확했나요?",
    "context": "설명내용 명확성확인",
    "ko_before": "제 설명이 명확했나요?",
    "priority": "important",
    "purpose": "이해 전달 점검",
    "criteria": [],
    "reason": "설명한 사람이 전달의 명확성을 확인하는 실용 질문이며 듣는 쪽의 이해 확인(35)과 관점이 다르다."
  },
  {
    "key": "business-general-073",
    "source_line": 73,
    "en": "Is any part unclear?",
    "ko": "불명확한 부분이 있나요?",
    "context": "불명확부분 유무질문",
    "ko_before": "불명헌 부분이 있나요?",
    "priority": "supplementary",
    "purpose": "이해 전달 점검",
    "criteria": [],
    "reason": "불명확한 부분을 묻는 목적이 72와 가깝고 질문 요청(29)으로도 상당 부분 해결할 수 있다."
  },
  {
    "key": "business-general-074",
    "source_line": 74,
    "en": "We’re short on time, so let’s move on.",
    "ko": "우리는 시간이 부족하니 다음으로 넘어갑시다.",
    "context": "시간부족 다음진행제안",
    "ko_before": "시간 관계상 다음으로 넘어가겠습니다.",
    "priority": "important",
    "purpose": "다음 항목 진행 제안",
    "criteria": [],
    "reason": "시간 부족이라는 이유까지 덧붙이는 진행 제안으로 기본 이동 제안(27)의 상황별 변형이다."
  },
  {
    "key": "business-general-075",
    "source_line": 75,
    "en": "Let me briefly summarize this.",
    "ko": "제가 이것을 간단히 요약해 보겠습니다.",
    "context": "해당내용 간략요약예고",
    "ko_before": "이 내용을 간단히 정리하겠습니다.",
    "priority": "essential",
    "purpose": "내용 요약",
    "criteria": [
      1,
      3
    ],
    "reason": "논의·문서·설명 내용을 간단히 정리할 때 쓰며 전송 약속까지 포함하는 50보다 즉석 대화에서 범용적이다.",
    "coverageAreas": [
      "meeting",
      "completion"
    ],
    "coveragePurposes": [
      "meeting.summary",
      "completion.summary"
    ]
  },
  {
    "key": "business-general-076",
    "source_line": 76,
    "en": "Here is my understanding.",
    "ko": "제 이해는 다음과 같습니다.",
    "context": "내이해내용 제시",
    "ko_before": "제가 이해한 내용은 다음과 같습니다.",
    "priority": "important",
    "purpose": "이해 확인",
    "criteria": [],
    "reason": "내 이해를 제시하는 유용한 도입이지만 정확성을 점검하는 대표(35)와 함께 쓰는 보완 표현이다."
  },
  {
    "key": "business-general-077",
    "source_line": 77,
    "en": "Please let me know if I misunderstood.",
    "ko": "제가 잘못 이해했다면 저에게 알려주세요.",
    "context": "오해사항 알림요청",
    "ko_before": "제가 잘못 이해했다면 알려주세요.",
    "priority": "important",
    "purpose": "이해 확인",
    "criteria": [],
    "reason": "오해를 고쳐 달라고 요청하는 유용한 보완형이나 이해 확인의 핵심 목적은 35가 대표한다."
  },
  {
    "key": "business-general-078",
    "source_line": 78,
    "en": "I'll check that.",
    "ko": "제가 그 점을 확인하겠습니다.",
    "context": "해당사항 확인약속",
    "ko_before": "그 점은 확인해 보겠습니다.",
    "priority": "important",
    "purpose": "확인 후 회신 약속",
    "criteria": [],
    "reason": "대상을 가리지 않는 확인 약속이지만 후속 회신까지 포함하는 대표(41)와 겹쳐 필수 중복을 피했다."
  },
  {
    "key": "business-general-079",
    "source_line": 79,
    "en": "I'll answer that after the meeting.",
    "ko": "제가 그것에는 회의 후에 답변하겠습니다.",
    "context": "받은질문 회의후답변약속",
    "ko_before": "그 질문은 회의 후에 답변드리겠습니다.",
    "priority": "important",
    "purpose": "확인 후 회신 약속",
    "criteria": [],
    "reason": "회의 이후 답한다는 시점을 밝히는 변형으로 즉답을 유보하는 대표(41)를 보완한다."
  },
  {
    "key": "business-general-080",
    "source_line": 80,
    "en": "Let’s end here for today.",
    "ko": "우리 오늘은 여기서 끝냅시다.",
    "context": "오늘논의 종료제안",
    "ko_before": "오늘은 여기까지 하겠습니다.",
    "priority": "essential",
    "purpose": "오늘 논의 종료",
    "criteria": [
      1,
      3
    ],
    "reason": "회의뿐 아니라 작업 논의·면담을 오늘 여기서 마칠 때 쓰며 거의 같은 49와 회의 한정형 54 대신 대표로 삼는다.",
    "coverageAreas": [
      "meeting"
    ],
    "coveragePurposes": [
      "meeting.discussion.close"
    ]
  },
  {
    "key": "business-general-081",
    "source_line": 81,
    "en": "Could we adjust the schedule?",
    "ko": "일정을 바꿀 수 있을까요?",
    "context": "업무일정 변경제안",
    "ko_before": "일정을 조정할 수 있을까요?",
    "priority": "essential",
    "purpose": "일정 조정 요청",
    "criteria": [
      1,
      3
    ],
    "reason": "회의·납기·작업 일정의 변경 가능성을 폭넓게 물으며 구체적 이동 방향이나 분량을 고정하지 않는다.",
    "coverageAreas": [
      "schedule"
    ],
    "coveragePurposes": [
      "schedule.adjust"
    ]
  },
  {
    "key": "business-general-082",
    "source_line": 82,
    "en": "That time works for me.",
    "ko": "그 시간은 저에게 맞습니다.",
    "context": "제안시간 수락표현",
    "ko_before": "그 시간은 괜찮습니다.",
    "priority": "essential",
    "purpose": "제안 시간 수락",
    "criteria": [
      1,
      3
    ],
    "reason": "상대가 제안한 시간을 수락하는 관용적인 회신으로 단순 시작 준비 질문과 다르고, 반대 의사인 83으로 대체할 수 없다.",
    "coverageAreas": [
      "schedule"
    ],
    "coveragePurposes": [
      "schedule.time.accept"
    ]
  },
  {
    "key": "business-general-083",
    "source_line": 83,
    "en": "That time doesn't work for me.",
    "ko": "그 시간은 저에게 맞지 않습니다.",
    "context": "제안시간 불가표현",
    "ko_before": "그 시간은 어렵습니다.",
    "priority": "essential",
    "purpose": "제안 시간 거절",
    "criteria": [
      1,
      3
    ],
    "reason": "제안한 시간을 받아들일 수 없음을 이유를 꾸미지 않고 전달한다. 충돌 이유를 단정하는 105·106보다 넓고 수락(82)과는 반대 목적이다.",
    "coverageAreas": [
      "schedule"
    ],
    "coveragePurposes": [
      "schedule.time.decline"
    ]
  },
  {
    "key": "business-general-084",
    "source_line": 84,
    "en": "How about another time?",
    "ko": "다른 시간은 어떠신가요?",
    "context": "다른시간 제안",
    "ko_before": "다른 시간은 어떠신가요?",
    "priority": "important",
    "purpose": "일정 조정 요청",
    "criteria": [],
    "reason": "다른 시간을 제안하는 유용한 변형이지만 범용 일정 조정 요청(81)에서 파생되는 구체적 상황이다."
  },
  {
    "key": "business-general-085",
    "source_line": 85,
    "en": "Could we start a little later?",
    "ko": "조금 더 늦게 시작할 수 있을까요?",
    "context": "시작시각 소폭연기요청",
    "ko_before": "조금 늦게 시작해도 될까요?",
    "priority": "important",
    "purpose": "일정 조정 요청",
    "criteria": [],
    "reason": "시작을 조금 늦추는 요청으로 유용하지만 조정 방향이 늦추기로 제한된다."
  },
  {
    "key": "business-general-086",
    "source_line": 86,
    "en": "Could we postpone the meeting by 30 minutes?",
    "ko": "회의를 30분 뒤로 미룰 수 있을까요?",
    "context": "회의시각 30분연기요청",
    "ko_before": "회의를 30분 미뤄도 될까요?",
    "priority": "supplementary",
    "purpose": "일정 조정 요청",
    "criteria": [],
    "reason": "회의를 정확히 30분 미루는 수치 고정형이어서 일정 조정 대표(81) 이후 예비 변형으로 둔다."
  },
  {
    "key": "business-general-087",
    "source_line": 87,
    "en": "Could we move the meeting to an earlier time?",
    "ko": "회의를 더 이른 시간으로 옮길 수 있을까요?",
    "context": "회의시각 앞당김요청",
    "ko_before": "회의를 앞당길 수 있을까요?",
    "priority": "important",
    "purpose": "일정 조정 요청",
    "criteria": [],
    "reason": "회의를 앞당기는 구체적 요청으로 연기와 반대 방향의 조정이 필요할 때 유용하다."
  },
  {
    "key": "business-general-088",
    "source_line": 88,
    "en": "We may need to revise the schedule.",
    "ko": "우리는 일정을 수정해야 할 수도 있습니다.",
    "context": "업무일정 수정가능성안내",
    "ko_before": "일정을 변경해야 할 것 같습니다.",
    "priority": "important",
    "purpose": "일정 변경 가능성",
    "criteria": [],
    "reason": "일정을 수정할 수도 있음을 미리 알리는 통보로 직접 조정을 요청하는 81과 화행이 다르다."
  },
  {
    "key": "business-general-089",
    "source_line": 89,
    "en": "I’ll send a meeting invitation.",
    "ko": "제가 회의 초대장을 보내겠습니다.",
    "context": "회의초대 발송예고",
    "ko_before": "회의 초대를 보내겠습니다.",
    "priority": "important",
    "purpose": "회의 초대 전달",
    "criteria": [],
    "reason": "회의 초대장을 보내겠다는 일상적 운영 안내지만 회의 일정 관리에 특화된다."
  },
  {
    "key": "business-general-090",
    "source_line": 90,
    "en": "Please check the calendar invite.",
    "ko": "캘린더 초대장을 확인해 주세요.",
    "context": "캘린더초대 확인요청",
    "ko_before": "캘린더 초대를 확인해 주세요.",
    "priority": "important",
    "purpose": "회의 초대 확인",
    "criteria": [],
    "reason": "캘린더 초대 확인을 요청하는 실용 문구지만 특정 도구의 초대 확인에 한정된다."
  },
  {
    "key": "business-general-091",
    "source_line": 91,
    "en": "I didn't receive the invite.",
    "ko": "저는 초대장을 받지 못했습니다.",
    "context": "회의초대 미수신알림",
    "ko_before": "초대를 받지 못했습니다.",
    "priority": "important",
    "purpose": "회의 초대 미수신",
    "criteria": [],
    "reason": "초대가 도착하지 않은 사실을 알려 재전송을 유도하는 구체적 문제 보고다."
  },
  {
    "key": "business-general-092",
    "source_line": 92,
    "en": "Could you propose a new time?",
    "ko": "새로운 시간을 제안해 주실 수 있을까요?",
    "context": "새시간 제안요청",
    "ko_before": "새로운 시간을 제안해 주시겠어요?",
    "priority": "important",
    "purpose": "가능 시간 문의",
    "criteria": [],
    "reason": "상대에게 새 시간을 제안하도록 요청하는 변형으로 가능한 시간을 넓게 묻는 대표(95)를 보완한다."
  },
  {
    "key": "business-general-093",
    "source_line": 93,
    "en": "How about the same time tomorrow?",
    "ko": "내일 같은 시간은 어떠신가요?",
    "context": "내일동일시간 제안",
    "ko_before": "내일 같은 시간은 어떠신가요?",
    "priority": "supplementary",
    "purpose": "가능 시간 문의",
    "criteria": [],
    "reason": "내일 같은 시간이라는 특정 시점을 제안하는 고정형으로 범용 시간 조율 표현 이후 익힌다."
  },
  {
    "key": "business-general-094",
    "source_line": 94,
    "en": "Would you be available this week?",
    "ko": "이번 주에 시간이 가능하신가요?",
    "context": "이번주 시간가능여부질문",
    "ko_before": "이번 주 안에 가능하신가요?",
    "priority": "important",
    "purpose": "대화 가능 여부",
    "criteria": [],
    "reason": "이번 주의 가능 여부를 묻는 일정 문의로 당장 대화 가능한지 묻는 대표(1)의 시간 범위 변형이다."
  },
  {
    "key": "business-general-095",
    "source_line": 95,
    "en": "What time works best for you?",
    "ko": "어떤 시간이 당신에게 가장 잘 맞나요?",
    "context": "최적시간 질문",
    "ko_before": "언제가 가장 편하신가요?",
    "priority": "essential",
    "purpose": "가능 시간 문의",
    "criteria": [
      1,
      3
    ],
    "reason": "상대에게 가장 편한 시간을 개방적으로 물어 일정 조율을 시작하며 새 시간(92)·여러 후보(96)로 답을 제한하지 않는다.",
    "coverageAreas": [
      "schedule"
    ],
    "coveragePurposes": [
      "schedule.time.propose"
    ]
  },
  {
    "key": "business-general-096",
    "source_line": 96,
    "en": "Please tell me which times work for you.",
    "ko": "어떤 시간들이 가능한지 알려주세요.",
    "context": "가능시간 알림요청",
    "ko_before": "가능한 시간을 알려주세요.",
    "priority": "important",
    "purpose": "가능 시간 문의",
    "criteria": [],
    "reason": "여러 가능한 시간을 받아 일정을 조율하는 데 유용하지만 대표(95)와 기본 목적이 같다."
  },
  {
    "key": "business-general-097",
    "source_line": 97,
    "en": "I’ll notify you once the schedule is confirmed.",
    "ko": "일정이 확정되는 즉시 제가 알려드리겠습니다.",
    "context": "업무일정 확정후통보약속",
    "ko_before": "일정이 확정되면 알려드리겠습니다.",
    "priority": "important",
    "purpose": "확정 후 알림",
    "criteria": [],
    "reason": "일정 확정이라는 사건에 맞춘 알림 약속으로 일반 업데이트(172)보다 조건이 구체적이다."
  },
  {
    "key": "business-general-098",
    "source_line": 98,
    "en": "We may need to cancel the meeting.",
    "ko": "우리는 회의를 취소해야 할 수도 있습니다.",
    "context": "회의취소 필요가능성안내",
    "ko_before": "회의를 취소해야 할 것 같습니다.",
    "priority": "important",
    "purpose": "회의 취소 가능성",
    "criteria": [],
    "reason": "회의를 취소할 수도 있다는 중요한 사전 통보이지만 회의 유지 여부에 한정된다."
  },
  {
    "key": "business-general-099",
    "source_line": 99,
    "en": "Could we move the meeting to next week?",
    "ko": "우리가 회의를 다음 주로 옮길 수 있을까요?",
    "context": "회의일정 다음주변경요청",
    "ko_before": "회의를 다음 주로 옮길 수 있을까요?",
    "priority": "important",
    "purpose": "일정 조정 요청",
    "criteria": [],
    "reason": "다음 주로 미루는 구체적 조정 요청으로 일반 조정 대표(81)의 기간 변형이다."
  },
  {
    "key": "business-general-100",
    "source_line": 100,
    "en": "Please let me know if you can't attend.",
    "ko": "참석할 수 없다면 저에게 알려주세요.",
    "context": "참석불가 알림요청",
    "ko_before": "참석이 어려우시면 알려주세요.",
    "priority": "important",
    "purpose": "참석 불가 통보 요청",
    "criteria": [],
    "reason": "불참 시 알려 달라는 운영 안내로 유용하지만 참석 관리에 한정된다."
  },
  {
    "key": "business-general-101",
    "source_line": 101,
    "en": "I'll attend instead.",
    "ko": "제가 대신 참석하겠습니다.",
    "context": "대신참석 의사표현",
    "ko_before": "제가 대신 참석하겠습니다.",
    "priority": "important",
    "purpose": "대리 참석",
    "criteria": [],
    "reason": "다른 사람 대신 회의에 참석하겠다는 제안으로 상황이 특정되어 있다."
  },
  {
    "key": "business-general-102",
    "source_line": 102,
    "en": "I’ll verify the meeting time.",
    "ko": "제가 회의 시간을 확인하겠습니다.",
    "context": "회의시각 확인약속",
    "ko_before": "회의 시간을 다시 확인하겠습니다.",
    "priority": "supplementary",
    "purpose": "확인 후 회신 약속",
    "criteria": [],
    "reason": "확인 대상이 회의 시간으로 제한되고 확인 약속의 대표(41·보완 78)와 크게 겹친다."
  },
  {
    "key": "business-general-103",
    "source_line": 103,
    "en": "I've added the meeting link to the invite.",
    "ko": "제가 초대장에 회의 링크를 추가했습니다.",
    "context": "초대링크 추가완료알림",
    "ko_before": "초대에 회의 링크를 추가했습니다.",
    "priority": "supplementary",
    "purpose": "회의 링크 안내",
    "criteria": [],
    "reason": "초대에 링크를 넣었다는 특정 완료 안내로 회의 도구 사용에 집중된다."
  },
  {
    "key": "business-general-104",
    "source_line": 104,
    "en": "The time has changed.",
    "ko": "시간이 변경되었습니다.",
    "context": "예정시간 변경알림",
    "ko_before": "시간이 변경되었습니다.",
    "priority": "important",
    "purpose": "시간 변경 통보",
    "criteria": [],
    "reason": "이미 전달한 시간이 바뀌었다는 사실을 알려 혼선을 막는 실용 안내다."
  },
  {
    "key": "business-general-105",
    "source_line": 105,
    "en": "I have a scheduling conflict.",
    "ko": "저는 일정이 겹치는 문제가 있습니다.",
    "context": "업무일정 중복알림",
    "ko_before": "일정이 겹칩니다.",
    "priority": "important",
    "purpose": "제안 시간 거절",
    "criteria": [],
    "reason": "일정 충돌이라는 이유를 설명하는 관용적 표현이지만 이유를 가정하지 않는 대표(83)보다 범위가 좁다."
  },
  {
    "key": "business-general-106",
    "source_line": 106,
    "en": "I have another meeting at that time.",
    "ko": "저는 그 시간에 다른 회의가 있습니다.",
    "context": "동일시간 다른회의알림",
    "ko_before": "그 시간에는 다른 회의가 있습니다.",
    "priority": "supplementary",
    "purpose": "제안 시간 거절",
    "criteria": [],
    "reason": "다른 회의 때문이라는 제한된 사유로 83·105와 목적이 크게 중복된다."
  },
  {
    "key": "business-general-107",
    "source_line": 107,
    "en": "I’ll check my schedule and reply.",
    "ko": "제가 제 일정을 확인하고 답변하겠습니다.",
    "context": "업무일정 확인후회신약속",
    "ko_before": "일정 확인 후 답변드리겠습니다.",
    "priority": "important",
    "purpose": "확인 후 회신 약속",
    "criteria": [],
    "reason": "내 일정 확인 후 답하겠다는 변형으로 대표(41)에 확인 대상을 지정한 형태다."
  },
  {
    "key": "business-general-108",
    "source_line": 108,
    "en": "I’ll reply as soon as possible.",
    "ko": "제가 가능한 한 빨리 답변하겠습니다.",
    "context": "업무연락 신속회신약속",
    "ko_before": "가능한 한 빨리 회신하겠습니다.",
    "priority": "important",
    "purpose": "회신 속도 약속",
    "criteria": [],
    "reason": "가능한 한 빨리 답하겠다는 시간 약속으로 유용하지만 확인 후 회신(41)과 목적 일부가 겹친다."
  },
  {
    "key": "business-general-109",
    "source_line": 109,
    "en": "I've sent you an email.",
    "ko": "제가 당신에게 이메일을 보냈습니다.",
    "context": "이메일 발송완료알림",
    "ko_before": "이메일을 보내드렸습니다.",
    "priority": "important",
    "purpose": "이메일 발송 안내",
    "criteria": [],
    "reason": "이미 이메일을 보냈다는 사실을 알리는 실용적인 채널별 전달 안내다."
  },
  {
    "key": "business-general-110",
    "source_line": 110,
    "en": "Please check your email.",
    "ko": "당신의 이메일을 확인해 주세요.",
    "context": "이메일 확인요청",
    "ko_before": "이메일 확인 부탁드립니다.",
    "priority": "important",
    "purpose": "이메일 확인 요청",
    "criteria": [],
    "reason": "메일 확인을 촉구하는 데 유용하지만 더 구체적인 검토·의견 요청(122)보다 요청 결과가 덜 명확하다."
  },
  {
    "key": "business-general-111",
    "source_line": 111,
    "en": "Please check the attached file.",
    "ko": "첨부된 파일을 확인해 주세요.",
    "context": "첨부파일 확인요청",
    "ko_before": "첨부파일을 확인해 주세요.",
    "priority": "important",
    "purpose": "검토와 의견 요청",
    "criteria": [],
    "reason": "첨부 파일 확인이라는 제한된 요청으로 검토 대상에 제한이 없는 대표(122)를 보완한다."
  },
  {
    "key": "business-general-112",
    "source_line": 112,
    "en": "I've attached the file.",
    "ko": "제가 파일을 첨부했습니다.",
    "context": "업무파일 첨부완료알림",
    "ko_before": "자료를 첨부했습니다.",
    "priority": "essential",
    "purpose": "파일 첨부 안내",
    "criteria": [
      1
    ],
    "reason": "업무 파일 전달에서 첨부 사실을 간결하게 명시하는 관용적 안내로 수정본(132) 등 상태를 덧붙인 변형보다 기본형이다.",
    "coverageAreas": [
      "materials",
      "completion"
    ],
    "coveragePurposes": [
      "materials.file.attach",
      "completion.deliver"
    ]
  },
  {
    "key": "business-general-113",
    "source_line": 113,
    "en": "I'll send the file again.",
    "ko": "제가 파일을 다시 보내드리겠습니다.",
    "context": "업무파일 재전송약속",
    "ko_before": "파일을 다시 보내드리겠습니다.",
    "priority": "important",
    "purpose": "파일 재전송",
    "criteria": [],
    "reason": "같은 파일을 다시 보내는 안내로 유용하지만 수정 재전송 대표(159)와 다른 단순 재전송 상황이다."
  },
  {
    "key": "business-general-114",
    "source_line": 114,
    "en": "I can't open the file.",
    "ko": "저는 파일을 열 수 없습니다.",
    "context": "파일열기 불가알림",
    "ko_before": "파일이 열리지 않습니다.",
    "priority": "essential",
    "purpose": "자료 이용 장애 보고",
    "criteria": [
      1,
      3
    ],
    "reason": "문서·견적·보고서 등 받은 파일을 사용할 수 없음을 직접 알려 조치를 유도하며 링크·편집 권한 한정형보다 기본적인 장애 보고다.",
    "coverageAreas": [
      "materials",
      "problem"
    ],
    "coveragePurposes": [
      "materials.file.access.problem",
      "problem.report"
    ]
  },
  {
    "key": "business-general-115",
    "source_line": 115,
    "en": "I didn’t receive the attachment.",
    "ko": "저는 첨부 파일을 받지 못했습니다.",
    "context": "첨부파일 미수신알림",
    "ko_before": "첨부파일을 받지 못했습니다.",
    "priority": "important",
    "purpose": "첨부 미수신",
    "criteria": [],
    "reason": "첨부 자체를 못 받은 상태를 설명해 파일이 열리지 않는 경우(114)와 원인을 구분한다."
  },
  {
    "key": "business-general-116",
    "source_line": 116,
    "en": "Could you attach the file again?",
    "ko": "그 파일을 다시 첨부해 주시겠어요?",
    "context": "업무파일 재첨부요청",
    "ko_before": "파일을 다시 첨부해 주시겠어요?",
    "priority": "important",
    "purpose": "첨부 재요청",
    "criteria": [],
    "reason": "상대에게 파일을 다시 첨부하도록 요청하는 실용 문구지만 첨부 전달 장애 상황에 한정된다."
  },
  {
    "key": "business-general-117",
    "source_line": 117,
    "en": "Could you confirm that you received my email?",
    "ko": "제 이메일을 받으셨는지 확인해 주실 수 있을까요?",
    "context": "내이메일 수신확인요청",
    "ko_before": "메일을 받으셨는지 확인 부탁드립니다.",
    "priority": "important",
    "purpose": "수신 확인 요청",
    "criteria": [],
    "reason": "이메일 도착 여부의 확인을 요청해 전달 누락을 막지만 이메일 수신 점검에 특화된다."
  },
  {
    "key": "business-general-118",
    "source_line": 118,
    "en": "Sorry for the late reply.",
    "ko": "답변이 늦어서 죄송합니다.",
    "context": "회신지연 사과표현",
    "ko_before": "회신이 늦어 죄송합니다.",
    "priority": "important",
    "purpose": "사과 표현",
    "criteria": [],
    "reason": "회신 지연에 맞는 관용적 사과로 유용하지만 범용 불편 사과(156) 외의 사유별 변형이다."
  },
  {
    "key": "business-general-119",
    "source_line": 119,
    "en": "Thank you for your patience.",
    "ko": "기다려 주셔서 감사합니다.",
    "context": "기다림 감사표현",
    "ko_before": "답변 기다려 주셔서 감사합니다.",
    "priority": "supplementary",
    "purpose": "감사 표현",
    "criteria": [],
    "reason": "기다림에 대한 감사라는 특정 사유 표현으로 감사 대표(154)와 다른 감사 변형 뒤에 익힌다."
  },
  {
    "key": "business-general-120",
    "source_line": 120,
    "en": "I’ll reply after I check.",
    "ko": "제가 확인한 후 답변하겠습니다.",
    "context": "문의내용 확인후회신",
    "ko_before": "확인 후 회신드리겠습니다.",
    "priority": "supplementary",
    "purpose": "확인 후 회신 약속",
    "criteria": [],
    "reason": "확인 후 답한다는 목적이 대표(41)와 사실상 같아 어순 변형을 필수에 중복 배치하지 않았다."
  },
  {
    "key": "business-general-121",
    "source_line": 121,
    "en": "Please reply when you can.",
    "ko": "가능할 때 답변해 주세요.",
    "context": "가능시점 회신요청",
    "ko_before": "가능하실 때 회신 부탁드립니다.",
    "priority": "important",
    "purpose": "회신 요청",
    "criteria": [],
    "reason": "상대 사정을 배려하며 회신을 요청하는 실용 문구로 단순 채널 지정형(125)보다 활용이 넓다."
  },
  {
    "key": "business-general-122",
    "source_line": 122,
    "en": "Please review it and share your comments.",
    "ko": "그것을 검토하고 의견을 공유해 주세요.",
    "context": "검토의견 공유요청",
    "ko_before": "검토 후 의견을 알려주세요.",
    "priority": "essential",
    "purpose": "검토와 의견 요청",
    "criteria": [
      1,
      3
    ],
    "reason": "문서·기획안·작업물을 검토하고 의견을 달라는 행동과 결과를 함께 요청하며 첨부·문서 위치를 고정하는 변형보다 넓다.",
    "coverageAreas": [
      "materials"
    ],
    "coveragePurposes": [
      "materials.review.request"
    ]
  },
  {
    "key": "business-general-123",
    "source_line": 123,
    "en": "I’m sending this for reference.",
    "ko": "제가 이것을 참고용으로 보내고 있습니다.",
    "context": "전송자료 참고목적안내",
    "ko_before": "참고용으로 보내드립니다.",
    "priority": "important",
    "purpose": "참고용 전달",
    "criteria": [],
    "reason": "참고 목적임을 명시해 상대의 즉시 처리 부담을 줄이는 유용한 자료 전달 표현이다."
  },
  {
    "key": "business-general-124",
    "source_line": 124,
    "en": "Could you forward this to the relevant people?",
    "ko": "이것을 관련된 사람들에게 전달해 주실 수 있을까요?",
    "context": "관련자 전달요청",
    "ko_before": "관련자에게 전달해 주시겠어요?",
    "priority": "important",
    "purpose": "담당자에게 전달",
    "criteria": [],
    "reason": "관련자들에게 전달을 부탁하는 요청형으로 내가 담당자에게 전달하겠다는 대표(200)의 역할 반대 변형이다."
  },
  {
    "key": "business-general-125",
    "source_line": 125,
    "en": "Please reply to this email.",
    "ko": "이 이메일에 답변해 주세요.",
    "context": "현재이메일 회신요청",
    "ko_before": "이 메일에 회신해 주세요.",
    "priority": "supplementary",
    "purpose": "회신 요청",
    "criteria": [],
    "reason": "이 이메일에 답해 달라는 채널 지정 외에는 121의 회신 요청과 목적이 크게 겹친다."
  },
  {
    "key": "business-general-126",
    "source_line": 126,
    "en": "I've updated the email subject.",
    "ko": "제가 이메일 제목을 수정했습니다.",
    "context": "이메일제목 수정완료알림",
    "ko_before": "메일 제목을 수정했습니다.",
    "priority": "supplementary",
    "purpose": "메일 제목 수정",
    "criteria": [],
    "reason": "메일 제목을 바꿨다는 매우 구체적인 편집 완료 안내다."
  },
  {
    "key": "business-general-127",
    "source_line": 127,
    "en": "Please refer to my previous email.",
    "ko": "제 이전 이메일을 참고해 주세요.",
    "context": "이전이메일 참고요청",
    "ko_before": "이전 메일을 참고해 주세요.",
    "priority": "important",
    "purpose": "참조 위치 안내",
    "criteria": [],
    "reason": "이전 이메일을 참조하도록 안내해 이미 보낸 설명을 재사용하는 데 유용하다."
  },
  {
    "key": "business-general-128",
    "source_line": 128,
    "en": "Please review the details below.",
    "ko": "아래의 세부 사항을 검토해 주세요.",
    "context": "아래세부내용 검토요청",
    "ko_before": "아래 내용을 확인해 주세요.",
    "priority": "supplementary",
    "purpose": "검토와 의견 요청",
    "criteria": [],
    "reason": "아래 세부 사항이라는 위치만 지정한 검토 요청으로 대표(122) 및 첨부 확인(111)과 기능이 겹친다."
  },
  {
    "key": "business-general-129",
    "source_line": 129,
    "en": "Please review the attached file for details.",
    "ko": "세부 사항을 위해 첨부 파일을 검토해 주세요.",
    "context": "첨부파일 세부내용검토요청",
    "ko_before": "자세한 내용은 첨부파일을 확인해 주세요.",
    "priority": "supplementary",
    "purpose": "검토와 의견 요청",
    "criteria": [],
    "reason": "첨부에서 세부 내용을 확인하라는 안내로 111·122와 크게 겹쳐 별도 필수 암기 우선순위가 낮다."
  },
  {
    "key": "business-general-130",
    "source_line": 130,
    "en": "This is for internal review.",
    "ko": "이것은 내부 검토를 위한 것입니다.",
    "context": "내부검토 용도안내",
    "ko_before": "이 내용은 내부 검토용입니다.",
    "priority": "supplementary",
    "purpose": "내부 검토 용도",
    "criteria": [],
    "reason": "자료의 내부 검토 용도를 밝히는 제한된 안내로 일반 참고용 전달(123) 이후 익혀도 된다."
  },
  {
    "key": "business-general-131",
    "source_line": 131,
    "en": "I'm sending the final version.",
    "ko": "제가 최종 버전을 보내고 있습니다.",
    "context": "최종본 전송알림",
    "ko_before": "최종 버전을 보내드립니다.",
    "priority": "important",
    "purpose": "최종본 전달",
    "criteria": [],
    "reason": "버전 혼선을 막기 위해 최종본임을 명시하는 데 유용하나 자료 버전 관리에 특화된다."
  },
  {
    "key": "business-general-132",
    "source_line": 132,
    "en": "I’ve attached the revised file.",
    "ko": "제가 수정된 파일을 첨부했습니다.",
    "context": "수정파일 첨부완료알림",
    "ko_before": "수정된 파일을 첨부했습니다.",
    "priority": "important",
    "purpose": "파일 첨부 안내",
    "criteria": [],
    "reason": "수정된 파일을 첨부했다는 상태별 변형으로 첨부 기본형(112)을 보완한다."
  },
  {
    "key": "business-general-133",
    "source_line": 133,
    "en": "I’ve highlighted the changes.",
    "ko": "제가 변경 사항들을 강조 표시했습니다.",
    "context": "변경사항 강조표시알림",
    "ko_before": "변경 사항을 표시했습니다.",
    "priority": "important",
    "purpose": "수정 표시",
    "criteria": [],
    "reason": "변경 부분을 강조했다는 안내로 검토자의 확인을 돕는 구체적 협업 표현이다."
  },
  {
    "key": "business-general-134",
    "source_line": 134,
    "en": "Please check the file name.",
    "ko": "파일 이름을 확인해 주세요.",
    "context": "파일이름 확인요청",
    "ko_before": "파일 이름을 확인해 주세요.",
    "priority": "supplementary",
    "purpose": "파일명 확인",
    "criteria": [],
    "reason": "파일명만 확인해 달라는 제한된 요청으로 검토 요청 대표(122)보다 좁다."
  },
  {
    "key": "business-general-135",
    "source_line": 135,
    "en": "Would you like me to send it in another format?",
    "ko": "제가 이것을 다른 형식으로 보내드릴까요?",
    "context": "다른파일형식 전송희망여부질문",
    "ko_before": "다른 형식으로 보내드릴까요?",
    "priority": "important",
    "purpose": "파일 형식 조율",
    "criteria": [],
    "reason": "다른 형식으로 보내기를 원하는지 제안해 파일 호환 문제를 해결하는 데 유용하다."
  },
  {
    "key": "business-general-136",
    "source_line": 136,
    "en": "What format do you need?",
    "ko": "어떤 형식이 필요하신가요?",
    "context": "필요파일형식 질문",
    "ko_before": "어떤 형식이 필요하신가요?",
    "priority": "important",
    "purpose": "파일 형식 조율",
    "criteria": [],
    "reason": "필요한 형식을 직접 물어 자료 준비 조건을 맞추는 특정 정보 요청이다."
  },
  {
    "key": "business-general-137",
    "source_line": 137,
    "en": "When should I send the materials?",
    "ko": "제가 자료들을 언제 보내야 하나요?",
    "context": "자료전송 시점질문",
    "ko_before": "자료를 언제까지 보내면 될까요?",
    "priority": "important",
    "purpose": "마감 기한 확인",
    "criteria": [],
    "reason": "자료를 언제 보내면 되는지 묻는 시점 조율로 범용 완료 기한 대표(58)의 발송 상황 변형이다."
  },
  {
    "key": "business-general-138",
    "source_line": 138,
    "en": "I’ll send it by the end of today.",
    "ko": "제가 오늘이 끝나기 전까지 그것을 보내겠습니다.",
    "context": "자료전송 오늘내약속",
    "ko_before": "오늘 중으로 보내드리겠습니다.",
    "priority": "important",
    "purpose": "발송 시한 약속",
    "criteria": [],
    "reason": "오늘 안에 보내겠다는 구체적 약속으로 납기 소통에 실용적이나 시한이 고정되어 있다."
  },
  {
    "key": "business-general-139",
    "source_line": 139,
    "en": "I’ll send it by tomorrow.",
    "ko": "제가 내일까지 그것을 보내겠습니다.",
    "context": "자료전송 내일까지약속",
    "ko_before": "내일까지 보내드리겠습니다.",
    "priority": "supplementary",
    "purpose": "발송 시한 약속",
    "criteria": [],
    "reason": "내일까지 보낸다는 뜻은 138과 시한만 다르고 동일 구조이므로 반복 암기를 뒤로 둔다."
  },
  {
    "key": "business-general-140",
    "source_line": 140,
    "en": "I'm preparing the materials.",
    "ko": "제가 자료들을 준비하고 있습니다.",
    "context": "자료준비 진행보고",
    "ko_before": "자료를 준비하고 있습니다.",
    "priority": "important",
    "purpose": "자료 준비 상태",
    "criteria": [],
    "reason": "자료를 준비 중이라고 보고해 진행 상태를 공유하는 구체적 표현이다."
  },
  {
    "key": "business-general-141",
    "source_line": 141,
    "en": "The materials aren't ready yet.",
    "ko": "자료들이 아직 준비되지 않았습니다.",
    "context": "자료준비 미완료알림",
    "ko_before": "아직 자료가 준비되지 않았습니다.",
    "priority": "important",
    "purpose": "자료 준비 상태",
    "criteria": [],
    "reason": "아직 준비되지 않았음을 분명히 알려 기대를 조정하는 상태 보고다."
  },
  {
    "key": "business-general-142",
    "source_line": 142,
    "en": "I've updated the file.",
    "ko": "제가 파일을 업데이트했습니다.",
    "context": "업무파일 갱신완료알림",
    "ko_before": "파일을 업데이트했습니다.",
    "priority": "essential",
    "legacyPriorityDefaults": ["important"],
    "purpose": "파일 수정 완료 보고",
    "criteria": [1, 2],
    "reason": "수정한 파일 상태를 명시해 자료 작업의 완료와 전달 여부를 상대가 판단하게 한다. 파일 자체의 변경 완료는 다른 업무 전반에 쓰이는 진행 알림과 구별되며, 다음 조치에 필요한 산출물 상태를 직접 보고한다.",
    "coverageAreas": [
      "materials",
      "completion"
    ],
    "coveragePurposes": [
      "materials.file.update",
      "completion.file"
    ]
  },
  {
    "key": "business-general-143",
    "source_line": 143,
    "en": "I'll send the link again.",
    "ko": "제가 링크를 다시 보내드리겠습니다.",
    "context": "업무링크 재전송약속",
    "ko_before": "링크를 다시 보내드리겠습니다.",
    "priority": "important",
    "purpose": "파일 재전송",
    "criteria": [],
    "reason": "대상이 링크인 재전송 안내로 113의 파일 재전송과 구체적 대상이 다르다."
  },
  {
    "key": "business-general-144",
    "source_line": 144,
    "en": "I can't access the link.",
    "ko": "저는 링크에 접근할 수 없습니다.",
    "context": "링크접속 불가알림",
    "ko_before": "링크에 접근할 수 없습니다.",
    "priority": "important",
    "purpose": "자료 이용 장애 보고",
    "criteria": [],
    "reason": "링크 접근 장애를 보고하는 실용 변형으로 파일 열기 장애 대표(114)와 매체가 다르다."
  },
  {
    "key": "business-general-145",
    "source_line": 145,
    "en": "Could you verify the access permissions?",
    "ko": "접근 권한을 확인해 주실 수 있을까요?",
    "context": "접근권한 확인요청",
    "ko_before": "접근 권한을 확인해 주시겠어요?",
    "priority": "important",
    "purpose": "접근 권한 확인",
    "criteria": [],
    "reason": "접근 문제를 해결하도록 권한 점검을 요청하는 구체적 조치 요청이다."
  },
  {
    "key": "business-general-146",
    "source_line": 146,
    "en": "I can't edit this document.",
    "ko": "저는 이 문서를 편집할 수 없습니다.",
    "context": "문서편집 불가알림",
    "ko_before": "이 문서를 편집할 수 없습니다.",
    "priority": "important",
    "purpose": "자료 이용 장애 보고",
    "criteria": [],
    "reason": "문서를 볼 수 있지만 편집할 수 없는 별도 장애를 설명하는 데 유용한 변형이다."
  },
  {
    "key": "business-general-147",
    "source_line": 147,
    "en": "Please leave your comments in the document.",
    "ko": "문서에 의견을 남겨 주세요.",
    "context": "문서의견 작성요청",
    "ko_before": "문서에 의견을 남겨 주세요.",
    "priority": "important",
    "purpose": "검토와 의견 요청",
    "criteria": [],
    "reason": "의견을 문서 안에 남기도록 기록 위치를 지정하는 협업 변형으로 대표(122)를 보완한다."
  },
  {
    "key": "business-general-148",
    "source_line": 148,
    "en": "Please check the revised parts.",
    "ko": "수정된 부분들을 확인해 주세요.",
    "context": "수정부분 확인요청",
    "ko_before": "수정한 부분을 확인해 주세요.",
    "priority": "important",
    "purpose": "검토와 의견 요청",
    "criteria": [],
    "reason": "수정 부분에 검토를 집중해 달라는 범위 지정형으로 대표(122)보다 대상이 좁다."
  },
  {
    "key": "business-general-149",
    "source_line": 149,
    "en": "I’ve incorporated your feedback.",
    "ko": "제가 당신의 피드백을 반영했습니다.",
    "context": "상대피드백 반영완료알림",
    "ko_before": "검토 의견을 반영했습니다.",
    "priority": "important",
    "purpose": "피드백 반영",
    "criteria": [],
    "reason": "받은 의견을 적용했음을 알려 검토를 이어가는 실용적인 수정 완료 보고다."
  },
  {
    "key": "business-general-150",
    "source_line": 150,
    "en": "Please let me know if you need more information.",
    "ko": "더 많은 정보가 필요하시면 저에게 알려주세요.",
    "context": "추가정보 필요시알림요청",
    "ko_before": "추가 자료가 필요하면 알려주세요.",
    "priority": "important",
    "purpose": "추가 정보 제공",
    "criteria": [],
    "reason": "추가 정보 필요 시 알려 달라는 제안으로 질문 기회 제공(29)과 기본 소통 목적이 가까운 비동기 변형이다."
  },
  {
    "key": "business-general-151",
    "source_line": 151,
    "en": "Please let me know if you have any questions.",
    "ko": "질문이 있으시면 저에게 알려주세요.",
    "context": "질문사항 발생시알림요청",
    "ko_before": "문의 사항이 있으면 알려주세요.",
    "priority": "important",
    "purpose": "질문 기회 제공",
    "criteria": [],
    "reason": "나중에 질문이 생기면 알려 달라는 문구로 직접 질문을 받는 대표(29)의 비동기 변형이다."
  },
  {
    "key": "business-general-152",
    "source_line": 152,
    "en": "Thank you for checking.",
    "ko": "확인해 주셔서 감사합니다.",
    "context": "내용확인 감사표현",
    "ko_before": "확인해 주셔서 감사합니다.",
    "priority": "supplementary",
    "purpose": "감사 표현",
    "criteria": [],
    "reason": "확인해 준 것에 대한 감사라는 사유별 변형으로 필수 감사 대표(154)에 중복 배치하지 않았다."
  },
  {
    "key": "business-general-153",
    "source_line": 153,
    "en": "Thank you for your quick reply.",
    "ko": "빠른 답변에 감사드립니다.",
    "context": "신속회신 감사표현",
    "ko_before": "빠른 회신 감사합니다.",
    "priority": "important",
    "purpose": "감사 표현",
    "criteria": [],
    "reason": "빠른 회신을 인정하는 관용적 이메일 표현이지만 감사 대표(154) 외의 상황별 변형이다."
  },
  {
    "key": "business-general-154",
    "source_line": 154,
    "en": "Thank you for your help.",
    "ko": "도와주셔서 감사합니다.",
    "context": "업무도움 감사표현",
    "ko_before": "도와주셔서 감사합니다.",
    "priority": "essential",
    "purpose": "감사 표현",
    "criteria": [
      1,
      3
    ],
    "reason": "상대의 도움에 감사를 표하며 협조·문제 해결·지원에 두루 쓰이므로 시간·참석·확인 등 사유별 감사 대신 대표로 삼는다.",
    "coverageAreas": [
      "courtesy"
    ],
    "coveragePurposes": [
      "courtesy.thanks"
    ]
  },
  {
    "key": "business-general-155",
    "source_line": 155,
    "en": "Thank you for informing me.",
    "ko": "저에게 알려주셔서 감사합니다.",
    "context": "정보전달 감사표현",
    "ko_before": "알려주셔서 감사합니다.",
    "priority": "supplementary",
    "purpose": "감사 표현",
    "criteria": [],
    "reason": "정보를 알려준 데 대한 사유별 감사로 대표(154)와 기본 화행이 같고 표현 확장이 쉽다."
  },
  {
    "key": "business-general-156",
    "source_line": 156,
    "en": "Sorry for the inconvenience.",
    "ko": "불편을 드려 죄송합니다.",
    "context": "불편초래 사과표현",
    "ko_before": "불편을 드려 죄송합니다.",
    "priority": "essential",
    "purpose": "사과 표현",
    "criteria": [
      1,
      3
    ],
    "reason": "문제 처리·지연·실수로 끼친 불편에 폭넓게 사과하며 회신 지연(118)·혼란(157) 등 사유별 문구보다 일반적인 대표다.",
    "coverageAreas": [
      "courtesy"
    ],
    "coveragePurposes": [
      "courtesy.impact.apology"
    ]
  },
  {
    "key": "business-general-157",
    "source_line": 157,
    "en": "Sorry for the confusion.",
    "ko": "혼란을 드려 죄송합니다.",
    "context": "혼란초래 사과표현",
    "ko_before": "혼란을 드려 죄송합니다.",
    "priority": "important",
    "purpose": "사과 표현",
    "criteria": [],
    "reason": "혼란을 초래한 데 맞는 실용적 사과지만 포괄적인 불편 사과 대표(156)에 추가할 변형이다."
  },
  {
    "key": "business-general-158",
    "source_line": 158,
    "en": "I sent the wrong file.",
    "ko": "제가 잘못된 파일을 보냈습니다.",
    "context": "파일오전송 실수보고",
    "ko_before": "제가 잘못 보냈습니다.",
    "priority": "important",
    "purpose": "잘못된 파일 전달",
    "criteria": [],
    "reason": "파일을 잘못 보낸 구체적 실수를 인정해 후속 수정 행동을 설명하는 데 유용하다."
  },
  {
    "key": "business-general-159",
    "source_line": 159,
    "en": "I’ll revise it and send it again.",
    "ko": "제가 수정해서 다시 보내드리겠습니다.",
    "context": "해당자료 수정후재전송약속",
    "ko_before": "수정해서 다시 보내드리겠습니다.",
    "priority": "essential",
    "purpose": "수정 후 재전달",
    "criteria": [
      1,
      3
    ],
    "reason": "문서·계획·요청 등을 고쳐 다시 보내겠다는 복구 행동을 약속하며 재심사를 전제하는 197보다 전달 대상과 절차가 넓다.",
    "coverageAreas": [
      "materials",
      "problem",
      "completion"
    ],
    "coveragePurposes": [
      "materials.file.resend",
      "problem.correction.resubmit",
      "completion.deliver"
    ]
  },
  {
    "key": "business-general-160",
    "source_line": 160,
    "en": "I’m sorry I missed that.",
    "ko": "제가 그것을 놓쳐서 죄송합니다.",
    "context": "사항누락 사과표현",
    "ko_before": "확인하지 못해 죄송합니다.",
    "priority": "important",
    "purpose": "사과 표현",
    "criteria": [],
    "reason": "확인 사항을 놓친 데 사과하는 표현으로 사유가 특정되어 대표(156) 이후 익힌다."
  },
  {
    "key": "business-general-161",
    "source_line": 161,
    "en": "I’ll be more careful next time.",
    "ko": "제가 다음번에는 더 주의하겠습니다.",
    "context": "다음기회 주의약속",
    "ko_before": "다음부터 주의하겠습니다.",
    "priority": "important",
    "purpose": "재발 방지 약속",
    "criteria": [],
    "reason": "다음에는 더 주의하겠다고 말하는 실용적인 후속 다짐이지만 실수 뒤에 쓰는 상황에 집중된다."
  },
  {
    "key": "business-general-162",
    "source_line": 162,
    "en": "I'm checking the issue.",
    "ko": "제가 문제를 확인하고 있습니다.",
    "context": "발생문제 확인중보고",
    "ko_before": "문제를 확인하고 있습니다.",
    "priority": "important",
    "purpose": "문제 조사 상태",
    "criteria": [],
    "reason": "문제를 확인 중이라고 보고하는 구체적 진행 상태로 후속 업데이트 대표(172)를 보완한다."
  },
  {
    "key": "business-general-163",
    "source_line": 163,
    "en": "I’m investigating the cause.",
    "ko": "제가 원인을 조사하고 있습니다.",
    "context": "문제원인 조사중보고",
    "ko_before": "현재 원인을 파악 중입니다.",
    "priority": "essential",
    "legacyPriorityDefaults": ["important"],
    "purpose": "문제 원인 조사 보고",
    "criteria": [1, 2],
    "reason": "문제가 발생한 뒤 원인을 조사 중이라고 알리면 상대의 해결 기대와 후속 대응을 조율할 수 있다. 원인을 아직 단정하지 않으면서 문제 대응의 핵심 단계를 분명히 보고하는 표현이다.",
    "coverageAreas": [
      "problem"
    ],
    "coveragePurposes": [
      "problem.cause.investigate"
    ]
  },
  {
    "key": "business-general-164",
    "source_line": 164,
    "en": "I haven’t determined the exact cause yet.",
    "ko": "저는 정확한 원인을 아직 파악하지 못했습니다.",
    "context": "정확한원인 미파악보고",
    "ko_before": "아직 정확한 원인은 모릅니다.",
    "priority": "important",
    "purpose": "불확실성 전달",
    "criteria": [],
    "reason": "아직 정확한 원인을 모른다는 보고로 일반적인 확신 유보 대표(40)의 원인 조사 변형이다."
  },
  {
    "key": "business-general-165",
    "source_line": 165,
    "en": "It's taking longer than expected.",
    "ko": "예상한 것보다 더 많은 시간이 걸리고 있습니다.",
    "context": "업무진행 지연보고",
    "ko_before": "예상보다 시간이 더 걸리고 있습니다.",
    "priority": "essential",
    "purpose": "예상보다 지연 보고",
    "criteria": [
      1,
      3
    ],
    "reason": "작업·검토·승인 등이 예상보다 오래 걸림을 과도한 사유 단정 없이 알리며 일정 지연(166)·오늘 미완료(170)보다 넓다.",
    "coverageAreas": [
      "progress"
    ],
    "coveragePurposes": [
      "progress.status.delay"
    ]
  },
  {
    "key": "business-general-166",
    "source_line": 166,
    "en": "The schedule is slightly behind.",
    "ko": "일정이 약간 뒤처져 있습니다.",
    "context": "업무일정 소폭지연보고",
    "ko_before": "일정이 조금 지연되고 있습니다.",
    "priority": "important",
    "purpose": "예상보다 지연 보고",
    "criteria": [],
    "reason": "일정이 조금 뒤처진다는 구체적 지연 보고로 시간 초과 기본형(165)을 보완한다."
  },
  {
    "key": "business-general-167",
    "source_line": 167,
    "en": "So far, the work is progressing as planned.",
    "ko": "지금까지 작업은 계획대로 진행되고 있습니다.",
    "context": "현재업무 계획대로진행보고",
    "ko_before": "현재까지는 계획대로 진행 중입니다.",
    "priority": "essential",
    "legacyPriorityDefaults": ["important"],
    "purpose": "계획 대비 진행 보고",
    "criteria": [1, 2],
    "reason": "업무가 계획대로 진행 중이라는 상태를 간결하게 알려 일정 점검과 협업자의 판단을 돕는다. 진행 정상 여부는 단순 업데이트 약속이나 지연 통보로 대체되지 않는 대표적인 상태 보고다.",
    "coverageAreas": [
      "progress"
    ],
    "coveragePurposes": [
      "progress.status.normal"
    ]
  },
  {
    "key": "business-general-168",
    "source_line": 168,
    "en": "The expected completion date is Friday.",
    "ko": "예상 완료일은 금요일입니다.",
    "context": "예상완료일 금요일안내",
    "ko_before": "예상 완료일은 금요일입니다.",
    "priority": "important",
    "purpose": "예상 완료일 보고",
    "criteria": [],
    "reason": "예상 완료일을 알려 납기 기대를 맞추는 데 유용하지만 문장 자체는 금요일로 고정되어 있다."
  },
  {
    "key": "business-general-169",
    "source_line": 169,
    "en": "I need one more day to complete it.",
    "ko": "저는 그것을 완료하려면 하루가 더 필요합니다.",
    "context": "업무완료 하루추가필요안내",
    "ko_before": "완료까지 하루 더 필요합니다.",
    "priority": "important",
    "purpose": "예상보다 지연 보고",
    "criteria": [],
    "reason": "완료에 하루 더 필요하다고 수량까지 밝히는 지연 설명으로 대표(165) 이후 익힌다."
  },
  {
    "key": "business-general-170",
    "source_line": 170,
    "en": "I may not be able to finish today.",
    "ko": "저는 오늘 끝내지 못할 수도 있습니다.",
    "context": "오늘완료 불가가능성알림",
    "ko_before": "오늘 안에 끝내기 어려울 것 같습니다.",
    "priority": "essential",
    "legacyPriorityDefaults": ["important"],
    "purpose": "당일 완료 위험 보고",
    "criteria": [1, 2],
    "reason": "오늘 끝내지 못할 가능성을 미리 알려 마감 기대와 대체 계획을 조정하게 한다. 이미 발생한 일반 지연 보고와 달리 완료 전 위험을 앞서 알리는 목적이 뚜렷하다.",
    "coverageAreas": [
      "progress"
    ],
    "coveragePurposes": [
      "progress.status.risk"
    ]
  },
  {
    "key": "business-general-171",
    "source_line": 171,
    "en": "Could we extend the deadline?",
    "ko": "우리가 마감일을 연장할 수 있을까요?",
    "context": "업무기한 연장요청",
    "ko_before": "마감일을 연장할 수 있을까요?",
    "priority": "essential",
    "purpose": "마감 연장 요청",
    "criteria": [
      1,
      3
    ],
    "reason": "지연 사실을 알리는 것(165)과 달리 마감일 변경이라는 상대의 조치를 직접 요청해 작업·검토·제출에 두루 쓰인다.",
    "coverageAreas": [
      "schedule"
    ],
    "coveragePurposes": [
      "schedule.deadline.extend"
    ]
  },
  {
    "key": "business-general-172",
    "source_line": 172,
    "en": "I’ll provide an update.",
    "ko": "갱신하겠습니다.",
    "context": "업무진행 후속보고",
    "ko_before": "진행 상황을 공유하겠습니다.",
    "priority": "essential",
    "purpose": "진행 상황 업데이트 약속",
    "criteria": [
      1,
      3
    ],
    "reason": "특정 사건을 고정하지 않고 업무 현황을 알려주겠다고 약속하며 일정·완료·결정 알림(97·175·198)보다 대상이 넓다.",
    "coverageAreas": [
      "progress"
    ],
    "coveragePurposes": [
      "progress.status.update"
    ]
  },
  {
    "key": "business-general-173",
    "source_line": 173,
    "en": "I've completed about half of it.",
    "ko": "제가 그것의 약 절반을 완료했습니다.",
    "context": "업무진행 절반완료보고",
    "ko_before": "현재 절반 정도 완료했습니다.",
    "priority": "important",
    "purpose": "진행률 보고",
    "criteria": [],
    "reason": "절반 정도 완료했다는 수치 있는 보고로 유용하지만 진행 상태가 그 시점에 해당해야 한다."
  },
  {
    "key": "business-general-174",
    "source_line": 174,
    "en": "It's almost done.",
    "ko": "그것은 거의 끝났습니다.",
    "context": "업무완료 임박보고",
    "ko_before": "거의 완료했습니다.",
    "priority": "important",
    "purpose": "진행률 보고",
    "criteria": [],
    "reason": "거의 끝났다는 상태를 전달하는 실용적인 완료 직전 보고다."
  },
  {
    "key": "business-general-175",
    "source_line": 175,
    "en": "I’ll notify you as soon as it’s complete.",
    "ko": "제가 완료되는 즉시 알려드리겠습니다.",
    "context": "업무완료 즉시통보약속",
    "ko_before": "완료되면 바로 알려드리겠습니다.",
    "priority": "important",
    "purpose": "확정 후 알림",
    "criteria": [],
    "reason": "완료 즉시 알린다는 사건 조건형 약속으로 일반 업데이트 대표(172)를 보완한다."
  },
  {
    "key": "business-general-176",
    "source_line": 176,
    "en": "The review isn't finished yet.",
    "ko": "검토는 아직 끝나지 않았습니다.",
    "context": "업무검토 미완료보고",
    "ko_before": "검토가 아직 끝나지 않았습니다.",
    "priority": "important",
    "purpose": "검토 미완료",
    "criteria": [],
    "reason": "검토가 아직 끝나지 않았다는 상태로 준비 미완료(141)와 업무 단계가 다르다."
  },
  {
    "key": "business-general-177",
    "source_line": 177,
    "en": "We need to verify a few more things.",
    "ko": "우리는 몇 가지를 더 확인해야 합니다.",
    "context": "추가사항 확인필요안내",
    "ko_before": "추가 확인이 필요합니다.",
    "priority": "important",
    "purpose": "추가 검증 필요",
    "criteria": [],
    "reason": "확인할 사항이 더 있다는 팀 단위 판단으로 확인 대상 수가 지정된 변형이다."
  },
  {
    "key": "business-general-178",
    "source_line": 178,
    "en": "We need to review this part again.",
    "ko": "우리는 이 부분을 다시 검토해야 합니다.",
    "context": "해당부분 재검토필요안내",
    "ko_before": "이 부분은 다시 검토해야 합니다.",
    "priority": "important",
    "purpose": "재검토 필요",
    "criteria": [],
    "reason": "현재 부분을 다시 검토할 필요를 전달하는 실용적 제안이나 재검토 대상이 있는 상황에 한정된다."
  },
  {
    "key": "business-general-179",
    "source_line": 179,
    "en": "The next step is testing.",
    "ko": "다음 단계는 테스트입니다.",
    "context": "다음단계 테스트안내",
    "ko_before": "다음 단계는 테스트입니다.",
    "priority": "important",
    "purpose": "다음 절차 안내",
    "criteria": [],
    "reason": "테스트가 다음 단계라는 구체적 프로젝트 안내로 유용하지만 업무 절차와 단계명이 고정되어 있다."
  },
  {
    "key": "business-general-180",
    "source_line": 180,
    "en": "I’ll prioritize this task.",
    "ko": "제가 이 작업을 우선순위에 두겠습니다.",
    "context": "해당업무 우선처리약속",
    "ko_before": "이 작업을 먼저 처리하겠습니다.",
    "priority": "important",
    "purpose": "업무 우선 처리",
    "criteria": [],
    "reason": "이 업무를 우선하겠다는 약속으로 우선순위 확인 질문(181)과 달리 수행 입장을 통보한다."
  },
  {
    "key": "business-general-181",
    "source_line": 181,
    "en": "I'd like to set the order of the tasks.",
    "ko": "작업의 순서를 정하고 싶습니다.",
    "context": "작업순서 설정의향",
    "ko_before": "우선순위를 확인하고 싶습니다.",
    "priority": "essential",
    "purpose": "작업 순서 설정",
    "criteria": [
      1,
      3
    ],
    "reason": "여러 업무의 처리 순서를 정하겠다는 의사를 전달하는 표현이다.",
    "coverageAreas": [
      "decision"
    ],
    "coveragePurposes": [
      "decision.task.order"
    ]
  },
  {
    "key": "business-general-182",
    "source_line": 182,
    "en": "Who is responsible for this task?",
    "ko": "이 작업을 누가 담당하나요?",
    "context": "업무담당자 질문",
    "ko_before": "이 작업의 담당자는 누구인가요?",
    "priority": "supplementary",
    "purpose": "담당자 확인",
    "criteria": [],
    "reason": "this task라는 대상 지정 외에는 담당자 질문 대표(57)와 사실상 동일하다."
  },
  {
    "key": "business-general-183",
    "source_line": 183,
    "en": "I’ll take responsibility for this task.",
    "ko": "제가 이 작업에 대한 책임을 맡겠습니다.",
    "context": "해당업무 책임수락",
    "ko_before": "이 작업을 제가 맡겠습니다.",
    "priority": "important",
    "purpose": "업무 담당 수락",
    "criteria": [],
    "reason": "책임을 맡겠다는 유용한 약속이나 단순 수행 수락보다 책임 강조가 강해 상황에 맞춰 익힌다."
  },
  {
    "key": "business-general-184",
    "source_line": 184,
    "en": "Could you handle this task?",
    "ko": "이 업무를 맡아주시겠어요?",
    "context": "업무담당 요청",
    "ko_before": "이 작업을 맡아 주시겠어요?",
    "priority": "essential",
    "purpose": "업무 수행 요청",
    "criteria": [
      1,
      3
    ],
    "reason": "상대에게 업무를 맡아줄 수 있는지 정중히 요청하며 잠깐 도움 요청(186)과 달리 일의 수행 책임을 부탁한다.",
    "coverageAreas": [
      "collaboration"
    ],
    "coveragePurposes": [
      "collaboration.task.delegate"
    ]
  },
  {
    "key": "business-general-185",
    "source_line": 185,
    "en": "I need some help.",
    "ko": "저는 약간의 도움이 필요합니다.",
    "context": "업무지원 필요표현",
    "ko_before": "도움이 필요합니다.",
    "priority": "important",
    "purpose": "도움 요청",
    "criteria": [],
    "reason": "도움이 필요하다고 알리는 표현이지만 상대에게 직접 협조를 구하는 대표(186)가 행동을 더 명확히 한다."
  },
  {
    "key": "business-general-186",
    "source_line": 186,
    "en": "Could you help me for a moment?",
    "ko": "잠시 저를 도와주시겠어요?",
    "context": "업무지원 요청",
    "ko_before": "잠시 도와주실 수 있나요?",
    "priority": "essential",
    "purpose": "도움 요청",
    "criteria": [
      1,
      3
    ],
    "reason": "동료에게 잠시 도와 달라고 직접 정중히 요청해 다양한 문제 해결에 쓸 수 있으며 필요 상태만 말하는 185 대신 대표로 삼는다.",
    "coverageAreas": [
      "communication",
      "collaboration"
    ],
    "coveragePurposes": [
      "communication.help.request",
      "collaboration.help.request"
    ]
  },
  {
    "key": "business-general-187",
    "source_line": 187,
    "en": "I’d like your advice.",
    "ko": "저는 당신의 조언을 받고 싶습니다.",
    "context": "상대조언 요청",
    "ko_before": "조언을 구하고 싶습니다.",
    "priority": "important",
    "purpose": "조언 요청",
    "criteria": [],
    "reason": "판단에 관한 조언을 구하는 데 유용하지만 일반 도움 요청(186)의 특정 지원 방식이다."
  },
  {
    "key": "business-general-188",
    "source_line": 188,
    "en": "Is there anything I've missed?",
    "ko": "제가 놓친 것이 있나요?",
    "context": "누락사항 유무질문",
    "ko_before": "제가 놓친 부분이 있을까요?",
    "priority": "supplementary",
    "purpose": "누락 확인",
    "criteria": [],
    "reason": "빠뜨린 사항이 있는지 묻는 목적이 대표(37)와 사실상 같아 긴 변형은 보조로 둔다."
  },
  {
    "key": "business-general-189",
    "source_line": 189,
    "en": "Can we proceed with this method?",
    "ko": "우리가 이 방법으로 진행해도 될까요?",
    "context": "해당방법 진행가능여부확인",
    "ko_before": "이 방법으로 진행해도 될까요?",
    "priority": "essential",
    "purpose": "진행 허락 확인",
    "criteria": [
      1,
      3
    ],
    "reason": "업무 방안대로 진행해도 되는지 상대의 동의를 확인하며 단순 진행 선언(190)과 달리 허락·합의가 필요한 시점에 쓰인다.",
    "coverageAreas": [
      "decision"
    ],
    "coveragePurposes": [
      "decision.method.confirm"
    ]
  },
  {
    "key": "business-general-190",
    "source_line": 190,
    "en": "I’ll proceed with this approach.",
    "ko": "제가 이 접근 방식으로 진행하겠습니다.",
    "context": "해당방식 진행예고",
    "ko_before": "이 방향으로 진행하겠습니다.",
    "priority": "important",
    "purpose": "진행 방식 통보",
    "criteria": [],
    "reason": "정한 방식으로 진행하겠다고 알리는 실용적 보고로 허락을 묻는 189와 다른 화행이다."
  },
  {
    "key": "business-general-191",
    "source_line": 191,
    "en": "I’ll make a decision after an internal review.",
    "ko": "제가 내부 검토 후 결정을 내리겠습니다.",
    "context": "업무결정 내부검토후결정약속",
    "ko_before": "내부 확인 후 결정하겠습니다.",
    "priority": "important",
    "purpose": "검토 후 결정",
    "criteria": [],
    "reason": "내부 검토 후 결정하겠다는 절차별 약속으로 결정 시점을 미루는 특정 사유가 필요하다."
  },
  {
    "key": "business-general-192",
    "source_line": 192,
    "en": "I’ll confirm this with the person responsible.",
    "ko": "제가 담당자와 이것을 확인하겠습니다.",
    "context": "해당사항 담당자확인약속",
    "ko_before": "담당자에게 확인하겠습니다.",
    "priority": "important",
    "purpose": "담당자 확인 후 답변",
    "criteria": [],
    "reason": "담당자에게 확인하겠다는 구체적 조치로 일반 확인·회신 대표(41)를 보완한다."
  },
  {
    "key": "business-general-193",
    "source_line": 193,
    "en": "We need approval.",
    "ko": "우리는 승인이 필요합니다.",
    "context": "업무승인 필요안내",
    "ko_before": "승인이 필요합니다.",
    "priority": "important",
    "purpose": "승인 요청",
    "criteria": [],
    "reason": "승인이 필요함을 알리는 전제 설명으로 실제 조치를 직접 요청하는 대표(194)보다 간접적이다."
  },
  {
    "key": "business-general-194",
    "source_line": 194,
    "en": "Could you approve this?",
    "ko": "이것을 승인해 주시겠어요?",
    "context": "업무내용 승인요청",
    "ko_before": "승인해 주시겠어요?",
    "priority": "essential",
    "purpose": "승인 요청",
    "criteria": [
      1
    ],
    "reason": "상대에게 승인을 직접 요청하는 기본형으로 필요성 안내(193)·결과 보고(195·196)와 달리 다음 업무를 가능하게 하는 행동을 구한다.",
    "coverageAreas": [
      "collaboration"
    ],
    "coveragePurposes": [
      "collaboration.approval.request"
    ]
  },
  {
    "key": "business-general-195",
    "source_line": 195,
    "en": "The request has been approved.",
    "ko": "요청이 승인되었습니다.",
    "context": "제출요청 승인완료알림",
    "ko_before": "승인이 완료되었습니다.",
    "priority": "important",
    "purpose": "승인 결과 보고",
    "criteria": [],
    "reason": "요청이 승인되었다는 결과를 알려 후속 업무를 시작하게 하는 실용 보고다."
  },
  {
    "key": "business-general-196",
    "source_line": 196,
    "en": "I haven't received approval yet.",
    "ko": "저는 아직 승인을 받지 못했습니다.",
    "context": "업무승인 미수령알림",
    "ko_before": "아직 승인을 받지 못했습니다.",
    "priority": "important",
    "purpose": "승인 결과 보고",
    "criteria": [],
    "reason": "아직 승인받지 못했다는 상태를 알려 진행 기대를 조정하는 데 유용하다."
  },
  {
    "key": "business-general-197",
    "source_line": 197,
    "en": "I’ll revise it and resubmit it.",
    "ko": "제가 수정 후 다시 제출하겠습니다.",
    "context": "제출자료 수정후재제출약속",
    "ko_before": "수정 후 다시 제출하겠습니다.",
    "priority": "important",
    "purpose": "수정 후 재전달",
    "criteria": [],
    "reason": "수정 후 다시 심사를 받는 제출 절차로 대표(159)의 구체적인 업무 흐름 변형이다."
  },
  {
    "key": "business-general-198",
    "source_line": 198,
    "en": "I’ll notify you as soon as a decision is made.",
    "ko": "제가 결정이 내려지는 즉시 알려드리겠습니다.",
    "context": "결정결과 즉시통보약속",
    "ko_before": "결정되면 바로 알려드리겠습니다.",
    "priority": "important",
    "purpose": "확정 후 알림",
    "criteria": [],
    "reason": "결정이 나면 즉시 알린다는 사건 조건형 약속으로 대표(172)에 결정 시점을 추가한 형태다."
  },
  {
    "key": "business-general-199",
    "source_line": 199,
    "en": "This isn't my area of responsibility.",
    "ko": "이것은 제 책임 영역이 아닙니다.",
    "context": "담당영역 해당없음안내",
    "ko_before": "이 부분은 제 담당이 아닙니다.",
    "priority": "important",
    "purpose": "담당자에게 전달",
    "criteria": [],
    "reason": "내 담당이 아니라고 경계를 설명하는 데 유용하지만 후속 연결까지 제시하는 대표(200)가 문제 해결을 더 이어준다."
  },
  {
    "key": "business-general-200",
    "source_line": 200,
    "en": "I’ll forward this to the person responsible.",
    "ko": "제가 이것을 담당자에게 전달하겠습니다.",
    "context": "해당내용 담당자전달약속",
    "ko_before": "담당자에게 전달하겠습니다.",
    "priority": "essential",
    "purpose": "담당자에게 전달",
    "criteria": [
      1,
      3
    ],
    "reason": "직접 처리할 수 없는 문의·요청·자료를 담당자에게 연결하겠다는 건설적인 약속으로 단순 담당 부인(199)보다 다음 행동을 명확히 한다.",
    "coverageAreas": [
      "collaboration"
    ],
    "coveragePurposes": [
      "collaboration.owner.handoff"
    ]
  }
];
// Keep recognition of previously shipped contexts for cards with edited English.
var legacyContexts=(typeof module==='object'&&module.exports?require('./business-contexts'):root.BusinessContexts).previousContexts;
var names=['영어업무(일반)','업무대화 일반','업무대화(일반)'];
// Historic repository defaults before the audited tier revision. Migration accepts these only when card text is unchanged and no direct user edit exists.
var legacyPriorityDefaults={"business-general-013":["essential"],"business-general-027":["essential"],"business-general-037":["essential"],"business-general-142":["important"],"business-general-163":["important"],"business-general-167":["important"],"business-general-170":["important"]};
var selectionCriteria=[{"id":"work-frequency","label":"실제 직장에서 자주 사용되는가?"},{"id":"importance","label":"대체하기 어려울 만큼 중요하며, 없으면 업무 진행에 영향이 있는가?"},{"id":"versatility","label":"하나의 표현으로 여러 업무 상황에 대응할 수 있는가?"},{"id":"impact","label":"표현을 모르면 업무 진행이나 조율이 실질적으로 어려워지는가?"},{"id":"low-overlap","label":"기존 필수 표현과 의사소통 목적이 중복되지 않는가?"},{"id":"workflow-balance","label":"업무 시작부터 완료까지 전체 과정을 균형 있게 다루는가?"}];
var coverageAreas=[{"id":"communication","label":"기본 대화·의사소통","purposes":[["communication.conversation.start","대화 시작 전 가능 여부 확인"],["communication.pause.request","잠시 대기 요청"],["communication.clarification.repeat","상대 발언 반복 요청"],["communication.clarification.slow","설명 속도 조정 요청"],["communication.clarification.explain","불명확한 부분의 추가 설명 요청"],["communication.understanding.check","상대 설명 이해 여부 확인"],["communication.questions.invite","질문 요청"],["communication.help.request","업무 도움 요청"]]},{"id":"meeting","label":"회의 진행","purposes":[["meeting.open","회의 시작"],["meeting.agenda.transition","안건·항목 전환"],["meeting.discussion.close","논의 종료"],["meeting.summary","논의 요약"]]},{"id":"decision","label":"의견 교환·의사결정","purposes":[["decision.opinion.request","상대 의견 질문"],["decision.opinion.agree","상대 의견 동의"],["decision.option.alternative","대안 검토 제안"],["decision.uncertainty.express","불확실성 표현"],["decision.method.confirm","진행 방안 동의 확인"],["decision.task.order","작업 순서 설정"]]},{"id":"schedule","label":"일정·기한 조정","purposes":[["schedule.deadline.ask","업무 기한 확인"],["schedule.adjust","일정 변경 조정"],["schedule.time.propose","가능 시간 제안 요청"],["schedule.time.accept","제안 시간 수락"],["schedule.time.decline","제안 시간 거절"],["schedule.deadline.extend","기한 연장 요청"]]},{"id":"materials","label":"자료·이메일","purposes":[["materials.file.attach","파일 첨부·전달"],["materials.file.access.problem","파일 접근 장애 보고"],["materials.review.request","자료 검토·의견 요청"],["materials.file.update","수정 파일 완료 보고"],["materials.file.resend","수정 자료 재전달"],["materials.email.receipt","이메일 수신 확인"]]},{"id":"collaboration","label":"업무 지시·협업","purposes":[["collaboration.owner.identify","업무 담당자 확인"],["collaboration.task.delegate","업무 수행 요청"],["collaboration.help.request","업무 지원 요청"],["collaboration.approval.request","업무 승인 요청"],["collaboration.owner.handoff","담당자에게 전달"]]},{"id":"progress","label":"진행 상황 보고","purposes":[["progress.check.and.reply","확인 후 회신 약속"],["progress.status.normal","계획 대비 정상 진행 보고"],["progress.status.update","진행 상황 후속 보고"],["progress.status.delay","예상보다 지연 보고"],["progress.status.risk","당일 완료 위험 보고"]]},{"id":"problem","label":"문제 발생·해결","purposes":[["problem.report","문제·장애 보고"],["problem.cause.investigate","문제 원인 조사 보고"],["problem.fix.request","문제 해결 조치 요청"],["problem.correction.resubmit","수정 후 재제출"]]},{"id":"completion","label":"완료·결과 보고","purposes":[["completion.file","수정 파일 완료 보고"],["completion.deliver","결과물 전달"],["completion.summary","논의·작업 결과 요약"],["completion.task.general","일반 업무 완료 보고"]]},{"id":"courtesy","label":"감사·사과","purposes":[["courtesy.interruption.apology","대화 중 끼어들기 사과"],["courtesy.thanks","도움 감사"],["courtesy.impact.apology","불편 초래 사과"]]}];
var labels={essential:'필수',important:'중요',supplementary:'보조'};
function valid(value){return Object.prototype.hasOwnProperty.call(labels,value);}
function business(card,chapters){return chapters.some(function(ch){return ch.id===card.chapterId&&names.indexOf(ch.name)!==-1;});}
function passed(card){return typeof card.firstCorrectAt==='number'&&isFinite(card.firstCorrectAt)&&card.firstCorrectAt>0;}
function normalize(text){return String(text||'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();}
function identify(card){
  var keyed=items.find(function(x){return x.key===card.businessTemplateKey;});if(keyed)return keyed;
  var exact=items.find(function(x){return normalize(x.en)===normalize(card.en);});if(exact)return exact;
  // For edited English, accept only a unique, non-conflicting surviving translation/context.
  var matches=items.filter(function(x,i){return (card.context&&(card.context===x.context||card.context===legacyContexts[i]))||(card.ko&&(card.ko===x.ko||card.ko===x.ko_before));});
  return matches.length===1?matches[0]:null;
}
function migrate(cards,chapters){
  var changed=false;
  cards.forEach(function(c){
    if(!business(c,chapters))return;
    var source=identify(c);if(!source)return;
    if(!c.businessTemplateKey){c.businessTemplateKey=source.key;changed=true;}
    if(c.priority==null){c.priority=source.priority;changed=true;}
    // Never infer firstCorrectAt from stage, everAnswered, retests or aggregate statistics.
  });return changed;
}
function plan(pool,chapters,time){
  var managed=pool.filter(function(c){return business(c,chapters)&&valid(c.priority);});
  var essential=managed.filter(function(c){return c.priority==='essential';});
  var important=managed.filter(function(c){return c.priority==='important';});
  function due(c){return (c.everAnswered||passed(c))&&c.dueAt<=time;}
  function unpassed(c){return !passed(c)&&c.dueAt<=time&&!due(c);}
  function reviews(list){return list.filter(due).sort(function(a,b){return a.dueAt-b.dueAt||a.id-b.id;});}
  var essentialDue=reviews(essential),blocked=essential.some(function(c){return !passed(c);})||essentialDue.length>0;
  return {managedCount:managed.length,blocked:blocked,tiers:[
    {review:true,cards:essentialDue},{review:false,cards:essential.filter(unpassed)},
    {review:true,cards:blocked?[]:reviews(important)}, {review:false,cards:blocked?[]:important.filter(unpassed)}
  ],legacy:pool.filter(function(c){return managed.indexOf(c)===-1;})};
}
function progress(cards,chapters,time){
  var scoped=cards.filter(function(c){return business(c,chapters);}),out={total:scoped.length,unclassified:0};
  Object.keys(labels).forEach(function(key){var list=scoped.filter(function(c){return c.priority===key;});out[key]={total:list.length,passed:list.filter(passed).length,due:list.filter(function(c){return(c.everAnswered||passed(c))&&c.dueAt<=time;}).length};});
  out.unclassified=scoped.filter(function(c){return !valid(c.priority);}).length;
  out.importantAllowed=out.essential.passed===out.essential.total&&out.essential.due===0;return out;
}
var api={items:items,selectionCriteria:selectionCriteria,coverageAreas:coverageAreas,legacyPriorityDefaults:legacyPriorityDefaults,labels:labels,valid:valid,business:business,passed:passed,identify:identify,migrate:migrate,plan:plan,progress:progress};
if(typeof module==='object'&&module.exports)module.exports=api;else root.BusinessPriority=api;
})(typeof window!=='undefined'?window:globalThis);
