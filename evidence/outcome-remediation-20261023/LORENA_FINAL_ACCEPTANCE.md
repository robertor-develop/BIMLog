# Lorena final acceptance — Builds 61–65

Candidate baseline: `633a2317225f4652572b5eb5cc065fb6115c6c3c`

This block closes the complete Lorena workflow. A source test proves only its bounded contract. Production acceptance additionally requires exact live identity, authenticated Chrome, controlled save/reopen evidence, responsive review, clean console/network results and independent Viva review.

| Criterion | Source and database evidence | Required live evidence | State before Build 64 |
| --- | --- | --- | --- |
| Job Intake and Excel import | `test:outcome-remediation-block12`, `test:outcome-remediation-block11`, `test:ux-block05`, `test:ux-block06`, `test:ux-block07` | Controlled import, validation, save, reopen, reload and two-tab continuity | PENDING LIVE |
| APU and Cost & Value | `test:lorena-p1-release-block02`, `test:ux-block23`, `test:ux-block24` | Select/reopen/version, derived and manual rates, quantity change, provenance and incompatible-default denial | PENDING LIVE |
| Delivery workflow and governance | `test:lorena-p1-release-block03`, `test:recovery-ga-block03` | Published version, edits, clear/reselect, PRE/COO/FOR/ASB guidance and truthful approval boundaries | PENDING LIVE |
| EDT/WBS | `test:edt-engine-block14`, `test:recovery-ga-block04` | Canonical contract, generated phases/tasks, totals, repair link, save/reopen and duplicate denial | PENDING LIVE |
| Activation and Operations | `test:lorena-p1-release-block04`, `test:full-ga-remediation-block05`, `test:ux-block25` | Activation receipt, idempotency, resources, packages, hours, rates, task lifecycle and persistence | PENDING LIVE |
| RFIs | `test:ga-final-block03-build021`, `test:post120-block31` | Controlled draft/reopen/link/return plus role and tenant denial | PENDING LIVE |
| Submittals | `test:ga-final-block03-build022`, `test:post120-block36` | Controlled create/reopen/revision/evidence/return plus isolation | PENDING LIVE |
| Files, transmittals and reports | `test:ga-final-block02-build010`, `test:ga-final-block03-build023`, `test:ga-final-block04-build028` | Task-linked file selection, canonical revision, safe return/cancel, PDF/CSV and link integrity | PENDING LIVE |
| BIMLog Agent | `test:page-assistant-workspace-block02`, `test:corrective-b35` | Dedicated correlated Agent remains docked/resizable and shifts the page workspace | PENDING LIVE |
| UX, responsive and accessibility | `test:ga-final-block05-build032`, full authenticated route matrix | Desktop, tablet and exact 390 px without clipping/overflow; keyboard/focus and state messaging | PENDING LIVE |

## Release gates

- Exact-head complete gate must pass after all authoritative history is integrated.
- The release branch, `main` and `master` must contain the accepted commit through a normal non-force update.
- Provider publication must report the same source commit, bound asset package, healthy readiness and a rollback predecessor.
- Builds 64–65 must replace every `PENDING LIVE` state with `PASS`, `FAIL`, or an exact external `BLOCKED` item. Any `FAIL` remains active repair work.
- Viva independent acceptance is separate from constructor evidence.
