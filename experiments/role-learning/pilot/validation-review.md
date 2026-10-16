# Candidate validation boundary

The fixed end-of-task LLM reflection produced learned-candidates.json from events.json.
Coordinator reviewed all 3 candidates against their source events: parent database ID,
stable work_key deduplication, and has_more pagination are explicitly supported by the
synthetic validator observations. The hypotheses remain hypotheses; the API is fictional.

Activation is scoped to system=delta,version=1. The actual adapter contract tests check
different-context exclusion, role/project/private boundaries, stale receipts and revocation.
The future LLM trials and held-out answers are NOT used to choose or revise these rules.

This is qualitative source validation plus executed retrieval-boundary checks. It is not
a real Delta service validation, broad causal proof, or a confidence score learned from
human emotion. The adapter checks the presence/structure of a validation record; it does
not independently prove that an external validator is honest. No new human value or
permission is inferred or adopted. No lesson was manually rewritten by the coordinator.
