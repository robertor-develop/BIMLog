# Core block 12 — Builds 56–60

Baseline: fbaf7ea7f8d1e779211dd1b1cc51bf24c7578752, pushed Build 55. Production remains Build 50, deployment 7eade195, until a new release receipt verifies otherwise.

- 56 / d4b705cf: reject missing, nonnumeric and invalid runtime revisions before mutation.
- 57 / 4a52179d: phase QC/approval cannot approve the actor's own completed tasks.
- 58 / c4528f94: assigned runtime roles require current active project membership and company scope.
- 59 / 5746cc8d: clear stale runtime on refresh failure, distinguish saved mutation from failed refresh, explain independent reviewer restriction in English/Spanish.
- 60: final-approval denial regression with unchanged revision/audit; release reconciliation and acceptance tracking.

Disposable PostgreSQL runtime lifecycle passes, including evidence gates, independent QC/final approval, role revocation, frozen source versions, completion/reopening and immutable audit. Browser fixture runs actual components with synthetic responses: 28 English/Spanish desktop/mobile scenarios PASS at F:/BIMLog/TestProof/core-block12-build59-browser-20260926. These do not constitute production acceptance.

No Lens Next, native, installer, schema, credential or production grant changes. Suspected transition/QC inconsistency was already rejected by template validation and was left unchanged.

Exact-head full gate, push, Replit publication and authenticated Chrome smoke remain required at this authoring point. Ten unpublished builds; do not start another block before publication. Original estimate remaining: 20 builds/four blocks. Full policy hierarchy/threshold/runtime semantics, template-to-Operations acceptance and actual SharePoint tenant round trip remain open; this block does not claim those complete.
