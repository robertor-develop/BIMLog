# Corrective Build 6 — Task-level resource assignment

- Baseline: `v1.05.N17-P15`, commit `61d57db15b3ed15ce6ac13cc2f9420b7448ab745`.
- Smoke finding: resource planning did not make task-level assignment visible or independently exercisable.
- Correction: the existing Work Package-to-operational-task architecture is now explicit in Intake; changing a Contract Item clears any stale package task selection.
- Authority: the existing activation service remains the single task and resource-assignment authority.
- Database/schema: unchanged.
- Native/Lens: unchanged.
