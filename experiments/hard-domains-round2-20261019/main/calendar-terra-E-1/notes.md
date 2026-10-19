# Repair validation

Implemented `book` as a global backtracking optimizer rather than independent booking selection. It resolves local civil starts through `Intl.DateTimeFormat`, supports earlier/later/either fold behavior, rejects nonexistent local starts, uses elapsed duration, and emits UTC ISO timestamps with milliseconds.

Feasibility covers range containment, half-open room blocks and room occupancy, shared-person overlap, directed setup time only between chronological adjacent selected meetings for each person, and mandatory temporal prerequisites. The optimizer ranks value, count, then the required ASCII tuple sequence. Inputs are read only.

## Validation actually run

Ran `functions.tests` after adding `candidate.test.mjs`.

Result: 3 test files/tests passed, 0 failed. Candidate coverage includes global-vs-greedy selection, transition gap at adjacency, an intermediate meeting changing the relevant transition, New York fall-back `either`, New York spring gap, and mandatory/temporal requirements.

## Limits

The optimizer is exhaustive with simple value/count bounds. At the maximum meeting count, deliberately adversarial equal-value cases with many compatible alternatives can remain exponential. Zone handling intentionally targets the contracted supported zones and dates and relies on the installed Node Intl timezone data. No live calendar, network, or external package is used.
