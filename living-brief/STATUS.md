# STATUS.md - Current Accepted Platform State

Status: Active current-state record
Last reconciled accepted integration commit: `8022b894bf8650c9a02384f2d187e0f84f476d55`
Accepted integration date: 2026-07-21

This document states accepted `origin/master` truth. A local candidate, review result, build, package,
deployment, production mirror, and customer field verification are separate states. Nothing in this
document treats the current Living Brief freshness candidate as accepted, pushed, published, or live.

## Accepted platform foundation

- BIMLog remains a pnpm monorepo with the React/Vite web application, Express API, shared Drizzle
  schema, PostgreSQL runtime, authenticated project boundaries, activity history, reports, files,
  conventions, coordination modules, and Navisworks integration paths described by
  [PLATFORM.md](./PLATFORM.md).
- RFI Builds 1 through 7 are accepted in the source history. The canonical RFI workflow, lifecycle
  integrity, attachment identity, non-destructive image handling, professional PDF/DOCX/audit
  outputs, native-fidelity Complete PDF package, and canonical four-sheet Excel register are present.
  RFI Build 8 is not accepted.
- Telegram Product Builds 1 through 5 are accepted. Secure linking, AI control-plane foundations,
  bilingual conversation/support, Delivery Concierge foundations, and the canonical Notification
  Center/outbox are present. Module notification adapters still marked coming later remain unavailable.
  Telegram Product Build 6 is not accepted.
- Plans, Entitlements, and Feature Controls Steps 1 and 2 are accepted. The canonical feature
  catalog, advisory entitlement resolver, explicit company/project/user policies, user preferences,
  support matrix, and append-only project-company binding history are present. Step 3 is not accepted.
- Meeting Minutes M1 through M4 are accepted. Meetings link immutable meeting-time snapshots to
  existing same-project RFIs, Submittals, and canonical Clashes while preserving canonical records,
  legacy notes, and user-removal intent. M4 adds controlled creation and synchronization of canonical
  Schedule Buckets and tasks from already-linked Submittals without creating or mutating the canonical
  Submittals. Meeting Minutes M5 is not accepted.
- Cost and Financial Control Builds 1 and 2 are accepted. Build 1 establishes explicit effective-dated
  financial authorities, exact decimal/currency controls, approval policy boundaries, maker/checker
  separation, suspension, and append-only evidence. Build 2 adds versioned company cost libraries,
  project cost structures, exact-decimal budgets, maker-checker workflow, immutable approved
  snapshots/history, bounded import/export, controlled authorization, and bilingual responsive UI.
  Finance Build 3 is not accepted.
- Shop Drawing Control filter correction is accepted. Visible results and PDF/Excel exports share
  normalized comparison semantics while preserving human labels and stored customer data.
- The report design system Phase 1 and Phase 2 source history remains accepted; route-specific
  artifact quality and deployment/field verification remain separate acceptance gates.

## Accepted Navisworks history and current boundary

- The platform contains the accepted Navisworks project Import/Rebind correction, including scoped
  idempotency, controlled conflicts, project boundaries, queryable physical identity, and Pull parity.
- Preserve-first reconciliation source is present on accepted master. Normal Pull/Reconcile must not
  treat omission, ambiguity, incomplete metadata, duplicate labels, historical state, or `Guid.Empty`
  as deletion authority. Exact field/package acceptance remains governed by [PLUGIN.md](./PLUGIN.md).
- The v1.60.7 physical saved-viewpoint behavior is a protected compatibility baseline when the
  separately reviewed baseline documentation lands. This status record does not claim an unintegrated
  documentation candidate is accepted.
- Navisworks v1.60.18 is a concurrent candidate and remains **Pending / Under Review**. It is not part
  of accepted `origin/master` at this reconciliation point and must not be reported as deployed or
  customer verified.

## Living Brief current condition

- The authoritative set is the 11 Git-controlled documents in `living-brief/catalog.json`, in the
  authority order defined there.
- Before this candidate, `OPEN_LOOP.md` contained accepted history through commit `8022b894`, while `STATUS.md`, `AUDIT.md`,
  and several module/governance documents had not been reconciled with the accepted integration
  history. The browser served a mixed disk/database view, exposed only eight tabs, and labeled mirror
  or filesystem update time as if it were document freshness.
- The current local Living Brief candidate introduces cross-platform deterministic source hashes
  over canonical UTF-8/LF text, impact metadata, a completeness/freshness gate, a verified database
  mirror model, and all 11 API/UI documents. Independent local review has exercised the real
  migration, authenticated API, transactional synchronization, observed-hash reconciliation,
  advisory-lock serialization, concurrent-source-change detection, restart behavior, and rollback
  against disposable localhost PostgreSQL only. It remains unaccepted until clean integration,
  push, and remote verification; deployment and production mirror verification remain later gates.

## Pending and under review

- Navisworks v1.60.18.
- Plans/Entitlements Step 3, Telegram Product Build 6, and RFI Build 8.
- Production deployment, production database mirror reconciliation, and browser verification against
  the deployed production bundle for this Living Brief architecture.

See [OPEN_LOOP.md](./OPEN_LOOP.md) for the detailed accepted, pending, blocked, and future register.
Historical audits and production row counts remain evidence for their dated observations only in
[AUDIT.md](./AUDIT.md).
