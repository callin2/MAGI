# MAGI

## 실제 효과 비교 — 2026-10-18

코드 수리와 고객 인계 두 업무에서 기억 없음·짧은 경험 규칙·원문 로그·정제 교훈을 비교하고 제외/오염/철회를 포함해 22회 실행했습니다. 코드 수리의 무기억 조건은 0/2, 경험을 전달한 세 조건은 각각 2/2였습니다. 정제 교훈은 짧은 규칙과 같은 통과 수를 얻었지만 주 비교의 처리 토큰은 29.6% 더 많았습니다. 작은 표본의 신호이며 MAGI 전체의 효과 증명은 아닙니다.

[결과·비용·한계](docs/effectiveness-verification-20261018.md) · [원판정과 내용 검토](docs/effectiveness-semantic-review-20261018.md) · [원자료](experiments/effectiveness-20261018/) · [#18](https://github.com/callin2/MAGI/issues/18) · [#19](https://github.com/callin2/MAGI/issues/19)

실제 발견한 tracker import 검증 누락도 수정했습니다([#24 및 검증](docs/tracker-import-validation.md)). 기존 포함 32개 회귀와 별도 import 판정 13개가 통과했습니다. 과거 보관 자료는 Windows checkout 줄바꿈 때문에 hash 재검증이 실패할 수 있으며, 새 자료는 바이트를 보존합니다. 현재 실패를 숨기거나 과거 hash를 재발급하지 않았습니다.

```sh
python -X utf8 scripts/effectiveness/verify_evidence.py
python -X utf8 scripts/effectiveness/evaluate.py
```

## 실제 업무 위임 파일럿

재귀적 MAGI 분해 → 하위 실행 → 통합 실패 수정 → 독립 검증 → 경험 반영 → 새 세션 업무를 실제로 실행했습니다. [결과와 산출물](docs/recursive-work-pilot.md), [첫 구성 결정](experiments/recursive-work/runs/initial/decision-v3.md), [검증 운영 명세](experiments/recursive-work/runs/transfer-E/protocol.md)를 볼 수 있습니다. 25개 도구 시험과 5개 업무의 최종 구조 검사가 통과했으며 초기 미완료·판정 오류·복구도 보존했습니다. 일반 학습 효과와 총비용 우월성은 미입증입니다.

```sh
python3 -m unittest discover -s scripts/work_pilot -p 'test_*.py' -v
python3 scripts/work_pilot/check_runs.py
```

새로운 대상의 해석과 판단 기준 형성을 포함하는 범용 다중 AI 판단 구조를 연구합니다. 사업·기술 의사결정부터 코드 설계까지 적용 가능한 추상 구조가 목표입니다.

현재는 연구 계약과 소규모 실제 AI 파일럿 단계입니다. 범용 엔진·모델 연결 런타임·자동 변화 감지는 구현되지 않았습니다. 확정된 제품 아키텍처나 성능 보증은 아닙니다.

역할 경험의 지속을 위한 작은 SQLite/JSON adapter와 새 에이전트 전이 탐색 시험을 추가했습니다. [기존 사례 비교](docs/learning-precedents.md), [독립 검토 후 계약](docs/role-learning-contract.md), [실행 결과와 한계](docs/role-learning-pilot-report.md)를 확인할 수 있습니다. 저장·조회·범위·철회 경로는 시험했으며, 정제 교훈의 독립적 이득과 전체 토큰 효율은 입증하지 못했습니다. [#16](https://github.com/callin2/MAGI/issues/16)·[#18](https://github.com/callin2/MAGI/issues/18)에 남은 검증을 연결했습니다.

```sh
python3 scripts/test_role_memory.py -v
python3 scripts/check_role_learning.py
```

## 요구사항과 연구 계약

- [상위 요구사항 #1](https://github.com/callin2/MAGI/issues/1)
- [세 독립 평가 보고서](https://github.com/callin2/MAGI/issues/1#issuecomment-6205482424)
- [해석·판단 기준 평가 계약](docs/evaluation-contract.md) — [#2](https://github.com/callin2/MAGI/issues/2)
- [독립 평가·공통 오판 프로토콜](docs/independence-protocol.md) — [#3](https://github.com/callin2/MAGI/issues/3)
- [유보·종료·재판단·비용 계약](docs/decision-lifecycle.md) — [#4](https://github.com/callin2/MAGI/issues/4)
- [실제 AI 탐색 파일럿 보고서](docs/pilot-report.md) — [#5](https://github.com/callin2/MAGI/issues/5)

## 확인한 결과

여섯 합성 사례에서 단일 판단·단순 협의·가설 경쟁의 action이 모두 같았습니다. 추가 이득은 관찰하지 못했습니다. 새로운 해석·판단 기준 생성, 공통 오판 탐지, 동일 예산 효율은 미검증입니다. 세 방식이 같은 응답을 재사용한 탐색 비교이며 성능 우월성 시험이 아닙니다.

## 파일럿 자료 확인

`experiments/pilot-001/`에 사전 고정 사례·평가 키·프로토콜·해시와 실제 독립 응답 3개·조정 응답·집계 결과를 보존했습니다.

```sh
python3 scripts/check_pilot.py --check
```

이 명령은 저장된 자료를 검증합니다. AI 모델을 호출하거나 새 응답을 생성하지 않습니다. 외부 패키지는 필요하지 않습니다.

## 남은 후속 검증

[서브이슈 #6](https://github.com/callin2/MAGI/issues/6): 개방형·공통 오류·동일 예산 조건에서 가설 경쟁을 재평가합니다. 아직 실행하지 않았습니다.

## 현재 미결 쟁점의 재실험

[pilot-002 보고서](docs/pilot-002-report.md) · [서브이슈 #7](https://github.com/callin2/MAGI/issues/7)

Broward 데이터센터 유예, AI 학습·뉴스 저작권 분쟁, EU 장기예산 협상에서 세 추상 우선순위의 독립 판단과 별도 조정을 수행했습니다. 실질적 권고 차이와 남는 가치 충돌을 기록했지만, 정답·동일 예산 우월성·실제 사회 효과는 미검증입니다.

```sh
python3 scripts/check_pilot_002.py --check
```
