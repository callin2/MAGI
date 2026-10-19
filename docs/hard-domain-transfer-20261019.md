---
id: magi.hard-domain-transfer-20261019
type: report
status: recorded
owner: MAGI
reviewed: 2026-10-19
issue: https://github.com/callin2/MAGI/issues/18
---

# 다중 분야 새 과제의 선별과 경험 전이

[문서 목차](README.md) · 관련 [#18](https://github.com/callin2/MAGI/issues/18), [#19](https://github.com/callin2/MAGI/issues/19).

마지막 추가 묶음의 G 선별9회가 완료됐다. 일정 배정(Terra25/26, Luna/Sol26/26)과 이벤트 session 집계(Luna/Terra22/40, Sol40/40)를 본 비교 대상으로 선정했다. 재고는 Terra/Sol31/31이나 Luna 평가90초 timeout으로 무효이며 쉬움/난도의 증거로 쓰지 않고 미선정했다. 본 비교는 새 G/F/E각2회×두 분야×세 모델=36회이며 현재0회다. 첫 묶음은9/9 전체 성공으로 세 과제 모두 제외했고 본 시험은0회였다. 선별과 본 시험을 합산하지 않는다. [이전18회](cross-system-three-models-20261019.md)는 Sol만 전체 성공했으므로 세 모델 공통 쉬운 과제로 재분류하지 않았다.

모든 새 과제는 합성 벤치마크다. 역사적 제품 결함이라고 주장하지 않는다. 실행 장치는 callin-macmini.local, 모델은 기존 Codex의 gpt-6-luna/gpt-5.6-terra/gpt-6.1-sol만 medium으로 사용한다. 새 인증/키 이동/OAuth refresh/설정·권한 변경, 운영 서비스·장비·DB·제품 데이터 변경은 없다.

## 동결 대본과 실제 기억 파일

| 묶음·도메인 | 실제 대본 | 짧은 F 기억 예시 | 상세 E 기억 예시 |
|---|---|---|---|
| 첫 묶음 재고 replay | [task](../experiments/hard-domains-20261019/source-B/inventory/task.md) | [F](../experiments/hard-domains-20261019/main/inventory-luna-F-1/memory.json) | [E](../experiments/hard-domains-20261019/main/inventory-luna-E-1/memory.json) |
| 첫 묶음 주간 일정 | [task](../experiments/hard-domains-20261019/source-B/calendar/task.md) | [F](../experiments/hard-domains-20261019/main/calendar-luna-F-1/memory.json) | [E](../experiments/hard-domains-20261019/main/calendar-luna-E-1/memory.json) |
| 첫 묶음 고정 window 집계 | [task](../experiments/hard-domains-20261019/source-B/events/task.md) | [F](../experiments/hard-domains-20261019/main/events-luna-F-1/memory.json) | [E](../experiments/hard-domains-20261019/main/events-luna-E-1/memory.json) |
| 추가 전역 재고 배치 | [task](../experiments/hard-domains-round2-20261019/source-B/inventory/task.md) | [F](../experiments/hard-domains-round2-20261019/main/inventory-luna-F-1/memory.json) | [E](../experiments/hard-domains-round2-20261019/main/inventory-luna-E-1/memory.json) |
| 추가 공동 일정 배정 | [task](../experiments/hard-domains-round2-20261019/source-B/calendar/task.md) | [F](../experiments/hard-domains-round2-20261019/main/calendar-luna-F-1/memory.json) | [E](../experiments/hard-domains-round2-20261019/main/calendar-luna-E-1/memory.json) |
| 추가 수정 가능 session 집계 | [task](../experiments/hard-domains-round2-20261019/source-B/events/task.md) | [F](../experiments/hard-domains-round2-20261019/main/events-luna-F-1/memory.json) | [E](../experiments/hard-domains-round2-20261019/main/events-luna-E-1/memory.json) |

선별 전에 가능한 본 seed도 준비·동결했다. 위 파일의 존재가 실제 호출을 뜻하지 않는다. 첫 묶음54개 본 seed는 제외 규칙에 따라 미실행이다. 각 도메인의 memory 내용은 모델/반복 간 동일하며 G는[]다. F/E는 같은 source 경험의 rule/conditions 투영 또는 상세 기록이고 대상 정답을 추가하지 않았다.

## 실제 출처와 생성 순서

첫 A1은 coordinator가 작성한 합성 credit replay / single alarm / unversioned snapshot을 실제 실행·수리한 기록이다. 수리 전1/6,1/7,3/6에서 수리 후6/6,7/7,6/6로 바뀌었다. 자연 발생 역사적 사건이나 autonomous worker 학습이라고 표현하지 않는다. [A1](../experiments/hard-domains-20261019/source-A/frozen.json)은 fc98c5c에서 첫 B 전에 동결했다.

첫 B의 실제 G9회가 모두 성공한 후, 그중 Sol의 실제 수리·시험·별도 판정 로그를 새 A2로 추출해55fc025에서 추가 B 전에 동결했다. [A2](../experiments/hard-domains-round2-20261019/source-A/frozen.json). 최초 ‘A1 재사용’ 계획에서 A2로 바꾼 것은 신규 실제 작업에서 얻은 경험을 먼저 동결하라는 요구에 따른 명시적 사전 변경이다. 원래 A1은 수정하지 않았다. 교훈 추출은 coordinator가 했고 자율 검색/자동 기억 추출은 구현하지 않았다.

A2는 추가 과제의 identity/time/state 하위 계약에 관련된 경험이며 새로운 최적화/세션 요구 전체를 가르치는 자료가 아니다. 같은 분야 안의 또는 인접 시스템에서 구조를 옮기는 시험이다. 세 분야가 추가됐다고 모든 A→B가 먼 도메인 간 전이라는 뜻은 아니다.

## 선별 규칙과 첫 결과

첫 묶음 [2964abf](https://github.com/callin2/MAGI/commit/2964abf), 추가 묶음 [e08292b](https://github.com/callin2/MAGI/commit/e08292b)에서 대본·정답·판정·선별 순서·가능한 본 seed를 생성 전에 고정했다. 추가 묶음은 사전 계획상 마지막3후보이며 무한히 실패 문제를 찾지 않는다.

세 모델의 유효한 G 한 번씩이 모두 업무 의미 기준 전체를 통과한 과제 전체만 제외한다. 형식만의 실패나 인프라 무효를 난도로 해석하지 않는다. 한 번 통과는 선별 휴리스틱이다. 정상/회귀 assertion은 삭제하지 않는다. 선정된 분야는 새 대화·초기 코드로 G/F/E각2회 본 시험을 실행하며 선별 patch/history/표본을 본 시험으로 사용하지 않는다. 난도 선정 편향 때문에 일반 성능이 아닌 선택 집합 비교다.

첫 선별은 세 모델 모두 재고27/27,일정24/24,이벤트29/29였다. [원본/점수](../experiments/hard-domains-20261019/screen-results.json), [세 과제 제외 결정](../experiments/hard-domains-20261019/selected-domains.json). 본 시험0회이고 모든 선별 실패/성공 원본은 남긴다. 실제 모델 원본이 아니라 reference의 대조 점수를 모델 성과로 더하지 않는다.

분야별 업무 전체 성공을 주요 결과로 삼으며 부분 검사 수가 많은 분야가 전체 결론을 지배하지 않게 한다. 산출물/schema/자체 시험과 무결성은 별도로 본다. 경험 적용/오적용은 counterexample 행동과 코드로 검토하되 G도 틀릴 수 있어 기억이 오류를 유발했다는 인과를 단정하지 않는다.

## 평가 경계·시간 초과·측정 한계

생성 도구는 자기 작업 파일만 읽고 reference/cases/judge를 제공하지 않는다. 다만 채점 때 제출 모듈과 judge는 같은 프로세스/argv·파일 권한을 공유하므로 제출 코드가 oracle 경로를 읽을 여지가 있다. **완전한 oracle sandbox를 주장하지 않는다.** 각 제출 모듈의 fs/process.argv/dynamic loader/정답 경로/eval을 검토한다. [첫9개 정적 검토](../experiments/hard-domains-20261019/access-audit.json)는 flag0, 실제 악용 미관찰이지만 모든 악성 우회가 없다는 형식 증명은 아니다. 잠재 한계만으로 정상 후보를 무효화하거나 생성 재실행하지 않는다. 실제 악용이 보이면 원본을 보존하고 유효 성공에서 제외한다.

추가 묶음 checker는 TimeoutExpired를 evaluation_timeout으로 partial stdout/stderr와 함께 명시 반환한다. 시간 초과를 누락/쉬운 과제/성공으로 처리하지 않는다. 첫 선별에는 평가 timeout이 없었다.

동일 medium·16응답/60도구/300초/8192출력 한도를 재사용하며 세 모델을 병행한다. 실제 요청/응답 모델 ID·raw provider usage·시간·부분/전체 판정·도구 실패를 보존한다. 캐시/병행 부하/출력 길이와 작은 표본의 시간/token 차이를 현금비용·총생애비용·인간 시간 절감으로 확대하지 않는다. 이 비용과 coordinator/경험 생성 비용은unknown이다. 기존 실험 원본,main,제품 저장소는 변경하지 않는다.
