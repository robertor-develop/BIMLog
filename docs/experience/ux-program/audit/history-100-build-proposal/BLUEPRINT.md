# A connected BIMLog experience

Design proposal, September 2026. Companion to [the audit](AUDIT.md) and [the implementation program](MICROBUILDS.md). This document does not authorize product changes.

## Product promise

**BIMLog connects the work, decisions and evidence needed to deliver a BIM project.**

Every important screen should answer: What job am I in? What is its current state? What needs my attention? Who acts next? What evidence supports it? Where do I return?

The experience should make a difficult construction workflow understandable without weakening it. A coordinator should not need to learn the application's internal authority vocabulary. An administrator should still be able to inspect permissions, provenance and immutable versions.

## One lifecycle, with several entry points

```mermaid
flowchart LR
  A[Understand BIMLog] --> B[Start or request a demo]
  B --> C[Company and project context]
  C --> D[Guided job setup]
  D --> E[Review and activate]
  E --> F[Project work home]
  F --> G[Task or coordination issue]
  G --> H[Evidence and document workflow]
  H --> I[Review and decision]
  I --> F
  I --> J[Commercial impact when applicable]
  J --> F
  F --> K[Reports and closeout]
  D --> L[Contextual prerequisite editor]
  L --> D
```

This is a lifecycle, not a rule that every project must complete every commercial step. Core operational setup remains available according to current entitlements. Existing active projects enter their work home directly. Commercial modules remain optional/controlled where they are optional/controlled today.

## Information architecture

| Scope | Primary destinations | What moves out of the daily path |
|---|---|---|
| Global | My work, Projects, Search, Inbox, Help, profile/company switcher where authorized | API credentials, feature flags, diagnostics |
| Company administration | People and companies; reusable catalogs; delivery templates; pricing templates; integrations; company settings | Personal profile and project execution |
| Project | Overview; Work; Documents; Commercial; Reports; Project settings | Long setup explanations and raw provenance |
| Project setup | Six-stage resumable guide, available from draft project cards and project settings | Separate competing quick/advanced journeys |
| Lens | Specialized issue workspace with project context, bridge status and return link | Ordinary web project administration |
| Platform administration | Clearly scoped support/admin functions | Everyday coordinator navigation |

Suggested grouping preserves existing routes initially. Add compatibility redirects only after route-level tests. Do not remove deep links used by notifications, reports or native clients.

Project home should be role-aware: an operator sees assigned work; a coordinator sees blockers and pending decisions; a manager sees progress and commercial exceptions. Users can switch views. Permission enforcement remains on the server; visual personalization must not create authority.

## Six-stage Intake

| Stage | What the user supplies | What BIMLog reuses | Exit condition |
|---|---|---|---|
| 1. Job and client | Name, code, client, location/date context | Existing company/project information | Valid project identity and selected client where required |
| 2. Scope | Contract/work items, quantities and units; optional source evidence | Approved catalog items, imported draft mapping | Every required item has an identity, quantity/unit and clear scope |
| 3. Delivery | Workflow/template and relevant locations | Published workflow versions and project conventions | Eligible delivery definition, or explicit permitted minimal flow |
| 4. Team | Responsible company/person and planned effort | Project members, directory and roles | Required ownership/capacity constraints satisfied |
| 5. Commercial, if applicable | Contract terms, linked APU/version, rate and budget | Existing approved pricing/budget versions | Applicable commercial readiness is explicit; no invented mandatory paywall |
| 6. Review and start | Review the resulting job and address blockers | All previous input and source links | One intentional, idempotent activation with result summary |

Source documents are optional evidence available at the relevant stage, not an intimidating first mandatory-looking wall. Advanced fields expand in place. A sticky footer says Saved, Saving or Save failed, with stage-level Next and Back. It must not cover fields or conflict with feedback buttons.

An active project displays Active since [date], changes pending if any, and Open work. It should not remain visually poised for its first activation. Setup completeness is separate from task completion, staffing coverage, earned value and payment.

### A concrete repaired detour

The user is pricing Scope item A at stage 5 and needs an APU:

1. Select Choose or create pricing plan.
2. Open a focused panel or full editor headed Pricing for Scope item A, with Return to job setup visible.
3. Select a published compatible version, or create a draft using existing permissions.
4. Show unit, quantity, unit rate, total and version source. Explicitly distinguish a plan's total selling value from a line's unit rate.
5. Complete and return restores the exact step and item, and displays the selected plan once.
6. Cancel and return restores unchanged input. Refresh restores a saved draft; conflicts ask the user to reconcile rather than silently overwrite.

This return mechanism applies to client creation, directory contacts, naming conventions, budgets, contracts and connector setup. For a task requiring a different role, display the named role and a permitted handoff route; sending a request is a distinct explicit user action.

## Data ownership: enter once, reuse deliberately

| Concept | Canonical owner | Other screens do |
|---|---|---|
| Company/person | Existing company and directory identities | Select references; snapshot issued-document party data deliberately |
| Project engagement/client | Project relationship to canonical parties | Show the same eligible parties in Intake and document workflows |
| Scope/contract item | Existing stable job item identity | Reference in operations, commercial lines and evidence |
| Work task/assignment | Existing operational task and assignment | Project into My work, calendar, meetings and reports |
| Pricing template/version | Published company pricing definition | Instantiate/link according to existing rules, keep provenance |
| Project cost/value plan | Existing project plan/version | Reference from scope and commercial views without re-entering totals |
| Budget/baseline | Existing governed budget accounts and immutable snapshots | Show current versus approved versus historical scope explicitly |
| Contract/change | Existing commercial lifecycle | Link supporting RFIs, scope and approvals; never infer legal approval from a view |
| File/document version | Existing artifact identity and version | Attach/link by identity, not by matching filename |
| Required submittal | Requirement definition | Link received package revisions; coverage is not approval |
| RFI/submittal/transmittal/meeting | Existing source record | Show related context and next actor, avoid parallel task copies |
| Lens issue | Existing stable Lens identity | Reference from web workflows while preserving native boundaries |
| Notifications | One effective preference model plus channel readiness | Show consistent availability in profile, settings and records |

Do not merge similar records merely because their labels match. Distinguish actual duplicated records, repeated entry, multiple projections of one record and legitimate historical snapshots. Each needs a different remedy.

## Daily work design

Project work home begins with a compact project header and one primary action appropriate to the role. Below it: My work, Needs a decision, Blocked and Due soon. Rows show the work item, current stage, owner, due date and next action. Missing owner/due date is an actionable state, not an internal code.

Opening a task displays its scope, deliverable, linked evidence and workflow together. Log time, submit for review, request clarification and attach evidence are contextual. A task's detail can reference an RFI or meeting action without creating a duplicate task. The user can inspect history and commercial implications without losing the task.

Record detail should start read-only with a meaningful heading and current lifecycle. Editing, issuing, responding, approving and sharing are distinct actions. Reports are secondary to the current work action. Every related-record jump carries a visible return path and preserves filtered lists.

## Documents and coordination

Use one entry vocabulary: Add evidence, Create RFI, Create submittal, Issue transmittal, Record change, Schedule meeting. A common creation shell reuses project/party/date/evidence controls while each document retains its own lifecycle.

Upload/import should show the source, artifact type, naming result, storage behavior, intended destination and any optional AI cost. Do not claim content analysis for filename-only validation. A missing naming convention should offer an eligible template or a clear administrator handoff without discarding upload context.

Linking should explain meaning. A file belongs to a package; a package satisfies a requirement; a response resolves an RFI; a change references its supporting decision; a transmittal records issuance. A generic Attach menu alone cannot teach this model.

Calendar layers should distinguish operational tasks, document deadlines, meetings and milestones. Filters define the scope; an empty result explains which layers were included. Never silently generate parallel schedule tasks from every document.

## Commercial experience

Organize around the questions: What did we agree to deliver? At what quantity/unit/rate? What is approved? What changed? What effort is planned/actual/remaining? What amount is committed/earned/billed/paid?

Display familiar names and currency precision. Keep full decimal precision, version hashes and IDs in inspectable evidence. Show current contract status separately from activation-time snapshots. Existing approval/separation-of-duty/entitlement rules remain intact.

Human performance must distinguish insufficient evidence, capacity planning and actual outcomes. Do not label missing data poor performance or present scenario assumptions as measured productivity.

## Visual and interaction direction

Retain BIMLog by IgniteSmart and the recognizable blue accent. Use a restrained workspace: neutral surfaces, clear typography, consistent spacing, compact but readable tables and fewer simultaneously emphasized elements. Color communicates state with text, never as the only signal. Avoid repeated informational banners that visually compete with the work.

Proposed design rules:

- One page title and one dominant current action.
- A consistent project header with context, role and resume/back behavior.
- Shared form primitives for labels, help, required/optional state, loading, errors and saved state.
- Shared record table, detail panel, empty state, confirmation, notification and export patterns.
- Common date/currency/status terminology across English and Spanish.
- IDs, hashes, debug terms and implementation limitations in Details; operational consequences stay visible.
- Reflow at 320px and above; usable touch controls, keyboard focus, clear labels and safe drawer stacking.
- Basic fields first; advanced controls remain available without a separate duplicate workflow.

These are proposed design rules, not claims that an untested theme meets accessibility requirements.

## Brand and sales

### Positioning and voice

Lead with coordination confidence and delivery clarity. Suggested headline: **Keep BIM work, decisions and evidence connected.** Supporting line: **Move from agreed scope to daily delivery with clear ownership and a traceable project record.** Validate wording with actual target customers before treating it as final brand copy.

Use precise, calm language. Replace broad absolutes and adversarial phrases with verified outcomes. A professional platform earns trust through visible product behavior and truthful limitations, not through technical assurances repeated on every screen.

### Public site structure

1. Hero: clear audience/value, real workflow image, Start a project or Book a demo.
2. Product story: scope → task → issue → decision → evidence → report, using one realistic example.
3. Role outcomes: coordinator, project manager, delivery team and business owner.
4. Product proof: real screens, a short verified walkthrough, honest connector availability.
5. Trust: data ownership/storage explanation, permissions, history, support, accurate policy links.
6. Pricing: concise comparison, clear billing basis, trial limits and a coherent next action.
7. FAQ and contact with preserved plan and use-case intent.

Keep all current prices until a separate commercial review. Simplify the way plans are compared before changing packaging. Distinguish a self-service eligible path from a sales-assisted enterprise path; do not use the same vague Get Started label for both.

### Funnel measurement

Measure view → CTA → completed signup/demo request → first draft → first activated job → first completed task/review → repeat use. Add detour return rate, draft abandonment, repeated party creation and support requests about setup. Use aggregate approved telemetry without document contents or secrets. No analytics transmission was added by this audit.

Do not promise a conversion lift. Establish a baseline and compare cohorts after rollout. Suggested usability gates are hypotheses for validation: five representative users complete a prepared setup scenario without moderator navigation help; no repeated client entry; every prerequisite excursion returns correctly; and at least four of five users find the next assigned action within 30 seconds. Include Roberto's acceptance and actual coordinator/operator/admin participants; simulated personas are not a substitute.

## Preservation and rollout

Start with a capability and route inventory, canonical-data map, baseline record counts/totals, and representative fixtures. Implement a coherent vertical slice from draft through operational work before redesigning every page separately. Use preview verification, feature-controlled rollout if supported, compatibility routes and a reversible switch to the established experience.

Prefer additive projections/components over database replacement. Any identity normalization requires a dry-run mapping, collision review, record reconciliation and rollback design. Issued documents, immutable snapshots and history must retain their original meaning. No bulk deletion, automatic merge, historical rewrite or native upgrade belongs to a cosmetic redesign.

Release by complete user journey. Each block must include behavior, wording, responsive/keyboard checks and integration evidence. The final release gate includes record and financial reconciliation, permission isolation, export scope, native compatibility where affected, and a real user walkthrough. A green unit test suite alone cannot establish that the experience flows.
