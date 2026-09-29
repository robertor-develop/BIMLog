# Block 05 — one full Job Intake setup

Five sequential builds: UX021 b7c2e35d; UX022 c93bf26a; UX023 730abb2a; UX024 45b866de; UX025 94e37c6f.

One six-stage path retains legacy quick drafts. Quantity/unit and labor hours are distinct; canonical contract lines use quantity, while operational hours retain their meaning. Legacy items without quantity derive it from their previous hours, preserving value. Stable scope IDs survive reorder. Delivery owns published template selection and work-package locations. Convention Builder and company workflows carry saved Intake return context. Optional generic role budgets preserve existing assignments and can activate with no leader, no employees and incomplete staffing coverage. Existing resource rows with null user IDs support planning without fake users. Named staffing is deferred to Operations.

Focused checks: frontend typecheck, quantity/legacy/stable-ID behavior, generic role exact cost and unstaffed readiness, complete Intake behavior, editor rendering, old Intake recovery regressions, workflow selection and return validation. Real disposable PostgreSQL HTTP fixture verifies generic roles save/reopen and activate with partial hours and no employee identity, as well as existing financial/authorization/idempotency regressions.

Actual JobIntakeWorkspace Chrome fixture imports production components with synthetic transport. It tests quantity edits preserving hours, 20 × 6.50 = 130 role cost, published workflow selection, work-package entry, stable reorder, six-stage navigation, English/Spanish and 390px layout. This local UI fixture does not claim live authentication, server persistence, or production activation; HTTP/database tests separately establish persistence. No publication is due until UX030. Full authenticated production Chrome smoke follows that publication.

Known deferred scope: approved employee-profile cost and excess-only $3.50 policy, global APU library, company discipline/document usage favorites, SendGrid setup, canonical-contract remediation, full location catalog and staffing demand evolution belong to later program builds. Existing source data is not migrated or erased.

External completion evidence and exact final gate receipt: F:/BIMLog/Evidence/ux-audit-20260928/UX-B05-*.
