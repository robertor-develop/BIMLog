# Job Intake and Multi-APU Experience

## Product outcome

BIMLog must be powerful underneath and obvious in front. A first-time user should create a
basic job in under two minutes without learning BIMLog's storage model. Advanced users must be
able to represent one real job with multiple participating companies, multiple customer
relationships, multiple contracts or change orders, multiple APUs, and delegation by floor,
zone, task, deliverable, phase, or milestone without duplicating the job.

The canonical hierarchy is:

`Job -> Participants -> Engagements -> Contracts -> APU versions -> Work packages -> Resource assignments`

The existing Job Intake draft, Commercial contracts, Generic APU versions, Job Operations work
items/packages, assignments, time entries, budgets, and immutable baselines remain the canonical
authorities. The new experience composes them; it must not create parallel financial stores.

## Simple front-end rule

The default flow asks seven human questions:

1. What job are you creating?
2. Who hired you?
3. What are they hiring you to do?
4. Is this a quote, base contract, or additional work?
5. How should it be estimated?
6. Who will work on it?
7. Is this summary correct?

Terms such as engagement, immutable snapshot, authority receipt, and APU version remain behind
Advanced controls. Optional documents, detailed budgets, complete work-package decomposition,
and rate overrides must not prevent a valid basic job from starting.

## Multi-company and multi-contract rules

- A company is recorded once and may hold several roles in one job.
- One service provider may serve several customers in the same job.
- Each provider/customer relationship owns its own contracts and contacts.
- Quotes, base contracts, change orders, additional work, amendments, and time-and-material
  authorizations remain separately reportable.
- Change orders and additions reference a parent contract and copy only user-selected scope.
- Every APU belongs to one contract. A contract may own many APUs.
- Approved APU versions and commercial baselines are immutable; changes create a new version.
- Work may be split and delegated by building, floor, zone, discipline, system, phase,
  deliverable, task, or milestone without rewriting the owning contract or APU.
- Redelegation preserves the original assignee, completed hours, transferred remaining hours,
  actor, timestamp, and reason.

## Rate vocabulary

- Internal hourly cost: what the providing company pays or incurs for a resource.
- Customer rate: what the selected customer is charged.
- APU calculation rate: the rate frozen into one APU version.
- Budgeted hours and actual hours remain separate.

Initial editable portfolio defaults are USD 35.47 for Drafting and USD 37.99 for BIM
Coordinator. They are configurable defaults with visible provenance, never hardcoded financial
authority. Customer, contract, APU, role, resource, and effective-date overrides require the
appropriate permission.

## User roles and progressive disclosure

- Intake/Sales sees customer, contact, scope, quote, and simple estimate controls.
- Project Manager sees contracts, APUs, work packages, team, schedule, and budget summaries.
- Coordinator sees floor/task allocation, progress, and deliverables.
- Finance sees authorized rates, costs, billing, bonus basis, and profitability.
- Resources see their assignments, hours, deliverables, and progress.
- External customers see only explicitly shared information.
- Administrators manage templates, defaults, permissions, and operating entities.

## Ruben feedback acceptance

The experience must: fully translate and explain every setup question; replace ambiguous
"company" and "location" fields with role-aware company selection plus job/site, office, and
billing locations; reuse job disciplines instead of asking twice; allow levels and documents to
be completed later; filter contacts by customer; carry selected scope into contracts; support
editable Drafting and BIM Coordinator defaults; store customer/name/type/status per contract;
support multiple APUs per contract; show all eligible BIMLog users with an explanation for any
ineligible user; budget hours per contract/APU/work package; label internal cost plainly; and
replace the stale completion percentage with truthful Setup readiness, Optional items remaining,
Work progress, and Financial progress.

## Ten-build program

1. `INTAKE-APU-01`: shared version rule and backward-compatible foundation contract.
2. `INTAKE-APU-02`: two-minute bilingual Job Intake.
3. `INTAKE-APU-03`: visual multi-company job map.
4. `INTAKE-APU-04`: quotes, contracts, change orders, additions, and statuses.
5. `INTAKE-APU-05`: multiple-APU builder, templates, methods, defaults, and versioning.
6. `INTAKE-APU-06`: floor/zone/task/deliverable work-package delegation.
7. `INTAKE-APU-07`: resources, rates, hours, redelegation, and bonus authority.
8. `INTAKE-APU-08`: visual Job Command Center and truthful readiness/progress.
9. `INTAKE-APU-09`: contextual help, accessibility, bilingual and responsive acceptance.
10. `INTAKE-APU-10`: compatibility, migration preview, complete scenario, release acceptance.

Each build must preserve existing records, pass focused and relevant regression gates, receive
desktop and exact-390 English/Spanish visual inspection when UI changes, and distinguish local
implementation from integration, publication, deployment, live verification, and customer
acceptance.

## Shared version rule

The shared BIMLog format is `v1.05.Nxx-Pxx`. If no shared-format version exists, first adoption
is exactly `v1.05.N01-P01`; legacy versions never supply counter values. BIMLog MAIN 04/Lens Next
owns only `N`. MAIN 00/platform, Job Intake, and APU own only `P`. Each owner increments only its
counter and preserves the latest verified other counter. Concurrent ambiguity fails closed.
