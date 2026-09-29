# Block 06 — UX026–UX030

Five sequential features connect existing commercial records to Intake. No new financial authority, snapshot rewriting, schema, pay policy or automatic approval is introduced.

| Build | Result |
|---|---|
| UX026 | Explicit compatible APU versions; ambiguous versions never auto-picked; unavailable saved binding remains visible. |
| UX027 | Quantity × unit rate with six-decimal precision; labor hours and plan total separate; fixed 35.47/37.99 presets removed from active Intake. |
| UX028 | Named CSV/XLSX project-file versions replace raw evidence ID; snapshot changes load before commit and clear stale line references; budget navigation preserves Intake origin. |
| UX029 | Setup explains canonical draft creation and opens exact existing contract identities with return context. |
| UX030 | Optional commercial availability and errors are explicit; source failures preserve operational Intake; existing server activation requirements retained. |

Focused behavior tests cover compatible currency, unchanged item rate, decimal precision, distinct file versions, canonical contract identity, unavailable entitlements and commercial errors. Existing full Intake behavior tests pass. Frontend typecheck passed before final documentation and acceptance edits; the final full release suite is required on the committed candidate.

Chrome local fixture imports actual JobIntakeWorkspace and FinancialBudgetWorkspace, uses synthetic transport, and is restricted to development localhost. It is not authenticated production proof. Verified version v2 retains rate 30 and 12 drawings × 30 = 360 independently of 80 labor hours; selecting budget B after mapping A clears A's line; named file v2/v1 choices exclude PDF; budget return restores Scope; APU/budget errors leave setup visible with retry. English/Spanish and 390/768 widths have no page overflow. Local screenshot and DOM evidence is under F:/BIMLog/Evidence/ux-audit-20260928/UX-B06-*.

Release boundary: B05 is pushed at 48e0f841. B05+B06 must be published together after the full nine-command release suite, then verified by exact live identity, health/readiness, read-only database correspondence and full authenticated Chrome route smoke. Publication/customer acceptance is not implied by local fixture results. Completion receipts are external so they bind the final commit without altering it.

The initial full release suite passed at 258f6096. A long diagnostic destination in the localhost fixture caused page overflow during the later budget mobile check; wrapping that fixture-only output corrected it without changing product styles. Repeat exact-candidate verification follows this fixture correction.
