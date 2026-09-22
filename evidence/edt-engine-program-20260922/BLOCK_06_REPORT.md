# EDT and Engine Templates — Block 6 remediation

Builds: 301–305  
Date: 2026-09-22  
State: FOCUSED_PASS; full release, push, publication and Chrome gates pending

The Block 5 route review exposed authority gaps that made its originally planned UI connection unsafe. This block corrected those gaps before any new EDT UI was connected:

- 301: resolve project-company scope from the canonical project binding before granting a role.
- 302: derive QC conflict users from stored assignments and tasks; reject client-supplied conflict lists.
- 303: require the retained Intake document and exact source hash for a Result preview; client preview rows cannot mark a batch validated.
- 304: fail closed both governed EDT activation HTTP routes until the saved Intake, version and EDT plan can be resolved on the server.
- 305: fail closed Economic Plan and time-ledger HTTP mutations until their amounts and pools can be derived from canonical records.

The underlying service functions and additive schema remain available for the next integration block. Existing Job Intake activation and Operations remain the operational route. This block does **not** claim the planned full UI/runtime integration, nor completion of the approved EDT program.

`pnpm run test:edt-engine-block06` passes. No Native C#, installer, plugin package or Autodesk load path changed; focused Navisworks smoke is not applicable. Before publication: full gate, exact push, Replit Shell schema preview, controlled publish, exact live identity and authenticated Chrome acceptance are required.

The first full pre-push run caught a stale tracked route-interconnection graph from the new EDT routes. Regeneration restored the exact 658-route graph and `test:post120-block37` passed. That check is now part of the EDT block suite, closing the repeated late-detection pattern at the focused-test level.
