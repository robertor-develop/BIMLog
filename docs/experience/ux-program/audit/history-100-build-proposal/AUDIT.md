# BIMLog UX, UI, business and brand audit

September 28–29, 2026. Live site: https://bimlog.app. Release label: v1.05.N18-P36.

## Overall assessment

BIMLog contains substantial useful capability: reusable job setup, delivery work, commercial snapshots, document registers, linked evidence, reports, and controlled Lens workflows. The product does not consistently present these capabilities as one coherent service. Users are asked to understand the architecture, rebuild context after navigation, reconcile conflicting labels, and configure prerequisites before they can perform the action that brought them to the page.

The resulting commercial problem is significant even without measured conversion data: a prospect sees broad, confident promises, while a new operator encounters empty selectors, technical explanations, and interrupted journeys. An experienced operator spends attention locating work rather than completing it. These are observed mechanisms that could hurt activation, retention, and trust; this audit does not invent churn or revenue-loss percentages.

Recommend a comprehensive experience redesign with gradual replacement of surfaces. Preserve the underlying business entities and established controls. The desired feeling is calm, credible, connected, and easy to resume.

## Method and evidence standard

Primary method: live authenticated Chrome walkthrough, DOM/accessibility inspection, visual screenshots, navigation, reversible view/filter changes, opening existing records, and opening/cancelling creation forms. Main synthetic fixture: project 58. Populated comparison: project 26. Public pages were inspected in the existing authenticated session, so anonymous registration/login behavior is not certified.

Evidence labels: **O** directly observed; **S** source corroboration; **J** design/business judgment; **H** hypothesis requiring additional testing. Severity: **P1** materially interrupts a core journey or undermines record/offer confidence; **P2** substantial friction or ambiguity; **P3** polish/discoverability. No confirmed security bypass, irreversible data loss, or financial-calculation failure is asserted.

Reproduction paths below use `P58 = /projects/58` and `P26 = /projects/26`. Results are observations at this audit, not statements about every tenant or role. Screenshots were visually inspected in the audit session; they are not included as durable image attachments. This report preserves the routes, exact distinguishing UI states, and relevant source references instead of claiming a screenshot archive exists.

## Findings

### F01 — Intake prerequisite detours lose visible return context · P1 · O/S

**Reproduce:** P58 Intake → commercial prerequisite/APU or budget; follow its contract link to Contracts & Commitments. The destination uses its own navigation and does not offer Return to Intake at the originating step. The contract destination provides a budget-oriented return. Browser Back did recover the intake and saved values.

**Impact:** the user must remember how to return and which item they were preparing. This directly matches Roberto's report of being cut off midway. Data loss was not demonstrated.

**Fix/gate:** a reusable return-context contract carrying project, draft revision, step, selected item and allowed origin. Every detour must support Complete and return and Cancel and return. Test browser Back/Forward, refresh, direct links, stale revisions, and denied destination access. Do not replace existing draft recovery.

### F02 — Contract deep link does not reveal the linked record · P1 · O/S

**Reproduce:** Intake's contract link includes `contractId=2765bcab-f052-41be-a8a0-dc3833d56419`, but opens the register; View contract details must be clicked separately.

**Impact:** a link implying a specific contract forces another search and makes the connection appear missing.

**Fix/gate:** resolve and select the authorized exact record, scroll/focus its heading, and retain origin context. Missing/unauthorized records need an explanatory state, not a silent generic register. Source search found no query-contract selection handling in the inspected workspace; verify the full route integration during implementation.

### F03 — Activated job still appears ready to activate · P1 · O

**Reproduce:** P58 Intake displays 100% complete and Ready to activate together with Activated operational foundation and a disabled Job activated action.

**Impact:** users cannot confidently tell whether activation is complete or whether they should repeat it.

**Fix/gate:** distinguish Draft, Ready, Activating, Active and Changes pending. An active job should lead to Open job workspace; subsequent changes should be described as changes to the active job. Repeated activation must not create duplicate entities.

### F04 — Progress labels confuse configuration with execution · P1 · O/J

**Reproduce:** Intake Work progress = 100% because 12/12 planned hours are assigned; Operations shows the task at 25%. Financial progress = 100% means configuration coverage. Explanatory prose does disclose this distinction, but only after the misleading labels.

**Fix/gate:** label these Staffing coverage and Commercial setup coverage. Reserve Work complete for execution, and keep earned/billed/paid amounts separate. All summaries must share documented definitions and drill down to their source.

### F05 — Setup order and field structure are inconsistent · P2 · O

**Reproduce:** advanced Intake's section sequence is 1, 2, 4–5, 3, 6, 7, 8; its sidebar lists Contract setup before Contract Items. Quick mode uses three stages while advanced mode exposes a large continuous form.

**Fix/gate:** one stable six-stage lifecycle with optional detail, consistent order and state. Quick setup becomes the default level of detail of that same draft, not a second mental model. Test switching detail levels without loss or repeated entry.

### F06 — Quick Intake cannot see an active company discipline · P1 · O/H

**Reproduce:** P58 quick setup says No active disciplines available and asks the company PMO to add them. Company Catalogs shows an active QA Electrical discipline for the company.

**Impact:** an apparent blocked prerequisite sends the user to configure something that already exists.

**Fix/gate:** reconcile company/project catalog scope and availability rules. If the active value is intentionally ineligible, explain why. Test scope changes, published/draft values, loading/error states and refresh. The exact data-source cause remains unconfirmed.

### F07 — Company/contact sources differ across workflows · P1 · O/H

**Reproduce:** Intake offers its synthetic client; New RFI's company choice shows BIMCorp; New Transmittal and New Change Order company selectors are empty. All are in P58.

**Impact:** the same job appears to have different parties depending on the module. Users may create duplicate companies to continue.

**Fix/gate:** shared canonical party picker with project engagements and explicit eligibility. Add a party once and reuse it everywhere authorized. Preserve historical document party snapshots; do not overwrite issued documents when a directory entry changes.

### F08 — A placeholder directory record is presented as a real contact · P1 · O

**Reproduce:** Intake Primary contact includes a synthetic `@project-directory.local` address. The project's directory presents the associated record with an Invite action.

**Impact:** internal placeholder data looks actionable and trustworthy.

**Fix/gate:** distinguish company-only records from real contacts. Never offer invite/send for a placeholder address; show Add contact. No invitation was sent in this audit.

### F09 — Repeated identity entry creates unnecessary reconciliation · P2 · O/J

**Reproduce:** Intake shows Client and Client company; Company job map separately offers adding the selected client. RFI repeats company/person/email fields alongside directory selection.

**Fix/gate:** select a canonical party once, prefill a clearly labeled document snapshot, and expose deliberate overrides with provenance. Separate adding a project engagement from selecting a client. Do not indiscriminately delete fields that serve historical or contractual purposes.

### F10 — Priority options repeat three times · P2 · O/S

**Reproduce:** P58 → RFIs → New RFI → Priority: Low, Medium and High each appear three times.

**Fix/gate:** normalize catalog option identity/precedence and render each eligible value once. Validate actual stored values, localized labels and legacy records. Source maps configured `rfi_priority` options directly; database duplication versus merged catalogs still requires diagnosis.

### F11 — View navigation opens Submittal editing immediately · P1 · O/S

**Reproduce:** Command Center → Open original for submittal 563 → selected record opens in Edit Submittal. Source initializes and resets `editOpen` from `canWrite`.

**Impact:** permission to edit is confused with intent to edit; users arriving to inspect a record face editable fields immediately.

**Fix/gate:** read mode on normal record navigation, explicit Edit action, clear Cancel/Save behavior, dirty-state handling, focus restoration, and view-preserving return. Existing authorization checks remain enforced.

### F12 — Submittal date disagrees between representations · P1 · O/S/H

**Reproduce:** submittal 563 editor Date Submitted = 2026-09-26; detail displayed Sep 25, 2026. Shop Drawing Control shows 09/26/26.

**Fix/gate:** one calendar-date contract across editor, detail, register, export and API. Source editor slices the date string; display helper treats date-only values locally but timestamps as instants. Timestamp/calendar conversion is a likely contributor, not a proven complete root cause. Test legacy timestamp input, date-only input and positive/negative UTC offsets.

### F13 — Operations puts configuration before today's work · P1 · O/J

**Reproduce:** P58 Operations places EDT preview, time review, reporting identity, APU history, governance and activated setup above the task. The task label was approximately 3,824px down within the inspected scrolling layout at a 919px viewport.

**Fix/gate:** tasks, blockers, next review, due dates and Log time first. Setup, budget history and provenance become linked secondary views. An assigned operator must identify and open today's task from the initial work view without traversing configuration.

### F14 — Task-to-document creation requires leaving and refreshing · P1 · O

**Reproduce:** Operations Document connections is empty and tells the user to create documents elsewhere, then refresh. The connection step does not offer the complete contextual creation journey.

**Fix/gate:** Create linked RFI/Submittal/Transmittal from the task, carrying project, work item, party and selected evidence. On save, link the canonical record and return to the task. Retry must not duplicate either record or relationship.

### F15 — Delivery action eligibility is unclear · P2 · O/H

**Reproduce:** the sample workflow assigns execution/review/approval to Roberto. Approve QC is disabled because a different reviewer is required, while Advance Phase remains enabled.

**Impact:** the UI leaves the user unsure whether they may advance or must get another reviewer. No transition was executed; a server-side bypass is not established.

**Fix/gate:** show exact next actor, missing gate and permissible next action. Test separation of duties and server rejection in a controlled environment; do not infer that enabled appearance means unauthorized advancement succeeds.

### F16 — Snapshot status and current commercial status are not easy to distinguish · P2 · O/J

**Reproduce:** Operations shows reporting identity work-in-progress/draft while the contract register shows the linked contract withdrawn. These can be legitimate historical snapshots, but their relationship is not sufficiently clear.

**Fix/gate:** Current contract status versus Activation snapshot, each dated and linked. Preserve immutable snapshot history; never silently rewrite it to match current state.

### F17 — Similar remaining-work numbers use different meanings · P2 · O/J

**Reproduce:** Operations remaining hours = 10 after 2 of 12 hours recorded; Team Performance remaining = 9 at 25% completion. These can reflect different valid calculations.

**Fix/gate:** distinguish Unused planned hours from Estimated remaining effort. Show formulas in concise help and avoid a shared label implying identical measures. No financial arithmetic defect is claimed.

### F18 — File entry promises conflict within the product · P1 · O

**Reproduce:** Files offers a drop zone saying only the filename is validated and no content stored; its empty state directs the user to confirmed Coordination Hub intake. Hub promises files are read/understood/renamed, then blocks the sample on a missing convention.

**Fix/gate:** one Upload/Import journey with explicit modes: record-only, stored evidence, connected import/delivery, and optional content analysis where available. Display storage, validation, destination and AI cost before commitment. The register should clearly identify each artifact's origin and version.

### F19 — Convention prerequisite becomes another long detour · P2 · O

**Reproduce:** Hub → Convention Builder opens a multi-section pre-wizard questionnaire and evidence checklist, with no explicit return-to-upload journey.

**Fix/gate:** offer an eligible approved template, then exceptions; explain who can complete unavailable prerequisites and preserve the pending upload intent. No convention should be activated without the existing required authority.

### F20 — Document registers lead with controls rather than records · P2 · O/J

**Reproduce:** RFI register has duplicate status control rows, many filters and export controls before even an empty state. Similar filter/provenance density appears in Contracts and Files.

**Fix/gate:** visible search, a small set of task-relevant filters, one status control, and an expandable advanced filter panel. Saved views and exact export scope remain available and visible when applied. Do not hide active filters.

### F21 — Similar documents and versions are hard to distinguish · P2 · O/H

**Reproduce:** P26 Files shows repeated identical viewpoint filenames on different rows, each v1; the same execution-plan filename also repeats. This does not prove duplicate binary data or incorrect versioning.

**Fix/gate:** show document identity, source issue/package and version relationship. Offer deliberate grouping and duplicate review with provenance. Never auto-merge by filename alone.

### F22 — RFI lifecycle, age and action presentation need reconciliation · P2 · O/J

**Reproduce:** P26 RFI-0006 is Draft RFI/open and not sent, has no required date, while the register reports five overdue RFIs and presents long Days Out values. Detail has four export choices and an always-visible official-response form below distribution.

**Fix/gate:** separate age, due-date lateness, draft/issued lifecycle and next actor. Explain any default overdue policy. Show the primary current action before optional report variants or response fields. Existing Back to RFI Log and Jump to Viewpoint are useful patterns to retain.

### F23 — Generic relationship controls do not explain business meaning · P2 · O/J

**Reproduce:** Submittal detail offers linking/creating another Submittal by default; linked-RFI fields and generic Linked Documents coexist. Register, Packages and Shop Drawing Control use different descriptions for related concepts.

**Fix/gate:** label relationships by purpose: responds to RFI, satisfies requirement, contains file version, issued in transmittal, supports change. One canonical relationship service, multiple views; retain legitimate many-to-many relationships.

### F24 — Meetings and schedule feel disconnected from delivery work · P2 · O/J

**Reproduce:** New Meeting begins with several blank agenda rows, a dense fixed-discipline attendee grid and `? Select ?` placeholders. Schedule is empty for P58 despite an operational task; available schedule types explain some document integration but do not expose Operations tasks.

**Fix/gate:** meeting agenda items link to existing actions; follow-ups reuse canonical tasks. Calendar offers explicit layers for delivery tasks and document deadlines. Different entity scopes may explain the current empty calendar; do not label it data loss.

### F25 — Project entry does not prioritize the user's next work · P2 · O/J

**Reproduce:** Headquarters project cards open Analytics. That page tells the user actionable work lives in Command Center, requiring another action. Headquarters includes many synthetic projects without a visible test/production distinction.

**Fix/gate:** role-aware project home with Resume setup for drafts and My work/Project overview for active jobs. Keep Analytics a clear destination. Add explicit test/demo metadata through reviewed migration, not name-based assumptions.

### F26 — Search and source actions overpromise their scope · P2 · O

**Reproduce:** Headquarters Search everything → `QA-INT-B` → No results found, while the project code is visibly present in the project register. Responsibility summary buttons repeat Open source 1/2/3 instead of record names.

**Fix/gate:** either implement permitted cross-entity search or name its actual scope accurately. Results and source links need project/type/title/context. Test project code/name and document numbers; never leak unauthorized results.

### F27 — Internal engineering language dominates customer screens · P2 · O/J

**Reproduce:** Analytics exposes Shared metric authority and absence of a retained history table; Reports says Phase A shell; financial surfaces expose raw IDs, hashes and internal entitlement/provenance codes; Headquarters shows OWNER_MISSING.

**Fix/gate:** plain action-oriented copy, with technical/audit detail under Details. Retain meaningful provenance and truthful unavailable states. Replace OWNER_MISSING with Assign an owner and a permitted action.

### F28 — Financial presentation adds avoidable cognitive load · P2 · O/J

**Reproduce:** Budget shows 600.000000 and full hashes; import requests an Authenticated file ID. APU has extensive planning/scenario/bonus content; its five-step guide does not match all numbered sections.

**Fix/gate:** currency-aware display precision with full underlying precision preserved, source-file picker, named versions, basic/advanced planning separation, and coherent step count. APU's Back action worked in the sampled journey; preserve it while adding explicit origin context.

### F29 — Notification controls contradict each other · P1 · O

**Reproduce:** Profile exposes email/RFI/submittal preferences, including checked switches. Notification Center calls Email and multiple event groups Coming Later and disables them while describing itself as canonical.

**Fix/gate:** one effective notification configuration with channel readiness, event availability, project overrides and a preview of actual behavior. Legacy controls must migrate or redirect. Do not equate a checked preference with delivery availability.

### F30 — Company identity and financial dates undermine confidence · P1 · O/H

**Reproduce:** Profile identifies BIMCorp Inc, but Company Profile's company-name field is blank without a displayed error. Financial Controls shows effective roles dated 12/31/1969.

**Fix/gate:** load the correct company context, distinguish missing/inherited/error states, and never render null/zero dates as actual authority dates. Underlying record corruption is not established; verify bindings and nullable dates.

### F31 — Profile is overloaded with unrelated administration · P2 · O/J

**Reproduce:** Profile combines personal identity, company, project list, activity, performance, notification switches, security, API/AI keys, Telegram, SendGrid and connectors. Feature Visibility also routes here. One Project Controls load-error alert appeared; retry was invoked, but recovery was not fully verified.

**Fix/gate:** separate Personal settings, Company administration, Integrations and Platform administration. Keep secrets/setup tasks away from routine profile editing; provide clear recoverable load errors. Do not treat a transient load error as a sustained outage.

### F32 — Role and administration scope are difficult to understand · P2 · O/J/H

**Reproduce:** project Team offers five configured roles but shows a legacy viewer member. Features describes four different roles. Administration loses the normal shell; feature flags say Applies to global despite scoped administration copy.

**Fix/gate:** human-readable effective permissions and scope labels, deliberate legacy-role mapping, consistent navigation. Validate actual server authorization separately. The audit did not establish cross-company access or a privilege escalation.

### F33 — Diagnostic/destructive-looking tools occupy normal work surfaces · P2 · O

**Reproduce:** Lens Viewpoints toolbar exposes Repair Chains and Reset Test Data; Headquarters prominently offers Clear session & sign in again.

**Fix/gate:** isolate diagnostics by environment/role, put them under support tools, explain consequences and retain appropriate confirmation. These actions were not executed. Do not remove recovery capabilities; make their context explicit.

### F34 — Reports and performance lack a consistent decision hierarchy · P2 · O/J

**Reproduce:** Reports mixes library and intelligence content; current-view print preview labels are tied to CVR filters rather than a clear report scope. Profile Performance Score 0 Needs Improvement lacks sufficient context about activity/evidence. Activity Log is a separate general event feed, while commercial history is elsewhere.

**Fix/gate:** select the business question, report scope and source first; preview exactly what will export. Unrated/insufficient data must differ from poor performance. Provide a navigable cross-record timeline without replacing immutable source logs.

### F35 — Empty states and integrations do not consistently hand off the next action · P2 · O/J

**Reproduce:** Knowledge is empty with authoring-milestone language. Lessons requires a closed issue without a direct journey. SharePoint destination setup requires an administrator but mainly offers Reload destination. APU Templates initially opens a new editor beside an existing published template.

**Fix/gate:** empty states explain why, who can act and where to go; published templates should be easy to select/reuse. Connector states distinguish unconfigured, unauthorized, disconnected and temporary failure. Any request sent to another person remains explicit, not automatic.

### F36 — Landing page needs product proof and a clearer audience journey · P2 · O/J

**Reproduce:** text-heavy hero with large unused desktop space; three proof cards describe implementation rather than showing the product. Authenticated users still see Get Started and Log In. Public navigation is primarily in the footer in the inspected state.

**Fix/gate:** actual product imagery, one concrete connected-job story, role-specific value and a credible primary CTA. Authenticated CTA: Open workspace. Avoid fabricated testimonials or certification implications.

### F37 — Public capability promises exceed or conflict with visible availability · P1 · O/H

**Reproduce:** public copy broadly promises automatic notifications, AI analysis, unrestricted workflow validation and easy one-step handling; settings shows multiple notification categories Coming Later. Features lists capabilities not located in the inspected navigation, such as Punch List/Daily Reports.

**Fix/gate:** a capability/plan/source-of-truth matrix reviewed against shipping behavior. Label availability and prerequisites. Absence from sampled navigation is not proof a capability does not exist; verify before removing or promising it.

### F38 — File-retention and brand statements conflict · P1 · O

**Reproduce:** About and Data Retention say physical files are not retained after routing; Privacy permits retained uploaded/imported files. Public pages also alternate technology-division/company-brand language.

**Fix/gate:** reconcile copy with verified deployed data handling and approved brand architecture. Product, operations and the appropriate policy owner must agree on one factual description. This is a content consistency finding, not a legal compliance conclusion.

### F39 — Pricing loses buyer intent · P1 · O

**Reproduce:** pricing plan CTA → Contact; selected plan and monthly/annual choice are not retained. Contact's interest list omits Team. Annual toggle itself works.

**Fix/gate:** carry selected plan, billing interval and intended next step into Contact or eligible signup. Allow correction without re-entry. Keep existing prices/entitlements until a separate commercial decision; do not silently restructure billing.

### F40 — Pricing and ROI presentation weaken credibility · P2 · O/J

**Reproduce:** five main plans plus several founding-partner offers create a long comparison. A displayed $805 per rejected-document claim does not substantiate one prevention paying an entire Professional year at $1,490. Industry loss/rejection claims have no visible supporting citation in the reviewed copy.

**Fix/gate:** concise comparison, explicit per-company/project/member basis, exact trial limits, transparent founding offer terms, and sourced claims. An ROI calculator should use editable assumptions and show its arithmetic. No conversion or willingness-to-pay research was performed.

### F41 — Help is comprehensive but poorly timed for the task · P2 · O/J

**Reproduce:** How It Works leads, in the authenticated session, to a long Help manual. The general getting-started topic is lengthy and oriented to explaining the platform rather than completing the current action.

**Fix/gate:** public product walkthrough separate from authenticated contextual help. Give short task instructions, a next action, and explicit Return to work; keep the full reference manual available. Anonymous access behavior remains untested.

### F42 — Responsive layout works in samples, but navigation chrome needs repair · P2 · O

**Reproduce:** at 390×844, landing and Intake reflow without document-level horizontal overflow. On Intake, the mobile drawer Close control is partly covered by the fixed header; long explanatory blocks occupy most of the screen. Escape successfully dismissed the drawer.

**Fix/gate:** consistent header/drawer stacking and focus behavior, compact optional guidance, accessible touch controls. Test 320/390/768/1280 widths, 200% zoom, long Spanish labels and on-screen keyboard. This was a sample, not comprehensive responsive certification.

### F43 — Form naming and action semantics are inconsistent · P2 · O

**Reproduce:** several close/row-action buttons and form fields appear without useful accessible names in snapshots; Meeting uses `? Select ?`; RFI validation refers to saving while the main action says Submit RFI. Dense forms mix draft saving, issuing and sharing concepts.

**Fix/gate:** explicit accessible labels, stable focus order, required-field errors linked to inputs, and distinct Save draft/Issue/Share actions. Complete keyboard and assistive-technology testing before claiming WCAG conformance.

### F44 — Lens web entry is specialized but loses project continuity · P2 · O/J

**Reproduce:** entering `/lens-next` after working in P26 selected the first project, 521 E TREMONT TEST PROJECT. The page correctly showed BIMLog connected, Navisworks disconnected, no active model, and disabled creation; its project picker and work panes are useful specialized controls.

**Fix/gate:** explicit project context when entered from a project, a safe standalone project chooser, and a visible return path. Preserve native capture, Working View, controlled publishing and stable issue identity. No native bridge, installer, model capture or publishing was tested in this audit.

## What should be preserved

- Saved Intake recovery and stable draft/work-item identity; browser Back recovered the sampled setup.
- Existing company catalogs, approved/published templates, workflow versioning and immutable financial snapshots.
- Explicit differences between setup coverage, actual work and payment—make them clearer, not less rigorous.
- Command Center links to authorized source records; sampled submittal selection worked.
- Inline Operations workflow expansion, rather than requiring another full-page jump.
- RFI Back to log, evidence links, explicit optional sharing/lifecycle distinction and source-document relationships.
- Submittal planned requirements versus received packages versus control table; these are distinct concepts, not automatically redundant data.
- Scope-aware filtering/exports, budget history, approved baseline evidence and permitted missing-data states.
- Lens Next's clear bridge status, controlled publishing, issue identity and native integration boundary.
- Sampled responsive reflow and Escape dismissal.

## Unproven concerns and audit limits

No intentional record mutations, activation, financial approval, file upload, external sharing, email sending, retirement, repair/reset or connector authorization occurred. Therefore no end-to-end transactional acceptance is claimed. View events may have been recorded automatically.

The audit did not test every member role, anonymous registration/login/password recovery, payment flow, generated export file contents, all notification deliveries, disconnected/offline editing, every locale, all browser engines, every connector, scale/performance under load, every administrator-only route, native installers or model operations. Console samples returned no warnings/errors, which is not a general proof of runtime correctness. No Lighthouse/Core Web Vitals measurement or formal accessibility conformance test was conducted.

The populated comparison contains historical test data. Repeated filenames/titles may be intentional fixtures; they are evidence of ambiguous presentation, not proof of duplicate business transactions. A missing convention or disconnected bridge is a valid prerequisite state, not inherently a defect. The failure is insufficient guidance and continuity when those states occur.

## Source corroboration

Paths relative to reviewed source root `F:\BIMLog\Worktrees\bimlog-template-gap-block01-20260923`:

- `artifacts/bimlog/src/pages/JobIntakeWorkspace.tsx:142`: prerequisite navigation preserves draft state and then changes location; linked APU/budget destinations at 1880/1883.
- `artifacts/bimlog/src/lib/job-intake-workspace-state.ts`: existing recovery mechanism to preserve.
- `artifacts/bimlog/src/pages/FinancialContractWorkspace.tsx`: register/detail implementation inspected for linked-contract handling.
- `artifacts/bimlog/src/pages/project/SubmittalsTab.tsx:2085` and `:2096`: edit state follows write permission; `:2718` renders submitted date.
- `artifacts/bimlog/src/lib/submittal-editor-contract.ts`: editor truncates submitted/required dates to the first ten characters.
- `artifacts/bimlog/src/lib/submittal-presentation-scope.ts:5`: date-only versus timestamp display behavior.
- `artifacts/bimlog/src/pages/project/RfisTab.tsx:1815`: configured priority options; `:1735`: directory-derived company choices in the inspected component.

Source inspection strengthens diagnosis but does not replace live transactional tests. No product tests were executed as part of this read-only UX audit, and no source-based assertion test is presented as proof of a full browser journey.

## Evaluation references

The proposed acceptance criteria use established principles of visible system status, consistency, recognition and user control from [Nielsen Norman Group's usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/). Reusing information already supplied in the same process follows [W3C guidance on redundant entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html); predictable menus follow [W3C guidance on consistent navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html). These references guide the design; they do not establish a formal compliance result for BIMLog.
