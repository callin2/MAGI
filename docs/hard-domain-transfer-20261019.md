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

새 선별18회와 본 비교36회(선별과 별도)를 Mac mini에서 실제 완료·채점했다. 첫 묶음은 세 모델이 모두 성공해 세 과제 전부 제외했다. 마지막 추가 묶음에서 일정·이벤트를 선정했고 재고는 평가 timeout으로 미선정했다. 본 비교36회 중29회가 유효하며7회는 provider 과부하 무효다. **일부 이벤트 실행에 개선 신호는 있으나 경험 전이의 일반 효과나 상세 E의 추가 이득을 입증하지 못했다.** 이벤트 거부 계약의 모호함, 불균형한 표본 손실, Sol의 G부터 전체 성공, 조건당2회의 한계가 크다. [이전18회](cross-system-three-models-20261019.md)와 원본은 별도로 보존했다.

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

추가 선별의 [원점수](../experiments/hard-domains-round2-20261019/screen-results.json)와 [선정 이유](../experiments/hard-domains-round2-20261019/selected-domains.json)를 b694aa1에 보존한 뒤 새36회를 시작했다. 이전 댓글 확인으로 잘못 끝난 응답은 작업 완료가 아니었으며, 파일·프로세스 확인에서 본 시험 미시작을 확인해 중복 호출 없이 이어갔다.

분야별 업무 전체 성공을 주요 결과로 삼으며 부분 검사 수가 많은 분야가 전체 결론을 지배하지 않게 한다. 산출물/schema/자체 시험과 무결성은 별도로 본다. 경험 적용/오적용은 counterexample 행동과 코드로 검토하되 G도 틀릴 수 있어 기억이 오류를 유발했다는 인과를 단정하지 않는다.

## 평가 경계·시간 초과·측정 한계

생성 도구는 자기 작업 파일만 읽고 reference/cases/judge를 제공하지 않는다. 다만 채점 때 제출 모듈과 judge는 같은 프로세스/argv·파일 권한을 공유하므로 제출 코드가 oracle 경로를 읽을 여지가 있다. **완전한 oracle sandbox를 주장하지 않는다.** 각 제출 모듈의 fs/process.argv/dynamic loader/정답 경로/eval을 검토한다. [첫9개 정적 검토](../experiments/hard-domains-20261019/access-audit.json)는 flag0, 실제 악용 미관찰이지만 모든 악성 우회가 없다는 형식 증명은 아니다. 잠재 한계만으로 정상 후보를 무효화하거나 생성 재실행하지 않는다. 실제 악용이 보이면 원본을 보존하고 유효 성공에서 제외한다.

추가 묶음 checker는 TimeoutExpired를 evaluation_timeout으로 partial stdout/stderr와 함께 명시 반환한다. 시간 초과를 누락/쉬운 과제/성공으로 처리하지 않는다. 첫 선별에는 평가 timeout이 없었다.

동일 medium·16응답/60도구/300초/8192출력 한도를 재사용하며 세 모델을 병행한다. 실제 요청/응답 모델 ID·raw provider usage·시간·부분/전체 판정·도구 실패를 보존한다. 캐시/병행 부하/출력 길이와 작은 표본의 시간/token 차이를 현금비용·총생애비용·인간 시간 절감으로 확대하지 않는다. 이 비용과 coordinator/경험 생성 비용은unknown이다. 기존 실험 원본,main,제품 저장소는 변경하지 않는다.

## 이벤트 거부 정책의 해석 한계

본 시험 진행 중, 결과 집계 전에 [별도 기록](https://github.com/callin2/MAGI/issues/18#issuecomment-6261134754)했다. 대본은 같은 accepted revision의 다른 payload에는 Error를 명시하지만, 늦거나 finalized 상태를 바꾸는 요청의 rejected atomically가 레코드를 건너뛰고 계속하는지 호출 전체를 throw하는지 명시하지 않는다. Oracle은 충돌 외 거부를 건너뛰고 최종 상태를 반환한다. 선별 Luna/Terra22/40은 이 구간에서 throw해 배치 전체가 중단된18개 사례와 관련된다. 잘못된 상태 변경18개라고 표현하지 않는다.

이 차이는 실제 거부 판단·세션 상태 오류와 구별해서 해석해야 한다. 동결 대본·oracle·선정·원점수는 수정하지 않았고 조건을 재생성하지 않았다. 해당 사례를 삭제해 새로운 성공 점수를 만들지도 않는다. 오류 정책을 바꾸었을 때 다른 논리까지 맞는다고 증명한 것이 아니다. 원천 교훈이 해석 선택에 영향을 주었을 가능성을 경험 일반화의 입증과 구별한다.

## 실행 중 서버 실패와 재개

본 비교에서 HTTP200으로 시작한 SSE가 response.failed/server_is_overloaded로 종료된 실행을 provider_error/invalid로 보존한다. 실패 호출의 raw usage가 null이면 토큰0이나 무료 호출로 해석하지 않는다. 해당 대화는 다시 실행하거나 성공 후보로 교체하지 않는다. Luna/Terra에서 연속 두 실패로 고정 runner가 멈췄으며, 이미 진행 중이던 다른 모델의 정상 HTTP200/toolUse 응답을 확인한 뒤 events.jsonl조차 없는 미시작 manifest 행만 이어갔다. [재개 근거](../experiments/hard-domains-round2-20261019/workflow-recovery.json)에 완료/실패/미시작과 시각을 남긴다.

모든 조건에 같은 수의 유효 표본이 남지 않는다. 계획상2회와 유효 수를 함께 표시하고 provider 무효를 업무 능력 실패로 해석하지 않는다. 표본 손실이 조건별로 불균형하므로 성공 횟수·시간/token 차이를 기억의 인과 효과나 비용 절감으로 부르지 않는다. 사용자 교정0은 사람이 개입하지 않는 프로토콜의 값이며 교정 비용이 줄었다는 결과가 아니다. 마지막 Terra 재개는 다른 모델 큐가 모두 끝난 뒤 마지막 과부하 오류에서60초 이상 기다리고 미시작 두 대화만 첫 시도한 것이다. 이 마지막 재개를 새로운 정상 health 확인이라고 부르지 않는다.

검토용 추가 진단 코드는 동결 task/worker/scorer를 바꾸지 않는다. public fs 추적의 별도 합성 positive control은 readFileSync와 promises.readFile을 포착했다. 첫 임시 경로 시도는 trace를 생성하지 못했고, 실경로로 확인한 대조 결과를 보존한다. 공개 API 추적의 동작 확인이며 모든 native/obfuscated 우회 차단의 증명은 아니다.

## 본 비교36회 결과

표의 셀은 `업무 전체 성공/계획상 실행 수 (유효 수)`다. 무효를 업무 실패로 해석하지 않는다. G=경험 없음, F=동일 A2의 짧은 규칙/조건, E=상세 동일 A2다. 분야별 전체 성공이 주요 결과이며 사례 수를 합쳐 가중 총점을 만들지 않는다.

| 분야 | 모델 | G | F | E |
|---|---|---:|---:|---:|
| 일정 배정 | luna | 0/2 (유효1) | 0/2 (유효1) | 0/2 (유효2) |
| 일정 배정 | terra | 1/2 (유효1) | 0/2 (유효1) | 0/2 (유효0) |
| 일정 배정 | sol | 2/2 (유효2) | 2/2 (유효2) | 2/2 (유효2) |
| 이벤트 session | luna | 0/2 (유효2) | 1/2 (유효2) | 1/2 (유효2) |
| 이벤트 session | terra | 0/2 (유효1) | 0/2 (유효2) | 1/2 (유효2) |
| 이벤트 session | sol | 2/2 (유효2) | 2/2 (유효2) | 2/2 (유효2) |

[분야/모델/조건 집계](../experiments/hard-domains-round2-20261019/summary.json), [원점수36회](../experiments/hard-domains-round2-20261019/main-results.json), [각 실행 코드·판정·메시지/도구 로그](../experiments/hard-domains-round2-20261019/main). 각 그룹의 부분 검사 점수는 summary의 partial_behavior에 개별 실행으로 남기며 무효 실행에는 null을 표시한다. 원래 judgment/score의 숫자는 그대로 보존했다.

- 일정 Luna는 유효한 G1회25/26, F1회25/26, E2회25/26씩으로 전체 성공이 없었다. 세 후보는 전환 시간의 분→밀리초 환산을 누락했고, 다른 E 후보는 비연속 일정 쌍에도 전환을 강제했다.
- 일정 Terra는 유효 G1회26/26, F1회25/26으로 조건 간 악화가 관찰됐다. E는 두 실행 모두 provider 무효여서 비교할 수 없다. F의 비연속 쌍 과잉 제약을 기억이 유발했다고 단정할 수 없다. Sol은 양 분야의 G/F/E 모두2/2로 기본 성공부터 천장에 가까웠다.
- 이벤트 Luna G는39/40·22/40, F는39/40·40/40, E는40/40·22/40이었다. F/E에 각각 전체 성공1회가 있었으나 E 추가 이득은 없었다. 39/40의 G/F는 같은 sealed 범위 과잉 확장 오류였다. 22/40은 거부 시 throw/skip 해석 차이가 포함된다.
- 이벤트 Terra는 유효 G1회22/40, F2회22/40씩, E는40/40·22/40이었다. E의 성공1회를 전이 입증으로 부르지 않는다. G 유효 표본이 한 개이며 거부/throw 계약 해석만으로도 차이 일부가 생길 수 있다.

본 비교29개 유효 실행 중 업무 전체 성공16회이며 제출 전체 성공도16회다. 이는 분야별 비교를 대체하는 가중 성능 지표가 아닌 기록 확인용 건수다. schema·notes/자체 시험 산출물·성공한 worker test 호출은 각각30/36에 있었다. 형식이나 자체 시험 통과를 숨겨진 업무 성공으로 세지 않았다. Provider 무효7회는 일부 코드가 검사26/26을 통과하더라도 유효 성공으로 올리지 않았다. 본 평가 timeout은0회다.

## 실제 오류와 반례 검토

[동결 판정의 실패 목록](../experiments/hard-domains-round2-20261019/failure-analysis.json)과 [실제 함수로 재현한 네 사례](../experiments/hard-domains-round2-20261019/semantic-review.json)를 보존한다. 후자는 기존 두 일정 사례와 이벤트 혼합 이력의 최소 재현 두 개이며 사후 진단이다. 새 채점 assertion이나 새 모델 실행이 아니다.

일정의 directed-setup-boundary는 같은 참석자가 a방09:00–09:30 뒤 b방09:35에 가려면10분이 필요한데 Luna가 둘을 배정했다. 코드가 밀리초 시각에10을 그대로 더했다. consecutive-not-all-pairs에서는 a→c 직접 전환50분이어도 중간 b방 일정이 있으면 연속 전환 a→b→c는 각각0분이라 세 일정을 모두 배정할 수 있다. Terra F2는 비연속 a/c 쌍으로 미리 가지치기해 값15 대신10을 반환했다.

이벤트의 최소 재현은 gap10, lateness10에서 e(time3)와 watermark28로 end13의 e가 final이 되고, c(time34)를 time15로 옮기는 것이다. e와15의 거리는12라 연결되지 않으며 새 c의 end25는 cutoff18보다 커 수락해야 한다. Luna G1/F1는 이미 gap이 더해진 sealed end13에 gap을 다시 더한23까지 거부해 c를34에 남겼다. 이는 throw/skip 해석과 별개인 실제 상태 오류다. G와 F 모두에서 나타나므로 기억의 부작용이라고 단정하지 않는다.

Source의 both-fold/고정 window 정책을 새 목표의 선택형 booking/session 계약에 무조건 적용하면 틀리는 반례도 원래 판정에 유지했다. 그러나 관측 실패를 모두 source 오적용으로 분류하지 않는다. 특히 source A2는 전환 시간의 단위·전역 최적화·session 전체 알고리즘을 가르치는 자료가 아니며, 대상의 독립 요구에서 난 오류도 있다. 관련 기억은 직접 제공했다. 자율 검색이나 MAGI 기억 시스템 전체, 자연 발생 제품 결함의 장기 학습 효과는 시험하지 않았다.

## 실제 호출·시간·usage

아래 input은 raw provider input_tokens이며 cache read는 그중 cached subset이다. output에는 provider가 보고한 reasoning 토큰이 포함된다. 실패7호출의 raw usage는 null로 남아 있어 본 비교의 알려진 합계는 전체 청구량의 확정값이 아니다. SDK가 가격0으로 표시한 값을 현금 비용0으로 사용하지 않는다.

| 분리된 단계 | 대화 | SDK 요청 | 도구/도구 오류 | worker 시간 합계 | phase wall span | raw input | raw output | cache read | 알려진 total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 첫 선별 | 9 | 61 | 67/0 | 596.4초 | 301.3초 | 191,486 | 30,887 | 4,608 | 222,373 |
| 추가 선별 | 9 | 78 | 77/7 | 999.4초 | 537.5초 | 343,457 | 44,593 | 31,872 | 388,050 |
| 본 비교 | 36 | 294 | 281/22 | 3726.1초 | 1970.1초 | 1,354,062 | 156,291 | 110,336 | 1,510,353 |

본 비교의 provider reasoning output 합계는29,291이며 실패 호출의 누락분은unknown이다. 각 조건의 비용·시간은 summary groups에 원래2회 기준 합계로 남겼다. 요청 medium은 계산량의 동등성을 보장하지 않는다. 모델별 큐 병행, 순서/캐시/서버 부하/실패로 생긴 차이와 작은 표본 때문에 빠름·적은 토큰을 효율 개선으로 확대하지 않는다. 현금 청구액·coordinator/교훈 추출을 포함한 생애 비용·인간 시간 절감은unknown이다. A1은 결정론적 실제 관측이며 별도 모델 API0회, A2의 donor3회는 첫 선별9회에 이미 포함해 두 번 세지 않았다. 이번 새 모델 대화는 선별18+본36=54회이며 이전18회와 합산하지 않는다.

[정확한 요청/서버 응답 모델 ID](../experiments/hard-domains-round2-20261019/model-id-evidence.json), [provider 실패7회](../experiments/hard-domains-round2-20261019/provider-errors.json), [Mac mini/runtime](../experiments/hard-domains-round2-20261019/machine.json)를 보존했다. 모델 ID와 요청 payload/HTTP상태/raw usage는 호출별 events.jsonl에 있다. HTTP 고유 request ID와 response object UUID는 동결 adapter가 수집하지 않았다. 원본 메시지 기록은 사고과정 텍스트와 인증 헤더/비밀을 제외한 공개 응답/도구 I/O다.

## 감사·보존·재현과 남은 한계

정적 검토는 첫9+추가45=54개 모듈에서 flag0이었다. [추가 정적 감사](../experiments/hard-domains-round2-20261019/access-audit.json), [추가 동적 감사](../experiments/hard-domains-round2-20261019/dynamic-access-audit.json), [첫 동적 감사](../experiments/hard-domains-20261019/dynamic-access-audit.json). 공개 fs 실제 호출은0이며 known inventory evaluator timeout1개는 재실행하지 않아 inconclusive다. 즉53개에서 추적 결과가 있고1개는 불확정이다. [합성 positive control](../experiments/hard-domains-round2-20261019/audit-positive-control.json)은 API 읽기를 포착했다. 실제 oracle 악용은 관찰되지 않았지만 native/난독화 우회나 같은 프로세스·argv·권한 공유의 잠재 문제를 배제한 형식 증명은 아니다.

[무결성2699/2699](../experiments/hard-domains-round2-20261019/integrity.json)는 고정 파일/모델 route·예산·prompt·새 대화·F/E 투영·기록 일치·기존 인증값 유출 검사다. 행동 성공 수가 아니다. 이전 실험/scripts1002개는 c57848d와 바이트가 같다. [추가 보존 확인](../experiments/hard-domains-round2-20261019/preservation.json)에서 첫 묶음370개와 두 번째 선별99개도 각각55fc025/b694aa1 그대로다. A2 freeze55fc025에는 B2 파일이 없고 B2 동결e08292b가 이후다. 최초54개 본 seed와 추가 재고18개 본 seed는 미실행으로 남는다.

읽기 전용 개별 재현은 `python3 scripts/hard_domains2/check.py calendar experiments/hard-domains-round2-20261019/main/calendar-luna-G-2/solution.mjs`처럼 실행한다. score.py/finalize.py/review_failures.py는 write-once 자료를 생성하므로 완료 디렉터리에서 재실행하지 않는다. 원점수·후보·실패를 삭제하지 않는다. [evidence manifest](../experiments/hard-domains-round2-20261019/evidence-manifest.json)에 파일 hash를 둔다. 문서 인덱스 생성/현재성·관련 문서 검색, 실제 의미 오류4개 재현, provider 실패·timeout 분류와 provenance 검사를 완료했다. 기존 결과를 덮어쓰는 과거 실험 check 스크립트는 실행하지 않았다.

이번 유한 묶음은 실행/채점/기록을 완료했으나, 복수 분야에서 경험 전이의 일반 효과를 신뢰성 있게 입증한 시험은 아니다. 첫3과제가 모두 쉬워 제외됐고, 추가 재고는 인프라 무효, 이벤트는 계약 해석 한계가 있다. 유효한 어려움의 단일 G 선별·작은 표본·선정 편향·합성 모듈·원천 경험의 수동 추출·모델 기본 지식 및 사전노출 가능성·server missingness를 남은 한계로 유지한다. A→B는 같은/인접 분야의 구조 이동이며 모두 먼 분야 간 전이라고 부르지 않는다. 새 인증/refresh/키 이동/설정·권한 변경, 운영 서비스/장비/DB/실제품 변경, Git main 병합·배포는 하지 않았다. #18/#19를 완료로 닫지 않는다.
