# Coordination routing — block 4 source report

Scope: Builds 16–20 after pushed source `d9605ea3`. Lens Next and installers remain frozen.

| Build | Bounded change |
| --- | --- |
| 16 | Verify an existing project Files object from durable storage by exact byte count and SHA-256 before any delivery candidate |
| 17 | Introduce bounded, fixed-origin, create-only Graph upload transport; no production invocation |
| 18 | Freeze current import, routing, mapping, source and exact drive-relative destination in a deterministic request digest |
| 19 | Compose a fail-closed, read-only publication candidate that verifies current destination and stored bytes |
| 20 | Bind the candidate to a project-scoped authenticated endpoint; retain disabled publishing, update inventories and release evidence |

The production route only previews. It does **not** enqueue a job or upload a file. The Graph write transport is intentionally disconnected until the transactionally durable job, worker lease/fencing, retry/error audit, user confirmation and authorized tenant/site round-trip exist and pass. The prior false `queued_sync` behavior remains closed. No database schema or customer data is mutated by this block.

The Build 10 Chrome-controlled Wizard JSON file selection remains unverified because the extension denied the file chooser operation. This is a tool limitation, not evidence of product success. The Build 20 publication must still bind the exact source to Replit runtime and pass authenticated visible-browser smoke; no real SharePoint delivery acceptance may be inferred from those checks.
