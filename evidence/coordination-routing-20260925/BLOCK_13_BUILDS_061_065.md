# Resource Planning block 13 — Builds 61–65

Baseline: e12ca284f20796135e147d973caf771bf3ae02f6. Lens Next frozen.

61 f9a1c198: reject impossible dates instead of silently normalizing February/April overflow.
62 62d8db93: validate timezone, integer weekdays and physical daily capacity; preserve protected rates.
63 facf459f: warn when an assignment's own dates exceed capacity or contain no working days after leave. Scenario-wide spare capacity cannot hide a one-day overload.
64 a37b9585: English/Spanish actionable warnings and disabled saving for invalid availability.
65: deterministic/advisory evaluation, redaction and invalid-leave regressions; connect API/UI test command and release records.

Focused behavior and actual-component static-render tests pass. Static rendering is not Chrome acceptance. Full exact-head release gate, push, publication and live smoke are pending at authoring. R11–R15 plus 61–65 total ten unpublished changes: publication is due now, not at Build 70.

No migration, financial authority, credential, permission, native or installer changes. No real tenant SharePoint round trip or full template-to-Operations acceptance is claimed. Fifteen original planned builds remain, plus unresolved acceptance/policy gaps requiring evidence-based reconciliation.

## Build 65 connected live-defect repair

Before publication, authenticated Chrome at `/projects/58/commercial/team-performance` showed Team Performance temporarily unavailable while Resource Scheduling loaded. Isolated PostgreSQL EXPLAIN reproduced SQLSTATE 42601 at the monthly query's unquoted `month` alias. Quoting the alias and ORDER BY fixes parsing; all eight real PostgreSQL query plans pass in a read-only transaction. This test does not read customer data or bypass UI acceptance. Repeat full gate on corrected HEAD, then exact live reproduction after publication. Earlier gate run is superseded, not exact-head release proof.
