# Workflow runtime repairs R11–R15

Baseline: published source 800493e73cc46deaa9a1d9d3b761af9f30891208, Replit f04f3322. No Lens Next/Native/installer/schema/credential/grant changes.

1. R11 fdf251da: isolated PostgreSQL reproduced completed-work reassignment (missing expected rejection); require controlled reopening and preserve roles/audit/revision on denial.
2. R12 455ec8b9: reproduced approval remaining after newly linked evidence; clear current checks atomically and record invalidation without deleting history.
3. R13 05f3ea07: read runtime through one read-only repeatable-read transaction. Eight concurrent task transitions and 24 reads retain revision/history consistency.
4. R14 1ebfcc50: keyed account/project/Work Item component state, closed-work controls, bilingual status/role labels and renewed-review guidance. Delayed old response cannot replace a new Work Item.
5. R15: prove duplicate evidence does not clear approval or change audit/revision; authorized reopened assignment succeeds; reconcile source/publication/remaining-scope truth.

Disposable runtime lifecycle and negative tests PASS. Frontend/API typechecks PASS before final metadata. Twenty-eight installed-Chrome local scenarios use real production components and synthetic responses, desktop/390px English/Spanish; screenshots/results at F:/BIMLog/TestProof/runtime-repair-R14-browser-final-20260926. These are not full-site authenticated acceptance.

Exact-head complete gate/push required after this report is committed. Five unpublished repairs count toward the ten-build cap. Next original Builds 61–65 will make ten changes and require publication, not wait for original Build 70. Original Resource/Earnings estimate remains 20 builds/four blocks; these corrections do not secretly replace it. Remaining policy/runtime semantics, full multi-role operating chain and real SharePoint tenant delivery remain open. No complete-platform or external-testing readiness claim.
