# EDT Engine Block 11 — Builds 326–330

This push-only block strengthens the read-only activated Intake plan. It does not open guarded EDT mutation routes or change the database schema, Native plugin, installer, or production data.

- 326 `ee071e13`: require the project row to match the Intake company and project.
- 327 `c6e1a989`: reject a canonical Contract version reused by separate activated Contracts.
- 328 `2e9ceed4`: reject sibling EDT codes that differ only in case.
- 329 `9550fc3d`: reject nonempty Work Item snapshots that contradict location, deliverable, or permanent trade identity.
- 330 `ba18cdbe`: bind the plan fingerprint to the complete saved Intake data and activation summary, not only the derived nodes.

Focused Block 11 regression and API TypeScript typecheck passed. The complete pre-push gate and exact remote verification are separate block-end checks. Block 10 pricing hotfix was published and live-retested at `5e20eec65374006ae10b709538d0fabf6baa2492`. Block 11 is not a positive end-to-end EDT activation acceptance: server-derived pre-activation versions/plan, economic/time authority, Intake/Operations UI and four guarded mutations remain unfinished. Publication and full authenticated Chrome smoke are due after Build 335.
