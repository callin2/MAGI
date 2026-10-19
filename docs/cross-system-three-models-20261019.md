---
id: magi.cross-system-three-models-20261019
type: report
status: recorded
owner: MAGI
reviewed: 2026-10-19
issue: https://github.com/callin2/MAGI/issues/18
---

# Luna·Terra·Sol 교차 시스템 검증 — 정확한 버전 지정 대기

[문서 목차](README.md) · 관련 [#18](https://github.com/callin2/MAGI/issues/18), [#19](https://github.com/callin2/MAGI/issues/19), [PR25](https://github.com/callin2/MAGI/pull/25).

사용자는 검증 대상을 luna, terra, sol 세 가지로 제한했다. 제한 이후 다른 모델의 추가 생성 호출은 하지 않았다. [완료된 GPT-4.1 Mini 6회](cross-system-transfer-20261019.md)는 별도로 보존하며 새 세 모델 결과에 합치지 않는다. 기존 결과의 전체 성공은 G/F/E 각각 0/2이고 실행별 부분 행동 통과는 20–23/26이다. 이는 아래 세 모델의 결과가 아니다.

## 기존 연결과 정확한 ID

Mac mini `callin-macmini.local`의 이미 연결된 Codex 계정에서 모델 목록을 읽기 전용으로 조회해 HTTP200을 받았다. 기존 credential이 만료되지 않았음을 확인하고 원래 위치에서 읽기만 했다. 새 인증 발급, OAuth refresh, 키 이동, 권한 확장, persistent 설정 변경은 없다. [실제 목록](../experiments/cross-system-target-models-20261019/inventory.json)은 요청/응답 날짜와 아래 정확한 ID, API 지원 및 reasoning 정보를 보존한다.

| 사용자가 지칭한 계열 | 실시간 응답의 정확한 ID |
|---|---|
| luna | `gpt-6-luna`, `gpt-5.6-luna` |
| terra | `gpt-5.6-terra` |
| sol | `gpt-6.1-sol`, `gpt-6-sol`, `gpt-5.6-sol` |

이전 실험 기록에는 `gpt-6-luna`, 이 Mac의 현재 Codex 설정에는 `gpt-6.1-sol`이 있지만, 이번 bare-name 요청의 버전 조합을 확정한 발언은 없다. 이름을 추측하거나 여러 버전 모두를 실행해 ‘세 모델’을 늘리지 않도록 정확한 세 ID를 질문한 상태다. 질문은 모델 버전 확인이며 새 권한 요청이 아니다. 버전 답변 전에 생성 API나 전송 생성 점검은 하지 않는다. 따라서 새 cohort의 실제 실험 실행 수는 0/18 계획이며 결과·provider token은 아직 없다. 연결의 read-only 목록 성공을 모델 추론 성공으로 부르지 않는다.

## 계속 진행 가능한 준비

[별도 프로토콜](../experiments/cross-system-target-models-20261019/protocol.md)과 `scripts/cross_system/target_models/`를 준비했다. 선택된 세 모델 각각에 기존 6개 입력 G/F/E × 2회, 동일 E/G/F/G/F/E 순서를 적용하는 총 18회 비교다. 정확한 선택은 selected-models.json에 기록한 후 seed 복제와 freeze를 수행하며, 현재 선택 미정이므로 freeze를 만들었다고 주장하지 않는다.

과제·A 교훈·B 원본 코드·공개 시험·숨겨진 판정은 기존 고정 자료를 바이트 그대로 재사용한다. GPT-4.1 결과에서 새로 확인한 실패나 해답을 worker 지시에 넣지 않는다. 관련 경험을 직접 제공하는 전이이며 자율 검색과 구분한다. 원래 한도·동일 reasoning 요청과 backend가 실제 수용한 출력 옵션은 전송 점검 후 과제 응답 전에 고정한다. 새 사용량/모델 선택 제한을 임의로 추가하지 않는다.

기존 Codex Responses 프로토콜 어댑터는 동일 서비스의 원래 credential을 controller 메모리에서만 읽도록 구성했다. 모델 ID는 선택 파일과 실시간 목록을 모두 확인한 정확한 값만 요청한다. 어댑터의 클라이언트 model 필드를 서버 응답 ID라고 오해하지 않도록 SSE의 실제 response.model과 raw usage도 별도로 보존하도록 준비했다. 인증 거부는 재시도하지 않는다. 전송 점검과 실제 실행은 정확한 버전 지정 이후다.

전체 성공, 실행별 0–26 부분 통과, repair/회귀/반례/CLI 축, provider usage·시간을 구분한다. 입력/모델/파일 무결성은 행동 성공과 따로 검사한다. 작은 조건별 2회·한 대상 과제이며 현금 비용·인간 시간 절감·모델 계열 전반의 효과를 추론하지 않는다. main 병합·배포·제품 서비스/DB/장비 변경도 없다.

## 추가 출처 확인과 한계

독립 감사에서 기존 6회 판정을 뒤집는 검사기 오류나 확인 가능한 정답 누출은 발견되지 않았다는 피드백을 받았다. 다만 archive의 수정 commit `ec21d3f5`가 원래 GitHub 경로에서404라는 한계가 있었다.

현재 Mac의 기존 API 저장소 Git 객체를 읽어 defect commit `95b2388f8c233b60007aa2b0df8f82a80d7efbf9`와 수정 commit `ec21d3f5b6921d4a62d7f74782caa6bc9cba4856`의 parent/tree/blob/commit timestamp 및 실제 파일 SHA-256을 확인했다. 실험에 복사한 원본과 수정 파일 모두 해당 로컬 Git 객체의 바이트와 일치한다. [로컬 출처 증거](../experiments/cross-system-target-models-20261019/local-reference-provenance.json).

이 확인은 로컬 보관의 동일성을 보여주며 외부 공개 저장소에서 독립적으로 내려받을 수 있다는 증거는 아니다. 수정본을 ‘공개 upstream에서 독립 검증했다’고 해석하지 않는다. 이 한계를 이유로 과제·교훈·판정·원점수를 바꾸지 않았다.
