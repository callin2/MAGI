---
id: magi.verification
type: guide
status: active
owner: MAGI
reviewed: 2026-10-23
issue: https://github.com/callin2/MAGI/issues/26
---

# 실행과 검증 안내

[문서 목차](README.md)

저장소 루트에서 Python 3로 실행한다. 아래 Python 검사 도구는 표준 라이브러리를 사용한다. Windows에서는 아래처럼 `-X utf8`을 사용한다. 자식 Python을 실행하는 검사에는 PowerShell에서 `$env:PYTHONUTF8="1"`도 설정해 인코딩을 동일하게 전달한다. 아래 Python 명령은 모델을 새로 호출하지 않는다. 보관 결과 확인, 소스 회귀 시험, 모델의 새 실행은 서로 다른 작업이다.

## 다른 PC의 작업을 가져온 뒤 문서 확인

저장소 루트에서 작업 트리와 fetch 범위를 먼저 확인한다. main만 가져오는 설정이면 다른 PC의 연구 브랜치가 갱신되지 않을 수 있다.

```sh
git status --short --branch
git config --get-all remote.origin.fetch
git fetch origin '+refs/heads/*:refs/remotes/origin/*' --prune
git log -1 --format='%H %s' origin/main
git for-each-ref --sort=-committerdate --format='%(refname:short) %(objectname:short)' refs/remotes/origin
```

fetch는 원격 추적 정보를 갱신하며 현재 문서를 병합하지 않는다. 2026-10-23 확인 당시에는 dev가 없었다. 2026-10-24 사용자의 전체 dev 통합 요청에 따라 기존 main에서 dev를 만들고 후속 연구·문서 PR27을 통합한다. 실제 병합 상태는 PR을 확인한다. 미커밋 작업을 보존한 뒤 선택한 기준과의 차이를 검토하고, fast-forward 가능한 경우에만 `git merge --ff-only <확인한 원격 브랜치>`로 반영한다. 서로 갈라진 연구를 날짜순으로 무조건 합치지 않는다. 최신 원격 기준과 문서 정리 PR의 관계는 [정리 기록](documentation-organization.md)에 남긴다.

그다음 [문서 목차](README.md)의 질문별 링크와 후속 연구 연결을 갱신한다. 원문 결과를 새 목차에 복사하거나 보관 실험을 다시 실행할 필요는 없다.

## 소스 회귀 시험

```sh
python -X utf8 -m unittest discover -s scripts/work_pilot -p 'test_*.py' -v
python -X utf8 scripts/effectiveness/import_checks.py scripts/work_pilot/tracker.py
python -X utf8 scripts/test_role_memory.py -v
python -X utf8 -m unittest discover -s scripts/effectiveness -p 'test_*.py' -v
```

순서대로 tracker·판정·화면 도구, 완료 import 반례, 역할 기억 adapter, 효과 비교 판정기를 시험한다. 시험은 임시 작업 파일/fixture를 사용한다. 제품 개발 DB에 연결할 필요가 없다. 통과가 기억의 효과나 고객 업무의 완료를 입증하지는 않는다. 기록된 수치는 [import 수정](tracker-import-validation.md)과 [효과 비교](effectiveness-verification-20261018.md)를 본다.

## 저장된 자료를 읽기만 하는 검사

```sh
python -X utf8 scripts/check_pilot.py --check
python -X utf8 scripts/check_pilot_002.py --check
```

고정 입력·응답 구조·저장된 집계를 확인한다. `--check`를 빼면 결과 JSON을 다시 쓴다. 점수의 의미와 한계는 [pilot-001](pilot-report.md), [pilot-002](pilot-002-report.md)에 있다.

## 결과 파일을 다시 쓰는 검사

2026-10-19 이후 실험의 원본 확인과 재현 방법은 아래에서 찾는다. 과거 실행 명령은 해당 보고서에 한 번만 보관한다. 먼저 결과 JSON과 보고서를 읽고, 재실행이 필요할 때만 명령을 사용한다.

| 보관 실험 | 결과·한계·재현 원문 | 실행 전 확인 |
|---|---|---|
| 다른 코드베이스 6회 | [교차 시스템 기록](cross-system-transfer-20261019.md#재현과-한계) | `check.py`는 보관 파일을 읽고 임시 fixture에서 CLI를 시험한다. 원래 실패도 정상적인 재현 결과 |
| Luna·Terra·Sol 18회 | [세 모델 기록](cross-system-three-models-20261019.md#재현과-변경-범위) | 같은 판정기 사용. 모델별 전체 성공과 부분 통과를 구분 |
| 다중 분야 선별·후속 비교 | [감사·보존·재현](hard-domain-transfer-20261019.md#감사보존재현과-남은-한계) | 현재 `hard_domains`/`hard_domains2` 검사기는 Mac 실행 경로를 사용. Windows 검증 완료로 간주하지 않음 |

후속 `evaluate.py`, `verify.py`, `score.py`, `finalize.py`, `review_failures.py`는 보고서·판정·무결성 파일을 생성하는 실행기다. write-once로 기존 파일을 거절하는 것도 읽기 전용 검사를 뜻하지 않는다. 이번 문서 정리에서는 실행하지 않았다. 특히 후속 검증기는 당시 장치의 인증 설정도 참조하므로 단순 문서 탐색 명령으로 실행하지 않는다.

다음 명령에는 읽기 전용 모드가 없다. 보존된 평가를 다시 만들 목적이 있을 때 별도 작업 사본에서 실행하고 diff를 검토한다. 문서를 읽기 위해 실행할 필요는 없다.

| 명령 | 쓰는 결과와 주의점 |
|---|---|
| `python -X utf8 scripts/check_role_learning.py` | 역할 기억 파일럿 `results.json` |
| `python -X utf8 scripts/work_pilot/check_runs.py` | 재귀 업무의 개별 판정과 전체 `results.json` |
| `python -X utf8 scripts/effectiveness/verify_evidence.py` | 효과 비교 `integrity.json`; 원점수의 성공률 검사가 아님 |
| `python -X utf8 scripts/effectiveness/evaluate.py` | 보관 후보 코드 시험을 실행하고 개별 판정·`results.json` 갱신. 원래 실패가 남는 것이 정상 |
| `python -X utf8 scripts/effectiveness/summarize.py` | 기존 결과로 `summary.json` 재집계 |

구형 재귀 업무 자료는 Windows checkout 줄바꿈으로 파일 hash가 달라져 실패한 기록이 있다. UTF-8 옵션은 인코딩만 다루며 줄바꿈 hash 문제를 해결하지 않는다. [기존 재검증 기록](../experiments/effectiveness-20261018/legacy-windows-recheck/)과 [바이트 보존 결정](../experiments/effectiveness-20261018/byte-storage-note.md)을 먼저 확인한다. 통과를 위해 과거 hash나 점수를 고치지 않는다.

2026-10-23 동기화에서도 같은 차이를 확인했다. 이 Windows checkout의 `core.autocrlf=true`와 현재 `.gitattributes`는 후속 교차 시스템/다중 분야 자료 전체의 원문 바이트를 보장하지 않는다. [문서 감사](documentation-audit.json)는 Git 원문 바이트 일치와 CRLF만 다른 파일을 분리해 기록한다. 로컬 hash 차이를 실험 결과 변경으로 단정하거나 원본 manifest를 덮어쓰지 않는다.

## Tracker 사용

요청 JSON에 `{"op":"describe"}`를 넣어 지원 연산과 필드를 조회한다. state와 request는 실제 파일 경로로 바꾼다.

```sh
python -X utf8 scripts/work_pilot/tracker.py /absolute/workspace/state.json /absolute/request.json
```

`init/list/show/create/register_followups/complete/reopen/branch`를 지원한다. 쓰기 연산은 지정한 작업 상태를 실제 변경한다. 완료 산출물의 hash와 상태를 검사하며 의미적 정확성은 별도 검토 대상이다. worker의 파일 접근을 제한하는 OS sandbox나 임의 목표의 계획 런타임은 아니다. import 경계는 [수정 기록](tracker-import-validation.md)을 본다.

[기존 검토 화면](../experiments/recursive-work/review.html)은 로컬 브라우저에서 열 수 있다. 화면을 의도적으로 재생성할 때만 다음 명령을 사용한다.

```sh
python -X utf8 scripts/work_pilot/render_report.py experiments/recursive-work/review-data.json experiments/recursive-work/review.html
```

## 새 모델 실험

저장된 응답을 재집계해도 새 모델 실행이 되지 않는다. 기존 실험의 입력·실행기·판정은 고정 증거다. 새 연구는 별도 식별자와 사전 등록을 사용하며, 모델 연결·비용 한도를 확인한 뒤 실행한다. 이전 실험의 `prepare`나 `run`을 자료 확인 명령으로 실행하지 않는다. 설계 근거는 [학습 입증 계획](learning-proof-plan.md), 실제 적용 조건은 [효과 비교](effectiveness-verification-20261018.md)에 있다.

`scripts/prepare_role_learning.py`는 빈 fixture DB에 저장된 후보·사건을 재생하며 실험 입력을 다시 쓸 수 있다. 별도 작업 사본에서 의도적으로 fixture를 재구성할 때만 사용한다. 효과 비교의 `prepare.py`는 기존 frozen 자료를 거부하고 `run.mjs`는 완료된 실행을 재생성하지 않는다. `collect.py`는 이미 채점한 실행을 재시험하지 않고 집계한다.
