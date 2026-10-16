# 실제 위임 업무: MAGI 첫 실사용 구성 결정

MAGI를 통해 반복 설명·교정 없이 지적노동을 맡기는 목적 아래 첫 사용 구성을 기술적으로 결정하고, 사람이 검토 가능한 업무 패키지를 완성하세요. 제공된 sources.md는 이번 세션에 확인한 자료이며 문서 주장/소스/직접 시험을 구분하세요. 새 웹조사·제품 설치·외부 전달은 필요 없습니다.

현재 로컬 작업 기록에 루트 runtime-decision과 기존 child composition-comparison이 있습니다. 먼저 실제 조회로 기존 작업을 확인하고, 분해·추가작업을 기록한 뒤 수행하세요. 비교 작업은 새로 만들지 말고 재사용합니다. 선택·통합 leaf의 goal은 composition-selection으로 기록하세요. 목표/완료기준을 적당히 나누고 비교→선택→검증을 수행하세요.

최종 산출물:
- comparison.md: Hermes/Letta/OpenClaw/현재 작은 adapter+기존 실행 도구의 역할·기억·추가구현·근거 한계를 비교. 실제 벤치마크가 없다는 점 명시.
- decision.md: 한국어로 추천 첫 구성, 선택/제외 이유, 실행 경로와 역할 책임·입출력·의존성, 검증 방법, 미검증을 분명히 적은 실행 가능한 기술 결정. 기존 제품들을 실제 설치했다거나 범용 학습 효과를 입증했다고 주장하지 않기.
- final.md: 사용자가 무엇을 얻었고 다음 실제 작업을 어떻게 맡기는지 한 페이지 안내. 파일/기능 목록만 나열하지 않기.

쓰기·작업 완료는 실제 CLI tracker.py를 사용하고, 산출물 파일 SHA-256 증거와 함께 leaf부터 root까지 완료하세요. tracker 상태 파일 직접 편집 금지. 소스 코드 수정 금지. root workspace 밖 쓰기·외부 이슈 등록·서브에이전트 생성 금지. 필요하면 내부 책임 분해를 짧게 기록하고 작업을 완결하세요. 도구 request JSON과 응답을 calls.json에 모아 실제 수행·실패·회복 흔적을 남기세요. 최종 응답에는 산출물·실제 완료 IDs·검증 한계만 간략히 보고하세요.

실행: python3 /Users/changjin/Documents/Codex/2026-10-16/new-chat-2/work/MAGI/scripts/work_pilot/tracker.py /Users/changjin/Documents/Codex/2026-10-16/new-chat-2/work/MAGI/experiments/recursive-work/runs/initial/state.json REQUEST.json
workspace: /Users/changjin/Documents/Codex/2026-10-16/new-chat-2/work/MAGI/experiments/recursive-work/runs/initial
