# Tracker recovery for integration findings

## 수정 전 재현

통합 검사에서 다음 세 결함을 재현했다.

1. `complete`에 `evidence: []`를 주면 acceptance가 있어도 issue가 `done`으로 기록됐다.
2. `init`이 `T1.parent_id=T2`, `T2.parent_id=T1`인 순환 부모 참조를 허용했다.
3. `register_followups`에서 기존 issue의 `parent_id`가 `None`이어도 요청 parent와 다른 부모를 충돌 없이 재사용했다.

세 경우 모두 통합 계약의 원자성·부모 수명주기·실제 증거 요구를 위반한다.

## 수정

`tracker.py`에 빈 evidence 거부, 부모 그래프 순환 검사, 기존 부모가 요청 parent와 정확히 같을 때만 reuse하는 조건을 추가했다. `test_tracker.py`에는 각 재현 사례를 회귀 시험으로 추가했다.

## 수정 후 검증

실행:

`python3 -m unittest work/MAGI/scripts/work_pilot/test_tracker.py`

결과: 7개 시험 모두 통과.

추가 회귀 시험은 빈 evidence 완료 거부, init 부모 순환 거부, root issue의 잘못된 parent 재사용 충돌을 각각 확인한다. 기존 rollback, 목표 중복, 증거 hash, branch 격리, 경로 순회 시험도 함께 통과했다.

## 반복 교정 reopen 경로

### 실패 재현 및 요구

완료된 child와 parent의 문서를 `v1` hash로 완료한 뒤 artifact를 `v2`로 수정하면 새 hash로 재완료할 수 없었다. 기존 `complete`는 `already done`만 반환하고, 이전 evidence를 무효화한 뒤 재검증 상태로 되돌리는 경로가 없었다.

### 수정

`reopen` 연산을 추가했다. 알려진 done issue에 nonempty reason을 요구하고, 해당 issue와 done 상태인 조상들을 원자적으로 `open`으로 되돌린다. 기존 evidence는 reopen audit에 보존하고 issue의 현재 evidence는 비운다. open issue나 알 수 없는 id에는 적용하지 않는다.

### 검증

새 회귀 시험은 child 완료 → parent 완료 → artifact 변경 → 새 hash complete 실패 → child reopen 및 done parent 동시 재개방 → 새 hash child complete → 새 hash parent complete 순서를 실행한다. 전체 시험 결과는 `8개 시험 모두 통과`다.
