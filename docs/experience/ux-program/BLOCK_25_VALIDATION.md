# Experience makeover Block 25 validation

UX121–UX125 replace the remaining Intake staffing ambiguity with one canonical resource-demand model. Generic role rows contain scope, optional floor/location, quantity, hours and planned cost, but no user identity. Activation retains those rows in the immutable Intake baseline and creates an Operations assignment only for a real named person; it never writes an `Unassigned resource` person record.

Seven floors over nineteen months can pass core readiness with seven generic demands and zero named assignments. Operations exposes the approved demands separately so a manager can staff only the matching floor or task that is ready. Reconciliation reports baseline, assigned, actual and remaining hours without changing the approved demand when a person is assigned or reassigned.

Focused acceptance runs the production contract, activation preview, Operations projection and production scheduling component with API and frontend TypeScript checks. Publication is intentionally deferred: UX121–UX125 are the first five unpublished builds in the UX121–UX130 ten-build publication set.
