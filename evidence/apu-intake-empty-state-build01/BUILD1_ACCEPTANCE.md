# APU / Job Intake Empty-Prerequisite Build 1

Date: 2026-09-14

Base commit: `ce8b45b4ba6e8d71bcbf7c03ca204db8ded84e81`

Scope: test-only reproduction and contract matrix. No product behavior changed.

## Reproduced defect

An otherwise complete Job Intake with a positive editable billing rate remains blocked when the Cost & Value Planner capability is enabled but no saved APU version exists. The equivalent budget-capability state remains blocked when no approved budget snapshot and line mapping exist.

## Locked cases

- core Intake without commercial versions
- APU enabled without a saved version
- APU enabled with a saved version
- budget enabled without an approved snapshot
- budget enabled with an approved snapshot and exact line mapping
- combined commercial capabilities without either prerequisite
- combined commercial capabilities with both prerequisites

The fixture preserves the requested editable Drafting rate of `35.47` while proving the current missing-version dead end.

## Verification

- `pnpm run typecheck:libs`: PASS
- `pnpm run test:job-intake`: PASS
- `pnpm run test:generic-apu`: PASS
- `pnpm run check:mojibake`: PASS

Highest gate: Source/test gate. No UI behavior, publication, deployment, or field acceptance is claimed.
