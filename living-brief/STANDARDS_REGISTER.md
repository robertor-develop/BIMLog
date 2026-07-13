# STANDARDS_REGISTER.md - BIMLog Verified Standards Register

Last updated: 2026-07-13
Owner: Roberto Rodriguez
Status: Active controlled register
Purpose: Maintain verified standards metadata, BIMLog relevance, evidence expectations, and
claim restrictions without turning conceptual similarity into a conformity claim.
Authority: Subordinate to `ECOSYSTEM_DOCTRINE.md`. This register owns standards research; it
does not replace roadmap, acceptance, agent, plugin, visual, current-state, open-work, or audit
documents.

## Verification, classification, and claims

Metadata was checked on 2026-07-13 against direct ISO catalog pages, buildingSMART International
standards pages, and National Institute of Building Sciences NBIMS-US pages. An official catalog
entry establishes identity, edition, and publication status; it does not prove BIMLog has
implemented the standard. If an official page did not expose exact current version metadata, the
entry says **verification incomplete** and is not an implementation requirement.

Standards alignment is not certification or a claim of complete compliance. Evidence maturity is
controlled as **conceptual relevance**, **designed alignment**, **implemented control**,
**verified implementation**, **audited conformity**, then **certification**. Only the highest
state supported by scoped objective evidence may be stated. This register establishes conceptual
relevance only unless an entry explicitly cites stronger evidence.

Classifications are **Core/current alignment** (present doctrine or control design), **Near-term
enabling alignment** (concrete candidate for scoped design and acceptance), **Strategic/future
reference** (documented future direction), **Monitor only** (awareness, no requirement), and
**Not applicable after verified review** (official scope does not fit present BIMLog use).

Every restriction below prohibits claims of implementation, complete compliance, audited
conformity, or certification unless a named scope, control map, objective evidence, appropriate
independent assessment, and Roberto's authorization support that exact claim.

## Registered standards

### 1. ISO 8000-1:2022 — Data quality — Part 1: Overview

- **Publisher / edition / status / source:** ISO; edition 1, published 2022-04, current (confirmed
  2024); [official catalog](https://www.iso.org/standard/81745.html), verified 2026-07-13.
- **Classification / relevance / scope:** **Core/current alignment** for trustworthy project
  memory and master data; affects identities, projects, linked records, imports, exports, audit,
  and handover.
- **Evidence / gap:** quality rules, provenance, validation, duplicate/correction controls, and
  export tests are expected. No part-by-part family mapping exists.
- **Permitted claim / restriction:** "ISO 8000-1 is a core BIMLog data-quality reference."
  Conceptual relevance only; no stronger claim under the register-wide restriction.

### 2. ISO 9001:2015 — Quality management systems — Requirements

- **Publisher / edition / status / source:** ISO; edition 5, published 2015-09, current with
  Amendment 1:2024 and marked for revision; [official catalog](https://www.iso.org/standard/62085.html),
  verified 2026-07-13.
- **Classification / relevance / scope:** **Core/current alignment** for process control,
  corrective action, evidence, and improvement; affects quality records, RFIs, submittals,
  changes, meetings, approvals, audit, reports, and acceptance.
- **Evidence / gap:** controlled procedures, roles, nonconformity/corrective-action trails,
  measures, reviews, and outcomes are expected. No QMS conformity assessment is recorded.
- **Permitted claim / restriction:** "BIMLog's quality design references ISO 9001 concepts."
  Conceptual relevance only; it is not a product or organizational conformity claim.

### 3. ISO 14001:2026 — Environmental management systems — Requirements with guidance for use

- **Publisher / edition / status / source:** ISO; edition 4, published 2026-04, current;
  [official ISO committee page](https://committee.iso.org/standard/14001), verified 2026-07-13.
- **Classification / relevance / scope:** **Strategic/future reference** for environmental
  information, impacts, obligations, reporting, asset handover, and lifecycle links.
- **Evidence / gap:** defined scope, aspects, obligations, controls, objectives, monitoring, and
  reviews would be required; none is a current BIMLog implementation requirement.
- **Permitted claim / restriction:** "ISO 14001 is a strategic reference for future environmental
  records." No environmental-management-system claim.

### 4. ISO 45001:2018 — Occupational health and safety management systems — Requirements with guidance for use

- **Publisher / edition / status / source:** ISO; edition 1, published 2018-03, current (confirmed
  2024), Amendment 1:2024, marked for revision;
  [official catalog](https://www.iso.org/standard/63787.html), verified 2026-07-13.
- **Classification / relevance / scope:** **Strategic/future reference** for accountable safety
  information; affects future observations, incidents, actions, meetings, reports, and handover.
- **Evidence / gap:** organizational scope, hazard/risk processes, consultation, controls,
  competence, response, and review would be required. No assessed OH&S system exists.
- **Permitted claim / restriction:** "ISO 45001 informs future safety-record concepts." No field
  safety, system conformity, or stronger claim.

### 5. ISO/IEC 27001:2022 — Information security, cybersecurity and privacy protection — Information security management systems — Requirements

- **Publisher / edition / status / source:** ISO/IEC; edition 3, published 2022-10, current with
  Amendment 1:2024; [official catalog](https://www.iso.org/standard/27001), verified 2026-07-13.
- **Classification / relevance / scope:** **Core/current alignment** for project records,
  identities, integrations, exports, and operations; affects access, tenancy, APIs, plugins,
  logs, backups, incidents, suppliers, and releases.
- **Evidence / gap:** ISMS scope, risk treatment, selected controls, operating evidence, internal
  audit, and management review are expected. Product features do not prove an ISMS.
- **Permitted claim / restriction:** "ISO/IEC 27001 is a core information-security control
  reference." Conceptual relevance only; no ISMS claim.

### 6. ISO/IEC 27701:2025 — Information security, cybersecurity and privacy protection — Privacy information management systems — Requirements and guidance

- **Publisher / edition / status / source:** ISO/IEC; edition 2, published 2025-10, current;
  [official catalog](https://www.iso.org/standard/27701), verified 2026-07-13.
- **Classification / relevance / scope:** **Core/current alignment** for accountable personal-data
  treatment; affects identities, permissions, audit, notifications, telemetry, support, exports,
  retention, suppliers, and privacy requests.
- **Evidence / gap:** PIMS scope, roles, inventory, purposes, notices, rights, retention,
  transfers, incidents, suppliers, and reviews are expected. No PIMS assessment is recorded.
- **Permitted claim / restriction:** "ISO/IEC 27701 is a core privacy-management reference."
  Conceptual relevance only; no PIMS or legal-compliance claim.

### 7. ISO/IEC 30141:2024 — Internet of Things (IoT) — Reference architecture

- **Publisher / edition / status / source:** ISO/IEC; edition 2, published 2024-08, current and
  marked for revision; [official catalog](https://www.iso.org/standard/88800.html), verified
  2026-07-13.
- **Classification / relevance / scope:** **Strategic/future reference** for IoT and digital twins;
  affects future device identity, sensor ingestion, events, asset links, integrations, and handover.
- **Evidence / gap:** architecture, trust boundaries, device/data lifecycle, semantics, security,
  resilience, and interface tests are expected. No production IoT architecture is evidenced.
- **Permitted claim / restriction:** "ISO/IEC 30141 is a future IoT architecture reference."
  No implemented-architecture or interoperability claim.

### 8. ISO 23257:2022 — Blockchain and distributed ledger technologies — Reference architecture

- **Publisher / edition / status / source:** ISO; edition 1, published 2022-02, current and marked
  for revision; [official catalog](https://www.iso.org/standard/75093.html), verified 2026-07-13.
  The official publisher corrects the joint-publisher label in the candidate list.
- **Classification / relevance / scope:** **Not applicable after verified review** to present
  BIMLog. Possible future evidence anchoring, smart-contract, investment, or transparency links
  need separate authorization.
- **Evidence / gap:** justified use case, governance/threat model, privacy/key controls,
  architecture, failure handling, and comparison with simpler records are absent.
- **Permitted claim / restriction:** "ISO 23257 was reviewed and is not applicable to current
  BIMLog scope." No blockchain-backed or immutable-record claim.

### 9. ISO 20022-1:2026 — Financial services — Universal financial industry message scheme — Part 1: Metamodel

- **Publisher / edition / status / source:** ISO; edition 3, published 2026-04, current;
  [official catalog](https://www.iso.org/standard/20022-1), verified 2026-07-13.
- **Classification / relevance / scope:** **Not applicable after verified review** to present
  construction coordination; only a future authorized financial-services integration could
  affect payment, investment, banking, or UrbanInvest interfaces.
- **Evidence / gap:** approved use case, messages, participants, controls, security,
  reconciliation, and interface tests are absent.
- **Permitted claim / restriction:** "ISO 20022-1 was reviewed and is not applicable to current
  BIMLog scope." No financial-message support claim.

### 10. ISO 23247 digital-twin framework series

- **Publisher / edition / status / source:** ISO; edition 1 parts are
  [ISO 23247-1:2021, *Automation systems and integration — Digital twin framework for manufacturing — Part 1: Overview and general principles*](https://www.iso.org/standard/75066.html),
  [ISO 23247-2:2021, *Automation systems and integration — Digital twin framework for manufacturing — Part 2: Reference architecture*](https://www.iso.org/standard/78743.html),
  [ISO 23247-3:2021, *Automation systems and integration — Digital twin framework for manufacturing — Part 3: Digital representation of manufacturing elements*](https://www.iso.org/standard/78744.html),
  [ISO 23247-4:2021, *Automation systems and integration — Digital twin framework for manufacturing — Part 4: Information exchange*](https://www.iso.org/standard/78745.html),
  and [ISO 23247-5:2026, *Automation systems and integration — Digital twin framework for manufacturing — Part 5: Digital thread for digital twin*](https://www.iso.org/standard/87425.html).
  All are published/current; parts 1-4 were published 2021-10 and part 5 in 2026-06. Verified
  2026-07-13.
- **Classification / relevance / scope:** **Strategic/future reference**. Manufacturing is not a
  direct BIMLog requirement, but its architecture can inform future asset twins, lifecycle links,
  event streams, model context, handover, IoT, and connectors.
- **Evidence / gap:** built-environment use cases, canonical asset identity, lifecycle and
  synchronization rules, provenance, interfaces, security, and end-to-end tests are absent.
- **Permitted claim / restriction:** "The ISO 23247 series is a strategic digital-twin
  reference." No present digital-twin implementation claim.

### 11. ISO/ASTM 52900:2021 — Additive manufacturing — General principles — Fundamentals and vocabulary

- **Publisher / edition / status / source:** ISO/ASTM; edition 2, published 2021-11, current
  (confirmed 2025); [official catalog](https://www.iso.org/standard/74514.html), verified
  2026-07-13.
- **Classification / relevance / scope:** **Not applicable after verified review**. Additive
  manufacturing is outside current coordination, records, reporting, and handover scope.
- **Evidence / gap:** an approved fabrication use case, terminology/data mapping, provenance,
  quality controls, and exchange tests do not exist.
- **Permitted claim / restriction:** "ISO/ASTM 52900 was reviewed and is not applicable to current
  BIMLog scope." No additive-manufacturing support claim.

### 12. ISO/IEC 38507:2022 — Information technology — Governance of IT — Governance implications of the use of artificial intelligence by organizations

- **Publisher / edition / status / source:** ISO/IEC; edition 1, published 2022-04, current;
  [official catalog](https://www.iso.org/standard/56641.html), verified 2026-07-13.
- **Classification / relevance / scope:** **Near-term enabling alignment** for human authority,
  accountability, and oversight; affects AI drafting, extraction, classification, summaries,
  warnings, recommendations, cost disclosure, permissions, and audit.
- **Evidence / gap:** governance roles, approved use cases, risk/impact decisions, oversight,
  traceability, monitoring, and retirement controls need a complete mapping and operating evidence.
- **Permitted claim / restriction:** "ISO/IEC 38507 informs BIMLog's AI governance design."
  Designed or implemented governance must not be claimed from this conceptual reference.

### 13. ISO 10005:2018 — Quality management — Guidelines for quality plans

- **Publisher / edition / status / source:** ISO; edition 3, published 2018-06, current;
  [official catalog](https://www.iso.org/standard/70398.html), verified 2026-07-13.
- **Classification / relevance / scope:** **Near-term enabling alignment** for project-specific
  quality planning; affects setup, quality plans, inspections, assignments, acceptance criteria,
  corrective action, reports, and handover.
- **Evidence / gap:** plan scope, inputs, roles, resources, controlled activities, records,
  measures, reviews, and tests are expected. No mapped quality-plan workflow is verified.
- **Permitted claim / restriction:** "ISO 10005 is a near-term quality-planning reference."
  No implemented quality-plan or conformity claim.

### 14. ISO 10018:2020 — Quality management — Guidance for people engagement

- **Publisher / edition / status / source:** ISO; edition 2, published 2020-04, under systematic
  review; [official catalog](https://www.iso.org/standard/69979.html), verified 2026-07-13.
- **Classification / relevance / scope:** **Near-term enabling alignment** for roles,
  participation, competence, feedback, and adoption; affects onboarding, permissions,
  assignments, notifications, meetings, corrective action, support, and partner learning.
- **Evidence / gap:** stakeholder/competence mapping, engagement mechanisms, feedback outcomes,
  measures, and reviews are expected. No formal control map exists.
- **Permitted claim / restriction:** "ISO 10018 informs near-term people-engagement design."
  Guidance does not establish implemented controls or conformity.

### 15. ISO 19650 information-management series

- **Publisher / edition / status / source:** ISO. Verified 2026-07-13 editions are
  [ISO 19650-1:2018, *Organization and digitization of information about buildings and civil engineering works, including building information modelling (BIM) — Information management using building information modelling — Part 1: Concepts and principles*](https://www.iso.org/standard/68078.html), edition 1, current/being revised;
  [ISO 19650-2:2018, *Organization and digitization of information about buildings and civil engineering works, including building information modelling (BIM) — Information management using building information modelling — Part 2: Delivery phase of the assets*](https://www.iso.org/standard/68080.html), edition 1, current/being revised;
  [ISO 19650-3:2020, *Organization and digitization of information about buildings and civil engineering works, including building information modelling (BIM) — Information management using building information modelling — Part 3: Operational phase of the assets*](https://www.iso.org/standard/75109.html), edition 1, current/marked for revision;
  [ISO 19650-4:2022, *Organization and digitization of information about buildings and civil engineering works, including building information modelling (BIM) — Information management using building information modelling — Part 4: Information exchange*](https://www.iso.org/standard/78246.html), edition 1, current;
  [ISO 19650-5:2020, *Organization and digitization of information about buildings and civil engineering works, including building information modelling (BIM) — Information management using building information modelling — Part 5: Security-minded approach to information management*](https://www.iso.org/standard/74206.html), edition 1, current (confirmed 2025); and
  [ISO 19650-6:2025, *Organization and digitization of information about buildings and civil engineering works, including building information modelling (BIM) — Information management using building information modelling — Part 6: Health and safety information*](https://www.iso.org/standard/82705.html), edition 1, current.
- **Classification / relevance / scope:** **Core/current alignment** for naming, CDE behavior,
  information states, delivery, exchange, operations, and security; affects all project records,
  files, models, audit, plugins, reports, exports, and handover.
- **Evidence / gap:** scoped requirements/responsibilities, naming and status rules, CDE
  workflows, exchange plans, authorization, security, acceptance, and verified exchanges are
  expected. Resemblance to a CDE is only conceptual relevance; no series assessment exists.
- **Permitted claim / restriction:** "The ISO 19650 series is a core BIMLog information-management
  reference." No part or series implementation claim without part-specific evidence.

### 16. ISO/IEC 42001:2023 — Information technology — Artificial intelligence — Management system

- **Publisher / edition / status / source:** ISO/IEC; edition 1, published 2023-12, current;
  [official catalog](https://www.iso.org/standard/42001), verified 2026-07-13.
- **Classification / relevance / scope:** **Core/current alignment** for controlled AI assistance,
  risk, transparency, oversight, monitoring, and accountability; affects AI systems, providers,
  inputs, prompts, outputs, review, costs, logs, incidents, evaluations, changes, and retirement.
- **Evidence / gap:** AIMS scope, policy, roles, impact/risk assessments, inventory, controls,
  evaluations, monitoring, internal audit, and management review are expected. Doctrine is not an
  implemented management system.
- **Permitted claim / restriction:** "ISO/IEC 42001 is a core AI-management reference for BIMLog."
  No AIMS implementation or conformity claim.

### 17. ISO 55000:2024 — Asset management — Vocabulary, overview and principles

- **Publisher / edition / status / source:** ISO; edition 2, published 2024-07, current;
  [official catalog](https://www.iso.org/standard/83053.html), verified 2026-07-13.
- **Classification / relevance / scope:** **Near-term enabling alignment** for asset value,
  lifecycle context, terminology, and owner handover; affects asset records, requirements,
  model/document links, decisions, commissioning, exports, and future twins.
- **Evidence / gap:** agreed vocabulary, context/value criteria, lifecycle relationships,
  ownership, and tested handover are expected. No formal mapping exists.
- **Permitted claim / restriction:** "ISO 55000 informs BIMLog's asset-information and handover
  design." No asset-management-system claim.

### 18. ISO 55001:2024 — Asset management — Asset management system — Requirements

- **Publisher / edition / status / source:** ISO; edition 2, published 2024-07, current;
  [official catalog](https://www.iso.org/standard/83054.html), verified 2026-07-13.
- **Classification / relevance / scope:** **Near-term enabling alignment** for traceable asset
  information supporting an owner's system; affects requirements, assets, documents, changes,
  commissioning, reports, exports, handover, and operational links.
- **Evidence / gap:** customer-defined scope, objectives, decision criteria, information
  requirements, controls, measures, reviews, and operating evidence are absent.
- **Permitted claim / restriction:** "ISO 55001 requirements are a near-term handover evaluation
  reference." BIMLog must not be presented as the owner's asset-management system.

### 19. ISO 16739-1:2024 — Industry Foundation Classes (IFC) for data sharing in the construction and facility management industries — Part 1: Data schema

- **Publisher / edition / status / source:** ISO; edition 2, published 2024-03, current;
  [official catalog](https://www.iso.org/standard/84123.html), verified 2026-07-13.
- **Classification / relevance / scope:** **Core/current alignment** for open model and asset
  exchange; affects model references/elements, viewpoints, coordination records, imports/exports,
  Navisworks plugins, reports, linked documents, and handover.
- **Evidence / gap:** pinned schemas and view scope, stable IDs, property/classification mapping,
  round-trip/error behavior, validation, samples, and automated/visual tests are expected. No IFC
  conformance evidence is recorded.
- **Permitted claim / restriction:** "ISO 16739-1 is a core open-interoperability reference."
  No IFC support, schema conformity, or interoperability claim until a named scope is verified.

### 20. ISO 29481 information delivery manual series

- **Publisher / edition / status / source:** ISO;
  [ISO 29481-1:2025, *Building information models — Information delivery manual — Part 1: Methodology and format*](https://www.iso.org/standard/88515.html), edition 3, published 2025-11/current, and
  [ISO 29481-2:2025, *Building information models — Information delivery manual — Part 2: Interaction framework*](https://www.iso.org/standard/88516.html), edition 2, published 2025-12/current.
  Verified 2026-07-13; both supersede earlier editions.
- **Classification / relevance / scope:** **Near-term enabling alignment** for use cases,
  exchange requirements, actors, interactions, timing, and traceability; affects RFI, submittal,
  change, transmittal, meeting, schedule, quality, plugin, export, and handover workflows.
- **Evidence / gap:** use cases, process/interaction maps, requirements, actors, triggers,
  outputs, validation, and acceptance evidence are expected. No formal IDM package is verified.
- **Permitted claim / restriction:** "ISO 29481 is a near-term information-exchange methodology
  reference." No IDM implementation claim.

### 21. ISO 21597 information-container series

- **Publisher / edition / status / source:** ISO;
  [ISO 21597-1:2020, *Information container for linked document delivery — Exchange specification — Part 1: Container*](https://www.iso.org/standard/74389.html), edition 1, published 2020-06/current (confirmed 2025), and
  [ISO 21597-2:2020, *Information container for linked document delivery — Exchange specification — Part 2: Link types*](https://www.iso.org/standard/74390.html), edition 1, published 2020-11/current (confirmed 2026).
  Verified 2026-07-13.
- **Classification / relevance / scope:** **Near-term enabling alignment** for portable packages
  preserving links among models, documents, drawings, records, and evidence; affects mixed-page
  deliverables, transmittals, reports, exports, plugins, and handover.
- **Evidence / gap:** container profile, link semantics, IDs, manifests, provenance, integrity,
  missing-resource behavior, validation, and round-trip inspection are expected. No conforming
  container export is verified.
- **Permitted claim / restriction:** "ISO 21597 is a near-term linked-delivery reference."
  No ICDD support or conformity claim until a named profile is verified.

### 22. ISO 12006-3:2022 — Building construction — Organization of information about construction works — Part 3: Framework for object-oriented information

- **Publisher / edition / status / source:** ISO; edition 2, published 2022-06, current;
  [official catalog](https://www.iso.org/standard/74932.html), verified 2026-07-13.
- **Classification / relevance / scope:** **Near-term enabling alignment** for shared concepts,
  classifications, objects, properties, and dictionaries; affects master data, elements, assets,
  search, imports/exports, plugins, reporting, and handover.
- **Evidence / gap:** governed concepts/IDs, relationships, versioning, multilingual labels,
  dictionary mappings, validation, and exchange tests are expected. No conforming framework is
  implemented or verified.
- **Permitted claim / restriction:** "ISO 12006-3 is a near-term semantic-data reference."
  No dictionary implementation or semantic-interoperability claim.

### 23. ISO 23386:2020 — Building information modelling and other digital processes used in construction — Methodology to describe, author and maintain properties in interconnected data dictionaries

- **Publisher / edition / status / source:** ISO; edition 1, published 2020-03, current (confirmed
  2025); [official catalog](https://www.iso.org/standard/75401.html), verified 2026-07-13.
- **Classification / relevance / scope:** **Near-term enabling alignment** for property identity,
  definition, authorship, lifecycle, and exchange; affects model/asset properties, custom fields,
  master data, imports/exports, plugins, reports, search, and handover.
- **Evidence / gap:** property IDs/attributes, ownership, status/version rules, translation,
  mapping, approval, deprecation, validation, and fixtures are expected. No methodology mapping
  is verified.
- **Permitted claim / restriction:** "ISO 23386 informs near-term property governance."
  No implemented dictionary-methodology claim.

### 24. ISO 23387:2025 — Building information modelling (BIM) — Data templates for objects used in the life cycle of assets

- **Publisher / edition / status / source:** ISO; edition 2, published 2025-09, current;
  [official catalog](https://www.iso.org/standard/85391.html), verified 2026-07-13.
- **Classification / relevance / scope:** **Near-term enabling alignment** for consistent object
  and asset data; affects object types, properties, submittals, commissioning, imports/exports,
  plugins, reports, and handover templates.
- **Evidence / gap:** use-case templates, governed properties/units, IDs, lifecycle rules,
  validation, versioning, and exchange tests are expected. No data-template implementation is
  verified.
- **Permitted claim / restriction:** "ISO 23387 is a near-term object-data-template reference."
  No implemented template or interoperability claim.

### 25. BIM Collaboration Format (BCF)

- **Publisher / edition / status / source:** buildingSMART International; its official library
  records BCF XML and BCF API as Final Standards, but the cited official overview does not expose
  one unambiguous current version for both forms: **verification incomplete**.
  [BCF overview](https://technical.buildingsmart.org/standards/bcf/) and
  [official standards library](https://www.buildingsmart.org/standards/bsi-standards/standards-library/),
  verified 2026-07-13.
- **Classification / relevance / scope:** **Near-term enabling alignment**, held from a pinned
  requirement until XML/API version and scope are selected; affects issues, viewpoints, comments,
  attachments, model links, Navisworks plugins, imports/exports, and audit.
- **Evidence / gap:** official version, schema/API profile, ID/status mapping, viewpoints,
  authorization, round-trip fixtures, errors, and interoperability tests are expected. No
  verified BCF exchange exists.
- **Permitted claim / restriction:** "BCF is a near-term issue-exchange reference; exact
  implementation version remains unverified." No BCF support or compatibility claim.

### 26. Information Delivery Specification (IDS) 1.0

- **Publisher / edition / status / source:** buildingSMART International; IDS 1.0, approved as an
  official standard 2024-06-01/current;
  [official standard page](https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/),
  verified 2026-07-13.
- **Classification / relevance / scope:** **Near-term enabling alignment** for machine-readable
  exchange requirements and IFC validation; affects model requirements, coordination, quality,
  issues, imports/exports, plugins, reports, and acceptance evidence.
- **Evidence / gap:** scoped requirements, authoring/validation workflow, supported facets,
  versioned files, traceable results, fixtures, error review, and interoperability tests are
  expected. No IDS execution is verified.
- **Permitted claim / restriction:** "IDS 1.0 is a near-term IFC information-requirement
  reference." No IDS support, validation-conformity, or guaranteed IFC-quality claim.

### 27. Construction to Operations Building information exchange (COBie) V3

- **Publisher / edition / status / source:** National Institute of Building Sciences, within the
  United States National BIM Standard (NBIMS-US) V4; COBie V3, published 2023/current in V4;
  [official NBIMS-US V4 page](https://nibs.org/nbims/v4/) and
  [official COBie content](https://nibs.org/nbims/v3/cobie/), verified 2026-07-13.
- **Classification / relevance / scope:** **Near-term enabling alignment** for maintainable asset
  data and construction-to-operations handover; affects facilities, spaces, types/components,
  documents, attributes, contacts, commissioning, spreadsheet/JSON/IFC exchange, and reports.
- **Evidence / gap:** selected exchange form/scope, field and ID mappings, classifications/units,
  responsibilities, validation, samples, round-trip tests, and owner acceptance are expected. No
  verified COBie export exists.
- **Permitted claim / restriction:** "COBie V3 is a near-term structured-handover reference."
  No COBie support, compliant deliverable, or owner-acceptance claim.

## Maintenance rule

Reverify an entry before using it as a new implementation requirement, after official revision
or withdrawal, and at least annually. Promotion beyond conceptual relevance requires a named
BIMLog scope, mapped controls, implementation evidence, verification results, and approving
authority. Audited conformity and certification require appropriate independent evidence and
may never be inferred from this register.
