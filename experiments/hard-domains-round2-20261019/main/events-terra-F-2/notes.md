Validation performed
- Ran the supplied test runner after implementing the module.
- All 6 tests passed: supplied empty/simple coverage plus added bridge merge/retraction/split, sealed boundary and mutation rejection, old-event joining an open session, and revision/tombstone replay/conflict cases.

Implementation notes
- Session components are formed by sorting live events per key and splitting only when consecutive timestamps differ by more than gap_ms.
- Finalized components are captured as immutable snapshots; their IDs remain protected from delete/upsert.
- Upsert validation computes the candidate component after removal of the old mutable contribution, before committing any revision/state change.
- A candidate is blocked when it could connect to a sealed component (from start-gap_ms through displayed end, inclusive).

Limits
- The implementation uses ordinary JavaScript Number values. Very large integer timestamps, amounts, or sums beyond Number safe-integer precision cannot be represented exactly.
