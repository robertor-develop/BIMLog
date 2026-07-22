# VISION.md - Product Vision and Agent Architecture

## Governance and ownership

This document owns BIMLog's roadmap, markets, agent architecture, future products, and long-term
direction. [ECOSYSTEM_DOCTRINE.md](./ECOSYSTEM_DOCTRINE.md) is the permanent product-doctrine
authority beneath Roberto's explicit current instruction and governs current ecosystem identity
and permanent product laws. Vision statements do not amend that doctrine or prove current
implementation.

## The big idea
BIMLog should run itself like a company. It is not just a coordination tool; it is the
operating system for construction coordination, with an agent organization that watches,
interprets, decides, and reports autonomously across every project and across the full
BIMCapital ecosystem. Agents operate continuously at five layers, not only when users
trigger them.

The deeper product thesis is this: BIMLog creates the verified construction record that
eventually becomes the operational digital twin. Digital twins fail when the underlying
coordination, document, RFI, submittal, field, and handover data is messy. BIMLog wins by
making that data clean, traceable, simple to use, and useful before the owner ever asks for
a full digital twin.

## Built-asset lifecycle operating network north star

Roberto's approved long-term strategy is for BIMLog to grow from construction coordination into
the trusted operating, contractual, maintenance, commercial, and circular-economy infrastructure
for built assets across their complete lifecycle. BIMLog must therefore not be described merely as
a BIM coordination application. The staged path is:

construction coordination -> verified construction record -> asset passport -> maintenance
obligation engine -> condition/IoT events -> controlled work orchestration -> contractor/supplier
network -> executable contract rules -> circular-material recovery network.

The indispensable operations wedge is **BIMLog Asset Passport + Maintenance Obligation Engine**.
For each installed asset, the future platform should connect canonical BIM/model identity and
exact location; manufacturer, model, serial, specifications, submittals, approvals, installation,
commissioning, and evidence; contract, warranty, SLA, maintenance schedule, and responsible party;
condition from inspection, technician, occupant, and IoT evidence; required labor, qualifications,
parts, and materials; approved contractor/supplier eligibility, geography, availability, lead time,
and contract pricing; human authorization thresholds; work order, dispatch, evidence, inspection,
acceptance, warranty, and payment eligibility; and replacement, deconstruction, reuse, resale,
recycling, disposal, and chain-of-custody evidence.

Executable contracts mean auditable rules and obligations first, not a blockchain-first promise.
Distributed ledgers or blockchain are optional future infrastructure only where multi-party
provenance or trust justifies them. Initial executable rules must not autonomously transfer money,
control safety-critical equipment, or silently make AI contractual authority. Human approval remains
based on authority, risk, value, and asset criticality; deterministic permissions, audit, rollback,
idempotency, and evidence are mandatory. AI may recommend, extract, monitor, and orchestrate, but
cannot become the contractual authority without explicit approval and controls.

The future circular-economy graph is: model element -> approved product/submittal -> manufacturer
and material composition -> procurement/cost -> delivery/installation -> embodied-carbon or other
environmental evidence -> maintenance/replacement -> deconstruction -> reuse/resale/recycling/
disposal -> certificates and recovered value. Future matching may include contractors, recyclers,
logistics, chain of custody, waste diversion, carbon avoided, salvage value, and compliance evidence.

### Lifecycle roadmap stages

| Stage | Entry criterion / capability gate | Deliverables | Exit / KPIs | Human approval and non-automation boundary |
| --- | --- | --- | --- | --- |
| 0. Construction coordination foundation | Current modules keep clean canonical records, bilingual UI, exports, audit, and source/release discipline. | RFIs, Submittals, Meetings, Schedule, Lens/Navisworks, Finance, Telegram, Plans/Entitlements, Living Brief governance. | Fewer duplicate records, clean exports, accepted evidence gates, customer field feedback. | Do not automate deployment, production data, payments, safety controls, or customer-specific hardcoding. |
| 1. Construction-to-operations handover and asset passports | Verified construction records can produce owner-ready asset seeds. | Asset identity model, location/system mapping, submittal/commissioning/document links, handover package. | Verified asset-passport count, completeness score, owner review outcomes. | Do not claim owner CMMS/digital-twin replacement or asset-management-system conformity. |
| 2. Warranty, SLA, and maintenance obligation engine | Contracts/warranties can be converted into reviewable obligations. | Obligation register, responsible party, due dates, evidence requirements, exception workflow. | Obligations detected, warranty value at risk/recovered, SLA compliance. | No legal conclusion or payment eligibility without human authority. |
| 3. Manual inspection and controlled condition/event intake | Human field evidence can update asset condition. | Inspection forms, photos/files, technician/occupant reports, condition history. | Condition events accepted, defect response time, avoided duplicate inspections. | No autonomous dispatch, equipment control, or safety-critical classification. |
| 4. Provider-neutral IoT/BMS/CMMS integration | External events are normalized without provider lock-in. | Connector registry, event schema, identity matching, retry/audit, health monitoring. | Matched event rate, false-match rate, connector uptime, security incidents. | No direct control of equipment; ingestion only until safety review approves more. |
| 5. Maintenance planning, work orders, approvals, evidence, closeout | Obligations and condition events can produce controlled work packages. | Work orders, approvals, dispatch-ready packet, closeout evidence, inspection/acceptance. | Work orders completed, SLA/downtime improvement, closeout completeness. | No unapproved contractor dispatch, spend commitment, or acceptance of work. |
| 6. Qualified contractor and supplier network | Providers can be qualified and matched by scope/geography/availability. | Qualification, insurance/license evidence, coverage map, parts/materials availability, pricing references. | Network liquidity, response time, quote coverage, completion quality. | No marketplace favoritism, unverified credentials, or automatic award. |
| 7. Executable contract rules and commercial eligibility | Rules evaluate obligations, evidence, exceptions, and approval thresholds. | Rule engine, eligibility states, exception handling, audit replay, settlement-readiness reports. | Rule accuracy, dispute reduction, audit replay success, exception resolution time. | No autonomous money movement, lien/claims/legal action, or safety override. |
| 8. Predictive maintenance and portfolio optimization | Historical/condition data can recommend prioritized intervention. | Risk models, portfolio dashboards, forecast explanations, scenario planning. | Failures avoided, downtime avoided, cost avoided, model calibration. | Prediction is advisory until validated; no silent schedule or spend changes. |
| 9. Material passports, deconstruction planning, circular recovery marketplace | Asset/material identity supports reuse, resale, recycling, disposal, and certificates. | Material passport, deconstruction plan, recycler/contractor matching, chain-of-custody, certificates. | Material reused/recycled, waste diverted, recovered value, carbon avoided. | No environmental, compliance, or resale claim without evidence and authority. |
| 10. Multi-region ecosystem scaling, standards interoperability, benchmarking | Repeatable lifecycle data works across regions, owners, and standards profiles. | Interoperability profiles, benchmarking, regional rule packs, governance services. | Retention, governed value, gross margin, benchmark confidence, compliance evidence. | No cross-region legal/regulatory claim without local expert review. |

Key dependencies and principal risks by stage:

| Stage | Key dependencies / prerequisites | Principal risks / failure modes |
| --- | --- | --- |
| 0 | Stable current modules, canonical identity, evidence discipline, bilingual UX, clean release workflow, customer feedback loop. | Shipping disconnected modules, dirty data, weak evidence, duplicate tasks, cost-producing validation churn, or customer-specific hardcoding. |
| 1 | Asset identity schema, location/system conventions, submittal/commissioning evidence, owner handover samples, standards mapping. | Incomplete asset identity, document-only handover, owner rejection, false digital-twin/CMMS claims, unusable data quality. |
| 2 | Contract/warranty/SLA examples, obligation vocabulary, responsible-party model, legal review, exception workflow. | Treating extracted text as legal truth, missed obligations, duplicate obligations, unapproved warranty/payment claims. |
| 3 | Field inspection workflow, mobile evidence, roles/permissions, condition taxonomy, offline/retry behavior. | Unsafe condition classification, poor photo/evidence custody, technician friction, silent overwrites of verified records. |
| 4 | Provider-neutral connector model, security review, identity matching, test fixtures, customer-approved systems. | Vendor lock-in, false asset matches, noisy/untrusted telemetry, privacy exposure, direct control before safety approval. |
| 5 | Obligation/event intake, approval matrix, contractor/provider data, closeout evidence rules, audit and rollback. | Unauthorized dispatch, spend commitment, weak closeout evidence, SLA disputes, acceptance without inspection. |
| 6 | Qualification evidence, insurance/license checks, geography/availability data, pricing references, neutrality/conflict controls. | Marketplace bias, unverified providers, low liquidity, poor quality, unclear responsibility, regulatory/insurance gaps. |
| 7 | Versioned rule model, deterministic permissions, replayable audit, exception handling, commercial/legal review. | Autonomous money movement, rule ambiguity, bad inputs, hidden AI authority, non-replayable decisions, legal exposure. |
| 8 | Sufficient history, calibrated models, explainability, portfolio baselines, owner objectives. | False prediction confidence, optimization against wrong metrics, hidden bias, unapproved spend/schedule changes. |
| 9 | Material/product composition data, deconstruction partners, logistics, certificate authority, environmental methodology. | Unsupported carbon/waste claims, broken chain of custody, poor recovery economics, regulatory mismatch, greenwashing. |
| 10 | Standards profiles, regional legal review, scalable governance, benchmark definitions, enterprise controls. | Premature international claims, incomparable benchmarks, privacy/data-residency gaps, standards overclaiming, operational complexity. |

Planning horizons are hypotheses, not delivery promises: 0-12 months emphasizes construction
coordination excellence, trusted records, handover foundations, and pilot discovery; 12-24 months
targets asset passports, obligations, manual condition events, and first owner/operator pilots;
24-48 months targets IoT/CMMS integrations, work orchestration, and qualified provider pilots;
48-72 months targets controlled executable contracts, predictive operations, and network economics;
72+ months targets circular recovery, cross-owner ecosystem effects, and international scale. Each
horizon depends on evidence, capacity, funding, customer pull, legal/regulatory review, and safety gates.

### Market and economic scenarios to validate

These figures are planning scenarios, not promises or accepted pricing. World Bank WDI API
`NY.GDP.MKTP.CD` for `WLD`, queried 2026-07-22, reported source last update 2026-07-13 and latest
world GDP values of about $118.35T for 2025 and $111.67T for 2024. UNEP's 2024 Global Status
Report for Buildings and Construction context records buildings/construction as material to global
emissions and energy demand; EPA records 600 million tons of U.S. construction and demolition debris
generated in 2018; WBDG/DOE facility guidance emphasizes that operations and maintenance are a major
facility-lifecycle responsibility. O&M cost ranges such as 60-85% must remain cited-context ranges,
not universal 90% claims.

Do not canonize "3% of world GDP uses BIM" until independently verified. Using the sourced 2025
world-GDP context of approximately $118.35T, the transparent planning math is:

| Scenario | Formula | Rounded governed-value output |
| --- | --- | --- |
| Conservative | $118.35T x 1% BIM-connected activity x 1% BIMLog penetration | approximately $11.835B |
| Base | $118.35T x 3% x 1% | approximately $35.505B |
| Stretch | $118.35T x 5% x 1% | approximately $59.175B |

The provisional $30B North Star and $50B stretch goal are deliberately rounded planning targets,
not forecasts, valuation, booked value, or accepted sales commitments. They sit inside the scenario
range so planning can stay ambitious without pretending precision.

Keep **governed value**, **asset value under management**, **O&M spend orchestrated**, and **BIMLog
revenue** separate. Monetization sensitivity is a hypothesis table only:

| Governed value scenario | 0.10% | 0.25% | 0.50% | 1.00% |
| --- | ---: | ---: | ---: | ---: |
| $30B governed value | $30M | $75M | $150M | $300M |
| $50B governed value | $50M | $125M | $250M | $500M |

These outputs are not revenue forecasts, accepted pricing, valuation, or booked revenue. Base
planning may use 0.25% and stretch 0.50% only as hypotheses subject to customer discovery,
willingness to pay, unit economics, retention, gross margin, and business-model validation.

Business-model options to validate include construction/project subscriptions; owner/operator
portfolio subscriptions; per active site/asset tiers; handover and asset-passport services;
IoT/BMS/CMMS/ERP integration; compliance, audit, and warranty recovery; contractor/supplier
network fees; controlled work-order transaction fees; circular material recovery and verification
fees; and enterprise/private deployment and data-governance services. No price, take rate, or
contract form is accepted until discovery and unit economics support it.

### Organizational excellence and adoption operating model

BIMLog's lifecycle roadmap should combine organizational excellence principles, continuous improvement,
change adoption, and recognized quality-management practices without implying certification, endorsement,
licensing, partnership, or current implementation.

- **EFQM:** organization-level excellence lens. Use EFQM to ask whether direction, execution, stakeholder
  value, transformation, performance, and results are aligned. EFQM is not BIMLog product certification, not
  a substitute for project or technical standards, and not a conformity claim. Verify the current official model
  and version at https://efqm.org/the-efqm-model/ before any formal adoption claim.
- **PHVA / PDCA:** PHVA (Planificar-Hacer-Verificar-Actuar) is the Spanish expression of PDCA (Plan-Do-Check-Act).
  Use it as the process-level continuous-improvement cycle: plan a bounded change, test it, verify evidence/results,
  then standardize/correct and repeat. ASQ's PDCA reference at https://asq.org/quality-resources/pdca-cycle informs
  the concept; BIMLog does not own PDCA and ASQ does not certify BIMLog's use.
- **Prosci ADKAR:** individual change-adoption lens: Awareness, Desire, Knowledge, Ability, Reinforcement. Use the
  official reference at https://www.prosci.com/methodology/adkar to plan and measure whether coordinators,
  owners, operators, contractors, suppliers, and field teams actually
  adopt a BIMLog capability. ADKAR is a Prosci model/trademark; branded operational templates, commercialization,
  training, certification claims, or copied proprietary content require licensing/trademark/training/use review.
- **ASQ-recognized practices:** ASQ is a professional quality body/resource authority, not a single competing
  framework. ASQ-recognized tools and bodies of knowledge may inform root-cause analysis, process measurement,
  corrective/preventive action, statistical thinking, and evidence discipline. Do not claim ASQ endorsement,
  certification, partnership, or conformity.

Layered use for lifecycle pilots and releases:

| Layer | BIMLog question |
| --- | --- |
| EFQM | Are organizational direction, execution, stakeholder value, and results aligned? |
| PHVA/PDCA | Are processes improved through bounded evidence-backed cycles? |
| ADKAR | Are affected individuals aware, willing, knowledgeable, able, and reinforced? |
| ASQ-recognized practices | Are quality methods, measurements, analysis, corrective action, and evidence rigorous? |
| BIMLog canonical records | Can every decision, change, adoption result, and improvement outcome be traced to authoritative evidence? |

Apply the model before, during, and after each lifecycle roadmap pilot: before, define the EFQM-aligned objective,
stakeholder outcome, and ADKAR readiness baseline; during, run a bounded PDCA implementation with quality measures
and evidence; after, verify operational KPI, adoption outcome, corrective action, reinforcement, and standardized
accepted practice. Failed adoption must not be mislabeled as product success merely because software shipped.

### North-star metrics

Metrics must be non-overlapping and anti-double-counted:

- **Annual Project Value Under Governance:** current-year construction/project contract value for
  projects whose records are governed by BIMLog. Source: project contract/budget authority. Do not
  double-count the same project across modules.
- **Annual Asset Value Under Management:** owner-approved replacement or insured value of assets
  with active BIMLog asset passports. Source: owner/asset register. Update at portfolio review.
- **Annual O&M Spend Orchestrated:** approved maintenance/work-order spend routed through BIMLog
  workflows. Source: approved work orders/invoices. Exclude project capex already counted above.
- **Verified asset passports:** assets with required identity, location, document, commissioning,
  obligation, and evidence fields complete. Source: asset-passport completeness gate.
- **Active buildings/sites/assets:** active entities with current governance, not archived history.
- **Maintenance obligations detected:** unique obligations extracted/entered and accepted by an
  authorized human. Do not count drafts or duplicates.
- **SLA compliance:** obligations completed within approved SLA, measured per obligation class.
- **Downtime and failures avoided:** estimated only where baseline, method, and confidence are recorded.
- **Warranty value recovered:** money/credit accepted under warranty; exclude merely identified claims.
- **Work orders completed:** accepted closeouts with evidence, inspection, and authorization.
- **Contractor/supplier network liquidity:** qualified provider coverage, response rate, quote depth,
  completion quality, and geographic availability.
- **Material reused/recycled and waste diverted:** measured by certificate/weight/value evidence.
- **Recovered financial value and carbon avoided:** scenario-based unless supported by verified method.
- **Recurring revenue, retention, gross margin, and effective monetization:** finance authority owns
  definitions and cadence; never mix with governed project value.

## 10D connected-record direction and delivery boundaries

BIMLog's approved direction extends the verified construction record across BIGDOTS 4D-through-10D+
dimensions. This is a connected-record strategy, not permission to clone records into parallel modules.
Meeting decisions should become traceable scheduled work by linking the meeting, its immutable decision
snapshot, the canonical source record, and the canonical Schedule Bucket/task. Cost & Financial Control is
the financial dimension: exact values, authority, approval, budget history, and construction relationships
must remain explainable together.

Telegram is an approved assistant, notification, and Delivery Concierge channel. Users control language,
AI use, notification preferences, channels, quiet hours, and each consequential external delivery. Accepted
Builds 1-5 provide secure linking, controlled AI foundations, bilingual support, delivery preparation, and
the Notification Center/outbox foundation; module adapters marked coming later are not shipped.

Tiered plans, add-ons, and user-controlled AI/channel preferences are approved product direction. Accepted
Entitlements Steps 1-2 provide the advisory catalog, resolver, policies, preferences, and support matrix;
they do not prove billing enforcement, Step 3, or every planned entitlement. Future dimensions must keep
one canonical identity, explicit relationships, and the verified record visible to the user.

## Roadmap design principle: spreadsheet-simple, twin-ready

BIMLog must stay as easy to understand as a spreadsheet with a matching folder of PDFs, while
quietly producing structured data that can power advanced BIM, AI, and owner operations.

- Every advanced feature must still produce clean tables, folders, PDFs, and Excel exports.
- Every record must answer: what is it, where is it, who owns it, what changed, why, when,
  and what is the current state.
- The user experience must reduce coordination work today, not only promise future digital
  twin value.
- AI should assist, explain, classify, summarize, and warn, but the user must always see the
  source record and the cost/credit implication when AI is used.
- BIMLog's data model should prepare owner handover by connecting RFIs, submittals,
  transmittals, change orders, viewpoints, clashes, companies, contacts, floors, trades,
  systems, documents, photos, reports, and audit history.

## Quality 4.0 direction
The Calidad 4.0 source material is now part of BIMLog's product doctrine, documented in
[QUALITY.md](./QUALITY.md) as operational quality requirements beneath
[ECOSYSTEM_DOCTRINE.md](./ECOSYSTEM_DOCTRINE.md). Its practical meaning for BIMLog is:

- Quality is not inspection at the end. Quality is a live operating system of people,
  process, data, technology, ethics, and continuous improvement.
- Technology does not replace judgment. AI, sensors, reports, automations, and dashboards
  must support human decisions and leave a clear audit trail.
- Data is the raw material of improvement. Dirty imports, disconnected records, unclear
  ownership, and misleading reports are quality failures, not cosmetic bugs.
- BIMLog must move coordination from reactive to preventive: flag missing data, stale
  records, overdue dates, chain inconsistencies, unclear responsibility, and report
  contamination before they reach the client.
- Every feature should produce immediate field value and future digital-twin value at the
  same time.
- Interoperability is a product requirement: RFIs, submittals, transmittals, change orders,
  schedule, files, directory, clashes, Lens viewpoints, PDFs, Excel, and APIs must speak the
  same project language.
- Every important record should be hashable, reproducible, explainable, and suitable for
  future immutable anchoring through DLT or smart-contract workflows.

## CERQA / digital twin positioning
CERQA validates the market direction: owners want a building data platform that combines
models, documents, scans, photos, field records, systems, analytics, and portfolio views.
BIMLog should not copy that whole product immediately. BIMLog's wedge is earlier and more
practical: construction coordination operations.

CERQA is owner/operator-first. BIMLog is coordinator/contractor-first, with a natural path
to owner handover and asset intelligence.

BIMLog can eventually compete with and surpass CERQA if it owns the upstream verified record:

- CERQA-style platforms depend on clean building data after the fact.
- BIMLog creates that clean data during the actual coordination and construction workflow.
- BIMLog can link a model issue to a viewpoint, RFI, submittal, transmittal, change order,
  responsible company, field photo, report, and final resolution.
- That chain is more valuable than a model viewer alone because it proves decisions, custody,
  responsibility, and history.

Long-term target: BIMLog becomes the construction memory layer for the building. From there,
it can expand into owner digital twins, portfolio dashboards, facility handover, asset
records, field verification, IoT, GIS, energy, sustainability, and operations.

## Strategic sequence
1. Win construction coordination first: Navisworks, RFIs, submittals, transmittals, change
   orders, reports, Excel, PDFs, and audit trails.
2. Make every module produce structured, exportable, owner-ready records.
3. Add intelligence that helps users find risk, missing data, overdue work, and conflicts.
4. Build handover packages from verified construction records.
5. Expand into digital twin operations once the data foundation is trusted.

## Ecosystem roadmap context

Current ecosystem identity and entity boundaries are governed by
[ECOSYSTEM_DOCTRINE.md](./ECOSYSTEM_DOCTRINE.md). The summary below provides roadmap context
only and must be reconciled to that doctrine when identity changes.

- BIMCapital Partners INC (USA) is the holding company that receives all revenue.
- IgniteSmart is the commercial brand. It sells BIMLog and ACCA software in Bolivia.
- BIMInvest IBC (Panama) owns UrbanInvest, a real estate tokenization platform with 51 active
  transactions and 20+ investors.
- RR and Asociados is the legal arm. Future connection: RR-AI legal document factory powered
  by AI.
- BIMTechCorp provides BIM services delivery.
- BIGDOTS is Roberto's proprietary framework: BIM 4D through 10D+, IoT, GIS, DLT, smart
  contracts, and AI. It is the architectural DNA of the full ecosystem.

## Reference projects
- IBQ: $450M lithium plant, Bolivia, 18 ECEC disciplines. Sample/reference project for
  complex convention and AI testing. Not a live client; used to stress-test the platform in
  a complex environment.
- ELARA EAST: 1185 River Ave, Bronx NY. Ruben's live project. Project 26 / ELA01 has driven
  the first real workflow. Ruben is a Founding Partner.
- ELARA EAST / Ruben's active production work will continue validating submittals, RFIs,
  schedule, reports, Navisworks plugin workflows, and owner-facing deliverables.

## The full 5-layer agent architecture
BIMLog runs itself like a company. Agents operate at five layers continuously.

- Layer 0 - Sensors: always on, no interpretation, just facts.
  Clash Sensor, Document Sensor, RFI Sensor, Submittal Sensor, Schedule Sensor,
  Compliance Sensor, Financial Sensor, Lens Sensor, Platform Health Sensor, Growth Sensor,
  Revenue Sensor, Legal Sensor, Investment Sensor.
- Layer 1 - Analysts: interpret sensor data, find patterns, make recommendations.
  Coordination Analyst, Risk Analyst, Performance Analyst, Financial Analyst, Legal Analyst,
  Product Analyst, Growth Analyst, BizDev Analyst, Investment Intelligence Analyst.
- Layer 2 - Department Heads: synthesize analysts and own their domain.
  Chief Coordination Officer, Chief Risk Officer, Chief Legal Officer, Chief Financial
  Officer, Chief Product Officer, Chief Growth Officer.
- Layer 3 - Project CEO: one per project. Synthesizes all department heads and generates the
  project-level morning briefing. Ruben sees this.
- Layer 4 - Platform CEO: across all projects. Synthesizes all Project CEOs and generates the
  IgniteSmart product intelligence briefing.
- Layer 5 - BIMCapital CEO: across the full ecosystem. Synthesizes the Platform CEO plus
  external signals and generates Roberto's master briefing.

## Three audiences, one data layer, role-filtered briefings
- Ruben's briefing: coordination status, P1/P2 clashes, overdue RFIs, submittal risks,
  schedule pressure, and actions by responsible company.
- IgniteSmart briefing: active projects, feature usage, support risk, churn signals, founding
  partner opportunities, onboarding friction, and product gaps.
- Roberto's briefing: full ecosystem view, including platform health, legal exposure,
  investment opportunities, business development, and cross-company strategy.

## New DB tables needed for the agent architecture
- agent_sensors: raw events from all sensors.
- agent_reports: department head synthesis outputs.
- agent_briefings: CEO-level briefings per audience per user.
- agent_heartbeats: tracks when each agent last ran and its health.
- agent_escalations: urgent items that bypass the hierarchy for immediate alert.

## Future interconnections
- RR-AI: the Legal Analyst Agent feeds verified clash/delay evidence to the legal document factory.
- UrbanInvest: the Investment Intelligence Agent flags projects ready for tokenization.
- IoT: the Sensors layer gets real-time physical data from site devices.
- Smart contracts: the Financial Intelligence Agent triggers payment verification on milestone
  completion.
- GeoTwin / BIM 10D: the Risk Analyst gets real-world site conditions, creating a living
  digital twin of every built asset.
- ACTA-SC: a governance layer for public-sector projects and anti-corruption transparency.

## The 25 planned Navisworks plugin features
1. Bulk AI Triage: 7000 clashes sorted P1-P5 in minutes.
2. Clash Fingerprinting: detects new vs reopened clashes on reruns.
3. Trade Responsibility Auto-Assignment.
4. Coordination Meeting Agenda Button.
5. Resolution Verification: no clash closes without linked proof.
6. Clash Aging Warnings.
7. Clash Relationships: groups related hits into parent/child issues.
8. What-If Mode: AI predicts which clashes a proposed fix resolves.
9. Clash History Timeline: the full life of every clash.
10. Clash Heatmap: visual floor plan overlay.
11. Clash to RFI One Click: pre-fills an RFI from clash data.
12. Natural Language Search across all clashes.
13. Clash Prediction before detection runs.
14. Clash Cost Impact: estimates field rerouting cost.
15. Contractor Scorecards: response time, clashes caused vs resolved.
16. Model Progress Score: coordination completion per floor per trade.
17. Clash Camera Fly-Through: auto MP4 for coordination meetings.
18. Voice Notes: speak a note, AI transcribes and attaches.
19. Offline Mode: queues locally, syncs on reconnect.
20. Subcontractor Portal: each trade sees only their issues.
21. Clash Report Watermarking: branded, timestamped PDFs.
22. Standards Alignment Agent: evaluates scoped alignment using the verified metadata, evidence
    expectations, and claim restrictions in [STANDARDS_REGISTER.md](./STANDARDS_REGISTER.md).
23. Digital Twin Handover: coordination decisions become owner-ready building memory.
24. BIMLog Mobile: field access, photo attach, mark resolved on site.
25. Auto-Update: plugin checks for updates on startup.

## Competitive positioning
BIMLog beats BIMcollab because it works with Navisworks locally with no ACC subscription
needed, has true bidirectional sync via the plugin, links clash to RFI to submittal to
transmittal to change order, has AI agents watching the work, works for the small GC through
the large ACC shop, and costs a fraction of ACC with deeper coordination intelligence.

BIMLog does not need to beat CERQA on day one. It can beat CERQA long-term by owning the
construction record before the asset becomes an operating building. If BIMLog becomes the
place where the truth is created, CERQA-style owner operations become a downstream expansion,
not a separate unreachable market.

## Business model
- Freemium: 1 project free for 3 months. Data is never lost on expiry.
- Premium: all modules, unlimited projects, PDF/Excel exports, and controlled AI assistance.
- Enterprise: white-label, dedicated onboarding, SLA, full API, PowerBI connector, advanced
  AI usage controls, and owner handover packages.
- Founding Partner Program: locked pricing for 36 months, co-branded, roadmap input, minimum
  3 projects in 6 months.
- BIMLog Performance Score and Compliance Badge: a verified reputation system for subs and GCs.
- Future Owner Twin tier: portfolio dashboards, asset records, handover archive, facility
  integrations, field verification, and digital twin operations.

## Where we are going
- Stabilize the construction coordination core until it is clean, reliable, and professional.
- Make submittals, RFIs, schedule, reports, files, companies, contacts, and Navisworks workflows
  feel like one connected operating system, not separate tabs.
- Move the agent system from today's foundational agents toward the full 5-layer organization.
- Deliver the three-audience briefing model so each stakeholder sees exactly their layer.
- Convert verified construction activity into owner-ready handover intelligence.
- Connect BIMLog outward into the BIMCapital ecosystem as the coordination backbone and future
  digital twin memory layer.
