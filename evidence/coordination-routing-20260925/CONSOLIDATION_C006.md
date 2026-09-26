# C006 — frozen-policy runtime role authority

Baseline: 5acb1728caeb46087dbaad29c024a94509505d18.

Scope: existing platform runtime only. No native Lens, installer, schema, customer-data or provider changes.

Implementation uses the canonical EDT project-role mapping and existing active company grants. QC_REVIEWER requires the already-assigned Work Item review slot. Configured unknown roles do not create authority. Required frozen workflow role and policy permission must both match. All callers of the runtime service share enforcement; there is no client-origin bypass parameter.

Local evidence:
- `artifacts/api-server/scripts/test-workflow-governance-roles.ts`: real PostgreSQL temporary relations; allowed roles, wrong company, inactive membership, unsupported role, scoped QC assignment, revocation and changed project binding PASS.
- Existing `delivery-workflow-runtime.http-evidence.ts` in disposable delivery_runtime_test: full checkpoints/evidence/QC/approval/completion/reopen/snapshot/audit/concurrent-read cycle PASS. Fixture explicitly supplies required policy permissions and actual project-management authority; tests reject an assigned but unauthorized approver before testing independent-review denial with an eligible actor.

Pending: complete block, exact-head release gate, push, C010 publication and authenticated Chrome. This does not claim hierarchy or threshold enforcement (C007/C008).
