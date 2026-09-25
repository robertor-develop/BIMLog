# Coordination routing — block 3 source report

Scope: builds 11–15 after published source `04f2af1c`. Lens Next and installers are excluded.

| Build | Bounded change | Source commit |
| --- | --- | --- |
| 11 | Fail-closed publishing-readiness contract for current import/profile, active mapping/credential and exact verified destination | `6ca24366` |
| 12 | Tenant-scoped projection of the project Wizard import, profile and SharePoint mapping | `cdd44a61` |
| 13 | Protected, bounded fixed-origin Graph reads verifying site and document-library identity | `43b4c06b` |
| 14 | Bind project readiness to live provider identity, exposing verification errors without declaring ready | `e43c5752` |
| 15 | Authenticated read-only endpoint, bilingual visible status, route inventory and Living Brief reconciliation | containing commit |

This block does **not** publish files. No file custody, upload job, retry worker or user-confirmed external delivery is implemented here. The previous `queued_sync` route remains disabled and must not be re-enabled until those capabilities and real tenant/site acceptance pass.

Build 10 was published at exact production source `04f2af1cf8c446783e38a826b10649afa59d330b`; production health/schema and authenticated navigation passed. The Chrome extension denied selection of a synthetic Wizard JSON file, so import/save/refresh live acceptance is unverified. This tool limitation is not a platform test pass or product defect.

Focused evidence: readiness contract, tenant-scope adapter, protected Graph identity and API/UI TypeScript checks. The full clean-tree pre-push gate and exact GitHub push belong to this five-build boundary; publication is due after Build 20.

The first pre-push run found two new silent-catch audit identities in the site-URL parser and Graph response cleanup. The repair removed both silent catches; focused behavior and the blocking platform audit then passed with zero unexpected P1 identities. The complete pre-push gate must be repeated on the repaired clean source.
