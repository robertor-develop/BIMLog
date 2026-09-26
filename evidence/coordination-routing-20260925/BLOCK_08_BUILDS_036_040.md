# Core operating chain — Builds 36–40

Published baseline `152cbe34`; prior five-build push `620c225f`.

- 36 `2856a6ca`: company/version-scoped preview validation and negative identity tests.
- 37 `ef306d64`: current policy and replacement checks in read-only preview. Initial isolated HTTP test failed on missing policy tables; correction `767e65b5` initializes through the existing authority and repeated HTTP passes. This repair is not an additional numbered build.
- 38 `6403a469`: selected version in preview requests; checked policy identity and bilingual non-approval explanation.
- 39 `e50bf36b`: discard stale preview success/error across context changes; clear preview on reload; changed drafts cannot inherit an old success.
- 40: cross-company administrator denial, exact version identity denial, preview preserves all version/audit rows, bilingual recovery messages and release candidate reconciliation.

Focused helper, HTTP and bilingual tests pass; frontend typecheck passes. Full exact-head gate, push, publication and live Chrome acceptance remain required. No source-defined schema migration, credentials, production mutation or Lens Next changes. Forty original planned source builds/eight blocks remain. Ten builds unpublished at this candidate point; do not accumulate another block.
