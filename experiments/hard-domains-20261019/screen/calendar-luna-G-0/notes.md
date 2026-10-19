Implemented and validated `solution.mjs` against the public and candidate suites. Ran `node --test public.test.mjs candidate.test.mjs`: 5 tests passed, 0 failed.

The planner resolves wall-clock starts by testing candidate UTC instants against Intl-rendered local fields. This preserves both instants in a fold, omits nonexistent times, and handles non-hour offsets/transitions. Durations are applied as elapsed milliseconds; exclusion matching includes both rule ID and local date; busy checks use strict half-open overlap; output is contained, unmerged, and sorted.

Limits: relies on the host Node Intl/IANA time-zone data and assumes contract-valid inputs. The supported zone/year/date/range constraints are those stated in the task.