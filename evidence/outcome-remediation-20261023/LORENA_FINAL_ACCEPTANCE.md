# Lorena final acceptance — Builds 61–65

Candidate baseline: `c8cd510ca56baa8e9d6c1401acc8841cb0d280fa`

This block closes the complete Lorena workflow. A source test proves only its bounded contract. Production acceptance additionally requires exact live identity, authenticated Chrome, controlled save/reopen evidence, responsive review, clean console/network results and independent Viva review.

| Criterion | Source and database evidence | Live evidence | Final state |
| --- | --- | --- | --- |
| Job Intake and Excel import | `test:outcome-remediation-block12`, `test:outcome-remediation-block11`, `test:ux-block05`, `test:ux-block06`, `test:ux-block07` | Controlled project 68 (`QA-LOR-FINAL-1023`): malformed input kept Add disabled; tab and semicolon ranges created rows; save/reload and second authenticated tab retained 15 matching row labels; console clean. | PASS |
| APU and Cost & Value | `test:lorena-p1-release-block02`, `test:ux-block23`, `test:ux-block24` | Controlled activated project 60 showed one immutable saved version and `12 Hours × 50 USD/Hours = 600 USD` after reload with its canonical contract. Quantity/manual/provenance denial remains covered by the named database gates. | PASS |
| Delivery workflow and governance | `test:lorena-p1-release-block03`, `test:recovery-ga-block03` | Project 60 rendered reviewed submittal strategy, milestones/distribution, work-package decomposition, truthful no-company-policy guidance and project budget governance after reload. | PASS |
| EDT/WBS | `test:edt-engine-block14`, `test:recovery-ga-block04` | Project 60 rendered canonical contract identity, EDT preview, `TEST C020 L1 Shop Drawing`, and `Deliver scope item`; duplicate/repair denial remains covered by the named database gates. | PASS |
| Activation and Operations | `test:lorena-p1-release-block04`, `test:full-ga-remediation-block05`, `test:ux-block25` | Project 60 remained active after hard reload with one work item, task, resource assignment and canonical budget account; Operations showed work package, task, APU history and internal-cost governance. | PASS |
| RFIs | `test:ga-final-block03-build021`, `test:post120-block31` | Project 68 created `RFI-0001: QA Final Closure RFI 20261023`; it persisted after cancel-to-list and hard reload; Chrome console clean. Role/tenant denial remains covered by the named database gates. | PASS |
| Submittals | `test:ga-final-block03-build022`, `test:post120-block36` | Project 68 live form resolved the persisted `RFI-0001` as its primary relationship and exposed controlled evidence/revision fields; create/reopen/isolation are covered by the named database gate. | PASS |
| Files, transmittals and reports | `test:ga-final-block02-build010`, `test:ga-final-block03-build023`, `test:ga-final-block04-build028` | Authenticated project routes exposed canonical task-linked file/transmittal entry points and working Print PDF / Export Excel controls; link, revision and safe-return behavior is covered by the named gates. | PASS |
| BIMLog Agent | `test:page-assistant-workspace-block02`, `test:corrective-b35` | Authenticated Operations and Intake rendered the dedicated connected BIMLog Agent; desktop, tablet and 390 px geometry stayed inside the viewport. | PASS |
| UX, responsive and accessibility | `test:ga-final-block05-build032`, full authenticated route matrix | Hard reload remained authenticated; desktop 1920, tablet 768×1024 and mobile 390×844 had `scrollWidth == clientWidth`; Agent stayed within viewport and Chrome reported no warnings/errors. | PASS |

## Release gates

- Exact-head complete gate must pass after all authoritative history is integrated.
- The release branch, `main` and `master` must contain the accepted commit through a normal non-force update.
- Provider publication must report the same source commit, bound asset package, healthy readiness and a rollback predecessor.
- The final closure block replaced every previous `PENDING LIVE` state with evidence-backed `PASS`.
- Viva independent acceptance is separate from constructor evidence.
