# MAGI

Read [the documentation index](docs/README.md) before related work. It identifies
the canonical contracts, current commands, historical reports and open proposals.
Read the relevant linked document rather than treating every historical report
as the current project state.

Follow the index's document ownership and metadata rules. Keep project documents
in their owning repository; parent projects link module details and own integration
decisions. Update an existing canonical document before adding a duplicate.

Preserve experiments, frozen inputs, recorded failures and scores byte for byte
during documentation changes. Some check scripts overwrite historical results;
consult [the execution guide](docs/verification.md) before running them.

Record completed changes, reasons, validation and remaining work in the relevant
document and GitHub issue, link them, then commit and push the issue slice.
Documentation organization evidence: [record](docs/documentation-organization.md).
