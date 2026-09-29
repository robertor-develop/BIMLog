# UX002 — source ownership and preservation contract

This map describes existing stores and the direction of the makeover. It creates no parallel business record or migration. Route ownership is generated in ROUTES.json; runtime audit coverage is in audit/COVERAGE.md. A source binding proves implementation ownership, not a successful live operation.

| User concept | Existing source under lib/db/src/schema | Relationship / boundary | Preservation and next work |
|---|---|---|---|
| Company / client | company_profiles.ts; enterprise-identity.ts; project-directory.ts | Company identity, tenant authority and project directory entries have distinct purposes | Reuse eligible identity; retain issued party snapshots. UX011–015 reconcile pickers before normalization. |
| Project and membership | projects.ts | Project owns scope and authorized membership | No global project visibility inferred from a URL or a help role choice. |
| Job setup / scope | job-intakes.ts | Intake belongs to project; saved payload and activation are different states | Preserve drafts and stable item references; UX021 replaces Quick Setup without dropping old drafts. |
| Naming convention | conventions.ts | Project prerequisite used by naming workflow | Save before leaving Intake; UX017 supplies exact step return later. |
| Commercial APU | generic-apu.ts | Versioned APU source, project applicability and pricing must be explicit | Never replace selected customer rate with a staffing-profile default. UX111–120 resolve library/version/rate provenance. |
| Contract and items | financial-contracts.ts; contract-item-workflows.ts | Contract source/version and work items feed governed downstream planning | Intake should create or link one draft from the same scope; draft creation is not approval. UX136–140 must prove idempotence and exact item mapping. |
| Budget / snapshot | financial-budgets.ts | Captured source/version supports historical comparison | Current master edits must not rewrite accepted snapshots. |
| Planned resources | team-resource-planning.ts | Role/hours/cost planning precedes named execution assignments | UX121–125 allow generic budgets and unassigned future work; current activation restriction remains a defect. |
| Member cost | users.ts; financial-controls.ts | Member identity and financial authority remain server-owned | UX126–135 require effective-dated, CEO-approved costs. Drafter $5.10/hr; coordinator $6.50/hr; $3.50 applies only to hours above each floor's approved estimate. Mixed-role excess allocation remains unresolved. Do not silently implement a wage/payroll rule. |
| Task / action | action-items.ts; job-intakes.ts and existing Operations projections | Work derives from source scope; assignment is not the scope itself | Do not create duplicate tasks from a help guide or imply staffing means completion. |
| File / revision | files.ts | Project file and exact revision supply evidence | Upload, issue, delivery and acceptance remain distinct events. |
| Submittal / transmittal | submittals.ts; submittal-register.ts; transmittals.ts | Planned requirements, submitted packages, revisions and dispatch records are distinct | Shop drawings are the primary BIMtech deliverable, not the only supported document type. Preserve review and dispatch histories. |
| RFI / change / meeting | rfis.ts; change-orders.ts; meeting-minutes.ts; linked-items.ts | Linked source records retain their original identity | Navigation and summaries must not duplicate custody, approval or completion. |
| Delivery workflow | delivery-workflows.ts; workflow-governance-policies.ts | Approved workflow controls transitions and roles | Status lists must derive from the applicable workflow; do not conflate document codes with status. |
| Email / integration | user-connections.ts; email-log.ts; connector-foundation.ts | Connection readiness is separate from actual provider outcome | Offer optional configuration and contextual return; never infer an email was sent from configuration alone. |

## Target chain

Company → Project → one Intake scope → exact APU versions / draft Contract items → governed EDT / Operations → deliverable revisions → review / dispatch evidence → reports. Each arrow carries the existing source key and version, not copied editable truth. A prerequisite editor returns to the same project, draft and step. Staffing may happen later.

## Unresolved decisions and protected behavior

- Mixed-role ordering/allocation of excess hours and effective-date treatment require a business decision before UX135; the confirmed excess-only rule is preserved now.
- The specific Ruben $30 incident is not proven by available logs. The observed rate-default source defect is documented separately; no fabricated incident attribution.
- Existing tenant/permission checks, approvals, immutable issued history, commercial units/precision, retained quick drafts, optional sharing boundaries and Lens Native behavior are preserved.
- No destructive migration, schema change, external send, financial repricing or production data write belongs to B01.
