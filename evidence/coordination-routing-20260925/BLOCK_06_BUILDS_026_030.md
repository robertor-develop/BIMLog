# Coordination routing — block 6 source report

Scope: Builds 26–30. Lens Next, Native, installers and production data are untouched. This is the ten-build publication boundary; source implementation is not deployment or real SharePoint acceptance.

| Build | Bounded change | Commit |
| --- | --- | --- |
| 26 | Prove publish queue, idempotency, lease, retry and settlement on isolated real PostgreSQL | `1ab71140` |
| 27 | Reconcile uncertain provider conflicts only against the exact existing file | `a1f098ae` |
| 28 | Require project-admin confirmation bound to the exact preview digest and current authority | `9ee68b2d` |
| 29 | Expose scoped, secret-free publication job status | `436e3ee9` |
| 30 | Mount request-bound exact-job execution and bilingual publish UI; use Graph create-only upload session and test invalid destination rejection | `f33f322d` |

The isolated PostgreSQL test rolls back its fixture; synthetic Graph tests assert no bearer token reaches a preauthenticated upload/download URL, no unsafe redirect is followed, and existing content is accepted only if exact bytes match. The exact-job executor does not drain other projects' queues. There is no background retry scheduler; an administrator must refresh the preview and confirm again after the retry delay.

Remaining release gates: full local pre-push gate, GitHub push, exact Replit Shell alignment and publication, deployed identity/health, authenticated Chrome import/save/reopen/publish/status smoke, and an authorized real SharePoint tenant/site round-trip. No delivery or full smoke PASS is claimed before those gates.
