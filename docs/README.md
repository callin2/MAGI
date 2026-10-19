---
id: magi.docs-index
type: index
status: active
owner: MAGI
reviewed: 2026-10-18
issue: https://github.com/callin2/MAGI/issues/26
---

# MAGI 문서 목차

[프로젝트 소개](../README.md)에서 시작하거나 아래 질문으로 찾는다. 상세 결과와 운영 명령은 각각 연결된 원문에서 관리한다. `experiments/` 안의 문서는 당시 입력·응답·판정의 증거이며 현재 사용 안내와 구별한다.

## 지금 필요한 문서

| 질문 | 기준 문서 | 읽을 내용 |
|---|---|---|
| 다른 시스템 전이는 실행됐나? | [2026-10-19 실제 전이 비교](cross-system-transfer-20261019.md) | 다른 실제 코드베이스·실제 모델 6회, G/F/E 전체 성공 0/2씩, 반례·회귀 실패 |
| MAGI가 실제 업무에 도움이 됐나? | [실제 효과 비교](effectiveness-verification-20261018.md) | 22회 실행, 경험 전달과 정제의 차이, 비용·미입증 범위 |
| 자동 채점 실패는 실제 오류였나? | [판정과 내용 검토](effectiveness-semantic-review-20261018.md) | 원점수와 사후 해석의 차이, 실제 코드·완료 실패 |
| 로컬에서 무엇을 실행하나? | [실행·검증 안내](verification.md) | 도구 시험, 자료 검사, 결과를 덮어쓰는 명령 |
| 완료 상태를 불러올 때 무엇을 확인하나? | [Tracker import 수정](tracker-import-validation.md) | 원인, 변경된 경계, 회귀 검증 |
| 전문성을 가진 에이전트에게 물어볼 수 있나? | [전문성·기억 제안](expertise-memory-review.md) | 사용자 의도와 검토 범위. 구현 완료 아님 |

## 계약

연구 계약은 요구와 판정 방법을 정의한다. 계약 문서의 존재가 제품 구현이나 효과 입증을 뜻하지 않는다.

초기 검토 근거: [세 독립 평가 보고서](https://github.com/callin2/MAGI/issues/1#issuecomment-6205482424).

| 주제 | 기준 문서 |
|---|---|
| 해석·판단 기준의 기록과 품질 | [평가 계약](evaluation-contract.md) |
| 독립성·공통 오판·비교 예산 | [독립 평가 프로토콜](independence-protocol.md) |
| 유보·종료·재판단·행동 권한 | [판단 생명주기](decision-lifecycle.md) |
| 역할·상태 승계·교훈 검증·공유·철회 | [역할 경험 계약](role-learning-contract.md) |

## 연구 기록

각 보고서는 해당 실험 당시의 결과를 보존한다. 오래된 보고서의 “현재”와 “미실행”을 오늘의 전체 상태로 읽지 않는다. 최근 결과가 과거의 고정 점수나 실패를 대체하지도 않는다.

| 순서와 주제 | 원문 | 연결된 후속 |
|---|---|---|
| 합성 사례의 가설 경쟁 | [pilot-001](pilot-report.md) | [동일 예산·개방형 비교 #6](https://github.com/callin2/MAGI/issues/6) |
| 미결 쟁점의 입장 차이 | [pilot-002](pilot-002-report.md) | [선택 우선순위의 정당화 #8](https://github.com/callin2/MAGI/issues/8) |
| 기존 경험학습 구현 조사 | [사례와 재사용 결정](learning-precedents.md) | [역할 경험 계약](role-learning-contract.md) |
| 합성 경험의 저장·새 세션 전이 | [역할 경험 파일럿](role-learning-pilot-report.md) | [확대 비교 #16](https://github.com/callin2/MAGI/issues/16) |
| 실제 업무에서 학습을 검증할 초기 계획 | [학습 입증 계획](learning-proof-plan.md) | 아래 실제 업무·효과 비교로 일부 실행. 최초 제안과 실행 조건은 다름 |
| 업무 분해·실패·복구·새 세션 실행 | [재귀 업무 파일럿](recursive-work-pilot.md) | [행동 전이 #19](https://github.com/callin2/MAGI/issues/19) |
| 실제 코드·인계 업무의 경험 전달 비교 | [2026-10-18 효과 비교](effectiveness-verification-20261018.md) | [판정·비용·확대 검증 #18](https://github.com/callin2/MAGI/issues/18) |
| 다른 코드베이스의 실제 경험 전이 비교 | [2026-10-19 기록](cross-system-transfer-20261019.md) | [확대 검증 #18](https://github.com/callin2/MAGI/issues/18), 실제 6회 완료, 전체 성공 0/6 |

미완료 업무의 진행 상태는 연결된 이슈에서 관리한다. 문서 정리를 이유로 연구 이슈를 완료 처리하지 않는다.

## 문서 관리

- 새 문서를 만들기 전에 이 목차에서 같은 목적의 원문을 찾는다. 같은 계약·명령·결과를 두 곳에서 독립 갱신하지 않는다. 다른 문서에는 필요한 맥락과 링크만 둔다.
- 프로젝트와 상위 프로젝트의 책임은 [사용자가 확인한 문서 소유 원칙](expertise-memory-review.md#프로젝트와-상위-프로젝트의-문서-책임)을 따른다. 여러 PC에 있더라도 소유 저장소의 원문을 연결한다.
- README는 입구, 이 목차는 길 안내, 계약은 규칙, 실행 안내는 명령, 보고서는 관측 결과다. 제안은 채택 여부를 표시한다. `experiments/`의 고정 증거는 복사본처럼 보여도 삭제·재서식하지 않는다.
- 기존 문서 경로를 유지한다. 꼭 이동할 때는 참조를 고치고 이전 경로에 이동 안내를 남긴다. 현재는 문서가 적어 폴더를 늘리는 대신 목차로 분류한다.
- 문서 변경 시 링크·메타데이터·관련 이슈를 함께 확인한다. 코드 변경은 해당 계약/안내를 갱신하고, 결과 변경은 새 관측을 기록한다. 이전 원점수는 덮어쓰지 않는다.

### 최소 front matter

`docs/`의 관리 문서에는 다음 필드를 둔다. 고정 실험 자료에는 일괄 적용하지 않는다.

| 필드 | 의미 |
|---|---|
| `id` | 경로가 바뀌어도 유지하는 고유 ID |
| `type` | index, guide, contract, report, research, proposal, plan, change-record |
| `status` | active(현행 안내), draft(연구 계약), recorded(관측 기록), snapshot(당시 조사), under-review(제안), historical-proposal(후속 실행이 있는 초기 계획) |
| `owner` | 원문을 관리하는 프로젝트. 여기서는 MAGI |
| `reviewed` | 문서 구조·연결을 검토한 날짜. 외부 사실 재조사나 시험 재실행 날짜가 아님 |
| `issue` | 이 문서의 주된 GitHub 이슈. 추가 관련 이슈는 본문에 연결 |

이번 정리의 범위·결정·검증·변경 이력은 [문서 정리 기록](documentation-organization.md)에 둔다.
