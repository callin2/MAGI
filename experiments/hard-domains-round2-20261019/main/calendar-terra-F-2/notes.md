# Validation notes

Implemented `book` as an exact backtracking optimizer rather than an independent slot picker. It resolves each local label against `Intl.DateTimeFormat`, retaining the requested occurrence(s) for DST folds and rejecting nonexistent labels. Candidate intervals are range- and room-block-filtered before search.

The search uses prerequisite-first topological order, validates room/person overlap, validates transition setup between adjacent selected meetings per person after every insertion, and enforces prerequisite end-to-start ordering. It compares complete schedules by value, count, then the required ASCII/code-unit booking tuple order.

Validation run: `functions.tests` completed successfully: 6 tests passed (public empty/simple tests plus global-choice, transition, DST fold/gap, requirement/block/tie tests).

Limits: exhaustive optimization is exponential in feasible alternatives, although the stated maximum of 10 meetings and optimistic value/count pruning are applied. Civil-time resolution depends on the Node runtime's bundled ICU/IANA zone data.
