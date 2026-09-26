# I001 — current BIMTECH identity reconciliation, 2026-09-26

Baseline: 7ca6a8a8 (two unpublished consolidation commits above 25d6952e).
Authority verifier PASS at 13:05:57 UTC. Replit Shell, explicit PROD_DATABASE_URL, READ ONLY transactions; no credentials printed or production writes performed.

## Observed production facts

- Canonical company31: BIMTECH CORP. Rubén user20, Leidy user21 and Lorena user25 belong to31. Both20 and25 have company-master-catalog administrator grants for31.
- Company35 is named as a historical alias of31 and has zero users. The September25 user move is still effective.
- Company38 is Bimtech with user27. Identity is unresolved; it is NOT included in the authorized31/35 correction merely by similar spelling.
- Rubén's nine active membership project IDs:28,29,30,34,40,51,52,54,55. All project_admin except40 drafter. Project24 is creator-owned by20 without an explicit member row. Do not infer owner membership or change role without the current project-authority contract.
- Lorena's active memberships:28(project_admin),30(read_only),36,37,38,39,40,47,48,52,54(project_admin).
- Scanning96 integer company_id/canonical_company_id columns found35 only in company_master_catalog_policies(1) and project_company_binding_versions(9);38 only in users(1). This scan does not claim arbitrary JSON references absent.
- Critically, the latest bindings for projects36,37,38,39,40,47,48,52,54 are still company35 version1. They are NOT superseded historical versions. Master catalog and EDT scope resolution read these current bindings, so account relocation alone left conflicting authority.
- Two accepted invitations for31; no pending invitation among31,35,38 in this read.

## Correction contract

Keep company31, all project IDs, creator IDs, membership roles and historical snapshots. Add version2 bindings to31 for the exact nine stale bindings after locked expected-version checks and recovery proof; retain version1. Retire35 operationally through explicit alias metadata, not a display-name convention. Do not delete either company or silently grant membership. Company38 requires identity evidence before any merge.

## Remaining proof

Inventory JSON snapshot identities and current financial scope before correction; verify exact data target and backup at application time. Test append-only correction, stale-version refusal, replay and rollback locally. Live UI under the actual roles remains separate from SQL observations. I001 is diagnostic evidence, not a five-build completion, push, publication or customer acceptance.
