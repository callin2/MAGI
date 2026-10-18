---
id: magi.expertise-memory-review
type: proposal
status: under-review
created: 2026-10-18
issue: https://github.com/callin2/MAGI/issues/23
---

# 경험과 전문성을 공유하는 에이전트 검토

## 사용자 의도

2026-10-18 사용자는 “사람을 에이전트로 치환해 놓고 생각해 보자”고 명확히 했다. 예시는 인상 깊은 긴 이야기의 내용을 단서로 기억하는 사람과, 해당 분야를 소중히 여기는 '야구박사' 친구에게 물어 답을 찾는 상황이다.

검토 대상은 문서 정리의 보조 도구가 아니라 **경험을 선택적으로 기억하고, 필요한 경험을 떠올리며, 누가 무엇을 아는지에 따라 서로 질문하는 에이전트 지식 체계**다. 인간의 관심·감정·기억과 같은 능력이 구현됐다는 주장은 아니다.

## 기존 구조와 추가 질문

[역할 경험 계약](role-learning-contract.md)과 [#11](https://github.com/callin2/MAGI/issues/11)의 역할·지속·승계를 유지한다. [#13](https://github.com/callin2/MAGI/issues/13)·[#14](https://github.com/callin2/MAGI/issues/14)·[#15](https://github.com/callin2/MAGI/issues/15)의 정체성, 교훈 수명주기, 공유·충돌·철회를 재사용하고, [#17](https://github.com/callin2/MAGI/issues/17)의 기존 adapter 범위부터 확인한다.

새 질문은 무엇을 기억할 가치가 있다고 판정할지, 사건과 이유의 관계가 회상에 도움이 되는지, 다른 에이전트의 전문성을 어떻게 발견하고 질의할지다. 역할 이름을 붙이거나 공유 권한을 주는 것과, 실제로 잘 아는 상대를 찾아 정확한 답을 얻는 것은 다르다.

세부 질문과 검토 완료 기준은 [#23](https://github.com/callin2/MAGI/issues/23)에 유지한다. 단일 에이전트와 검색, 역할별 기억과 검색, 전문성에 따른 에이전트 질의를 비교한다. 근거 있는 정확도와 새 작업 행동, 전체 비용을 구별하고, 잘못된 전문가 추천·낡은 지식·순환 질의·충돌·철회도 포함한다. 기존 [#16](https://github.com/callin2/MAGI/issues/16)·[#18](https://github.com/callin2/MAGI/issues/18)·[#19](https://github.com/callin2/MAGI/issues/19)의 미완료 검증을 대신하지 않는다.

## 등록 시점의 결정과 검증

- 현재 결과: 검토 제안과 기존 과제와의 연결을 기록했다. 구현·제품 채택·저장 구조 변경은 결정하지 않았다.
- 변경 이유: 사용자가 의도한 사람→에이전트 치환을 단순 문서 관리 기능으로 축소하지 않고 보존하기 위해서다.
- 확인: 기존 이슈와 역할 계약을 읽고 중복 범위와 추가 질문을 구분했다. 문서 링크와 diff를 확인하고 검토 이슈의 제목·상태·라벨·본문을 재조회한다.
- 남은 일: #23의 조사·가설 비교·실험 설계. 등록 완료를 검토 완료나 전문성 효과 입증으로 취급하지 않는다.
- 저장 이력: [문서 커밋](https://github.com/callin2/MAGI/commits/codex/expertise-memory-review/docs/expertise-memory-review.md). 등록 결과와 정확한 커밋은 #23에 연결한다.
