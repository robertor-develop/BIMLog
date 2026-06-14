# VISION.md — Product Vision and Agent Architecture

## The big idea
BIMLog should run itself like a company. It is not just a coordination tool; it is the
operating system for construction coordination, with an agent organization that watches,
interprets, decides, and reports — autonomously — across every project and across the full
BIMCapital ecosystem.

## The 5-layer agent system
- Layer 0 — Sensors: watch everything that happens on the platform (uploads, clashes,
  RFIs, submittals, status changes, schedule slips, plugin syncs). They emit raw signals.
- Layer 1 — Analysts: interpret signals into meaning (is this clash critical? is this RFI
  overdue? is approval happening too fast to be real?).
- Layer 2 — Department Heads: own a domain end to end (Clash Coordination, RFI Management,
  Submittals, Schedule, Documents). They make domain decisions and escalate.
- Layer 3 — Project CEO: one per project. Synthesizes all department heads into a single
  project-level intelligence and accountability picture.
- Layer 4 — Platform CEO: across all projects. Owns product-level intelligence for the
  IgniteSmart team — what is working, what is failing, where to invest.
- Layer 5 — BIMCapital CEO: across the full ecosystem. The executive layer for Roberto.

## Three audiences, three briefings
- Ruben (field/coordination): project coordination intelligence — what needs attention now.
- IgniteSmart team (product): platform product intelligence — adoption, reliability, gaps.
- Roberto (executive): the full BIMCapital executive picture across the ecosystem.

## The BIMCapital ecosystem (future connections)
BIMLog is one node in a larger system. Planned/eventual connections:
- RR-AI — the intelligence layer / assistant fabric.
- UrbanInvest — investment and development side.
- IoT — live building/site sensor data feeding back into coordination.
- GeoTwin — geospatial digital twin integration.
- Smart contracts — automated, on-chain settlement of milestones/obligations.

## Where we are going
- Move the agent system from today's foundational agents toward the full 5-layer org.
- Make every department head autonomous within guardrails, escalating only when needed.
- Deliver the three-audience briefing model so each stakeholder sees exactly their layer.
- Connect BIMLog outward into the BIMCapital ecosystem as the coordination backbone.
