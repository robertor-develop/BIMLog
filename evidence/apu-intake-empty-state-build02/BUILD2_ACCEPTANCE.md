# APU / Job Intake Optional Saved-Version Build 2

Date: 2026-09-14

Parent commit: `6861670620394a5f07eec2f57dea3ee100274fe9`

## Product correction

Cost & Value Planner entitlement no longer makes a saved APU version mandatory in Job Intake. Every Contract Item still requires a positive editable billing rate. If the user deliberately selects a saved APU version, its existing exact version and rate binding remain preserved by the unchanged selection, normalization, persistence, and activation paths.

The budget dependency is intentionally unchanged for Build 3.

## Verification

- zero saved APU versions plus editable `35.47` rate: ready
- selected saved APU version: ready and preserved
- zero approved budget snapshot: remains blocked by the unchanged budget contract
- fully configured commercial scenario: ready
- `pnpm run typecheck:libs`: PASS
- `pnpm run test:job-intake`: PASS
- `pnpm run test:generic-apu`: PASS
- `pnpm run check:mojibake`: PASS

Highest gate: Source/behavior-contract gate. No publication, deployment, or field acceptance is claimed.
