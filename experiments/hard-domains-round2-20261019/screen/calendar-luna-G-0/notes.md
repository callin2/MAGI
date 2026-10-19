# Validation notes

Implemented `book` as a global exhaustive search over skip/book choices, offered start instants, and eligible rooms. Leaf feasibility checks enforce selected requirements and precedence, room/person interval conflicts, and directed room setup only between adjacent selected meetings for each person. Room busy blocks constrain room occupancy only. The objective compares total value, booked count, then sorted booking tuples.

Validation: `functions.tests` ran the public and candidate suites: 6 tests passed, 0 failed. Candidate coverage includes global choice, directed consecutive transitions, a New York DST fold and nonexistent time, room blocks, and deterministic lexical choice.

Limits: search is exponential in the number of meetings and alternatives, within the specified small input bounds. Civil-start resolution tests UTC minute instants in a ±15-hour window, matching the provided minute-resolution starts and supported zones/years. This module only calculates recommendations; it does not read or modify any calendar.