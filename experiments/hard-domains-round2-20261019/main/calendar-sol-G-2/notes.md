# Repair and validation

- `solution.mjs` exports synchronous `book`, preserving caller input and returning exactly value/count/bookings.
- Generates valid civil-time occurrences by sampling nearby timezone offsets and round-tripping candidates through Intl. Resolves folds explicitly and rejects gaps. Durations are elapsed milliseconds.
- Searches offered occurrences chronologically, choosing one room or skipping. Because starts are processed in time order and durations are positive, the last selected meeting for a person is exactly the predecessor whose directed transition applies. Unselected intermediate events impose no transition; selected intermediate meetings replace that predecessor.
- Prerequisites must already have been selected and finished at selection time. Room blocks are filtered independently, without setup effects.
- Branch-and-bound uses remaining distinct meeting values/counts, plus an optimistic lexicographic schedule only when both objective upper bounds tie the incumbent. Results and ties use code-unit comparison, never locale collation.

## Actual validation

Ran the provided `functions.tests` runner after writing the implementation and candidate tests: exit code 0; 9 tests passed, none failed (about 83 ms reported total). This includes both public tests and seven candidate tests. Coverage includes greedy counterexamples, zero-value count tie-breaking, dependencies, room assignment and blocks, input preservation, directed nonmetric transitions with an intermediate meeting, setup boundary equality, range boundaries, fold alternatives, missing starts, New York/Berlin/Kathmandu/Lord Howe resolution, and elapsed duration across a fold. A seeded test independently enumerates all room/skip assignments for 60 five-meeting instances and checks overlap, dependencies, and whole-schedule consecutive transitions before comparing the complete optimum.

## Scope and limits

No network, live calendar, or external services are used. Inputs are assumed well formed under the contract. Timezone handling relies on runtime Intl data and is scoped to the supported zones and years; the nearby-offset sampling is not asserted to support arbitrary historical timezone changes. Search is exact but exponential in the worst case, bounded here by at most ten meetings and three rooms. No separate worst-case performance benchmark or exhaustive enumeration of every supported civil date was run.
