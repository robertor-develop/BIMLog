# VISION.md — Product Vision and Agent Architecture

## The big idea
BIMLog should run itself like a company. It is not just a coordination tool; it is the
operating system for construction coordination, with an agent organization that watches,
interprets, decides, and reports — autonomously — across every project and across the full
BIMCapital ecosystem. Agents operate continuously at five layers, not triggered by users.

## The ecosystem — BIMCapital Partners INC
- BIMCapital Partners INC (USA) is the holding company that receives all revenue.
- IgniteSmart is the commercial brand — sells BIMLog and ACCA software in Bolivia.
- BIMInvest IBC (Panama) owns UrbanInvest — a real estate tokenization platform — 51 active
  transactions, 20+ investors.
- RR and Asociados is the legal arm — future connection: RR-AI legal document factory powered
  by the Claude API.
- BIMTechCorp provides BIM services delivery.
- BIGDOTS is Roberto's proprietary framework: BIM 4D through 10D+, IoT, GIS, DLT, smart
  contracts, AI — the architectural DNA of the entire ecosystem.

## Reference projects
- IBQ — $450M lithium plant, Bolivia — 18 ECEC disciplines — sample/reference project for
  complex convention and AI testing. NOT a live client; used to stress-test the platform in
  a complex environment.
- ELARA EAST — 1185 River Ave, Bronx NY — Ruben's live project — Project 26 — ELA01 — drives
  every feature we build today. Ruben is a Founding Partner.

## The full 5-layer agent architecture
BIMLog runs itself like a company. Agents operate at five layers continuously.

- Layer 0 — Sensors (always on, no interpretation, just facts):
  Clash Sensor, Document Sensor, RFI Sensor, Submittal Sensor, Schedule Sensor,
  Compliance Sensor, Financial Sensor, Lens Sensor, Platform Health Sensor, Growth Sensor,
  Revenue Sensor, Legal Sensor, Investment Sensor.
- Layer 1 — Analysts (interpret sensor data, find patterns, make recommendations):
  Coordination Analyst, Risk Analyst, Performance Analyst, Financial Analyst, Legal Analyst,
  Product Analyst, Growth Analyst, BizDev Analyst, Investment Intelligence Analyst.
- Layer 2 — Department Heads (synthesize analysts, own their domain):
  Chief Coordination Officer, Chief Risk Officer, Chief Legal Officer, Chief Financial
  Officer, Chief Product Officer, Chief Growth Officer.
- Layer 3 — Project CEO (one per project): synthesizes all department heads, generates the
  project-level morning briefing. Ruben sees this.
- Layer 4 — Platform CEO (across all projects): synthesizes all Project CEOs, generates the
  IgniteSmart product intelligence briefing.
- Layer 5 — BIMCapital CEO (across the entire ecosystem): synthesizes the Platform CEO plus
  external signals, generates Roberto's master briefing.

## Three audiences — one data layer — role-filtered briefings
- Ruben's briefing: coordination status, P1/P2 clashes, overdue RFIs, submittal risks.
- IgniteSmart briefing: active projects, feature usage, churn signals, founding partner
  opportunities.
- Roberto's briefing: the full ecosystem — platform health + legal exposure + investment
  opportunities + business development.

## New DB tables needed for the agent architecture
- agent_sensors — raw events from all sensors.
- agent_reports — department head synthesis outputs.
- agent_briefings — CEO-level briefings per audience per user.
- agent_heartbeats — tracks when each agent last ran and its health.
- agent_escalations — urgent items that bypass the hierarchy for immediate alert.

## Future interconnections (vision — not built yet)
- RR-AI: the Legal Analyst Agent feeds verified clash/delay evidence to the legal document factory.
- UrbanInvest: the Investment Intelligence Agent flags projects ready for tokenization.
- IoT: the Sensors layer gets real-time physical data from site devices.
- Smart contracts: the Financial Intelligence Agent triggers payment verification on milestone
  completion.
- GeoTwin / BIM 10D: the Risk Analyst gets real-world site conditions — a living digital twin
  of every built asset.
- ACTA-SC: a governance layer for public-sector projects — anti-corruption transparency.

## The 25 planned Navisworks plugin features
1. Bulk AI Triage — 7000 clashes sorted P1-P5 in minutes.
2. Clash Fingerprinting — detects NEW vs REOPENED on reruns.
3. Trade Responsibility Auto-Assignment.
4. Coordination Meeting Agenda Button.
5. Resolution Verification — no clash closes without a linked RFI or submittal.
6. Clash Aging Warnings.
7. Clash Relationships — groups related hits into parent/child.
8. What-If Mode — AI predicts which clashes a proposed fix resolves.
9. Clash History Timeline — the full life of every clash.
10. Clash Heatmap — visual floor plan overlay.
11. Clash to RFI One Click — pre-fills an RFI from clash data.
12. Natural Language Search across all clashes.
13. Clash Prediction — AI predicts before detection runs.
14. Clash Cost Impact — estimates field rerouting cost.
15. Contractor Scorecards — response time, clashes caused vs resolved.
16. Model Progress Score — coordination completion per floor per trade.
17. Clash Camera Fly-Through — auto MP4 for coordination meetings.
18. Voice Notes — speak a note, AI transcribes and attaches.
19. Offline Mode — queues locally, syncs on reconnect.
20. Subcontractor Portal — each trade sees only their clashes.
21. Clash Report Watermarking — branded, timestamped PDFs.
22. ISO 19650 Compliance Agent — continuous monitoring.
23. Digital Twins Integration — coordination decisions become project DNA.
24. BIMLog Mobile — field access, photo attach, mark resolved on site.
25. Auto-Update — plugin checks for updates on startup.

## Competitive positioning
BIMLog beats BIMcollab because it works with Navisworks locally with no ACC subscription
needed, has true bidirectional sync via the plugin, links clash to RFI to Submittal to Change
Order, has AI agents watching everything continuously, works for the small GC through the large
ACC shop, and costs a fraction of ACC with 10x the features.

## Business model
- Freemium: 1 project free for 3 months — data is never lost on expiry.
- Premium: all modules, unlimited projects, PDF exports, AI agents.
- Enterprise: white-label, dedicated onboarding, SLA, full API, PowerBI connector.
- Founding Partner Program: locked pricing for 36 months, co-branded, roadmap input, minimum
  3 projects in 6 months.
- BIMLog Performance Score and Compliance Badge: a verified reputation system for subs and GCs.

## Where we are going
- Move the agent system from today's foundational agents toward the full 5-layer org.
- Make every department head autonomous within guardrails, escalating only when needed.
- Deliver the three-audience briefing model so each stakeholder sees exactly their layer.
- Connect BIMLog outward into the BIMCapital ecosystem as the coordination backbone.
