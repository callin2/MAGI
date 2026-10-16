# 역할 경험의 지속·검증 계약 v1 — #13, #14, #15

근거: #11, #12, [기존 구현 비교](learning-precedents.md). 세 독립 평가의 원문은 `experiments/role-learning/design/`에 보존한다. 구현·효과 통과를 의미하지 않는 설계 계약이다.

## 사후 조정: 합의와 이견

동일 입력 SHA-256 `3daba4bad64923f40d6fb0f90b0b3012f56a4e49923709b95128c57e6f17485e`로 의견 비공유 평가 3건을 완료한 뒤 조정했다. 같은 모델·입력이므로 오류의 독립성을 주장하지 않는다.

| 쟁점 | A | B | C | 조정 결정·근거 |
|---|---|---|---|---|
| 지속 상태 기본 단위 | 역할 중심+scope | role×project | 역할 중심+ownerScope | role×project를 기본으로 하고 agent-private 항목을 지원. 프로젝트 혼입을 시험 가능하게 분리 |
| 기술 교훈 최초 적용 | 검증 후 accepted | provisional 자동 적용 가능 | 검증 후 active | 첫 adapter는 candidate/held/active/rejected/revoked만 사용. 임시 적용 분기는 검증 부담을 늘려 제외. 자동 기술 검증은 허용 |
| 다른 역할 공유 | grant | grant | 승인 링크 | grant는 원본 revision 참조. 전역 자동 확산 안 함 |
| 충돌 우선순위 | project/role 등 계층 | 권한·좁은 범위·최신 | 구체 범위·최신, 가치 충돌 질의 | 기존 인간 지침/권한 제한 우선. 교훈끼리의 의미 충돌은 보류. 최신 시각만으로 참을 판정하지 않음 |

reviewer가 제안한 모든 필드·UI·후속 모듈을 새 필수 요구로 추가하지 않는다. 아래 최소 계약으로 핵심 경로를 시험하고 필요가 관찰된 확장만 이슈 등록한다.

## #13 정체성·승계

`role_id@version`은 목적·책임·판단 기준을 가진 추상 역할이다. `agent_id`는 실행 주체, `task_id`는 목표가 있는 작업, `session_id/run_id`는 대화/실행이며 `state_id@revision`은 지속 상태다. 모델과 역할 수를 고정하지 않는다.

binding은 agent, role/version, project, active 여부를 연결한다. 겸임은 binding을 분리한다. state는 role/version×project이며 private 교훈은 owner agent까지 좁힌다. 새 agent는 명시 binding으로 role-scoped 지식을 승계하고 private 지식은 승계하지 않는다. 역할 버전·프로젝트가 바뀌면 이전 state를 자동 연결하지 않는다. 역할 해제는 binding 비활성화로 향후 조회·적용을 차단한다.

새 세션은 state ID를 명시하고 revision을 읽어 binding·역할 버전·프로젝트·활성을 확인한다. 읽기와 적용 사이 변경이 있으면 재조회한다. 파일/역할 이름만으로 연결 성공을 주장하지 않는다. 영수증에는 binding, agent, task, session/run, state/revision, 검색된 교훈 ID/version, 입력 포함, 최종 응답·실제 도구 행동을 각각 남긴다. 자기보고 ‘used’는 인과 증거가 아니다.

수용 반례: 같은 역할명 다른 ID, 다른 프로젝트, 변경된 버전, 해제 binding, stale revision, 새 프로세스. 각 경우 거부 또는 정확한 재연결이 확인돼야 한다.

## #14 경험과 교훈 수명주기

경험(event)은 원문·출처·관측 결과다. candidate는 event ID, 관측 사실, 원인 가설, 재사용 규칙, 적용 조건, 반증 조건, 범위, 판단 종류(technical/value)를 갖는다. 자동 경험 검토에서 후보를 만들 수 있으며 별도의 사용자 ‘기억해’ 요청을 필수로 하지 않는다. 실험의 고정 reflection 절차가 있는 경우 그 사실을 공개한다.

상태는 `candidate → active | held | rejected`, `active → revoked`다. 수정은 기존 active를 철회하고 새 후보/version을 검증한다. 과거 이벤트는 보존한다. 단일 칭찬·불만·성공만으로 승격하지 않는다. 원인 미확정, 범위 불명확, 충돌, 근거 부족은 held다.

기술 교훈은 합의한 목적·제약 아래 source와 별도 검증 사례/반례의 실제 결과가 있을 때 agent가 승격할 수 있다. 새로운 취향·가치·권한 변경은 기존 인간 결정이 없으면 held로 남긴다. 매 항목 인간 승인을 기본으로 추가하지 않는다. 검증 영수증은 검증 대상 후보와 사례·판정·근거를 연결한다. adapter의 입력 검사는 근거 진위를 자동 보증하지 않으므로 실제 시험과 분리한다.

철회·수정·공유 범위 변경은 상태 revision을 증가시킨다. 새 조회와 적용 직전 revision 확인에서 철회 항목을 제외한다. 이미 모델에 노출된 내용을 ‘잊게 했다’고 주장하지 않는다. 노출 후 철회라면 기존 응답의 적용을 거부하고 깨끗한 실행으로 다시 판단한다.

## #15 귀속·공유·충돌

첫 기본은 해당 role×project에 한정된 role scope다. 동일 역할 다음 작업 전이라는 목적에 필요한 범위이며 agent-private는 별도로 선택한다. 다른 프로젝트/다른 역할로 자동 확대하지 않는다. 이 기본값은 실험적 기술 선택이며 인간의 공유 권한을 새로 부여하지 않는다. 실제 민감 정보의 공유는 기존 권한을 따라야 한다.

read/write: 활성 owner binding만 원본을 변경한다. private는 owner agent만 조회. role scope는 같은 state의 활성 binding만 조회. 다른 역할 공유는 동일 프로젝트의 특정 대상 state에 특정 active lesson version을 가리키는 명시 grant로 표현한다. 수신자는 원본을 수정하지 못하고 자신의 후보를 제안한다. grant 축소/철회 또는 source 철회는 향후 조회를 차단한다. 원본 교훈 자체 철회와 grant만 철회는 구별한다.

적용 조건은 task context의 명시 key/value와 일치해야 한다. first adapter는 사람이/모델이 판단한 의미 충돌을 `conflict_key`로 표현하고 같은 key의 서로 다른 active 규칙이 동시에 후보가 되면 모두 보류한다. 의미 충돌의 자동 발견은 구현하지 않는다. 최신 revision은 신선도이지 진실의 우선순위가 아니다.

조회는 먼저 binding/state/권한/active/grant/version/조건을 검사한 뒤 관련 항목을 반환한다. 이 필터는 adapter 경계이며 에이전트의 OS 파일 접근을 제한하는 보안 sandbox가 아니다. 같은 저장 파일을 직접 읽을 수 있는 실행 사이의 보안 격리를 주장하지 않는다.

## 실행 경로·외부 의존·추적

대상 구조: 경험을 처리하는 기존 LLM 실행 → 후보 JSON → 검증 → 지속 상태 adapter → 새 LLM 실행의 관련 지식 조회 → 별도 결과/비용 측정. 원문 사건·후보·수용 상태·실험 응답은 다른 자료다.

첫 구현은 이미 있는 Python 표준 SQLite(트랜잭션·동시 갱신·프로세스 재시작 지속)와 git(소스·공개 실험 이력), 현재 사용 가능한 에이전트 실행을 조합한다. SQLite는 작은 상태 저장소, git은 재현 산출물 버전이며 새 범용 기억/에이전트 프레임워크를 만들지 않는다. 기존 제품 profile/영속 agent 전체 설치·운영은 이번 범위에 넣지 않는다. 해당 제품과 동등한 엔진을 구현했다고 주장하지 않는다.

| 요구 | use case | 자료/실행 | 검증/이슈 |
|---|---|---|---|
| RL-01 | binding·역할 변경 | role/binding/state | #13 → 최소 adapter 시험 |
| RL-02 | 경험 검토·후보 승격/보류 | event/candidate/validation | #14 → 실제 LLM reflection·반례 |
| RL-03 | 다음 작업·새 세션 | receipt + state revision | #13 → #16 별도 새 실행 |
| RL-04 | 전용·지정 공유 | scope/grant | #15 → API 경계 시험 |
| RL-05 | 수정·철회·효과 | event history/receipts/responses/cost | #14·15 → #16 |

필요 구현은 별도 issue로 선등록한 뒤 시작한다. #16은 no-memory / raw-log / refined-lesson 비교와 조건 변경·철회·교훈 제외 대조를 수행한다. 반복 횟수·실제 호출·관측 시간과 가능한 token 사용을 기록하고 미측정 비용은 unknown으로 둔다. 토큰 미측정이면 동일 예산 우월성·토큰 절감을 주장하지 않는다. 합성 탐색에서의 성공을 장기 실사용·안전·범용 효과로 확대하지 않는다.
