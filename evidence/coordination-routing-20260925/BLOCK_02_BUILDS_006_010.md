# Coordination routing — block 2 source report

Scope: builds 6–10 after pushed base `b3d5a065`. Lens Next is excluded.

| Build | Bounded change | Source commit |
| --- | --- | --- |
| 6 | Immutable company-default and project-override routing profile storage, with additive startup DDL | `872df14a` |
| 7 | Exact tag/blueprint/tier validation and deterministic Wizard path resolver | `d8cf74ee` |
| 8 | Project/company authority, versioned profile API and stale-import detection | `e7fcf369` |
| 9 | Bilingual mapping editor and server-calculated path preview | `c5c59c32` |
| 10 | Refuse the legacy false `queued_sync` action before event creation or cache deletion; disable misleading UI | candidate commit containing this report |

This block is a configuration and safety milestone, **not** a SharePoint file-publishing release. Real Graph site authorization, durable bytes, upload jobs, retry/audit and end-to-end SharePoint delivery are not implemented by these ten builds. A live smoke may verify import, mapping, preview and the honest unavailable state; it cannot be used to claim file-delivery acceptance.

Focused checks: Wizard export, path parity, import service, connector schema, mapping contract, resolver, routing authority/version behavior, Coordination sync fail-closed, TypeScript, route graph and mojibake. Full pre-push and live Replit/Chrome results must be recorded separately and must bind the exact pushed/deployed commit.

Pre-push regression found five new project routes omitted an explicit `requireProjectMember()` middleware even though their services enforced membership. Build 10 adds that guard to import and routing endpoints, preserving the service-level company/project write checks. The regenerated endpoint authority matrix now passes with 667 endpoints and no missing project authority.
