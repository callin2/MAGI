# 첫 실사용 구성 비교

이 문서는 제공된 `sources.md`만 사용해 역할을 비교한다. 자료의 공개 문서(D), 소스 확인(C), 원저자 실험(A)을 구분하며, MAGI가 Hermes·Letta·OpenClaw를 설치하거나 직접 벤치마크한 결과는 없다(M 자료 없음).

| 구성 | 역할 | 기억·지속 방식 | 추가 구현/운영 부담 | 근거와 한계 |
|---|---|---|---|---|
| Hermes | profile별 실행 맥락과 memory·skills·세션 상태를 분리하는 참고 모델 | memory 도구로 사실·교훈을 갱신하고 디스크에 저장 | profile 범위, 동시 실행 충돌, 새 세션 snapshot 조회 정책 | profiles/memory 공개 문서(D). profile은 OS 접근통제가 아니며 MAGI 역할 효과는 미검증 |
| Letta | 영속 agent의 정체성과 대화 연속성, context 관리 참고 모델 | 로컬 파일·git 이력과 reflection으로 context를 갱신 | 지식 승계·충돌·서비스 의존 정책을 별도로 정해야 함 | stateful agents/context repositories 공개 문서(D), skill learning 원저자 사례(A). MAGI 재현 아님 |
| OpenClaw | 반복 절차를 skill로 저장·수정하는 절차 관리 참고 모델 | agent별 절차 파일, 변경 전 archive/restore | 버전 보존, 철회, facts와 procedures 분리. background 주기는 별도 결정 | Skill Workshop 공개 문서(D). 기본 주기·정리값은 MAGI에 자동 적용하지 않음 |
| 현재 작은 adapter + 기존 실행 도구 | 첫 구성의 실행 담당. 자연어 작업을 기존 실행 도구에 전달하고 결과·교정·검증을 기록 | 지속 파일/git, JSON 계약, 다음 대화의 관련 교훈 조회 | 근거 연결, 역할/프로젝트 범위, 충돌·철회, 전이 효과 측정 adapter가 필요 | sources의 조합 방향(C/D 기반). 실제 MAGI 실행·성능 벤치마크는 없음 |

## 비교 결론

첫 실사용은 전체 런타임을 도입하는 대신 현재 adapter와 기존 실행 도구를 중심에 두고, Hermes의 profile과 memory 구분, Letta의 정체성·git 버전, OpenClaw의 archive/restore 개념을 필요한 계약으로 제한해 조합한다. 이 결론은 기능 우월성이나 범용 학습 효과의 입증이 아니라, 현재 자료에서 확인된 재사용 가능한 설계 패턴과 작은 검증 범위를 정한 것이다.

검증은 동일 과제를 no-memory/log/lesson 조건으로 나누고 재설명 횟수, 오류, 시간, 모델 호출·토큰, 생성·검색 비용을 기록한다. 총비용을 측정하지 않으면 효율 향상을 주장하지 않는다.
