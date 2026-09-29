# Chrome audit coverage and remaining acceptance

September 28–29, 2026. **Observed means visited and inspected, not transactionally passed.** P58 is synthetic QA INTEGRAL 20260924 B; P26 is ELARA EAST, labeled RUBENS TEST PROJECT. Existing authenticated Project Admin/company user context was used. No sign-out or role changes.

## Executed coverage

| Surface | Executed inspection/action | Result or associated findings |
|---|---|---|
| Landing `/` | Desktop visual/DOM and 390×844 sample | Reflow works; text-heavy proof, authenticated CTA mismatch; F36–37 |
| Pricing `/pricing` | Monthly/annual toggle, plan CTA to Contact | Toggle works; intent lost; F39–40 |
| Contact `/contact` | Fields and interest options, no submission | Team missing; F39 |
| Features `/features` | Full capability/role copy review | Availability and role reconciliation needed; F32/F37 |
| About `/about` | Brand and storage claims | F38 |
| Privacy `/privacy` | Data handling/retention copy | Conflicts with no-retained-file claims; F38 |
| Terms `/terms` | Terms and report limitations read | No agreement accepted; no legal conclusion |
| Disclaimer `/disclaimer` | Record/hash/report limitations read | Preserve qualified evidence language |
| Data Retention `/data-retention` | Storage, archive and duration claims read | F38 |
| How It Works `/setup-guide` | Followed authenticated link | Opens long Help manual; F41 |
| Help `/help` | Getting-started content and context links | F41; contextual variants not all tested |
| Headquarters `/dashboard` | Project cards, scopes, controls, New Project/Cancel | Default Analytics, test data mixed, source labels; F25–26 |
| Headquarters search | Search everything with existing `QA-INT-B` code | No results despite visible project; F26 |
| Intake P58 `/intake` | Advanced/quick views, stages, linked prerequisites, browser Back | F01–09; saved values recovered |
| Intake mobile | 390×844 screenshot, drawer open, Escape | Reflow/no document overflow; Close clipped; F42 |
| Operations P58 `/operations` | Scroll hierarchy, task, workflow expansion, links | F13–17; no time/phase mutation |
| Command Center P58 `/command-center` | Filters/actions, selected source submittal jump | Exact submittal opened; F11/F20 |
| Analytics P58/P26 `/analytics` | Metrics, work and Files links | Links work; jargon and default landing issue; F25/F27 |
| Files P58/P26 `/files` | Empty and 14-record populated register | F18/F20–21; no upload/download |
| Coordination P58 `/coordination` | Empty intake and missing-convention path | F18–19 |
| Convention P58 `/convention` | Questionnaire/wizard entry | F19; not configured/published |
| Generator P58 `/generator` | Missing-convention state and link | Same prerequisite guidance issue |
| RFI P58 `/rfis` | Empty register, New RFI options, Cancel | F07/F09/F10/F20/F43 |
| RFI P26 `/rfis` | Six-record register, RFI-0006 View | Detail/evidence/back paths present; F22 |
| Submittals P58 `/submittals` | Package list, selected record/editor, close edit | F11–12/F23; no save |
| Submittal Register | Register tab, zero requirements | Legitimate distinction from one received package |
| Shop Drawing Control | Control tab, filters, received package/date | View works; date cross-check F12/F23 |
| Transmittals P58 `/transmittals` | Empty register, create form, Cancel | Empty company picker; F07 |
| Changes P58 `/change-orders` | Empty register, create form, Cancel | Empty company picker and impact entry; F07 |
| Meetings P58 `/meetings` | Create form, agenda/attendees, Cancel | F24/F43 |
| Schedule P58 `/schedule` | Board/list/calendar, empty state/types | F24; no calendar item created |
| Clash Reports P58 `/clash-reports` | Clash/Lens Viewpoints views | F33; repair/reset not run |
| Directory P58 `/directory` | Members/external company-contact record | F07–09; no invite |
| Team P58 `/team` | Member and role choices | F32; no role changes |
| Integrations P58 `/integrations` | Available/setup-required entries, folder/destination setup | F35; no external authorization |
| APU P58 `/financial/apu` | Plan, scenarios, saved version, Back | Back works; F28; no plan changes |
| Budget P58 `/financial/budget` | Amounts, source/import UI, tabs | F28; no approval/import |
| Cost structure | Budget tab, pinned version | Provenance preserved; display simplification |
| Budget history/baseline | History and approved snapshot opened | Existing immutable evidence to preserve |
| Contracts P58 `/financial/contracts` | Linked URL, register, detail/history | F01–02/F16/F28; no lifecycle action |
| Team Performance P58 `/commercial/team-performance` | Metrics and Assignment Planner tab | F17/F34; no staffing changes |
| Reports P58 `/reports` | Library/intelligence, current-view print dialog/Cancel | F27/F34; no generated artifact verified |
| Activity P58 `/activity` | Five general events and identifiers | F34; no completeness claim |
| Company Catalogs | Client, discipline, service, phase tabs | Active discipline observed; F06 |
| Company Delivery Workflows | Draft/published list, published version | Useful immutable versioning; no edits |
| Workflow Governance | Draft policy and selection state | Naming/guidance improvement; no policy mutation |
| APU/Pricing Templates | Published template/new editor presentation | F35; no template mutation |
| Feature Visibility | Settings entry to Profile | F31; transient load alert/retry not fully accepted |
| Profile `/profile` | Personal/company/projects/preferences/integrations | F29–31/F34; secrets not extracted |
| Company Profile `/settings/company-profile` | Loaded blank company fields | F30 |
| Notification Center `/settings/notifications` | Availability/preferences presentation | F29; no subscription changes |
| Financial Controls | Company roles, effective dates, entitlement setup | F30/F32; no financial/authority changes |
| Coordination Knowledge | Rules/methods/conflicts/lessons empty states | F35 |
| Project Administration `/admin` | Overview, companies and feature-flag presentation | F32; no settings mutation |
| Lens Next `/lens-next` | Project selection, bridge state, empty issue workspace | F44; no native model or issue mutation |
| Console sample | Warning/error logs at selected points | Empty samples; not complete runtime coverage |

## Transactional acceptance still required

Use approved synthetic fixtures in a verified preview/test environment. Production mutation is not implied by this audit. Where an action sends messages, grants access, accepts terms, publishes, or affects finances, honor the applicable explicit authorization and execution boundary.

| Journey | Required acceptance evidence |
|---|---|
| New user to first job | Anonymous navigation, signup/auth edge cases, clear company/project creation, no duplicate account/project |
| Minimal operational setup | Create draft, save, reload, resume, activate once, exactly one intended work structure |
| Commercial setup | Compatible APU/unit/rate/budget selection, contract link, return to Intake, values reconcile |
| Missing prerequisite | No convention/party/template/permission → recover or hand off → exact origin restored |
| Draft resilience | Browser Back/Forward, tab close/reopen, refresh, validation error, network failure and stale revision |
| Activation retry | Double-click/retry/concurrent activation cannot duplicate work items, tasks, accounts or contracts |
| Task execution | Assignment → evidence → time → review → next stage with correct actors and preserved history |
| RFI full lifecycle | Draft → issue → recipient response → decision/close; dates, ball-in-court and related records agree |
| Submittal lifecycle | Requirement → package revision → review → coverage/control; no automatic edit, date stable |
| Transmittal | Select exact file versions and recipients, preview issuance, explicit send behavior, return to source |
| Change | Originating issue/RFI → impact → approved process → commercial/operational updates with traceability |
| Meeting to action | Existing issue on agenda → assigned action → calendar/My work, no duplicate task |
| File intake | Record-only/stored/connected modes, invalid name, unavailable destination, retries and content-cost consent |
| Permissions | Project/company role matrix, read-only states, denied deep links, no cross-tenant search or exports |
| Notifications | Effective preference and actual channel availability agree; retry/dedup/unsubscribe behavior |
| Reports | Preview scope equals PDF/XLSX/DOCX rows, dates, totals and evidence; missing data labeled honestly |
| Native boundary | Existing Lens identity, Working View/capture/publishing contracts and supported installer behavior unchanged |
| Mobile/accessibility | Full keyboard journey, focus/error/readout, zoom and selected assistive technology; phone/tablet layouts |
| Migration | Before/after identity/count/relationship/financial reconciliation, rollback, historical snapshots retained |
| Real-user acceptance | Roberto plus representative coordinator/operator/admin complete assigned journeys without coaching |

## Audit self-review

The report was reviewed in a separate pass for unsupported claims: navigation interruption is distinguished from data loss; repeated filenames from actual duplicates; ambiguous button eligibility from a permission bypass; mixed formulas from incorrect arithmetic; source hypotheses from proven causes; public promise mismatch from a legal finding. No independent reviewer or completed transactional smoke suite is claimed.
