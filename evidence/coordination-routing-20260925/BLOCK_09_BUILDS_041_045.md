# Core block 09 — Builds 41–45

Baseline: 29c80f8da35c513d13356e7227db404221bf25c3, published deployment 4fcd87ed.
Scope: existing Company Delivery Workflow editor; Lens Next, schema, roles, approval/economic authority and production records unchanged.

41: contextual English/Spanish validation messages, recognized phase/task path only; arbitrary error-field content is not echoed.
42: accessible in-page switch confirmation; Cancel/Escape retain draft; explicit discard switches; selector blocked during outstanding action/load.
43: in-page APU phase replacement confirmation, cancel preservation and explicit draft-only replacement; existing matching-task behavior preserved.
44: visible borders, spacing, focus controls and translated role labels, scoped to this editor.
45: validation/action message dismissal preserves edits; load failures have separate retry; negative browser regression and block reconciliation.

Focused guidance tests and frontend typecheck passed. Installed-Chrome local browser fixture imports the real route/component and intercepts API responses with synthetic records; 20 scenarios cover 1280/390px, English/Spanish, PMO/read-only/no-APU/empty/denied. Tests exercise Cancel, Escape, discard, APU cancel/apply, validation failure, disabled save, save/reload, and browser exceptions/overflow. The fixture's obsolete auth schema and absent access-profile response were corrected without changing production authentication. Source fixture: artifacts/bimlog/scripts/company-workflow-economic-browser-evidence.mjs. External screenshots/results: F:/BIMLog/TestProof/core-block09-browser-final-20260926.

Full exact-head gate/push evidence will be recorded externally after commit. Publication is due at Build 50, not this five-build boundary. Five unpublished builds; 35 original planned builds/seven blocks remain after this block. No full-site acceptance claim: independent live approval/activation/EDT/hours/QC and real SharePoint tenant delivery remain unverified. No Replit/internal agents or native changes.
