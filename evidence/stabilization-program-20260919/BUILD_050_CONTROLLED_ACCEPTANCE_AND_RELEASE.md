# Build 050 — Controlled acceptance and release checkpoint

- Local result: PASS_PENDING_RELEASE_GATE
- Scope: catalog-to-Intake controlled acceptance across Super Administrator, Company PMO, Finance checker, and ordinary read-only user boundaries.
- Super Administrator can grant/revoke Company PMO for an existing account, bound to that account's company; the grant does not create global authority.
- Company PMO can manage catalog drafts and templates. Ordinary users remain read-only and all mutations are reauthorized server-side.
- Pricing publication and economic Delivery Workflow approval require the independent Finance checker and reject stale or maker-as-checker attempts.
- Intake independently revalidates company, client, classification, pricing, budget, workflow, project membership, and staffing authority before save/activation.
- Added a permanent Block 10 controlled-acceptance contract test.
- Corrected the current-state gate so it accepts only Builds 046–050 for Block 10 and still requires the Build 050 push/publication checkpoint before advancing cadence.
- Publication: due after this build. Exact release gate, additive schema preview/restore, push, Replit publication, and authenticated visible-Chrome acceptance remain to be appended to this record.
- Native/installer impact: none; focused Navisworks smoke is not required.
