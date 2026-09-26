# SharePoint repair block R1–R5

Baseline: 560e463cf997f444c42560b7679d8baf10c6cb28 (published deployment afe01b7d).
These five repairs do not replace Builds 31–80 of the agreed roadmap.

| Repair | Correction | Focused verification |
|---|---|---|
| R1 | Shared bounded tags and numeric file ID validation for preview/publication | Valid, malformed, over-bound and reserved-key inputs |
| R2 | Ignore stale responses on scope change, prevent duplicate clicks, lock selection during request | Request-lifetime invalidation and frontend typecheck |
| R3 | Canonical ISO timestamps and stored retry due time without provider payload | Scoped status serialization, Date and string inputs, secret exclusion |
| R4 | Select exact saved routing values; clear incompatible blueprint values | Production option helper tests; no automatic selection |
| R5 | Ignore late import/file/read/save results after scope change; prevent repeated saves | Delayed lifetime test and structural component binding checks |

Run: `node scripts/test-folder-wizard-publish-block06.mjs` (PASS).
Frontend typecheck (PASS). Full gate and push recorded separately after execution.
The first combined compilation caught frontend helper tests placed under the API TypeScript
root. Tests were moved into the frontend source-test directory and the runner was corrected;
no production behavior or compiler boundary was weakened. Repair corrections are not new builds.
Helper and structural tests are not UI/browser acceptance. No tenant writes, credential changes,
schema changes, Lens Next code, native binaries or installers are included.

Live acceptance remains open: authorized JSON import/save/refresh/reopen; real tenant/site
confirmed file publication and remote verification; conflict, retry, permissions and isolation.
Prior Chrome file-chooser denial is a tool limitation, not a product PASS or invented approval.
Five builds are unpublished after this block. Publication is due at the next ten-build boundary.
