# QUALITY.md - BIMLog Quality 4.0 Doctrine

This document translates the Calidad 4.0 source material into BIMLog's build doctrine.
The original PDFs are Spanish scanned source documents; this Living Brief entry is the
English operational version for BIMLog, IgniteSmart, BIMCapital, and all AI development
partners.

## Source
- Calidad 4.0 Part 1.pdf: 120 scanned pages.
- Calidad 4.0 Part 2.pdf: 36 scanned pages.
- OCR extraction completed page by page on July 8, 2026.
- Local OCR text lives in:
  `C:\Users\soporte\Desktop\BIMLog Version 1.60.6\_extracted`.

## Core Interpretation
Calidad 4.0 is not a separate theory from BIMLog. It is the operating philosophy behind
how BIMLog should be built.

The central idea is that quality has evolved from inspection, to assurance, to total
quality, and now to connected digital quality. In Quality 4.0, quality is not a department
and not a final report. It is a live system of people, process, data, technology, ethics,
and continuous improvement.

For BIMLog, that means every module must do more than store records. Every module must
help the user make better decisions with clean, traceable, connected, exportable, and
auditable construction data.

## BIMLog Quality Law
BIMLog must stay spreadsheet-simple for field users while quietly producing data that is
twin-ready, audit-ready, report-ready, and AI-ready.

Every feature must answer:
- What is the record?
- Where is it in the project?
- Who owns it?
- Who is responsible?
- What changed?
- Why did it change?
- When did it happen?
- What is the current state?
- What proof is attached?
- What decision should happen next?

If a feature cannot answer those questions, it is not finished.

## Human First, Digital Second
The Calidad 4.0 material is clear: technology amplifies quality but does not replace human
judgment. AI, sensors, dashboards, blockchain, digital twins, and automation only create
value when they support responsible decisions.

BIMLog must therefore:
- Keep users in control of final decisions.
- Show sources and evidence behind AI assistance.
- Separate low-cost text assistance from expensive file-reading AI.
- Warn users before consuming AI credits.
- Keep every automated action auditable.
- Avoid silent fallbacks that make the system look correct when it failed.
- Design workflows that reduce confusion for real users like Ruben, not just impress in demos.

## Data as the Raw Material of Quality
Calidad 4.0 treats data as the raw material of improvement. BIMLog must treat project data
the same way.

Required BIMLog behavior:
- Data must be structured at entry, not cleaned only at export.
- Reports, PDFs, Excel, dashboards, and AI must all read the same source records.
- UI fields must use human labels, never raw database names.
- Imports must normalize data into reusable project structures.
- Exports must be client-ready without manual cleanup.
- History must be scoped, understandable, and useful, not dirty noise.
- Deleted test data must not contaminate real reports.
- Lineage must be preserved whenever an item is edited, reassigned, voided, resolved, or superseded.

## Traceability and Auditability
The source material repeatedly connects Quality 4.0 with traceability, transparency,
cybersecurity, ethics, and reliable evidence.

BIMLog must make traceability visible:
- RFIs need custody, sent status, responses, attachments, linked records, and final resolution.
- Submittals need submitted by, submitted to, responsible company, ball in court, due dates,
  product data, attachments, review responses, revision history, and exportable logs.
- Lens viewpoints need active state, revision, supersedes/superseded-by, group, floor, trade,
  report type, responsible company, and Navisworks sync state.
- Schedule items need source type, due date, responsible party, status, and source record link.
- Every PDF must fingerprint the data snapshot.
- Every material change must leave an activity trail.

Traceability should not make the UI heavy. The main table should stay clean; deep evidence
belongs in details, history, reports, and audit panels.

## Interoperability
Calidad 4.0 emphasizes that systems create real value only when they talk to each other.
BIMLog must avoid isolated tabs.

Required interconnections:
- RFI, submittal, transmittal, change order, schedule, files, directory, clash reports, and
  Lens viewpoints must be linkable.
- Schedule should pull live due dates from RFIs and submittals instead of requiring duplicate entry.
- Submittal Tracker should be a live view inside Submittals, not a disconnected product.
- Navisworks plugin data and platform data must share the same display contract.
- Responsible company/contact should reuse the project directory.
- Files and attachments should belong to the same record graph used by reports and AI.

## Predictive and Preventive Quality
Calidad 4.0 moves quality from reactive inspection to predictive prevention. BIMLog should
move in that direction module by module.

Near-term examples:
- Flag missing due dates, missing companies, missing attachments, and unresolved ball-in-court.
- Detect stale RFIs and overdue submittals.
- Warn when a report is about to include superseded, voided, or dirty test history.
- Detect viewpoint chain inconsistencies before PDF export.
- Show schedule pressure by floor, trade, company, and week.
- Identify repeated responsible-company issues.

Long-term examples:
- Predict which RFIs and submittals are likely to become delays.
- Score contractor response performance.
- Recommend coordination meeting agenda items.
- Generate project CEO briefings from live project data.
- Feed owner handover and digital twin operations from verified construction records.

## Digital Twin Direction
The source material discusses digital twins, IoT, simulation, augmented reality, blockchain,
and integrated data ecosystems. BIMLog's path is practical: build the verified construction
record first, then expand into owner operations.

BIMLog should become the construction memory layer:
- Viewpoints, clashes, RFIs, submittals, files, photos, reports, companies, contacts, floors,
  trades, systems, costs, dates, and decisions become the evidence graph.
- That evidence graph becomes the foundation for owner handover.
- Owner handover becomes the foundation for digital twins, portfolio dashboards, facilities
  intelligence, energy, IoT, GIS, legal evidence, and asset lifecycle management.

This is how BIGDOTS becomes practical inside BIMLog: BIM 4D through 10D+ is not a slogan;
it is a connected decision system built from trustworthy records.

## Blockchain / Immutable Evidence Direction
Calidad 4.0 treats blockchain and distributed ledgers as tools for trust and traceability,
not as decoration.

BIMLog should not rush blockchain features. First, the platform must produce clean,
consistent, auditable records. Later, high-value events can be fingerprinted or anchored:
- report snapshots,
- dispute evidence,
- signed approvals,
- handover packages,
- compliance certificates,
- payment milestones,
- public-sector transparency records.

The immediate rule is simple: every important record must be hashable, reproducible, and
explainable before it can ever be anchored externally.

## AI Quality Rules
AI must be used as a controlled quality assistant, not as a magic black box.

Rules:
- AI suggestions must be optional unless explicitly approved by product design.
- AI usage must be logged by user, project, feature, billing mode, and credit unit.
- Super admin must see AI cost and usage across all users.
- Users should see their own AI usage and know when a feature may consume credits.
- Cheap text assistance and expensive file reading must be separate buttons.
- AI-generated text must be editable before save.
- AI must never hide missing data, failed uploads, failed imports, or uncertain matches.
- AI outputs must preserve source links when possible.

## User Experience Quality
Quality 4.0 fails if users cannot operate the system. BIMLog must be professional,
predictable, and self-explaining.

Each workflow should have:
- obvious primary action,
- clear back/navigation path,
- editable record details,
- attachments where users naturally expect them,
- linked records where decisions depend on other modules,
- client-ready PDF and Excel exports,
- guidance that can be turned on/off,
- no duplicate counters,
- no misleading success messages,
- no disconnected "views" that only look at data but cannot act on it.

If a screen only displays data and the user cannot understand what to do next, it is not a
finished screen.

## Implementation Method
Use this sequence for every meaningful feature:
1. Define the real field workflow.
2. Define the structured data contract.
3. Define the current state and history model.
4. Define the required links to other modules.
5. Define the PDF and Excel output.
6. Define the user guidance and error states.
7. Define the audit/activity events.
8. Define the AI assist option, if useful.
9. Build in small verified steps.
10. Run tests, mojibake scan, build, and targeted UI review.

## Quality 4.0 Build Checklist
Before calling a feature done, verify:
- It works from empty state.
- It works with real imported data.
- It works after browser refresh.
- It works after publish/rebuild.
- It has no mock data.
- It fails loudly on real errors.
- It has professional empty states.
- It has edit, delete/void/close, and history where the workflow requires them.
- It has PDF output if the module is reportable.
- It has Excel output if users will manage tabular work.
- It respects filters in exports.
- It logs activity.
- It links to related modules.
- It has clean UTF-8 text.
- It passes `pnpm run check:mojibake`.
- It does not create duplicate, contradictory counters.
- It does not create dirty historical report data.

## Where This Changes BIMLog
Calidad 4.0 turns BIMLog from a collection of coordination modules into a quality operating
system for construction.

Immediate product impact:
- Submittals must be unified: Submittals, Register, and Tracking Table are views of one module.
- Schedule must become a live coordination schedule for RFI, submittal, model, meeting, and
  milestone dates.
- Lens must keep platform and Navisworks aligned with clear current/history organization.
- Reports must be clean, scoped, filtered, and client-ready.
- AI must be metered, visible, optional, and useful.
- Analytics must surface risk and missing information, not just static counts.

Long-term impact:
- BIMLog becomes the verified construction record.
- The verified construction record becomes owner handover.
- Owner handover becomes the digital twin memory layer.
- The digital twin memory layer becomes the foundation for BIGDOTS, RR-AI, UrbanInvest,
  legal evidence, smart contracts, IoT, GIS, ESG, and portfolio intelligence.

## Guiding Sentence
Build BIMLog so every construction decision becomes structured evidence, every piece of
evidence becomes useful knowledge, and every useful insight helps people act earlier,
clearer, and with less risk.

## Open Loop Control - Mandatory Quality Gate

Customer feedback is now treated as a quality record, not as chat memory.
Every request, bug, complaint, or workflow gap that changes product behavior must be captured in STATUS.md under the Open Loop Register until closed.

Allowed states:
- Shipped: code/docs/package were built and committed.
- Verified: the real workflow was tested after publish/package by Roberto or the customer.
- Deferred: intentionally not built now, with a reason.
- Rejected: not aligned with BIMLog, with a reason.

Rules:
- Do not call a customer item done just because code was written.
- Do not leave a feature half-built without adding it to the Open Loop Register.
- Do not build a second disconnected version of something that already exists.
- Before adding UI, search for the existing module, route, schema, export, PDF, and activity-log paths.
- Before changing reports, verify the live table filter, PDF output, Excel output, and history scope use the same records.
- Before changing AI behavior, verify credit/cost visibility and whether the action is cheap text assist or expensive file/file-reading assist.
- Before changing plugin behavior, verify both Navisworks 2021 and 2025 source copies or explicitly state which one was changed.
- If a user complaint exposes a wider pattern, update QUALITY.md or STATUS.md so the same mistake is not repeated.

Customer feedback closeout checklist:
- What exactly did the customer ask for?
- Which module owns it?
- Does an existing feature already cover part of it?
- What code paths were changed?
- What exports/reports were affected?
- What was verified locally?
- What still needs publish/package/customer verification?
- Where is the user-facing brief or release note?

This is the prevention mechanism for limbo work: no invisible backlog, no forgotten widget, no orphaned feature, no duplicate workflow.
Additional enforcement:
- The Open Loop Register in STATUS.md is the source of truth for unfinished customer feedback.
- A feature is not ready for customer retest until code, exports/reports, guidance, release note, commit/push, publish/package status, and real workflow verification are accounted for.
- If a request includes multiple examples, extract the underlying category and audit the whole category, not only the first example.
