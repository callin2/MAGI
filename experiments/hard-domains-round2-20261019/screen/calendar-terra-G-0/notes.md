Validation performed
- Ran the supplied test runner after repair: 5 tests passed (public and candidate suites).
- Added candidate coverage for global rather than greedy optimization, directed room-transition gaps, prerequisite temporal ordering, DST fold=either selection with a room block, and lexicographic room tie-breaking.

Implementation notes
- `book` is synchronous and does not mutate input objects.
- Civil starts are resolved using Intl formatting and the only offsets possible in the contract's five supported zones. Spring gaps yield no occurrence; fall folds yield one or two occurrences according to `fold`.
- Search is exhaustive over skip/occurrence/room choices with a value upper bound. This is suitable for the contract's maximum of 10 meetings, but deliberately is not a large-scale calendar solver.
