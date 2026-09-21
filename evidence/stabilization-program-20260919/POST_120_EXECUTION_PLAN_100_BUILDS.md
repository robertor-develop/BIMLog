# BIMLog post-Build-120 execution plan — Builds 121–220

## Cadence

- Execute one block of five builds at a time.
- Push after each five-build block.
- Publish after every two blocks / ten builds.
- Run full authenticated visible-Chrome smoke after each publication.
- Run focused Navisworks smoke whenever a block changes Lens Next Native, packaging, or installers.
- Never accumulate more than ten unpublished builds.
- Stop only for a real failing test or production defect; correct it, repeat the failed gate, and continue only after it passes.
- Never use Replit Agents. Replit-hosted publication uses Replit Shell plus visible Chrome; `.ignitesmart.ai` Cloudflare products use their established Cloudflare release procedure.

## Block 25 — Builds 121–125 — audit finding normalization

- 121: freeze the exact 66-P1 finding inventory with owner/module/evidence identity.
- 122: deduplicate findings that point to the same executable defect.
- 123: add fail-closed checks preventing P0 growth and unclassified P1 additions.
- 124: replace the remaining `@ts-ignore` with a typed Living Brief boundary.
- 125: run full regression and push the normalized audit baseline.

## Block 26 — Builds 126–130 — silent-failure removal A

Status: complete, pushed, published, and authenticated live-smoke accepted at `v1.05.N18-P36`.

- 126: classify silent catches in authentication/session paths.
- 127: make actionable authentication failures observable without exposing secrets.
- 128: classify silent catches in project/model binding paths.
- 129: add deterministic denial/error/retry tests for those paths.
- 130: publish and run authenticated Chrome login, reload, project-switch, and two-tab smoke.

## Block 27 — Builds 131–135 — silent-failure removal B

Status: source accepted for the Build 135 push boundary; publication remains scheduled after Build 140.

- 131: classify silent catches in workflow and document operations.
- 132: add bounded user feedback and telemetry for workflow failures.
- 133: classify export/report silent catches.
- 134: add negative-path tests for export/report failures.
- 135: run full gate and push.

## Block 28 — Builds 136–140 — shared PDF architecture

Status: complete, pushed, published, and authenticated live-smoke accepted at `v1.05.N18-P36` from `1bb9ec7ee353d14a90cc0f2e925f9e3424599cd2`.

- 136: inventory every bespoke PDF renderer and output contract.
- 137: define one shared safe rendering adapter and migration compatibility tests.
- 138: migrate the first report family without visual/output regression.
- 139: migrate the second report family and preserve localization.
- 140: publish; compare representative PDFs and run full Chrome smoke.

## Block 29 — Builds 141–145 — meetings frontend decomposition

Status: complete, full-gate accepted, and pushed. Publication remains scheduled after Build 150.

- 141: extract meeting data/query orchestration from `MeetingsTab.tsx`.
- 142: extract agenda/minutes state machines.
- 143: extract participants/actions presentation modules.
- 144: add integration and accessibility tests across extracted boundaries.
- 145: run full gate and push.

## Block 30 — Builds 146–150 — convention builder decomposition

Status: Builds 146–149 implemented and verified; Build 150 is the full-gate, push, publication, and authenticated visible-Chrome acceptance boundary.

- 146: extract convention document state and validation.
- 147: extract phase navigation and hook-order invariants.
- 148: extract financial/party clause modules.
- 149: add saved-state, reload, denial, and error regressions.
- 150: publish and run the complete authenticated Convention workflow in Chrome.

## Block 31 — Builds 151–155 — RFI frontend decomposition

Status: Builds 151–154 implemented and verified; Build 155 is the full-gate and normal-push boundary.

- 151: separate RFI list/filter/query state.
- 152: separate RFI editor/attachment state.
- 153: separate permissions/status-transition presentation.
- 154: add cross-role and deep-link tests.
- 155: run full gate and push.

## Block 32 — Builds 156–160 — RFI backend decomposition

Status: source accepted; Build 160 push, publication, and authenticated visible-Chrome acceptance are active.

- 156: separate RFI command and query services.
- 157: centralize authorization predicates and audit records.
- 158: reconcile export/history scope with filtered UI truth.
- 159: add tenant/project/object negative matrix.
- 160: publish and run authenticated RFI creation, edit, transition, export, and reload smoke.

## Block 33 — Builds 161–165 — clash report architecture

- 161: split clash report parsing, identity, and presentation contracts.
- 162: centralize clash-to-issue provenance validation.
- 163: isolate image/reference/Visual Package truth.
- 164: add large-report, malformed-input, and authorization tests.
- 165: run full gate and push; run focused Lens Next package smoke if shared contracts changed.

Status: source accepted; Build 165 push is active. Native and installers did not change, so focused Navisworks smoke is not retriggered. Build 170 remains the next publication boundary.

## Block 34 — Builds 166–170 — meeting-minutes backend

- 166: split minutes commands, queries, and rendering.
- 167: centralize participant/action identity resolution.
- 168: align PDF, Excel, activity history, and live filter scope.
- 169: add idempotency and concurrent-edit tests.
- 170: publish and run authenticated meeting/minutes lifecycle smoke.

## Block 35 — Builds 171–175 — job intake workspace

- 171: extract intake schema and form-state boundaries.
- 172: extract uploads and document-assistance boundaries.
- 173: enforce cost/credit visibility before expensive AI operations.
- 174: add partial-save, resume, denial, and upload-failure tests.
- 175: run full gate and push.

## Block 36 — Builds 176–180 — submittals decomposition

- 176: separate submittal list/query state.
- 177: separate editor/review/status state.
- 178: align report/export/history scope.
- 179: add cross-role, stale-update, and attachment failure tests.
- 180: publish and run authenticated submittal lifecycle smoke.

## Block 37 — Builds 181–185 — route and interconnection graph

- 181: generate route-to-screen-to-API-to-table ownership graph.
- 182: identify dead, duplicate, and unreachable routes.
- 183: remove or redirect proven dead routes with compatibility evidence.
- 184: add deep-link and navigation completeness tests for all roles.
- 185: run full gate and push.

## Block 38 — Builds 186–190 — open-loop truth reconciliation

- 186: classify every active loop as product work, field evidence, provider evidence, or stale contradiction.
- 187: close stale contradictions with exact commit/test evidence.
- 188: bind genuine product work to owning routes/modules.
- 189: add current-authority precedence and duplicate-loop checks.
- 190: publish and verify no historical marker overrides current release truth.

## Block 39 — Builds 191–195 — Lens Next post-closure field evidence

- 191: ingest Ruben's physical Navisworks 2025 result when available without reopening Build 119.
- 192: reconcile 2021/2025 installation manifests and active-bundle inventories.
- 193: verify Pulse preservation and Original Lens absence in both supported years.
- 194: execute affected-model Lens Next workflow and rollback checks where environments exist.
- 195: push; run focused Navisworks smoke and package a field-evidence update. No platform publication unless platform code changed.

## Block 40 — Builds 196–200 — accessibility and responsive matrix

- 196: inventory every customer-facing route at desktop/tablet/exact-390.
- 197: close keyboard/focus/dialog defects.
- 198: close contrast/theme/reduced-motion defects.
- 199: close overflow/touch-target/layout-stability defects.
- 200: publish and run authenticated route-by-route visible-Chrome acceptance.

## Block 41 — Builds 201–205 — performance and code splitting

- 201: record route-level bundle and runtime baselines.
- 202: split high-cost initial-route dependencies.
- 203: lazy-load report/editor modules without stale-state defects.
- 204: enforce chunk/total-size and interaction budgets.
- 205: run full gate and push.

## Block 42 — Builds 206–210 — authorization/security matrix

- 206: generate endpoint-to-role/tenant/project/object matrix.
- 207: close missing server-side denial coverage.
- 208: add cross-tenant/project/object negative tests.
- 209: verify upload, export, AI, and Lens Next sensitive operations.
- 210: publish and run authenticated multi-role Chrome smoke without exposing credentials.

## Block 43 — Builds 211–215 — recovery and resilience

- 211: verify provider backup/restore evidence and stop conditions.
- 212: rehearse release rollback against an isolated disposable target.
- 213: test session continuity through deploy/reload/multi-tab/out-of-order responses.
- 214: test provider interruption, retry, and fail-closed behavior.
- 215: run full gate and push.

## Block 44 — Builds 216–220 — final convergence and freeze

- 216: rerun repository-wide file/line/finding census.
- 217: reconcile all remaining P0/P1/open-loop items with evidence.
- 218: run complete source, database, security, accessibility, performance, Native, and package gates.
- 219: publish exact candidate and run full authenticated visible-Chrome plus focused Navisworks acceptance.
- 220: reconcile local/remote/provider/live identities, record rollback and handoff, and freeze the accepted program state.
