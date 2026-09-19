# Build 061 — Coordination record identity

- One project-bound identity contract now covers issue/clash, RFI, submittal, transmittal, meeting, schedule, and change-order records.
- Duplicate state, unknown references, and cross-project links fail closed; duplicate links are idempotent.
- The existing linked-items route now verifies schedule placements in the same project before creating a link.
- Focused behavior and API TypeScript checks pass. Native, installers, schema, and customer data are unchanged.
