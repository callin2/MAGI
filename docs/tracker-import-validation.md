---
id: magi.tracker-import-validation
type: change-record
status: recorded
owner: MAGI
reviewed: 2026-10-18
issue: https://github.com/callin2/MAGI/issues/24
---

# Tracker 완료 상태 import 검증 — #24

[문서 목차](README.md)

[이슈 #24](https://github.com/callin2/MAGI/issues/24) · [실제 효과 비교](effectiveness-verification-20261018.md)

## 결정과 원인

고객 결과 → 실제 완료 근거가 없는 작업을 완료로 불러오지 않으며, 변경된 산출물을 정상적으로 다시 검증할 수 있어야 한다.

관측 → 기존 `init`은 `state_ok`의 구조 검사만 수행해 `done, evidence=[]`를 받아들였다. `complete`는 같은 상태를 거부한다. 정상 import와 사후 변경된 산출물의 `list`/`reopen`은 기존 동작으로 유지해야 한다.

다음 행동 → 효과 비교에서 처음 완료된 r001 후보가 고정된 판정을 통과했다. 조건 간 효과 판단과 무관하게 이 후보의 import 전용 검증을 기존 소유 모듈에 최소 변경으로 반영한다. 비교 입력인 `experiments/.../source/tracker.py`는 그대로 유지한다.

독립 리뷰에서 후보의 전체 파일 재서식은 제외하고, 재귀 descendant 탐색은 직접 parent 경계 검사로 바꾼다. 유효한 깊은 계층이 Python 재귀 한계로 거절될 이유가 없고, 모든 done parent의 직접 child가 done이면 전체 descendant 조건도 성립하기 때문이다. 또한 문서의 상대 경로 계약을 지키도록 absolute/drive-relative evidence 경로를 거부한다. 이 통합 수정은 모델 원출력과 구별하며, r001의 사전 판정 결과를 소급 변경하지 않는다.

수용 증거 → 원본 회귀, import 거부의 원자성, 올바른 완료 import, 기존 상태 덮어쓰기 방지, 변경/삭제된 파일의 재개, 계층 및 상대 경로 반례. 결과와 커밋은 아래에 기록했다.

## 검증 결과

현재 명령은 [실행·검증 안내](verification.md)에 있다. 아래는 수정 당시 관측이다.

- Tracker 회귀 시험: **32/32 통과**. 기존 25개 + import 경계 7개.
- 별도 import 판정: **13/13 통과**. 새 작업의 숨겨진 반례와 정상 import/reopen 포함.
- 변경 전 역할 기억 adapter 시험: **7/7 통과**. 이번 수정은 그 adapter를 변경하지 않는다.
- 과거 보관 실행의 `check_runs.py`는 Windows 기본 cp949에서 디코딩 실패했고, `-X utf8`로 실행하면 산출물 hash 불일치로 실패했다. 별도 조사에서 **17/17 산출물의 Git blob은 당시 기록한 hash와 일치하고 현재 Windows checkout은 모두 불일치**했다. 원본 코드 수정 회귀가 아니라 기존 checkout 줄바꿈의 재현성 문제다. 실패 기록은 [별도 재검증 자료](../experiments/effectiveness-20261018/legacy-windows-recheck/)에 보존하고, 검사 명령이 덮어쓴 과거 평가 파일은 복원했다. 과거 재검증을 통과했다고 보고하지 않는다.

새 비교 자료는 실험 전에 `.gitattributes`로 바이트 변환을 금지했다. 구형 증거 자료의 이식성 개선은 별도 범위이며, 실험 결과를 바꾸거나 이전 증거 hash를 다시 발급하지 않는다.

이 수정은 [커밋 a9a9b35](https://github.com/callin2/MAGI/commit/a9a9b35)에 저장하고 push했다. [PR #25](https://github.com/callin2/MAGI/pull/25)에서 검토 가능하며 main 병합 전이다. [#24 검증 기록](https://github.com/callin2/MAGI/issues/24#issuecomment-6248941557)에 변경 이유·결과·한계를 보존했다.
