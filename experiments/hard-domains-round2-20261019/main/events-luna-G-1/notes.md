# Validation notes

Implemented sessions as connected components of current live events, sorted by event time and connected when consecutive gaps are at most `gap_ms`. Revision tombstones and accepted canonical payloads are tracked independently of live contributions. Candidate upserts/deletes are evaluated on a copied proposal and only committed when admissible. Watermark advancement is monotone; eligible components are frozen and removed from the revisable live set.

Validation: `functions.tests` ran the provided public tests together with `candidate.test.mjs`; all 3 test files/cases reported by the runner passed (3 total). Candidate coverage includes bridge merge/retraction split, equality connection, finalization stability, acceptance of an old event joining an open component, revision conflict/lower-revision handling, and empty input.

Limits: Inputs are assumed well formed as specified. No broker, live service, network, or external process was accessed. The implementation is intended for the stated small bounds (at most 80 records and 18 IDs).