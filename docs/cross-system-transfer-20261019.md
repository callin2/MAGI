---
id: magi.cross-system-transfer-20261019
type: report
status: recorded
owner: MAGI
reviewed: 2026-10-19
issue: https://github.com/callin2/MAGI/issues/18
---

# 다른 시스템 경험 전이 — 실제 6회 완료, 전체 성공 0/6

[문서 목차](README.md) · 관련 [#18](https://github.com/callin2/MAGI/issues/18), [#19](https://github.com/callin2/MAGI/issues/19), [기존 PR25](https://github.com/callin2/MAGI/pull/25).

**Mac mini의 기존 OpenRouter 연결에서 실제 LLM 도구 대화 6/6회를 완료했다. 고정 판정의 전체 성공은 경험 없음 G, 짧은 규칙 F, 상세 교훈 E 모두 0/2다. 이번 다른 코드베이스 과제에서 경험 제공의 성공률 개선이나 상세 교훈의 추가 이득을 입증하지 못했다.** 실패한 실행을 재생성하거나 판정 기준을 바꿔 성공으로 세지 않았다.

처음에는 기본 `zai/glm-4.7` 연결이 401로 거부돼 준비만 완료했지만, 사용자의 추가 지시에 따라 다른 기존 연결을 확인했다. OpenRouter의 정상 접속을 확인하고 첫 과제 응답 전에 경로 변경을 기록한 뒤 실제 비교를 끝냈다. [최초 준비·실패 기록 75bc997](https://github.com/callin2/MAGI/commit/75bc997), [실행 전 경로 고정 0fc334b](https://github.com/callin2/MAGI/commit/0fc334b)를 보존한다. 초기 [results.json](../experiments/cross-system-20261019/results.json)의 blocked/0회는 당시 스냅샷이며, 최종 결과는 별도 [execution-results.json](../experiments/cross-system-20261019/execution-results.json)이다.

## 실제 실행과 결과

전 조건이 동일한 `openrouter/openai/gpt-4.1-mini`, 새 대화·별도 작업 파일, 동일한 현재 과제·도구·숨겨진 판정·한도를 사용했다. 공급자/모델은 API에 요청·응답한 식별자이며 내부 가중치는 독립 확인하지 않았다. Windows의 `atomic-8317/gpt-6-luna` 및 최초 거부된 `zai/glm-4.7`과 다르므로 이전 결과와 모델 독립적인 인과 비교를 하지 않는다.

| 조건 | 전체 성공 | 반례 실패 실행¹ | 새 회귀 실패 건² | 처리 토큰 합계³ | 실행 시간 합계 |
|---|---:|---:|---:|---:|---:|
| G 경험 없음 | 0/2 | 1/2 | 3 | 263,646 | 128.7초 |
| F 같은 경험의 짧은 rule/conditions | 0/2 | 1/2 | 2 | 137,269 | 110.8초 |
| E 같은 경험의 상세 교훈 | 0/2 | 1/2 | 2 | 99,349 | 86.0초 |

¹ 파일 없는 정상 질문·답변을 완료로 인정하지 못한 실행이다. ‘잘못된 유추’의 행동 지표이며, 기억이 없는 G도 같은 실패를 보여 과거 교훈이 그 오류를 일으켰다는 인과 주장은 하지 않는다.

² 고정 regression 축 11개 × 두 실행 중 실패한 건수다. 독립적인 업무나 표본 수가 아니다.

³ provider usage를 Pi SDK가 정규화한 input + output + cacheRead + cacheWrite 누계다. 토큰 가격·현금 청구액·전체 생애 비용과 같지 않다. E의 더 적은 토큰/시간도 전체 정확성 0/2인 탐색 결과이며, 일반적인 효율·비용 절감의 증거로 확대하지 않는다. 캐시와 공급자 부하, 출력/수정 길이, 고정된 순서의 영향도 분리하지 못했다.

총 SDK 모델 요청 56회, 도구 62회, 도구 시험 실패 10회, worker 실행 시간 누계 325.5초였다. provider-reported input 88,619 / output 41,725 / cacheRead 369,920 / cacheWrite 0, 처리 토큰 총 500,264다. OpenRouter 전송 점검의 79토큰은 이 worker 합계와 별도다. 원본 응답의 SDK cost 필드는 보존하지만 독립 확인한 현금 비용으로 사용하지 않는다. coordinator·과거 경험 생성 비용과 인간 시간 절감은 unknown이다. 통제된 사람 교정은 0회였으며 사람이 0만큼 필요하다는 효과 주장이 아니다.

여섯 실행 모두 요청한 파일·유효한 deliverable schema·후보 회귀 시험을 만들고 tests 도구가 성공한 상태로 끝났다. 그러나 독립된 전체 판정은 모두 실패했다. 단순 CLI 통합 사례 네 개는 모든 실행이 통과했지만 더 세밀한 report/capture 경계와 의미 반례에서는 실패했다. 과제 파일 존재나 공개 시험 통과를 실제 전체 성공으로 대체하면 안 된다는 관측이다.

## 실제 실패와 별도 내용 검토

[고정 실행별 judgment/score](../experiments/cross-system-20261019/runs/), [점수 변경 없는 사후 재현](../experiments/cross-system-20261019/semantic-review.json)에 실제 입력에 대한 반환값을 남겼다. 실패는 단순 라벨·출력 포맷만의 문제가 아니었다.

- **실제 프로세스 실패를 성공으로 표시:** b003(F), b004(G), b005(F), b006(E)는 capture exitCode=2 또는 exit 누락에도 report의 0만 믿어 `complete=true`/`fixedHoldoutPass=true`를 반환했다. b002(G)는 반대로 report의 실패를 capture의 0으로 덮어써 기존 실패 게이트를 잃었다.
- **기존 holdout 실패 게이트 제거:** b001(E), b002(G), b003(F), b004(G), b005(F)는 report.holdout.exitCode=1이어도 실제 capture의 성공 표식만 보고 통과시켰다. 모든 실행은 boolean true 대신 문자열 `"yes"`인 report 성공 주장도 통과시켰다. 고정 계약은 report와 실제 capture를 모두 요구한다.
- **반례의 실제 과잉 거부:** b001(E), b003(F), b004(G)는 source/holdout 증거를 함수 시작에서 모든 대화에 요구했다. 파일 없는 정상 clarification/answer에도 `complete=false`를 반환했다. 대화 완료와 최종 후보/holdout 성공의 차이를 보존하지 못했다.
- **검증을 잘못된 계층에 배치:** b005(F)는 source 누락/변조를 fixedHoldoutPass에서만 검사해 `finalCandidate=true`라는 잘못된 후보 확정을 남겼다.

각 실행의 엄격 통과 수는 b001(E) 21/26, b002(G) 23/26, b003(F) 20/26, b004(G) 20/26, b005(F) 20/26, b006(E) 23/26이다. 이 작은 진단 점수의 차이를 독립 표본이나 성공률 개선으로 부르지 않는다. 모든 실행에 실제 의미 실패가 남았으므로 원래 전체 0/6 판정을 유지한다. 후보 시험에 test.skip 등의 생략 표식은 없었지만 자체 시험의 성공은 독립 판정의 완전성을 대신하지 못했다. b006 후보의 trailing whitespace도 모델 원본 보존을 위해 재서식하지 않았으며, 관리 코드·문서의 whitespace 검사는 별도로 통과했다.

## 원천 경험·다른 시스템·누출 경계

A는 기존 Python tracker에서 실제 관측으로 추출한 `observed-integration-failures-evidence-gate` 하나다. [고정 원천](../experiments/cross-system-20261019/source/experience-A.json)은 기존 22회 자료 r005의 E memory에서 모든 필드를 그대로 선택했다. G에는 빈 배열, F에는 같은 교훈의 rule/conditions, E에는 상세 메타데이터까지 제공했다. 원래 conditions도 바꾸지 않았고 B의 정답·코드·수정 방법을 A에 덧붙이지 않았다.

B는 별도 저장소 [farm_studio_api](https://github.com/callin2/farm_studio_api)의 실제 과거 `tools/ghostflow-cli-ten-verdict.mjs` 결함이다. [출처](../experiments/cross-system-20261019/source/provenance.json)의 defect commit `95b2388f8c233b60007aa2b0df8f82a80d7efbf9`는 실제 파일·프로세스·holdout capture로 corroborate하지 않고 성공을 보고했다. tracker 상태/부모/evidence 배열과 달리 JavaScript CLI의 응답 종류, 별도 프로세스 종료, source bytes/hash 및 검사 출력을 결합하는 코드다. 같은 tracker의 이름/진입점만 바꾼 과제가 아니다.

반례는 산출물 없는 정상 clarification/answer다. 이는 `complete=true`일 수 있지만 최종 후보와 holdout 성공은 아니다. 원래 교훈을 모든 완료에 강제하면 틀린다. 다만 반례도 같은 B의 의미 경계이며 독립된 두 번째 대상 시스템으로 세지 않는다. 현재 과제 지시에는 이 차이를 명시했다. 따라서 성공했다 해도 모델이 자발적으로 경계를 발견했다고 주장할 수 없는데, 이번에는 그 명시적 차이도 3/6 실행이 지키지 못했다.

관련 경험은 coordinator가 골라 직접 제공했다. 자율 검색·전문가 라우팅·adapter 전체 효과를 시험하지 않는다. G는 현재 계약과 모델 기본 지식으로 해결하는 기준선이지만 모델이 학습 때 이 과거 코드를 봤는지는 모른다. 선정자는 upstream 수정 `ec21d3f5b6921d4a62d7f74782caa6bc9cba4856`을 읽었으므로 맹검 선정도 아니다. worker에게는 그 수정본·숨겨진 판정·다른 실행 결과를 노출하지 않는 경계만 유지했다. 후속 독립 조회에서 수정 commit의 GitHub 경로는404였다. [추가 로컬 Git 객체 검증](cross-system-three-models-20261019.md#추가-출처-확인과-한계)에서는 archive와 정확히 일치하지만, 공개 upstream의 독립 가용성은 확인되지 않았다.

## 고정·검증·실행 중 문제 보존

[원래 사전 프로토콜](../experiments/cross-system-20261019/source/preregistration.md), [manifest](../experiments/cross-system-20261019/runs.json), [원래 freeze](../experiments/cross-system-20261019/frozen.json), [추가 모델 경로 기록](../experiments/cross-system-20261019/route-amendment.json)은 실제 과제 응답 생성 전에 고정됐다. G/F/E 각 2회, seed 20261019의 순서 E/G/F/G/F/E, 새 대화, 응답 16회/도구 60회/300초/응답 출력 8192 한도를 모두 지켰다. API 과제 응답을 모의 데이터로 대체하지 않았다.

| 검사 | 결과 |
|---|---:|
| 실제 과거 결함의 결정론적 대조 | 15/26, 거짓 성공 11개 재현 |
| 실제 upstream 수정본의 결정론적 대조 | 26/26 |
| 최초 입력·분리·문법·권한 검사 | 59/59 |
| 실행 후 고정 입력·모델·요청·한도·비밀 미포함 검사 | 103/103 |
| 기존 experiments/scripts 바이트 보존 | 666/666 파일 동일 |

[원본 대조](../experiments/cross-system-20261019/preflight/baseline-check.json), [upstream 대조](../experiments/cross-system-20261019/preflight/reference-check.json), [실행 무결성](../experiments/cross-system-20261019/execution-integrity.json). 결정론적 대조는 판정기 교정이며 모델 학습 결과가 아니다. hidden 판정은 패치 문자열 비교 대신 실제 exported 함수와 실제 CLI를 실행한다. worker와 판정의 Node subprocess는 지정 파일만 접근하며 network/child process/worker/addon을 허용하지 않는다. 테스트 환경에는 credential을 전달하지 않았다.

b005가 정상 완료된 뒤 driver의 원시 로그 정규식이 타임스탬프 `1792371940326`의 `403`을 인증 거부로 오인해 b006 시작 전에 멈췄다. [원인·최소 재현·상태 확인](../experiments/cross-system-20261019/driver-interruption.json)을 보존했다. 실제 provider_error는 0건이고 b005의 stop은 settled, b006은 미시작임을 확인했다. 고정 runner/기준/완료 결과를 수정하지 않고 같은 runner에 b006만 지정해 이어 실행했다. 인증 거부를 재시도하거나 실패 응답을 교체한 것이 아니다. 이 batch-stop 탐지 결함은 고정 증거 안에 그대로 남아 있으며 후속 실행기 개선 대상으로 기록한다.

## 장치·기존 연결·범위

실행 장치는 `callin-macmini.local`, macOS 15.6 arm64, Node v25.2.1, Python 3.14.3, Pi 0.67.6이다. [machine.json](../experiments/cross-system-20261019/machine.json)은 최초 zai 계획 당시 snapshot이며 실제 비교 경로는 amendment와 각 execution.json을 본다.

최초 Pi zai 전송 점검은 실제 `401 Authentication Failed`였고 재시도하지 않았다. 이후 [기존 연결 읽기 확인](../experiments/cross-system-20261019/connection-review/existing-connections.json)에서 OpenRouter 인증 조회와 LM Studio 목록이 성공했다. OpenWebUI는 연결 오류였다. 선택한 기존 OpenRouter의 공식 모델 목록과 [실제 도구 전송 점검](../experiments/cross-system-20261019/connection-review/openrouter-smoke.json)을 확인한 뒤 진행했다. 기존 credential은 원래 저장 위치에서 controller 메모리에 읽어 같은 서비스에 사용했다. 키 이동·새 인증·OAuth refresh·접근 확장·persistent 설정 변경은 없었다.

#18/#19 본문·댓글, 열린 작업과 PR25를 확인하고 head `d2769ab`를 별도 디렉터리에 clone했다. 검토 브랜치는 `codex/cross-system-transfer-20261019`다. 중앙 work_status/shared_context/fleet 도구는 제공되지 않아 그 별도 조회 증거는 없다. 기존 22회 원본, main, PR25 브랜치, 타 작업과 대상 제품 저장소에는 변경하지 않았다. 운영 서비스·장비·DB·프로덕션 데이터 접근/변경, 배포, main 병합도 없다.

## 재현과 한계

다음 명령은 모델·네트워크 호출 없이 실제 보관 코드의 행동을 재검사하며 stdout만 출력한다. 원본 exit 1, reference exit 0, 후보 b006 exit 1은 보존된 결과와 일치한다.

```sh
python3 scripts/cross_system/check.py experiments/cross-system-20261019/source/verdict-before.mjs
python3 scripts/cross_system/check.py experiments/cross-system-20261019/source/verdict-upstream-reference.mjs
python3 scripts/cross_system/check.py experiments/cross-system-20261019/runs/b006/verdict.mjs
```

실제 생성 명령은 `node scripts/cross_system/resume/run.mjs`였고 마지막 미시작 작업만 `node scripts/cross_system/resume/run.mjs b006`로 이어 실행했다. 수집 명령은 `python3 scripts/cross_system/resume/evaluate.py`, 무결성 확인은 `python3 scripts/cross_system/resume/verify.py`다. 이 수집기는 기존 결과를 덮어쓰지 않으므로 이미 결과가 있는 본 사본에서는 재실행하지 않는다. 새로운 반복은 별도 실험 ID와 고정 기록을 사용해야 하며 기존 실행을 지워 재생성하지 않는다.

표본은 1개 다른 코드베이스의 1개 실제 과거 결함, 모델 하나, 조건별 2회뿐이다. 이 결과로 ‘경험은 전혀 도움이 없다’거나 모든 모델/시스템에서 일반화가 실패한다고 주장하지 않는다. 이번에는 실제 전이를 시험했고 전체 성공/반례 보존에 실패했다는 좁은 결론만 지지한다. 과거 결과와 실패는 보존하며 #18/#19를 완료 처리하지 않는다. 자율 경험 검색, 다른 시스템·모델 반복, 성공을 유지하는 효율, 인간 교정/시간과 전체 비용, MAGI 전체 효과 검증이 남아 있다.
