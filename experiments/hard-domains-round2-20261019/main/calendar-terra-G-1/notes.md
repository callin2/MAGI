# Validation notes

Implemented `book` as a global optimizer rather than an independent availability filter.

Validated with `functions.tests`: all 6 tests passed (the two supplied public tests plus four candidate tests). Candidate coverage includes:

- a globally better pair versus a higher-valued conflicting meeting;
- the fact that an inserted selected meeting changes the consecutive transition that applies;
- requirements, room busy blocks, and lexical tie resolution;
- New York fall-back `either` handling with a range that admits only the later occurrence.

## Limits

The specified maximum of ten meetings is handled by exhaustive DFS plus safe value/count upper-bound pruning. Time-zone conversion intentionally scans a +/-16 hour UTC window by minute, which covers all listed supported zones and preserves the contract's minute precision. It uses only standard `Intl` and `Date` APIs and does not mutate inputs or access any calendar service.
