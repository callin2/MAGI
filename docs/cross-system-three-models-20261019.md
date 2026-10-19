---
id: magi.cross-system-three-models-20261019
type: report
status: recorded
owner: MAGI
reviewed: 2026-10-19
issue: https://github.com/callin2/MAGI/issues/18
---

# Luna·Terra·Sol 교차 시스템 검증 — 실제 18회 완료

[문서 목차](README.md) · 관련 [#18](https://github.com/callin2/MAGI/issues/18), [#19](https://github.com/callin2/MAGI/issues/19), [PR25](https://github.com/callin2/MAGI/pull/25).

**동일한 다른 코드베이스 수리 과제를 세 모델 × G/F/E × 각 2회, 총 18회 실제 실행했다. Sol은 경험 없는 G까지 모두 성공했고, Luna와 Terra는 모든 실행에서 25/26을 통과했으나 동일한 한 회귀가 남았다. 어느 모델에서도 경험 제공에 따른 전체 성공 수의 추가 이득은 관찰하지 못했다.**

이 결과는 하나의 역사적 코드 결함과 한정된 판정의 소규모 비교다. Sol 계열의 일반적 우월성, 경험 학습의 보편적 무효, MAGI 전체 효과를 주장하지 않는다. [이전 GPT-4.1 Mini 6회](cross-system-transfer-20261019.md)는 원본 그대로 별도 보존하며 아래 18회에 합치지 않았다. 모델 제한 이후 생성 호출은 확정한 세 ID만 사용했다.

## 전체 성공과 부분 행동 통과

| 실제 요청·서버 응답 모델 ID | G 경험 없음 | F 같은 경험의 짧은 규칙 | E 같은 경험의 상세 교훈 | 실행별 부분 행동 통과 |
|---|---:|---:|---:|---|
| `gpt-6-luna` | 0/2 | 0/2 | 0/2 | 각 6회 모두 25/26 |
| `gpt-5.6-terra` | 0/2 | 0/2 | 0/2 | 각 6회 모두 25/26 |
| `gpt-6.1-sol` | 2/2 | 2/2 | 2/2 | 각 6회 모두 26/26 |

[실행별 원점수·집계](../experiments/cross-system-target-models-20261019/execution-results.json), [각 실행의 후보·시험·메시지·judgment/score](../experiments/cross-system-target-models-20261019/runs/). 각 모델 안의 b001~b006은 E/G/F/G/F/E 순서이며, 여섯 실행 모두 위 부분 점수와 일치한다. 전체 성공은 26개 행동 기준뿐 아니라 요구 파일·JSON schema·실제 성공한 tests 호출·입력 보존을 모두 요구한다. 18회 모두 이 파일/schema/tests 요건은 만족했고, Luna/Terra는 실제 행동 회귀 때문에 전체 실패였다.

세 모델 모두 source/holdout 증거 경계, 실제 capture 실패/누락, 정상 후보와 CLI, 파일 없는 clarification/answer 반례를 처리했다. 반례 2개는 모든 실행이 통과했다. 이를 과거 경험이 반례 처리를 개선했다는 증거로 부르지 않는다. 현재 지시가 그 차이를 명시하고 있고 G도 같은 결과였다.

부분 통과 진단은 Luna 150/156, Terra 150/156, Sol 156/156이지만 검사 항목을 독립적인 업무 표본이나 통계적 반복으로 세지 않는다. 실제 반복은 조건별 2회다. 무결성 324/324는 아래의 별도 기록 검사이며 행동 성공 수에 더하지 않는다.

## Luna·Terra의 한 가지 실제 회귀

고정 `reported-process-failure` 사례에서 report의 turn.exitCode는 1, 실제 capture.exitCode는 0이다. 두 증거가 불일치하면 원래 report 실패 게이트도 유지해 완료를 거부해야 한다. 단순히 source/검사 증거를 추가하면서 기존 실패 조건을 없애지 않는 경계다.

- Luna/Terra의 각 6개 후보는 report 실패를 actual capture의 성공으로 대체하거나 report 실패 조건을 검사하지 않아 `complete=true`, `finalCandidate=true`, `fixedHoldoutPass=true`를 반환했다.
- Sol의 각 6개 후보는 report와 capture가 모두 성공해야 하도록 검사해 세 값을 false로 반환했다.

이 사례는 **실제 capture가 실패했는데 통과한 사례가 아니다**. 실패 report와 성공 capture라는 모순을 통과시킨 회귀다. 출력 필드가 빠졌거나 boolean false 대신 undefined였던 형식만의 실패도 아니다. [점수를 바꾸지 않은 사후 입력/반환값 재현](../experiments/cross-system-target-models-20261019/semantic-review.json)이 실제 true/false를 보존한다. 원래 25/26과 전체 실패를 그대로 유지했다.

이 단일 사례를 제거하면 성공으로 바뀐다는 이유로 사후 기준을 완화하거나 실패한 실행을 다시 생성하지 않았다. 동시에 전체 0/2만으로 Luna/Terra가 과제를 전혀 처리하지 못했다고 표현하지 않는다. 둘 다 나머지 25개 행동 기준을 매번 통과했다.

## 모델 접속과 동일 실행 조건

실행 장치는 `callin-macmini.local`, macOS 15.6 arm64, Node v25.2.1, 기존 Pi SDK 0.67.6이다. [머신 기록](../experiments/cross-system-target-models-20261019/machine.json). 기존 Codex 계정의 실시간 모델 목록을 읽기 전용으로 조회해 지원 ID를 확인했고, 추가 명시 지시로 `gpt-6-luna`, `gpt-5.6-terra`, `gpt-6.1-sol`을 선택했다. [실시간 목록](../experiments/cross-system-target-models-20261019/inventory.json), [정확한 선택 기록](../experiments/cross-system-target-models-20261019/selected-models.json).

기존 credential을 원래 위치에서 controller 메모리에 읽어 같은 Codex 서비스에 사용했다. 새 인증, OAuth refresh, 키 이동, 권한 확장이나 persistent 설정 변경은 하지 않았다. 설치된 Responses 프로토콜 어댑터의 형식을 재사용했지만 실제 model 필드에는 위 선택 ID만 보냈다. 전송 template에 사용한 다른 모델 ID로 생성하지 않았다.

세 전송 점검 모두 실제 acknowledge toolCall, HTTP200, 요청과 같은 서버 model ID 및 provider usage를 반환했다. [Luna](../experiments/cross-system-target-models-20261019/smoke-luna.json), [Terra](../experiments/cross-system-target-models-20261019/smoke-terra.json), [Sol](../experiments/cross-system-target-models-20261019/smoke-sol.json). 본 실험의 모든 호출에서도 실제 SSE response.model은 요청 ID와 일치했다. SDK가 클라이언트에서 붙인 model 필드만을 서버 증거로 사용하지 않았다. 내부 가중치의 동일성·학습 데이터는 독립 검증하지 못한다.

모든 모델·조건에 reasoning effort를 `medium`으로 요청하고, max_output_tokens=8192, 모델 응답16회/도구60회/실행300초의 기존 한도를 적용했다. 요청 payload 메타데이터와 실제 SSE usage를 매 호출 보존했다. medium이라는 같은 요청 값이 모델 간 같은 계산량을 뜻하지는 않는다. 보고된 reasoning token 합계도 Luna 1,142 / Terra 9,962 / Sol 2,395로 달랐다. 이 token은 output token에 이미 포함되므로 합계에 다시 더하지 않았다.

세 모델은 별도 process로 병행하고 각 모델 안에서는 같은 여섯 실행을 순서대로 수행했다. 매번 새 대화·새 파일 상태이며 다른 실행/모델 결과를 전달하지 않았다. 공통 task와 tool contract는 동일하다. 모든 실행이 한도 안에서 settled로 종료했으며 공급자 오류/HTTP 거부/불확실한 작업을 재시도하거나 실행 결과를 교체하지 않았다.

## 실제 사용량과 시간

각 행은 두 실행의 합계다. token은 provider가 반환한 input + output + cacheRead + cacheWrite를 SDK가 정규화한 누계이며 현금 청구액이 아니다. 캐시·출력 길이·도구 복구·동시 host/network/provider 부하와 실행 순서의 영향을 분리하지 못하므로 이 작은 표의 시간/토큰 차이를 일반적 효율이나 MAGI 총비용 절감으로 부르지 않는다.

| 모델 | 조건 | 처리 토큰 합계 | 시간 합계(초) | SDK 모델 요청 | 도구 호출 | 도구 시험 오류 |
|---|---|---:|---:|---:|---:|---:|
| luna | G | 44,956 | 58.0 | 12 | 16 | 2 |
| luna | F | 64,768 | 66.6 | 15 | 18 | 3 |
| luna | E | 84,654 | 75.3 | 18 | 18 | 2 |
| terra | G | 63,824 | 260.1 | 12 | 16 | 2 |
| terra | F | 89,461 | 237.9 | 15 | 21 | 1 |
| terra | E | 99,807 | 315.3 | 15 | 20 | 1 |
| sol | G | 63,636 | 171.1 | 12 | 14 | 0 |
| sol | F | 107,925 | 212.1 | 16 | 17 | 0 |
| sol | E | 66,413 | 173.3 | 12 | 14 | 0 |

총 SDK 요청 **127회**, 도구 **154회**, 도구 시험 오류 **11회**, worker 실행 시간 누계 **1,569.9초**다. 모델별 6회 시간 합계는 Luna 200.0초 / Terra 813.4초 / Sol 556.6초이며, 병행했으므로 합계는 실제 경과 시간과 다르다.

provider usage 합계는 input **539,011**, output **88,065**, cacheRead **58,368**, cacheWrite **0**, 처리 token **685,444**다. 전송 점검273 token은 이 본 실험 누계와 별도다. [원시 usage를 함께 집계한 측정 기록](../experiments/cross-system-target-models-20261019/measurement-summary.json).

가격을 입력하지 않은 어댑터의 SDK cost=0은 현금 비용0의 증거가 아니다. 실제 청구액·coordinator/과거 교훈 생성 비용·전체 생애 비용·인간 시간 절감은 unknown이다. 통제된 worker 사람 교정은0회지만 이를 사람의 부담을 줄였다는 효과로 해석하지 않는다.

## 원천·과제·판정의 보존과 해석

[사전 고정 f1b8e34](https://github.com/callin2/MAGI/commit/f1b8e34)는 첫 본 과제 응답 전에 push했다. [프로토콜](../experiments/cross-system-target-models-20261019/protocol.md), [18회 manifest](../experiments/cross-system-target-models-20261019/runs.json), [source/adapter/collector 고정 hash](../experiments/cross-system-target-models-20261019/frozen.json)를 보존한다. 최초 status.json의 버전 대기와 preexecution-status.json의0회는 당시 스냅샷이며 최종 상태는 execution-results.json이다.

A는 기존 tracker에서 실제 관측으로 추출한 completion evidence 교훈 하나, B는 다른 저장소 farm_studio_api의 역사적 JavaScript CLI 수용 판정 결함이다. 같은 tracker의 이름/진입점 변경이 아니다. 공통 task·A/F/E 표현·B 원본·공개 시험·숨겨진 judge는 이전 고정 자료를 바이트 그대로 재사용했다. GPT-4.1 결과에서 발견한 회귀나 정답을 새 worker 지시에 덧붙이지 않았고 평가 기준도 바꾸지 않았다. G에는 경험이 없고 F는 같은 A의 rule/conditions, E는 같은 A의 상세 metadata를 받았다.

관련 A는 coordinator가 골라 직접 제공했다. 자율 검색·전문가 협의·지속 저장 시스템 전체를 시험하지 않는다. 과제/판정 선정자는 로컬 수정본과 이전 실패를 알고 있으므로 맹검 선정이 아니며, worker에게 그 정보와 다른 결과를 노출하지 않는 경계만 유지했다. 현재 요구 자체가 자세하므로 G의 성과에는 그 지시와 모델의 기본 지식이 반영된다. 모델이 학습 중 원래 코드를 보았는지는 알 수 없다.

관측한 G/F/E 성공 수가 각 모델에서 동일했다. Sol은 G도2/2라 이번 지시/기본 능력만으로 해결 가능한 ceiling이며, 추가 경험 이득을 측정하지 못했다. Luna/Terra는 기억 표현이 달라도 같은 실패를 반복했다. 이 사실만으로 경험이 언제나 쓸모없다거나 Sol을 모든 시스템에서 우월하다고 결론내리지 않는다. 표본은 한 대상/한 수리 과제, 세 특정 ID, 조건별2회뿐이다.

## 추가 출처 확인과 한계

독립 감사에서 기존 GPT-4.1 판정을 뒤집는 검사기 오류나 확인 가능한 정답 누출은 발견되지 않았다는 피드백을 받았다. 수정 reference commit ec21d3f5가 원래 GitHub 경로에서404라는 한계는 남아 있다.

이 Mac의 기존 API 저장소에서 defect `95b2388f8c233b60007aa2b0df8f82a80d7efbf9`와 수정 `ec21d3f5b6921d4a62d7f74782caa6bc9cba4856`의 실제 Git parent/tree/blob/commit 시각을 읽었고, 각 파일 SHA-256은 보관본과 정확히 일치했다. [로컬 출처 증거](../experiments/cross-system-target-models-20261019/local-reference-provenance.json). 이는 로컬 보관 동일성이지 공개 upstream 독립 가용성 증거가 아니다. source 파일명 upstream-reference가 그 검증을 대신하지 않는다.

동일 source/judge의 이전 결정론적 대조는 결함 원본15/26·로컬 보관 수정본26/26이며 판정기 교정용이다. 모델의 성공/기억 효과 점수에 합산하지 않는다. 이번 [무결성324/324](../experiments/cross-system-target-models-20261019/integrity.json)도 seed/동일 모델/실제 서버 ID/설정/usage/한도/이전 원본/비밀 미포함의 검증이며 행동 성공과 구분한다. 기존 GPT-4.1 원본 파일과 원래 source/judge hash는 그대로다. 로그는 프로토콜에 따라 reasoning text와 인증 header를 제외하고 visible 응답·도구·메타데이터·raw usage를 보존한다.

## 재현과 변경 범위

아래 명령은 네트워크/모델 호출 없이 보관 후보의 실제 exported 함수와 CLI를 재검사해 stdout에 출력한다. Luna와 Terra는25/26으로 exit1, Sol은26/26으로 exit0이 보존 결과다.

```sh
python3 scripts/cross_system/check.py experiments/cross-system-target-models-20261019/runs/luna-b001/verdict.mjs
python3 scripts/cross_system/check.py experiments/cross-system-target-models-20261019/runs/terra-b001/verdict.mjs
python3 scripts/cross_system/check.py experiments/cross-system-target-models-20261019/runs/sol-b001/verdict.mjs
```

실제 생성 명령은 `node scripts/cross_system/target_models/run.mjs luna` 및 terra/sol 각 실행이었다. 수집은 `python3 scripts/cross_system/target_models/evaluate.py`, 무결성 검사는 `python3 scripts/cross_system/target_models/verify.py`다. 수집기는 기존 결과를 덮어쓰지 않으므로 본 보관 사본에서 재실행하지 않는다. 새로운 반복은 별도 ID·사전 고정을 사용하며 기존 실행을 지워 재생성하지 않는다.

검토 브랜치는 codex/cross-system-three-models-20261019다. 변경은 격리 실험 코드·원본/후보/로그·보고서뿐이다. 기존 API 제품 저장소/운영 서비스/장비/DB/프로덕션 자료를 변경하지 않았고 main 병합·배포도 없다. #18/#19를 완료로 닫지 않는다. 다른 실제 시스템 반복, 자율 경험 검색, 설명 부담과 전체 비용 및 더 큰 표본의 검증이 남아 있다.
