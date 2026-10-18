# 실제 업무를 분해하고, 실패를 고쳐 완결한 MAGI 파일럿 — #19

## 결과

사용자의 재귀적 DnC 원칙을 실제 업무에 적용했다. 세 독립 분해안 비교 후 작업 도구·독립 판정기·검토 화면으로 책임을 나눠 구현하고, 통합 실패를 해당 책임에 돌려보내 수정했다. 이 도구로 첫 사용 구성 결정과 다음 검증 운영 명세를 실제 파일·로컬 작업 완료로 제출했다.

- [첫 사용 구성 결정 최종안](../experiments/recursive-work/runs/initial/decision-v3.md)
- [새 세션이 작성한 검증 운영 명세](../experiments/recursive-work/runs/transfer-E/protocol.md)
- [그 명세의 경험·전이 과제 데이터](../experiments/recursive-work/runs/transfer-E/cases.json)
- [사용자 안내](../experiments/recursive-work/runs/transfer-E/summary.md)
- [검토 화면 HTML](../experiments/recursive-work/review.html) — 파일을 로컬 브라우저에서 연다.

추가 사용자 판단 요청 없이 실행·교정·재검증을 진행했다. 이는 이번 실행의 관측이며 인간 시간 절감이나 범용 자율성을 입증한 수치가 아니다.

## 실제 순환

1. **분해 판단:** 같은 입력으로 독립 평가 A/B/C가 완료된 뒤 결과를 기록했다. 모두 사용자 결과 중심의 수직 슬라이스를 권했다. 기능별 구현만 나누는 안과 모든 단계의 병렬 협의 안을 비교하고, 중요 판단만 경쟁시키는 책임 DAG를 선택했다. [원문·조정](../experiments/recursive-work/design/)
2. **하위 실행:** #20 작업 도구, #21 독립 판정, #22 검토 화면을 먼저 등록한 뒤 병렬 구현했다. SQLite 기억은 #17 코드를 재사용했다.
3. **통합·국소 수정:** 빈 증거 완료, 부모 순환, 다른 부모로 잘못 재사용, 위험한 링크를 실제 재현하고 해당 leaf에 환류했다. 문서 수정 시 재개방·증거 재인증, 완료 부모의 새 하위 작업 생성 시 자동 재개방, 도구 계약 자체 조회와 실제 CLI 호출 로그를 추가했다. [복구 기록](../experiments/recursive-work/tracker-recovery.md)
4. **첫 실제 업무:** 새 에이전트가 기존 비교 업무를 재사용하고 선택 leaf를 등록해 구성 비교·결정·사용 안내를 작성했다. 내용 검토에서 현재 구현/목표 구조 혼동, 일괄 인간 승인 경계 두 건을 교정했다. v1/v2/v3와 reopen·재인증을 보존했다.
5. **실제 경험 검토:** 관측된 통합 결함과 문서 교정에서 LLM이 조건부 기술 교훈 3개를 추출했다. source·실행 시험/검토에 연결해 SQLite에 저장하고 새 worker 입력으로 조회했다. 앞선 Delta 합성 trace와 달리 이번 사건은 실행 중 관측한 작업에서 나왔다. 검증 레코드는 source 검토이지 자동적인 의미 진실 보증이 아니다.
6. **다른 업무로 전이:** 이전 대화 없이 시작한 worker 4개가 새로운 검증 운영 명세 업무를 G/F/L/E 조건에서 실제 도구로 수행했다. 초기 실패를 보존하고 도구·판정 계약을 고친 뒤 같은 작업을 완결했다.

## 초기 실패와 복구를 분리한 결과

| 조건 | 첫 시도의 실제 작업 완료 상태 | 같은 도구 계약 조회를 제공한 복구 후 |
|---|---|---|
| G: 경험 없음 | 미완료: 필요한 하위 작업과 완료 상태 누락 | 통과 17/17 |
| F: 고정 규칙 | 미완료: 하위 등록 실패 뒤 부모만 완료 | 통과 17/17 |
| L: 실제 경험 원문 | 실제 계층·작업 완료 | 통과 17/17 |
| E: 추출 교훈 | 미완료: 일부 leaf만 완료 | 통과 17/17 |

초기 판정기는 하위 작업이 루트의 직접 child여야 한다는 제약과 특정 단어가 있어야 한다는 제약까지 검사해 L도 실패로 처리했다. 이는 조정자의 판정 설계 오류다. MAGI가 선택할 수 있는 정상 중간 계층과 실제 비어 있지 않은 산출물을 허용하도록 수정했다. **원래 판정·원래 데이터·수정 판정의 결과를 모두 보존**했으며 유리한 결과만 교체하지 않았다. [고정 첫 시도](../experiments/recursive-work/first-attempt/) · [복구 계약](../experiments/recursive-work/recovery-contract.json) · [전체 결과](../experiments/recursive-work/results.json)

G/F/E는 도구 요청 형식을 추측하는 실패와 조기 완료 보고를 보였다. 도구 자체가 계약을 제공하도록 개선한 뒤 모든 조건이 회복했다. 따라서 차이를 기억·정제의 인과적 이득으로 해석할 수 없다. 각 조건 1회, 작은 자기 관련 문서 업무, 같은 모델, 단계 중 도구 변경, 묶음 순서의 한계가 있다. 정제 교훈이 원문 경험보다 낫다는 증거도 없다.

첫 구성 결정 업무는 최종 상태/파일 검사 16/16, 전이 업무는 각 17/17이다. 이 검사는 목표 존재·중복·계층·완료·실제 파일 hash와 과제 데이터 구조를 확인한다. 문서의 모든 기술 판단, 사용자 채택, 외부 업무 완료를 인증하는 검사는 아니다.

## 실행 가능한 도구와 재현

Python 표준 라이브러리만 사용한다.

```sh
python3 -m unittest discover -s scripts/work_pilot -p 'test_*.py' -v
python3 scripts/work_pilot/check_runs.py
```

25개 실패 지향 도구 시험이 통과했다. [실행 원문](../experiments/recursive-work/tests.txt). 두 번째 명령은 보존된 실제 작업의 상태·파일을 다시 판정하며 새 모델을 호출하지 않는다. 저장된 모델 출력을 새 실행으로 보고하지 않는다.

작업 도구는 request JSON 파일을 받아 실제 상태를 변경한다.

```sh
python3 scripts/work_pilot/tracker.py /absolute/workspace/state.json /absolute/request.json
```

처음에는 `{"op":"describe"}`를 넣어 모든 지원 연산의 계약을 조회한다. init/list/show/create/register_followups/complete/reopen/branch를 제공한다. completed artifact의 실제 hash와 상태를 검사하며, semantic correctness는 별도 검토한다. worker의 자유로운 파일 접근을 통제하는 OS sandbox나 임의 목표의 일반 계획 런타임은 아니다.

결과 화면을 다시 만들려면 다음을 실행한다.

```sh
python3 scripts/work_pilot/render_report.py experiments/recursive-work/review-data.json experiments/recursive-work/review.html
```

화면은 실제 Chrome에서 로드·내용·링크·레이아웃을 확인했다. 산출물 바로가기를 상단에 두었다. 실제 문서의 구체 수치들은 작성 당시 확인 근거이며 현재 도구의 추가 회귀 시험 수와 다를 수 있다.

## 비용·학습·미완료

후반부터 CLI가 실제 request/response/exit code/UTC 관측 시각/도구 소요 시간을 자동 기록한다. 초기 worker 자기작성 `calls.json`은 형식·포괄성이 달라 총 호출이나 비용을 단정할 수 없다. 초기 로그를 소급 생성하지 않았다. CLI 시간은 모델 시간이나 전체 작업시간이 아니다. 모델 token/청구 비용·인간 검토 시간은 미측정이다.

SQLite 조회 영수증으로 실제 경험이 새 worker 입력에 포함된 것은 확인했다. 교훈 때문에 결과가 달라졌다는 인과적 사용은 unknown으로 남겼고, 임의의 used ID를 성과 증거로 만들지 않았다. 개별 의미 품질·장기 개선·다양한 업무와 모델·전체 비용은 별도 검증이 필요하다.

#20~#22의 작은 도구/판정/화면 산출물은 근거로 완료 처리한다. #19의 재귀 실행 및 사용자 산출물 순환은 이번 범위에서 수행했지만, 최초 계획의 엄격 사전 고정 오염/교훈 제외/철회 대조를 모두 수행한 것은 아니므로 해당 항목과 #18의 총비용 검증을 남긴다. 기존 covering issue를 재사용하며 동일 과제를 위한 중복 이슈는 만들지 않는다. #11 전체 수용도 완료 처리하지 않는다.
