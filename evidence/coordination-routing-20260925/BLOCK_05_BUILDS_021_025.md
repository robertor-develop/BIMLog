# Coordination routing — block 5 source report

Scope: Builds 21–25 after published source `d71ea037`. This is a five-build **push-only** boundary. Lens Next, Native, installers, production schema, and customer data are untouched.

| Build | Bounded change | Commit |
| --- | --- | --- |
| 21 | Freeze a scoped, deterministic, byte-free publishing job identity | `9bb6e2f2` |
| 22 | Transactionally enqueue only against current company, project, credential, Wizard import, routing profile, mapped destination, and durable Files identity; append the first job event | `36c5ec43` |
| 23 | Claim only Wizard publish jobs with a finite lease, `SKIP LOCKED`, attempt bound, fencing increment and immutable claim event | `c9eb7a36` |
| 24 | Settle by exact lease/fence into completed, retry or dead-letter with bounded backoff and audit evidence | `5257b7e1` |
| 25 | Revalidate source and route at execution, compare the frozen digest, isolate the Graph create-only call, add focused aggregate and reconcile current truth | containing commit |

The queue, lease, settlement and worker classes are **not** mounted on a production route or scheduled. The existing visible SharePoint publish action remains disabled. This block does not claim a file was delivered. Before enabling it, the next block must prove real PostgreSQL transaction behavior, provider conflict reconciliation, explicit user confirmation, permission-safe status/retry UI, and an authorized tenant/site round-trip. The prior Chrome extension file-selection block remains unresolved; import/save/refresh/reopen must be retested, not inferred.

Focused tests run entirely with synthetic in-memory ports and a fake upload adapter; they do not access a real SharePoint tenant. The complete pre-push gate and GitHub push are separate release evidence.
