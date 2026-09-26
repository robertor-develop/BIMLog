# SharePoint repair block R6–R10

Pushed baseline: `66c140197dac2c4e619d4c073618f376039570c7`.
Last published baseline: `560e463cf997f444c42560b7679d8baf10c6cb28`, deployment `afe01b7d`.

| Repair | Corrected behavior | Focused proof |
|---|---|---|
| R6 | A failed status refresh no longer misreports an acknowledged import/publication as failed | Confirmed-refresh helper success/failure/no-write-retry |
| R7 | Routing editor ignores obsolete responses, prevents duplicate requests and catches reload failures | Request lifetime behavior, structural binding and frontend typecheck |
| R8 | Saved routing triggers readiness refresh and invalidates the old publication preview | Parent/editor callback and version-key binding |
| R9 | Readiness and history reads fail independently; explicit refresh recovers errors | Independent network, HTTP and malformed JSON cases |
| R10 | Repeated confirmation returns scoped persisted completed/retry/cancelled/dead-letter state | Exact company/project/job query and all stored states |

Focused publication runner passes. Structural checks and synthetic ports are not browser or
real SharePoint delivery acceptance. Complete exact-head gate and release receipts are recorded
externally after execution. No schema, credentials, customer data, native or installer changes.
Lens Next is frozen. No additional planned roadmap build is consumed by these repair IDs.
Ten repairs are now unpublished; publish before another block. Original remainder: 50 / ten blocks.
