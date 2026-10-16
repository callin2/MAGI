# 경험 학습 사례와 MAGI 재사용 결정 — #10

확인일: 2026-10-16 UTC. 공개 문서(D), 소스 확인(C), 원저자 실험(A), MAGI 직접 시험(M)을 구분한다. 현재 표에는 M이 없다. 수치 우월성은 이 문서에서 채택 근거로 사용하지 않는다.

| 사례·근거 | 경험 입력·트리거 / 바뀌는 것 | 유지·수정 / 가져올 부분 | 미검증·제외 |
|---|---|---|---|
| Hermes D: [profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles), [memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory) | 에이전트가 memory 도구로 사실·교훈을 갱신. profile마다 memory·skills·세션 상태 분리 | 디스크 저장 후 새 세션의 고정 snapshot으로 읽는 방식. profile과 실행을 구별하는 개념 재사용 | profile은 OS 접근 통제가 아님. 동시 프로세스가 같은 home을 쓰는 것은 문서상 경고 대상. MAGI 역할별 효과는 검증 안 됨 |
| Letta D: [stateful agents](https://docs.letta.com/concepts/stateful-agents), [context repositories](https://www.letta.com/blog/context-repositories/) | 같은 영속 agent가 여러 대화를 가짐. 로컬 파일·git 이력으로 context 관리, reflection으로 갱신 | 정체성/대화 구별, git 버전·되돌리기, 필요한 파일만 읽는 공개 방식 재사용 | 새 역할의 지식 승계·충돌 해결은 별도 정책 필요. 서비스/로그인 의존 도입은 작은 시험에 필수가 아님 |
| Letta A: [skill learning](https://www.letta.com/blog/skill-learning/) | 궤적·검증 피드백 → reflection → skill 생성. 문서 예시는 /skill 명령 | 교정이 포함된 경험과 전이 과제 구별, 로그와 정제 교훈 비교라는 실험 패턴 조합 | 원저자 Terminal Bench 실험을 MAGI 재현으로 간주하지 않음. 수동 트리거 사례만으로 완전 자동 학습을 주장하지 않음 |
| OpenClaw D: [Skill Workshop](https://docs.openclaw.ai/tools/skill-workshop) | 어려운 반복 절차나 잘못된 learned skill을 수정. turn·background·/learn 경로, agent별 절차 파일 | 변경 전 버전 보존, archive/restore, facts와 procedures 구별을 조합 | 현재 세션 snapshot과 새 세션 적용을 구별해야 함. background 주기와 30일 정리 기본값은 MAGI에 자동 도입하지 않음 |
| ACE D/C: [repo](https://github.com/ace-agent/ace), [고정 소스](https://github.com/ace-agent/ace/blob/82709de050e1db6e6ef2f07bcb0393560b94992a/playbook_utils.py) | generator 궤적 → reflector → curator delta. bullet ID와 helpful/harmful 계수 | 전체 이력을 계속 다시 쓰지 않고 교훈을 국소 수정하는 방식, 사용 항목 ID 추적을 조합 | 해당 소스의 apply_curator_operations는 ADD를 처리하며 UPDATE/MERGE/DELETE는 TODO. README의 넓은 정리 설명만으로 철회를 구현 완료라고 볼 수 없음. 카운터만으로 진실 판정하지 않음 |
| DGM A: [원저자 연구](https://sakana.ai/dgm/) | 실행 평가 후 에이전트 코드 변경, 변형 archive를 탐색 | 변형과 평가 결과를 보존하고 실패도 버리지 않는 실험 원칙 참고 | 이번 요구는 역할 경험의 전이이므로 자기 코드 진화 엔진은 최소 구현에서 제외. 그 효과를 부정하는 결정은 아님 |

## 조합 방향과 공백

가져올 기초는 기존 git/파일 기반 지속·버전 관리, JSON 자료 계약, 새 대화에 관련 교훈을 제공하는 기존 에이전트 실행 능력이다. 전체 Hermes/Letta/OpenClaw 런타임을 다시 구현하지 않는다. 제품 설치·이관은 이 작은 검증의 선행 조건으로 강제하지 않는다.

MAGI의 추가 부분은 (1) 경험과 교훈 후보의 근거 연결, (2) 승인된 목적 아래 기술 검증으로 확정 가능한 항목과 새로운 가치 선택 구분, (3) 역할/프로젝트별 범위와 충돌·철회, (4) 실제 전이·총비용 반증이다. 특정 엔진을 최종 선정했다는 뜻은 아니다. 독립 설계 검토 후 최소 실험 adapter를 정한다.

| 경로 | 재사용 가능한 기초 | MAGI가 명시할 공백 |
|---|---|---|
| 경험 → 후보 | 에이전트 reflection/skill 생성 패턴 | 원인 가설과 관측 사실 분리, 감정만으로 확정 금지 |
| 후보 → 검증 → 반영 | 기존 시험·git diff·버전 관리 | 기술/가치 판단 경계, 승격/보류/기각 조건 |
| 반영 → 다음 세션 | 지속 파일 + 새 실행의 관련 파일 조회 | 역할·지속 상태 ID, 실제 읽은 revision, 즉시 철회 처리 |
| 재사용 → 효과 | 기존 모델 실행·평가 도구 | 별도 과제, no-memory/log/lesson 대조, 생성·검색까지 총비용 |

## 우리 협업 레시피

원천은 사용자가 이 대화에서 반복해 명시한 교정과 현재 확인 가능한 이슈 작업이다. 과거 수 주의 전체 로그를 분석했다고 주장하지 않는다.

| 문제 / 기대 행동 | 적용 조건 | 예외·수정/기각 조건 | 관측 지표 |
|---|---|---|---|
| 평가 결론 뒤 후속 이슈를 빠뜨림 → 합의된 후속 작업을 중복 확인 후 선등록 | 실행할 후속 작업이 도출된 경우 | 사용자가 중단·논의만 요청한 경우 진행하지 않음. 새 목표를 추측해 만들지 않음 | 빠진 과제·재지시 횟수 |
| 동일 설명·교정 반복 → 관련 결정·교훈을 조회해 행동에 적용 | 같은 목적·범위와 유효 조건 일치 | 범위/권한/목표가 바뀌면 기존 규칙을 보류·재검토 | 재설명·동일 오류 |
| 완료 작업 재수행 → issue/산출물 최신 근거 먼저 확인 | 다른 실행·에이전트의 결과를 이어받을 때 | 오래된 상태는 확인 후 사용, 완료 표지만 맹신하지 않음 | 중복 호출·중복 산출 |
| 같은 실패 반복 → 실패 조건과 반증을 교훈 후보로 남김 | 원인·재현 조건을 식별할 수 있을 때 | 일회성 잡음/원인 불명이면 보류 | 반복 실패·회복 비용 |
| 불필요한 인간 질의 → 합의한 목표 안에서 기술 판단 진행 | 근거·제약·검증 방법이 있는 경우 | 새로운 취향·가치·권한 선택은 인간 판단 필요 | 불필요 질의·무단 가치 결정 |
| 파일 저장/합의를 완료로 과장 → 저장·조회·적용·성과를 분리 | 모든 학습 보고 | 효과가 없으면 그대로 기록하고 적용을 철회·수정 | 근거 없는 완료 주장 |

효과 검증은 #16에서 수행한다. 반복 횟수·오류율·재설명·시간·모델 호출·측정 가능한 토큰을 기록한다. 총비용 미측정이면 토큰 효율 개선을 주장하지 않는다. #13~#15의 계약 정의 뒤, 필요한 최소 구현을 별도 이슈에 먼저 등록한다.
