# Proposed makeover: 150 microbuilds, 30 blocks

**Proposal only.** UX001–UX150 are planning identifiers, not implementation/deployment approval and not continuations of the completed I/C program. Roberto requested expansion to 150 to incorporate the September 28 meeting requirements. Scope may be refined after discovery. A microbuild is one bounded reviewable outcome with a testable gate; it is not necessarily one commit, one day or one deployment. [Meeting requirements and traceability](MEETING-REQUIREMENTS.md) supersede conflicting historical assumptions.

Each block must produce a working integrated user outcome. No block passes on screenshots or source-pattern tests alone. Every applicable existing correctness, permission and release gate remains in force. UI simplification must preserve source identities, history, financial meaning, optional sharing boundaries and native behavior.

**Roberto's subsequent direction:** 150 is the current decomposition, not a ceiling. Add further bounded work if evidence requires it. Acceptance is the ability to understand and complete connected journeys, including recovery with accurate help—not the number of completed builds. R19/R20 in MEETING-REQUIREMENTS.md apply to every block.

## Program summary

| Phase | Blocks | Microbuilds | Outcome |
|---|---|---|---|
| Establish truth and restore continuity | B01–B04 | UX001–020: 20 | Agreed model, immediate defects, shared identity and navigation |
| Rebuild job setup and delivery | B05–B08 | UX021–040: 20 | One resumable setup feeding useful daily work |
| Connect documents and coordination | B09–B13 | UX041–065: 25 | Evidence, RFIs, submittals, related workflows and Lens continuity |
| Unify insights, administration and design | B14–B16 | UX066–080: 15 | Clear reports/settings and consistent accessible components |
| Reconcile brand and conversion | B17–B18 | UX081–090: 10 | Truthful product story and continuous buyer journey |
| Preserve data and prove acceptance | B19–B20 | UX091–100: 10 | Reconciled migration, reversible rollout and user acceptance |
| Project scope and smart choices | B21–B22 | UX101–110: 10 | Multi-discipline/level setup and compact relevant choices |
| APU library and exact rate lineage | B23–B24 | UX111–120: 10 | Reusable APUs with stable project/version/unit-rate bindings |
| Resource planning and approved costs | B25–B27 | UX121–135: 15 | Generic budgets, later staffing, CEO-approved member costs and excess-hours rule |
| Contract/EDT, shop drawings and email | B28–B30 | UX136–150: 15 | One source chain, delivery-first workflow and contextual SendGrid readiness |
| **Total** | **30** | **150** | Comprehensive experience makeover plus meeting requirements |

B16's component foundations should begin immediately after B01, before widespread page replacement. B19 migration design begins alongside any identity/data change; its execution/reconciliation gate remains late. B21–B30 are integrated into the relevant earlier journeys; they are not postponed until UX100. In particular B24/B25/B28 constrain Intake acceptance. B20 remains final acceptance for the entire 150-build scope. Do not release all 150 at once.

### B01 — Evidence, vocabulary and design contract

Dependencies: approved audit-follow-up scope. Findings: cross-cutting.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX001 | Capability/route inventory with shipping, gated and unavailable states | Every main navigation/public promise maps to an owner and verified behavior |
| UX002 | Canonical entity/relationship and snapshot map | Client, scope, task, document, contract and version ownership reconciled without duplicate stores |
| UX003 | Role/job-to-be-done journey map | Coordinator, operator, manager and administrator have explicit starting point, next action and completion |
| UX004 | Baseline usability protocol and event definitions | Representative scenarios, timing/error definitions and privacy-safe metrics documented; no invented baseline |
| UX005 | Reviewable prototype of setup → prerequisite → return → task | Full journey exposes context, next action, saved state and recovery; design review records wrong turns before broad implementation |

Block gate: one approved design contract, preservation list and prioritized fixture set. Unresolved business semantics are explicit decisions, not silent implementation guesses.

### B02 — Immediate state and trust repairs

Dependencies: B01 definitions. Findings: F03–04, F10–12, F30.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX006 | Correct active/draft readiness labels and next CTA | Activated fixture never asks for initial activation; draft still guides activation |
| UX007 | Replace configuration-progress labels with precise coverage terms | Staffing/setup versus actual completion remain distinct in every affected summary |
| UX008 | Normalize rendered RFI priority options | One eligible option per stable value in both locales; legacy selections retained |
| UX009 | Open Submittal details in read mode | Source/list/deep links inspect first; Edit/Cancel/Save retain permissions and selection |
| UX010 | Unify calendar-date handling and null effective-date display | Editor/detail/control/export agree across timezones; missing authority dates never show 1969 |

Block gate: reproduce original defects, demonstrate repaired browser states, and pass focused legacy/date tests without historical date rewriting.

### B03 — Shared party and catalog experience

Dependencies: UX002; migration design UX091 before any data normalization. Findings: F06–09, F30/F32.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX011 | Shared project-company eligibility adapter | Intake/RFI/Transmittal/Change choices agree where rules agree; exceptions explained |
| UX012 | Shared company/contact picker with contextual creation | Existing parties reused; new authorized party returns selected to origin |
| UX013 | Separate company-only placeholders from inviteable people | Synthetic internal email is never a recipient; real contact creation remains available |
| UX014 | Resolve discipline/catalog scope and loading states | Active eligible discipline appears in quick/full setup; errors do not masquerade as empty catalogs |
| UX015 | Company identity binding and document snapshot rules | Company Profile loads correct identity; issued snapshots do not change with master edits |

Block gate: one party created in an approved fixture is available across eligible modules without additional party records; no cross-company leakage.

### B04 — Navigation and return-context foundation

Dependencies: B01 and component primitives from B16. Findings: F01–02, F25–26, F41/F44.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX016 | Shared context header and stable project destinations | Project/role/current location recognizable across main workspaces |
| UX017 | Validated origin/step/item return-context mechanism | Safe internal origins only; Back, Cancel and Complete restore exact context |
| UX018 | Exact-record contract and related-record deep links | Authorized target opens selected; missing/denied target has explicit recovery |
| UX019 | Project home routing for draft/active roles | Draft resumes setup; active users reach relevant work while Analytics remains accessible |
| UX020 | Search scope and descriptive source links | Known project codes/document IDs find authorized results or scope is truthfully labeled |

Block gate: Intake → APU/Budget/Contract → Intake and work list → record → same filtered list succeed without user reconstruction.

### B05 — One guided Intake

Dependencies: B03–B04, UX005 and B16 primitives. Findings: F05–09/F19/F43.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX021 | One full six-stage setup; remove Quick Setup | Quick mode/buttons/routes retired safely; existing quick drafts resume in full setup without repeated entry |
| UX022 | Job/client stage with inherited identity | Name/code/client reuse existing values and explain deliberate overrides |
| UX023 | Scope item editor with explicit units and quantities | Quantity is not conflated with hours; stable item IDs survive edits and reorder |
| UX024 | Delivery/template and location stage | Eligible published versions selectable; prerequisites explained with return path |
| UX025 | Generic resource-budget stage, with named assignments removed | Role/hours/planned cost defined without choosing employees; no full-staffing activation gate |

Block gate: minimal operational job can be prepared without repeated identity entry or mandatory commercial setup where not required.

### B06 — Commercial setup in context

Dependencies: B05, existing commercial authorities. Findings: F01–02/F16–17/F28.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX026 | Contextual APU/version selection | Exact compatible version attached to selected item; multiple candidates never silently guessed |
| UX027 | Quantity/unit/rate/total explanation and presentation | Displayed totals reconcile with existing calculation rules and precision |
| UX028 | Budget selection/import picker and return | Named eligible file/version chosen without manual raw ID entry; origin restored |
| UX029 | Contract terms/detail connection from setup | Correct current contract selected and snapshot relation explained |
| UX030 | Optional commercial readiness and entitlement states | Core activation remains possible per existing rules; restricted actions explain role/availability |

Block gate: prepared commercial fixture reconciles scope/APU/contract/budget without changing historical snapshots or financial approval semantics.

### B07 — Draft resilience and activation confidence

Dependencies: B05–B06. Findings: F01/F03/F05/F43.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX031 | Clear saved/saving/failed state and recoverable retry | Failed save cannot appear saved; retry retains entered values |
| UX032 | Exact draft resume across refresh and prerequisite detours | Correct revision/stage/item restored; stale recovery cannot overwrite newer source |
| UX033 | Review screen with linked blockers and resulting structure | Items/tasks/generic resource demand preview accurate; unassigned future work is not a blocker |
| UX034 | Idempotent activation interaction and completion summary | Repeat/concurrent retry produces intended entities once, including jobs with no named task assignees |
| UX035 | Active-job changes workflow | User sees change impact and navigates to operations without implying initial activation |

Block gate: interrupted and retried setup reaches the same correct activated structure as an uninterrupted run.

### B08 — Daily Operations first

Dependencies: B04/B07, existing workflow controls. Findings: F13–17/F24.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX036 | Task-first work home with role-appropriate queues | Assigned task/blocker visible before configuration; empty state offers appropriate next step |
| UX037 | Integrated task detail with later/partial member assignment | Assignment occurs in Operations; effective approved member cost resolves without changing customer APU rate |
| UX038 | Next-actor and review-gate presentation | UI action eligibility matches server rules, including independent reviewer requirements |
| UX039 | Time/effort metrics with distinct definitions | Planned, actual, unused and estimated remaining values reconcile and are labeled |
| UX040 | Linked-document launcher from tasks | Created canonical document returns linked once; Cancel leaves task intact |

Block gate: operator logs approved synthetic work and routes a deliverable for review while manager sees consistent status and evidence.

### B09 — One evidence and file-intake journey

Dependencies: B03/B04/B08. Findings: F18–21/F35/F37–38.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX041 | Unified file/import entry with explicit operating modes | Record-only, retained evidence and connected delivery are accurately distinguished |
| UX042 | Convention prerequisite resolver with context return | Eligible template/setup/handoff returns to intended intake without duplicate upload |
| UX043 | File preview of naming, storage, destination and optional AI cost | No implied content analysis or delivery before it occurs; required confirmations separate |
| UX044 | Document identity/version/source presentation | Repeated filenames are distinguishable; no filename-only merge |
| UX045 | Upload failure/retry and destination recovery | Retry is safe, artifact state truthful, source context preserved |

Block gate: valid/invalid name, unavailable destination and retry scenarios yield correct records and comprehensible next steps.

### B10 — RFI experience

Dependencies: B03/B04/B09. Findings: F07/F09–10/F20/F22/F43.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX046 | RFI list hierarchy with one status filter and advanced controls | Applied scope visible; saved views/export remain exact |
| UX047 | Contextual draft form with reused parties/evidence | Minimal required entry clear; validation focuses the relevant field |
| UX048 | Read-first RFI detail with primary lifecycle action | Draft/issued/response state, next actor and due date agree |
| UX049 | Age versus overdue policy presentation | Missing due date and unsent drafts are not misleadingly presented as equivalent lateness |
| UX050 | Response/revision/close and return continuity | Existing history and explicit sharing separation preserved through full fixture lifecycle |

Block gate: create/issue/respond/close journey passes with correct parties, dates and source links, without sending to unapproved real recipients.

### B11 — Submittal requirements, packages and review

Dependencies: B02/B03/B04/B09. Findings: F11–12/F23/F43.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX051 | Clear Required/Received/Control navigation and terminology | User can distinguish a requirement from its package revisions and coverage |
| UX052 | Contextual package draft with inherited requirement/evidence | No repeated entry of known identity; one canonical package created |
| UX053 | Purposeful relationship picker for RFIs, requirements and files | Relationship meaning explicit; legitimate many-to-many links retained |
| UX054 | Review decision and revision history layout | Current review action clear; previous revisions immutable and accessible |
| UX055 | Integrated submittal round-trip acceptance | List/detail/editor/control/export show same selection, dates, version and status |

Block gate: a requirement receives a revised package and an authorized review; coverage never falsely implies approval.

### B12 — Transmittals, changes, meetings and calendar

Dependencies: B08–B11. Findings: F07/F14/F23–24.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX056 | Transmittal creation from selected evidence | Exact versions/recipients previewed; explicit issuance and return to source |
| UX057 | Change creation from an RFI/issue/contract | Supporting origin and structured impact retained without inventing approval |
| UX058 | Meeting form with intentional agenda/attendees | No confusing blank boilerplate or placeholder characters; existing records selectable |
| UX059 | Meeting follow-up links to canonical actions | Assigned action appears in My work without duplicate task copies |
| UX060 | Calendar layers for tasks/documents/meetings | Same record identity/status/due date, explicit included layers and empty-state meaning |

Block gate: one coordination decision flows through meeting/action/change/evidence where applicable and remains traceable.

### B13 — Lens continuity and specialized workspace

Dependencies: B04/B09, existing native contract review. Findings: F33/F44.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX061 | Project-aware Lens entry and return | Project origin retained; standalone entry asks or clearly identifies selected project |
| UX062 | Bridge/model prerequisite guidance | Connected/disconnected/no-model states have accurate permitted next actions |
| UX063 | Issue-to-RFI/task/evidence relationship presentation | Exact Lens identity maintained across jumps and return |
| UX064 | Diagnostics separated from daily issue actions | Repair/reset tools retain appropriate environment/role/consequence boundaries |
| UX065 | Native compatibility regression evidence | Existing capture/Working View/publishing contracts unchanged; unresolved field gates explicit |

Block gate: web continuity improves without treating native modernization as incidental UX work or declaring deferred field acceptance passed.

### B14 — Reports, metrics and evidence navigation

Dependencies: B08–B12. Findings: F04/F16–17/F27–28/F34.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX066 | Role-relevant insight hierarchy and defined measures | Counts/coverage/completion/value scopes explicit and source-linked |
| UX067 | Report chooser organized by business question | User selects the intended report and understands its inputs |
| UX068 | Consistent export scope preview | Visible filters/selected records match generated output rows and totals |
| UX069 | Navigable cross-record evidence timeline | Links to immutable source histories without rewriting or falsely unifying their authority |
| UX070 | Performance/scenario evidence sufficiency states | Unrated, assumed and measured outcomes clearly separated |

Block gate: sampled PDF/XLSX/DOCX outputs match their preview and source; no fabricated trends or performance judgments.

### B15 — Personal, company and platform settings

Dependencies: B03/B04 and notification capability inventory. Findings: F29–35.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX071 | Separate personal/company/platform settings navigation | Every setting clearly identifies scope and responsible role |
| UX072 | Canonical effective notification preferences | Legacy/current surfaces agree on channel readiness, events and overrides |
| UX073 | Connector readiness and administrator handoff | Setup/disconnected/permission/error states distinct; no silent external request |
| UX074 | Effective role labels and legacy mapping presentation | User understands authority without broadened access or hidden legacy changes |
| UX075 | Useful template/knowledge empty and selection states | Published templates easy to reuse; unavailable authoring has truthful next step |

Block gate: a normal user finds personal settings, an administrator finds company configuration, and both see the same effective notification availability.

### B16 — Design system, language and accessibility

Dependencies: B01; begin foundations early and finish adoption after affected modules. Findings: F20/F27/F36/F41–43.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX076 | Shared layout/type/spacing/status tokens and primitives | Representative forms/tables/details use consistent hierarchy in light/dark themes |
| UX077 | Plain-language English/Spanish product glossary and copy pass | Same concept has same label; internal codes move to details; long labels fit |
| UX078 | Responsive header/drawer/footer/table patterns | 320/390/768/1280 widths and zoom have no obscured primary controls |
| UX079 | Accessible forms/dialogs/errors/keyboard behavior | Names, focus return, error association and complete keyboard actions verified |
| UX080 | Visual/interaction regression matrix across adopted surfaces | Key loading/empty/error/read/edit states match shared patterns without lost functionality |

Block gate: tested component behavior plus representative full journeys; no formal WCAG conformance claim without sufficient audit evidence.

### B17 — Brand and truthful public story

Dependencies: UX001 and factual storage/entitlement review. Findings: F36–38/F41.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX081 | Positioning/voice and brand-architecture brief | Product, parent brand and audience relationship consistent and approved |
| UX082 | Landing story with actual product proof | Clear connected-job journey, real screenshots and state-aware primary CTA |
| UX083 | Role/use-case Features presentation | Every promised feature maps to verified availability/prerequisites |
| UX084 | Storage/retention/trust-copy reconciliation package | Policy owner reviews one factually consistent account; no unsupported assurance |
| UX085 | Rebuild public walkthrough, contextual guide and task-oriented manual | Instructions match released roles/screens; help preserves draft and returns to exact task; recovery scenario succeeds without verbal coaching |

Block gate: public claims, policies and observed shipping behavior agree; no invented testimonials, results or certifications.

### B18 — Pricing and conversion continuity

Dependencies: B17 and current commercial offer owner. Findings: F39–40.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX086 | Concise plan comparison using existing prices/entitlements | Billing basis, limits, trial and founding offer terms understandable and consistent |
| UX087 | Preserve plan/billing/use-case intent to Contact/signup | Team and every displayed plan selectable; no re-entry of known choices |
| UX088 | Separate self-service and sales-assisted CTA journeys | Action labels match destination and actual onboarding availability |
| UX089 | Supported claims and transparent ROI illustration | Cited inputs or editable assumptions; arithmetic correct; no promised return |
| UX090 | Privacy-reviewed funnel measurement and baseline dashboard | Conversion/activation definitions testable without sending document contents or secrets |

Block gate: prospect can compare, choose, complete the permitted next step and reach onboarding with intent preserved. No pricing change implied.

### B19 — Migration, compatibility and reversible rollout

Dependencies: design starts with B01/B03; execution after relevant implementation. Findings: all preservation-sensitive changes.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX091 | Migration/identity reconciliation plan and dry run | Every proposed mapping/collision reviewed; no automatic filename/name merge |
| UX092 | Before/after record and relationship reconciliation | Counts, IDs, attachments, assignments and historical links retained or explicitly mapped |
| UX093 | Financial/snapshot/permission reconciliation | Totals, versions, approvals and role boundaries match accepted baseline |
| UX094 | Old-route/client compatibility and reversible rollout control | Existing deep links/native clients work; rollback path rehearsed in preview |
| UX095 | Explicit synthetic/demo metadata and rollout cohort preparation | Test projects separated without guessing or deleting client data |

Block gate: no unexplained reconciliation delta; rollback restores usability without undoing legitimate business events.

### B20 — Full smoke, real users and release acceptance

Dependencies: affected blocks complete; B19 reconciliation. Findings: full program.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX096 | Transactional golden journeys in controlled Chrome fixtures | Setup → activate → task → evidence → decision → report passes with exact expected records |
| UX097 | Failure, retry, date, permission and cross-tenant journeys | Recoverable errors preserve input; no duplicate mutation or unauthorized exposure |
| UX098 | Mobile/keyboard/locale and applicable native acceptance | Complete representative journeys, not isolated screenshots; deferred native gates explicit |
| UX099 | Roberto/Ruben and representative-user journey acceptance | Normal work completes without coaching; blocked work recovers using help alone; wrong turns/repeated entry/confusing states recorded and resolved |
| UX100 | Release evidence, rollback readiness and handoff | Exact revision/deployment, completed gates, known limits and approved release scope recorded |

Block gate: no unresolved P1 issue in the released scope, reconciliation clean, user acceptance documented, and required publication authority obtained. Ongoing monitoring/automation is not created by this plan.

### B21 — Project disciplines and building levels

Dependencies: UX002/014/021–024; R02–R03.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX101 | Shared selected-discipline set per project | Multiple eligible disciplines persist/reload and appear across Intake, scope and delivery |
| UX102 | Add discipline in context | Authorized creation returns the selected value once; duplicates/errors/denied authority explained |
| UX103 | Building and level editor in full setup | Natural level ordering, basement/roof/custom labels and stable IDs; no arbitrary floor-count limit |
| UX104 | Shared scope/EDT/schedule location references | All views reference the same building/level identity without repeated free-text creation |
| UX105 | Multi-discipline/multi-floor recovery and compatibility | Existing scopes remain mapped; removing an in-use option cannot silently orphan records |

Block gate: configure a seven-floor job with several disciplines, save/reload and obtain the same selectable scope throughout the project.

### B22 — Relevant, compact choices and workflow statuses

Dependencies: B21, company catalog permissions and selected workflow; R04–R06.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX106 | User/company pinned discipline favorites | Small preferred set with full eligible catalog on demand; no permission expansion |
| UX107 | Deterministic frequent/recent discipline ranking | Repeated use improves ordering; project-selected and currently selected values never disappear |
| UX108 | Document-type favorites and frequency | Common types are prominent; uncommon types still searchable/addable within authority |
| UX109 | Workflow-derived status choices | Only valid states/transitions for version/role shown; favorites never override lifecycle |
| UX110 | Preference reset, new-user and bilingual behavior | Predictable defaults and reset; no cross-user/company preference leakage or keyboard regression |

Block gate: ordinary selection does not require scanning 50 values, while authorized uncommon options and historical values remain accessible.

### B23 — General APU Library

Dependencies: UX002/026/075, existing pricing-template authority; R08.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX111 | APU Library entry from full Intake and pricing workspace | One discoverable catalog of authorized reusable APUs; reuse current infrastructure rather than duplicate it |
| UX112 | Library list/search/preview with names and units | Published/draft/version/currency/unit/source clear; a test label never masquerades as another plan |
| UX113 | Controlled reuse of prior project APU as library draft | Explicit selected content/provenance, proper company scope and no confidential project leakage |
| UX114 | Select library version into exact project APU context | Project-specific identity/version established and visible; existing projects not silently updated |
| UX115 | Library version retirement and continued references | Retired versions remain readable in historical bindings; new selections follow eligibility rules |

Block gate: reuse an existing APU in two authorized projects while retaining independent project lineage and immutable prior references.

### B24 — Exact APU unit-rate integrity

Dependencies: B23 and UX026–029; R09. This precedes commercial Intake acceptance.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX116 | Reconcile template/project plan/unit-rate/total semantics | Exact chosen component/unit/currency/version represented; plan selling total never implicitly treated as unit rate |
| UX117 | Replace hard-coded $35.47/$37.99 customer profiles | Resource role selection cannot overwrite the selected project's $30 rate; governed alternatives explicit |
| UX118 | Version-bound contract-item rate selection | Named APU source and rate resolve together; incompatible or ambiguous choices require correction |
| UX119 | Save/reload/governance/contract propagation integrity | Same selected rate and identity survive every surface and detour; no fallback to another APU |
| UX120 | Traceable rate-change diagnosis and regression | Before/after rate/version/source event distinguishable; $30 scenario and multiple APUs pass browser/API checks |

Block gate: selected $30 unit rate remains $30 through Intake, resource planning, contract generation, EDT and reports unless explicitly changed with provenance.

### B25 — Generic resource budgets and future staffing

Dependencies: UX025, B21 and approved role-cost planning model; R10.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX121 | Generic resource-demand model without fake users | Role/location/hours/approved planned cost stored as planning demand, not a person record |
| UX122 | Floor/scope resource budgeting in Intake | Drafter/coordinator quantities and hours budgetable before hiring; no named-assignment fields |
| UX123 | Readiness rules allow unassigned future work | Server and UI permit activation without full staffing; project accountability remains distinct |
| UX124 | Later phased assignment in Operations | Allocate only chosen floors/tasks to real members; remaining demand stays unassigned |
| UX125 | Plan-versus-assignment-versus-actual reconciliation | Staffing does not duplicate budget or rewrite approved baseline; reassignment preserves history |

Block gate: seven floors over 19 months activate with generic budgets and zero named task assignments; a later floor can be staffed independently.

### B26 — Member internal cost and CEO approval

Dependencies: B25, existing project/company governance and permissions; R11–R13.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX126 | Versioned internal-cost profiles with effective dates | Drafter $5.10/h and coordinator $6.50/h recorded as applicable company policy inputs, not platform-wide constants |
| UX127 | Member-specific approved cost lookup | Selecting a member resolves correct effective cost; absent profile gives an explicit unresolved state, never zero/fabricated rate |
| UX128 | CEO approval workflow for profile/policy changes | Unauthorized activation denied; proposer/approver/version/effective date retained |
| UX129 | Project governance displays applicable cost policy | Permission-appropriate approved policy/source visible; ordinary Intake editing cannot bypass approval |
| UX130 | Sensitive cost access and historical snapshots | Customer views exclude internal costs; later rate changes do not silently reprice approved historical work |

Block gate: a later named-member assignment obtains its approved internal rate automatically, independent of the customer unit price.

### B27 — Floor estimate and excess-hour cost

Dependencies: B26 and explicit baseline/allocation business rules; R13. Roberto confirmed **only excess hours**.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX131 | Versioned approved floor-hour estimate reference | Threshold tied to exact scope/level/baseline; missing baseline cannot trigger arbitrary excess treatment |
| UX132 | Marginal excess-hours calculation | Normal hours retain applicable normal cost; only max(eligible hours − estimate, 0) receives $3.50/h |
| UX133 | Deterministic mixed-person/time-entry allocation | Agreed hour-order/eligibility rules handle threshold-crossing entries without double counting |
| UX134 | Corrections, revised estimates and policy approval | Rejected/corrected time and new baseline versions have auditable recomputation; no silent retroactive change |
| UX135 | Cost breakdown and boundary tests | Below/at/above threshold, partial entry and mixed-role cases reconcile; 110 drafter hours against 100 estimate = $545 under stated assumptions |

Block gate: $3.50 never reprices all floor hours, never changes customer billing and never executes payroll/payment.

### B28 — Intake, contract and EDT share one source chain

Dependencies: B24/B25, existing canonical contract and EDT engines; R14–R17.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX136 | Plain Companies and agreements setup | Who hires/delivers/which agreement clear; simple case requires no unexplained Engagements diagram |
| UX137 | Reuse Intake items in one canonical draft contract | Existing generator/linking repaired; Commitments does not ask for the same items again |
| UX138 | Existing-contract selection and difference reconciliation | Authorized exact version bound; no duplicate or silent approved-contract overwrite |
| UX139 | EDT source-readiness and guided repair | Exact missing contract/version/governance reference identified with return path; integrity checks remain |
| UX140 | Idempotent contract/EDT activation and retry proof | Repeated actions retain stable items/tasks/contracts and correct APU rate; existing work unchanged on failure |

Block gate: Intake-first and existing-contract-first entry converge on one verified lineage. Draft creation never implies approval, issuance or execution.

### B29 — Shop-drawing-first BIMtech delivery

Dependencies: B21/B22/B28, existing published delivery templates; R06–R07.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX141 | BIMtech shop-drawing default preset | New eligible BIMtech jobs lead with shop drawings; other companies/deliverables remain configurable |
| UX142 | Floor × discipline × deliverable plan | Required deliverables/project work packages derive from chosen scope without uncontrolled Cartesian duplication |
| UX143 | Governed preparation/review/issue/revision states | Status codes come from published workflow and role; assignment/review rules preserved |
| UX144 | Shop drawing package and task/evidence continuity | Drawing task links required/received submittal and relevant RFI without repeated scope entry |
| UX145 | Coordinator delivery overview | Clear floor/discipline progress and next action; planned, issued, reviewed and approved states distinct |

Block gate: coordinator can follow one shop drawing from planned scope to reviewed revision and evidence, including an initially unassigned task.

### B30 — SendGrid readiness and return to work

Dependencies: UX017/073 and existing email delivery boundary; R16/R18.

| ID | Bounded deliverable | Acceptance gate |
|---|---|---|
| UX146 | Email-readiness section in full setup | Shows not configured/configured/unverified/ready/error; setup can continue when email is not needed |
| UX147 | Authorized SendGrid configuration entry | Uses correct user/company sender authority and secure server storage; no secret in project fields/logs/exports |
| UX148 | Sender/provider readiness verification | Connection alone not equated with verified sending; provider checks use existing supported path |
| UX149 | Send-time preflight and unsent-draft recovery | Missing setup opens contextual configuration, then restores draft/recipients; no unrequested send or false success |
| UX150 | Full meeting-scenario integration acceptance | Full setup, library $30 APU, generic staffing, Convention/email returns, one contract/EDT and later member/excess-cost behavior pass as one understandable journey; guide/manual match |

Block gate: authorized user can configure email where needed and resume work, while lifecycle issuance and external delivery remain explicit, separate actions.

## Revised sequencing and first commitment

Begin with B01's evidence/model/prototype and bring forward the root-cause work in **B24 (APU integrity), B25 (generic resource planning) and B28 (contract/EDT lineage)** alongside navigation repairs. B21/B23 supply the catalog/library prerequisites; B26–B27 establish the approved cost policy before cost behavior is activated. UX021 explicitly removes Quick Setup. Finish B30's meeting scenario before B20 final release acceptance. This ordering addresses Roberto/Ruben's concrete blockers before broad cosmetic rollout; it does not change the 150-item total.

Do not approve a calendar or cost from the count alone. After B01, estimate by change surface, data migration risk, test fixtures, integration constraints and reviewer availability. The safest rollout is several complete journeys with acceptance between them, not a single replacement launch.
