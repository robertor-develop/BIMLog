# VISION.md - Product Vision and Agent Architecture

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

## Product law: spreadsheet-simple, twin-ready
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

## Quality 4.0 doctrine
The Calidad 4.0 source material is now part of BIMLog's product doctrine, documented in
QUALITY.md. Its practical meaning for BIMLog is:

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

## The ecosystem - BIMCapital Partners INC
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
22. ISO 19650 Compliance Agent: continuous monitoring.
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
