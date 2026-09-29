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

Final verification exposed an API runtime assembly timeout. Bounded sibling copies and byte-identical small-file hashing are under regression verification. A semantic negative fixture also exceeded its five-second harness budget before validation; its default is now thirty seconds, while intentional timeout/cancellation tests retain explicit budgets. Production remains limited to ten minutes.


## Publication smoke correction and decision record

The full suite passed at 66c8e3f2 and publication 44bbc4e0 served that exact identity. The 61-route smoke resolved without captured browser errors. Connected flow verification found an existing activated Intake browser-recovery inconsistency, so acceptance remains open until correction and republication pass.

CUSTOMER_PROBLEM=An activated canonical setup claimed retrying autosave and exposed editable fields that could never save.
TARGET_CUSTOMER=BIM coordination companies.
BUYER=Company owner and project management.
END_USER=Coordinator reviewing activated setup.
USER_JOB_TO_BE_DONE=Review saved setup and continue in connected operational/commercial records.
EXISTING_CAPABILITY_REVIEWED=Intake recovery helper, canonical save guard, stage navigation and validated return context.
DUPLICATION_CHECK=Improve existing controls; no new route, entity, authority, workflow or terminology.
AUTHORITATIVE_SOURCE=Saved server Intake and its canonical contract identity.
PROPOSED_SOLUTION=Share the existing lock condition across recovery and form affordances; preserve local copies without applying them; retain navigation links.
COMMERCIAL_VALUE=Avoid misleading editing and lost confidence in contract setup.
BUSINESS_VALUE=Reduce support and repeated work without changing financial records.
MARKETING_POSITION=Connected, trustworthy BIM coordination workspace.
UX_UI_RATIONALE=Visible bilingual read-only explanation and accurate saved status; navigable stages and destinations.
INFORMATION_ARCHITECTURE_RATIONALE=Existing Intake remains the setup record; existing Operations and commercial records remain execution destinations.
SECURITY_BOUNDARY=Existing server authorization and save/activation guards unchanged.
DATA_AUTHORITY=Server setup wins after canonical activation; browser recovery remains retained only.
SUCCESS_METRIC=No retry/pending message or editable setup after canonical activation; draft and core-only enrichment behavior unchanged.
EVIDENCE_REQUIRED=Same/older/newer recovery regression, local actual-component bilingual check, frontend typecheck and full release suite.
LIVE_ACCEPTANCE_REQUIRED=Exact publication identity, full authenticated 61-route smoke, read-only saved recovery and commercial/Convention return flows.
ROLLBACK_METHOD=Normal source revert and verified publication; no schema or data rollback required.

Local actual-component verification shows preserved browser copy, saved server job name, disabled fields, available stage buttons and return links in English and Spanish. Final release and live evidence remain external under F:/BIMLog/Evidence/ux-audit-20260928/UX-B06-corrective-*.
