# MAGI

새로운 대상의 해석과 판단 기준 형성을 포함하는 범용 다중 AI 판단 구조를 연구합니다. 사업·기술 의사결정부터 코드 설계까지 적용 가능한 추상 구조가 목표입니다.

현재는 연구 계약과 소규모 실제 AI 파일럿 단계입니다. 범용 엔진·모델 연결 런타임·자동 변화 감지는 구현되지 않았습니다. 확정된 제품 아키텍처나 성능 보증은 아닙니다.

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
