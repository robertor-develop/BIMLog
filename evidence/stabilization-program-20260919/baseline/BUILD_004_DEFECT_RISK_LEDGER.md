# Build 004 — Machine-readable defect and risk ledger

Date: 2026-09-19  
Result: `PASS`  
Mutation boundary: coordination evidence only; no BIMLog source, database, provider, production, or Native installation changed.

## Deliverable

The authoritative machine-readable ledger is
[`DEFECT_RISK_LEDGER.json`](./DEFECT_RISK_LEDGER.json). Every confirmed S1-S3
finding and every material release-control gap discovered in Builds 001-003 has
a stable ID, severity, state, owner, dependencies, evidence, assigned builds,
and measurable acceptance condition.

## Reconciliation result

| Classification | Count |
|---|---:|
| S1 | 4 |
| S2 | 17 |
| S3 | 6 |
| Total | 27 |
| Explicit read-only audit limitations | 1 |
| Findings without assigned builds | 0 |
| Findings without evidence | 0 |
| Findings without acceptance criteria | 0 |

The one accepted limitation, `R027`, records that the initial audit did not
exercise customer-impacting writes. It is not a waiver: it is mapped to
controlled functional and final-acceptance builds through Build 120.

## Added release-control findings

Build 004 also records Git branch divergence, the empty Replit publication
marker and missing synchronization operator, incomplete schema/restore
identity, stale force-push guidance, broad post-merge database synchronization,
the stale lineage checker, the missing unified release receipt, and
nondeterministic disposable workflow fixtures.

## Validation contract

The ledger must parse as JSON and retain unique IDs, allowed severities,
non-empty owners/evidence/build mappings/acceptance conditions, build numbers
within `1-120`, all original mappings `R001-R018`, and declared/computed count
agreement.

`ALL_S1_S3_MAPPED=YES`

## Program position

- Completed builds: `4 of 120`
- Remaining builds: `116`
- Current unpublished builds: `4 of maximum 10`
- Next build: Build 005 — program branch, build ledger, report templates, and exact local/remote identity checks
- Next push: after Build 005
- Next publication and full authenticated Chrome smoke: after Build 010
- Blocker: none

