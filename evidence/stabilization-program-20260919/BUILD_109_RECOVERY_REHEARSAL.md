# Build 109 — Isolated restore and application rollback rehearsal

Status: PASS_AFTER_CORRECTION

- The first isolated restore exposed six source/deployed Workflow Governance constraint-name mismatches. Source declarations were corrected to the already deployed `_chk` identities; no database rename or production mutation was performed.
- Retry restored `bimlog_rfi_test` to disposable `bimlog_rfi_restore_test` in the F-rooted loopback PostgreSQL cluster.
- Exact schema and record counts matched. Backup SHA-256: `79177013e583e96a875441db329bc4b67467d14babe91f783e92bb93d9e7cad1`; bytes: `1521332`; count-manifest SHA-256: `332dcbc6e566dd23cfbf067be1cb78d42743ab1ea72d9ba727e01d3a9b42a8da`.
- The exact packaged application reached health/readiness and completed credential login against the restored database. Application ready: `4964 ms`; wall ready: `6247.1 ms`.
- Deployment-module recovery and fail-closed non-idempotent-write behavior passed.
- The disposable restored database was removed after proof; production was untouched.

Evidence custody: `F:\BIMLog\TestProof\block22-build109-restore-20260920-retry` and `F:\BIMLog\TestProof\block22-build109-restored-artifact-20260920-retry`.
