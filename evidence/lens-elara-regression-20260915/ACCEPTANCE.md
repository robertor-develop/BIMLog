# Lens Next ELARA regression candidate acceptance

- Candidate: `v1.05.N17-P28`
- Base: `3731631e8020356ae8ba4d31a3a9f81e8d431b6c`
- Live observed before repair: `v1.05.N17-P27`, Replit HEAD `292983a4aa35eae834894797f188b1ab068ebe1c`
- P27 Lens source delta: none
- XML collection failure: one historical unverified package rejected the entire all-or-nothing load
- Active-action failure: superseded or void revisions were rendered beside active records and could reach active-only endpoints
- Repair: settled per-record load, exact skip reporting, active-only operational projection, preserved View History, compact independent panes, action-first detail
- Integrity preserved: digest, project, model, lifecycle, and immutable identity validation
- Explicit exclusions: Native, camera, quaternion, sectioning, database/schema, migrations, customer-data mutation, Job Intake/APU
- Release gates remaining: push, Replit publication, live ELARA verification, external acceptance
