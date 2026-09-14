# APU / Job Intake Optional Budget Link Build 3

Date: 2026-09-14

Parent commit: `a1d0858e07f3ff45cc79259e67082bab43e6698f`

## Product correction

Budget entitlement no longer makes an approved budget snapshot mandatory merely because the capability is available. With no snapshot or budget-line fields selected, Job Intake can complete through the core activation path.

Once any budget association is started, the existing strict contract remains active: an exact approved snapshot, line, cost node, project, and currency association are required. Partial, cross-project, and contradictory bindings remain rejected. Formal commercial activation occurs only when that authoritative budget link is complete.

## Verification

- budget entitled with no link selected: ready for core activation
- orphan line without snapshot: rejected
- selected snapshot without exact item mappings: rejected
- exact snapshot, line, and node mapping: ready
- zero saved APU version with positive manual rate: ready
- selected APU version and fully configured commercial scenarios: ready
- focused Job Intake suite: PASS
- complete Generic APU regression: PASS
- API/frontend typechecks: PASS
- mojibake: PASS

Highest gate: Source/behavior-contract gate. No publication, deployment, or field acceptance is claimed.
