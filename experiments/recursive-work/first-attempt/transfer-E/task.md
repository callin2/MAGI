# 새 업무 위임: MAGI 업무위임 검증 실행 명세를 완성하세요

목표: MAGI가 사람이 같은 설명·교정을 반복하지 않아도 지적노동을 맡아 수행·개선하는지 확인할 실제 실행 명세를 만드세요. 제공한 current-facts.json을 현재 근거로 사용하고 확인된 구현과 미래 목표를 구분하세요. 현재 판단 주체는 당신이며 기존 수행 도구를 사용해 파일·작업 상태를 실제 완결합니다.

현재 root goal delegation-protocol와 기존 child protocol-design이 등록돼 있습니다. 기존 작업을 조회·재사용하고 필요한 child protocol-cases를 등록해 명세→별도 과제→통합 검증을 수행하세요. 필요 이상으로 분해하지 말고 불명확한 지점은 대안과 근거로 기술 선택하세요. 새 인간 승인을 일괄 추가하지 마세요.

산출물:
1. protocol.md: 한국어. 목적·주장·현재 구현/목표구조, 실행 책임/입출력/의존성, G(경험 없음)/F(고정규칙)/L(원문)/E(추출교훈) 비교, 실제 도구행동 판정, 오류/교정/전체비용, 반증/철회/재분해 조건, 미측정 한계를 포함.
2. cases.json: {schema_version:1,cases:[{id,family,goal,is_transfer:boolean,acceptance:[string]}]}. 최소 3개 가족(followup,dedup,recovery), 가족마다 경험과 별도 전이 과제 최소 하나씩. 답을 베끼는 ID치환에 그치지 않게 차이를 설명. 예상 정답을 학습 입력에 유출하지 않을 경계 명시.
3. summary.md: 사용자가 목적을 맡기면 무엇을 받으며, 이번 결과로 무엇을 주장할 수/없고 다음 실행이 어떻게 진행되는지 짧게 설명.

작업 도구: python3 /Users/changjin/Documents/Codex/2026-10-16/new-chat-2/work/MAGI/scripts/work_pilot/tracker.py /Users/changjin/Documents/Codex/2026-10-16/new-chat-2/work/MAGI/experiments/recursive-work/runs/transfer-E/state.json REQUEST.json. list/register_followups/create/complete/reopen 지원. 완료는 실제 artifact SHA-256 증거가 필요합니다. REQUEST 파일과 CLI 응답은 calls.json으로 보존하세요. state 직접편집·소스코드 수정·workspace 밖쓰기·외부 issue등록·서브에이전트생성 금지. cases(채점키)나 타 실행결과를 읽지 마세요. task.md/current-facts.json/허용도구/자기산출물만 읽고 수행. 기존 사용자 필수원칙은 모든 조건에 동일합니다.

사용 가능한 추가 경험(없을 수 있으며 현재과제 조건에 맞는 것만 사용):
[
  {
    "conditions": {
      "workspace_type": "local-work-pilot"
    },
    "conflict_key": "documentation-evidence-and-decision-boundary",
    "fact": "Review corrected a draft that conflated the target natural-language planning runtime with the current memory/tool implementation, and then removed a universal human approval boundary that contradicted the existing decision principle; the revised artifact distinguishes technical judgment, validation, adoption, and revocation within existing goals from new preference, value, or permission decisions.",
    "falsifier": "A document that merges target and current implementation and adds universal approval for technical learning is shown by review to preserve accurate evidence scope and the established decision boundary without correction.",
    "grants": [],
    "hypothesis": "Separating documented target architecture from current implementation, while preserving the established human/agent decision boundary, reduces semantic drift without creating an extra approval gate for technical learning.",
    "id": "observed-document-review-evidence-boundary",
    "kind": "technical",
    "owner": "work-observer",
    "rule": "When reviewing technical documentation, label target and current evidence separately and route technical judgment, validation, adoption, and revocation through existing goals; require a new decision boundary only for genuinely new preferences, values, or permissions.",
    "scope": "role",
    "source_id": "observed-document-review",
    "state_id": "work-author",
    "status": "active",
    "validation": {
      "lesson_id": "observed-document-review-evidence-boundary",
      "reference": "actual-observation-and-source-review",
      "tests": [
        {
          "case": "source observation explicitly supports scoped rule",
          "passed": true
        },
        {
          "case": "counterexample outside existing goal/current implementation is not automatically accepted",
          "counterexample": true,
          "passed": true
        }
      ]
    },
    "version": 1
  },
  {
    "conditions": {
      "workspace_type": "local-work-pilot"
    },
    "conflict_key": "completion-requires-evidence",
    "fact": "Integration calls accepted complete evidence=[] as done; tracker recovery added a regression test that rejects empty evidence, and the combined tracker/evaluator suite passes.",
    "falsifier": "A valid completed work item with no evidence is accepted by the authoritative completion validator without reducing correctness.",
    "grants": [],
    "hypothesis": "A completion gate that requires nonempty evidence prevents false done states caused by structurally complete but unsubstantiated reports.",
    "id": "observed-integration-failures-evidence-gate",
    "kind": "technical",
    "owner": "work-observer",
    "rule": "When marking work done, reject the state unless evidence is nonempty and validate that condition in the recovery regression suite.",
    "scope": "role",
    "source_id": "observed-integration-failures",
    "state_id": "work-author",
    "status": "active",
    "validation": {
      "lesson_id": "observed-integration-failures-evidence-gate",
      "reference": "actual-observation-and-source-review",
      "tests": [
        {
          "case": "source observation explicitly supports scoped rule",
          "passed": true
        },
        {
          "case": "counterexample outside existing goal/current implementation is not automatically accepted",
          "counterexample": true,
          "passed": true
        }
      ]
    },
    "version": 1
  },
  {
    "conditions": {
      "workspace_type": "local-work-pilot"
    },
    "conflict_key": "parent-lineage-integrity",
    "fact": "Integration accepted init with T1→T2→T1 parents and accepted reuse under a different parent; recovery tests now reject parent cycles and parent reuse, while the evaluator rejects malformed state.",
    "falsifier": "A recovery path can accept a cyclic parent graph or different-parent reuse while preserving valid lineage and evaluator correctness.",
    "grants": [],
    "hypothesis": "Validating parent-graph acyclicity and immutable parent ownership at recovery boundaries prevents malformed tracker lineage from being reintroduced.",
    "id": "observed-integration-failures-parent-integrity",
    "kind": "technical",
    "owner": "work-observer",
    "rule": "At initialization and recovery, reject parent cycles, reject reuse under a different parent, and run regression tests for both invariants.",
    "scope": "role",
    "source_id": "observed-integration-failures",
    "state_id": "work-author",
    "status": "active",
    "validation": {
      "lesson_id": "observed-integration-failures-parent-integrity",
      "reference": "actual-observation-and-source-review",
      "tests": [
        {
          "case": "source observation explicitly supports scoped rule",
          "passed": true
        },
        {
          "case": "counterexample outside existing goal/current implementation is not automatically accepted",
          "counterexample": true,
          "passed": true
        }
      ]
    },
    "version": 1
  }
]

workspace: /Users/changjin/Documents/Codex/2026-10-16/new-chat-2/work/MAGI/experiments/recursive-work/runs/transfer-E
