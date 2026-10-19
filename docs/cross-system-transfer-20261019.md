---
id: magi.cross-system-transfer-20261019
type: report
status: recorded
owner: MAGI
reviewed: 2026-10-19
issue: https://github.com/callin2/MAGI/issues/18
---

# 다른 시스템 경험 전이 — 준비 완료, 모델 인증 차단

[문서 목차](README.md) · 관련 [#18](https://github.com/callin2/MAGI/issues/18), [#19](https://github.com/callin2/MAGI/issues/19), [기존 PR25](https://github.com/callin2/MAGI/pull/25).

**Mac mini에서 기존 모델 접속의 실제 API 전송 점검을 1회 했으나 `401 Authentication Failed`로 거부됐다. 본 실험은 0/6회 실행이며 경험 전이 효과 결과는 없다.** 인증·권한·모델 설정을 바꾸거나 같은 인증으로 재시도하지 않았다. 모의 모델 응답으로 대체하지 않았다.

독립적으로 가능한 과제·입력·판정기 준비와 결정론적 검증은 완료했다. 아래 15/26과 26/26은 실제 과거 코드의 판정기 교정용 결과이며 LLM이나 MAGI의 성과가 아니다.

## 장치·기존 작업·접속

- 장치: `callin-macmini.local`, Apple arm64. 정확한 OS·런타임은 [machine.json](../experiments/cross-system-20261019/machine.json).
- MAGI PR25는 OPEN, head `d2769ab01c185ec8fff71cd31ad7b7dd4b0856d0`이었다. #18/#19 본문·댓글과 열린 이슈를 읽고 중복 실행 공지가 없음을 확인했다. 이 head를 별도 디렉터리에 복제하여 `codex/cross-system-transfer-20261019`에서 작업했다. main/PR25 브랜치나 타 작업 디렉터리는 변경하지 않았다.
- 중앙 `work_status`/`shared_context`/fleet 도구는 제공되지 않아 새 중앙 조회의 증거는 없다. GitHub의 공유 작업만 확인했다.
- Windows 실험의 `atomic-8317/gpt-6-luna`는 이 장치에 설정돼 있지 않았다. Mac mini의 Pi 기본 경로는 `zai/glm-4.7`, 기존 credential 형식은 API key였다. 기존 설정을 읽고 installed Pi의 실제 `completeSimple` 경로를 사용했다.
- [전송 점검 원본](../experiments/cross-system-20261019/preflight/provider.json): tool-call 요청에 `401 Authentication Failed`, 응답 content는 빈 배열, SDK usage는 모두 0이었다. 이는 인증 실패 응답의 SDK 필드이며 실제 성공 추론이나 청구액 0을 증명하지 않는다. 공급자·모델 ID는 요청한 식별자이며 실제 추론 모델/가중치는 확인하지 못했다.

## 대상과 비교

원천 A는 기존 Python tracker의 실제 교훈 `observed-integration-failures-evidence-gate` 하나다. [원천 교훈](../experiments/cross-system-20261019/source/experience-A.json)은 기존 22회 자료 r005의 E memory에서 필드를 그대로 선택했다. F에는 같은 교훈의 rule/conditions만, E에는 상세 메타데이터까지, G에는 빈 배열을 제공한다. B의 코드·해답을 A에 덧붙이지 않았다.

대상 B는 별도 저장소 [farm_studio_api](https://github.com/callin2/farm_studio_api)의 실제 과거 CLI 수용 판정기다. 원본 `95b2388f8c233b60007aa2b0df8f82a80d7efbf9`의 `tools/ghostflow-cli-ten-verdict.mjs`는 보고서의 성공 표식과 stdout의 저장 주장만 보고, 실제 파일/검사 capture가 이를 뒷받침하지 않아도 통과시켰다. [원본·고친 upstream commit 및 hash 출처](../experiments/cross-system-20261019/source/provenance.json)를 보존했다. 제품 저장소에는 어떤 수정도 하지 않았다.

이 모듈은 tracker의 상태/부모/evidence 배열 검증이 아니라 JavaScript CLI의 응답 종류, 별도 프로세스 종료, 실제 source bytes/hash 및 holdout 출력을 결합한다. 같은 tracker의 다른 진입점이나 이름 변경 과제가 아니다. 반면 같은 넓은 ‘근거 없는 성공’ 계열이며, 1개 대상의 1개 수리 과제다. 여러 시스템 전반의 일반화 표본이라고 부르지 않는다.

겉보기만 비슷한 반례는 산출물 없는 정상 clarification/answer다. 이는 `complete=true`일 수 있지만 `finalCandidate=false`, `fixedHoldoutPass=false`여야 한다. 과거 tracker의 ‘완료는 nonempty evidence’를 모든 대화에 강제하면 이 반례에 실패한다. 반례는 같은 대상의 다른 의미 경계이며 독립된 두 번째 대상 과제로 세지 않는다.

G/F/E 각 2회, 총 6회 새 대화를 seed 20261019로 섞었다. 입력·도구·숨겨진 판정·모델·제한은 공통이다. 현재 과제 계약을 명시하므로 G도 쉽게 풀 수 있으며, 그 경우 차이가 없다는 결과를 보존한다. [사전 프로토콜](../experiments/cross-system-20261019/source/preregistration.md), [입력 manifest](../experiments/cross-system-20261019/runs.json), [고정 hash](../experiments/cross-system-20261019/frozen.json)에 조건과 실행 순서를 둔다. 모델 응답이 없으므로 현재 여섯 작업 디렉터리에는 seed만 존재한다.

이번 계획은 관련 경험을 직접 주는 시험이다. 스스로 검색·선택하는 능력, adapter 전체 효과나 다중 협의 효과를 시험하지 않는다. G는 현재 지시·기초 지식으로 해결하는 기준선이지만 모델 학습 데이터에 이 과거 코드가 있었는지는 알 수 없다. 과제 선택자는 upstream 수정도 읽었으므로 완전한 맹검이 아니며, worker에게 수정본이나 숨겨진 판정 코드를 노출하지 않는 경계만 고정했다.

## 결정론적 검증

숨겨진 26개 행동 기준은 실제 exported 함수와 실제 CLI를 실행한다. 패치 텍스트나 모델의 자기평가를 정답으로 사용하지 않는다.

| 대상 | 통과 | 의미 |
|---|---:|---|
| 실제 과거 결함 원본 | 15/26 | 근거 누락/변조 및 CLI의 거짓 성공 11개를 실제 재현 |
| 수정된 upstream 원본 | 26/26 | 과제의 올바른 구현이 고정 계약을 만족함을 확인 |
| 입력·hash·문법·분리 검사 | 59/59 | 여섯 작업 입력과 정확한 A 투영, 본 실험 미실행, 실행 권한 제한 등 |
| worker용 공개 예시 시험 | 2/2 | 정상 후보와 중복 응답 parser 예시가 실제 실행됨 |

[원본 판정](../experiments/cross-system-20261019/preflight/baseline-check.json), [upstream 대조 판정](../experiments/cross-system-20261019/preflight/reference-check.json), [무결성](../experiments/cross-system-20261019/preflight/integrity.json), [공개 시험](../experiments/cross-system-20261019/preflight/public-tests.json).

판정은 repair/회귀/counterexample/CLI integration을 분리한다. 정상 후보·mixed 대화, pin/turn count, 응답 종류/중복, source hash, 실제 capture exit, holdout 출력, 기존 verdict 보존을 확인했다. 원본 실패는 예상된 결함 재현이며 지우거나 ‘수리 성공’으로 바꾸지 않았다.

worker의 JS 시험 및 숨겨진 판정은 Node permission 모드에서 실행한다. 작업/fixture 밖의 파일 읽기·쓰기와 network/child process/worker/addon을 허용하지 않는다. credentials는 controller만 읽고 테스트 subprocess에는 최소 환경만 전달한다. [권한 점검](../experiments/cross-system-20261019/preflight/permissions.json)은 비밀 파일 경로 읽기, 네트워크와 프로세스 등의 permission이 false임을 실제 확인했다. 운영 서비스나 실제 장비·프로덕션 자료를 사용하지 않았다.

## 실행·해석·남은 일

[결과 상태](../experiments/cross-system-20261019/results.json)는 `blocked_authentication`, 여섯 조건은 모두 `not_run`이다. 본 작업의 사람 교정은 모델 대화 자체가 없어 해당 측정값이 없다. 코드 성공률, 회귀율, 잘못된 유추율, 적응 시간/토큰도 아직 관측하지 않았다. 같은 401로 다른 작업을 호출하거나 다른 계정을 찾아 우회하지 않았다.

실제 모델 API 비교가 남아 있다. 현재 인증이 거부된 경로에는 실질적으로 새로운 관련 근거가 있어야 재개할 수 있다. 다른 설정/모델로 재개한다면 고정 경로와 달라지는 사실을 별도로 기록해야 한다. 다음 실행은 실패 기록을 보존하고 아직 비어 있는 b001~b006을 사용하며, 기존 22회 원본에는 접근·덮어쓰기하지 않는다.

향후 표본도 조건별 2회·1개 대상뿐이므로 성공하더라도 폭넓은 일반화나 유의미한 효과 크기를 주장할 수 없다. provider usage와 경과 시간은 실제 측정값으로 보존하되 현금 비용, coordinator·과거 교훈 생성 총비용 및 인간 시간 절감으로 확대하지 않는다.

## 재현

저장소 루트에서 아래 명령은 네트워크·모델 호출 없이 실재 코드의 판정을 재현한다. baseline 명령의 exit 1은 11개 결함 재현으로 예상되며, reference는 exit 0이어야 한다. 결과는 stdout에만 출력하므로 보존 파일을 덮어쓰지 않는다.

```sh
python3 scripts/cross_system/check.py experiments/cross-system-20261019/source/verdict-before.mjs
python3 scripts/cross_system/check.py experiments/cross-system-20261019/source/verdict-upstream-reference.mjs
```

인증이 정상이라는 새 근거를 확보한 이후의 실제 모델 실행 명령은 `node scripts/cross_system/run.mjs`다. 현재 401 상태에서는 실행하지 않았다. 이 명령은 실제 API를 사용하고 모델 사용량이 발생할 수 있으며, 고정된 입력이 달라지면 중단하고 완료/불확실한 기록을 덮어쓰지 않는다. 원래 실험 실행기에서 allowlisted 도구·대화 루프·provider usage 보존 방식을 재사용해 별도 실행기로 옮겼으며, 기존 runner와 과거 실험은 수정하지 않았다. 일반 기능 재실행으로 이 새 비교를 대신하지 않는다.
