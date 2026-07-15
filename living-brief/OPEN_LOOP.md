# OPEN_LOOP.md - BIMLog Open Product Loops

This is the operating register for unfinished BIMLog work. It exists so customer feedback, half-built features, cleanup tasks, quality issues, plugin tasks, and Replit/Codex handoffs do not disappear across compacted chats or focused tasks.

## Mandatory New Task Startup Rule

Every new BIMLog Codex, Claude, or Replit task must start with this repository check:

The BIMLog repo is not in the current mounted project folder. Use the real repo path:
C:\Dev\bimlog
If that path is unavailable, search C:\Dev for a folder containing artifacts, lib, living-brief, package.json, and pnpm-workspace.yaml. Do not proceed until the real repo is mounted.

After the repo is confirmed, read:
- OPEN_LOOP.md
- QUALITY.md
- STATUS.md
- PLATFORM.md
- PLUGIN.md when plugin work is involved
- The real current code being changed

## Operating Rules

- Add any user request here if it will not be finished in the current task.
- Move shipped work to Watching or Closed with commit, version, build, or publish notes.
- Do not mark work complete just because code was written.
- Complete means built, verified, understandable to the user, and not duplicating an existing flow.
- Keep every item specific, testable, and connected to Quality 4.0.
- Before building a new button, tab, export, or workflow, check whether one already exists.
- Duplicate controls are quality defects unless each has a clearly different named purpose.
- Customer requests must be translated into BIMLog architecture, not copied blindly.
- If a task is interrupted, write the exact remaining work here before switching topics.

## Active Now

### Telegram Product Implementation 2 - AI Control Plane

- Independent review found the candidate AI control plane acceptable only after adding explicit provider-failure accounting and retry conflict checks. Failed provider requests now record a single zero-cost failure receipt, release any reservation, mark the run `failed`, and reject retried failure/settlement callbacks that reuse the same run with different details.
- Clean integration scope: secure provider connections, effective-dated price/entitlement policy, company budgets, user allocations, estimates, explicit confirmations, separate file-reading confirmation, reservations, cancellation, settlement, failure, append-only cost receipts, authenticated management routes, and the Profile/Project AI control panels.
- The correction explicitly tightens provider-management authorization, blocks pending/rotated key activation without validation, scopes budget/allocation responses by role, applies corrections to budget and allocation ledgers, and supersedes versioned policies instead of silently choosing ambiguous active rows.
- Integration evidence is stored under `C:\Dev\bimlog-tools\evidence\telegram-product-build-2-review`; the final reviewed run records behavior, authenticated HTTP, browser-role/source checks, Telegram Build 1 identity/link regression proof, validation commands, and sanitized hashes.
- Build 2 was cleanly integrated from `origin/master` at `6919765be8c7cd3f0042fa62b4283d4862210181` without Navisworks/plugin, RFI, generated mockup, or generated PLATFORM.md changes. Nothing was published, and Product Build 3 was not started.
- Legacy plaintext values in `users.openai_api_key` and AI rows in `user_connections.credentials` were preserved non-destructively. New plaintext writes are blocked; a separately reviewed migration/retirement plan is still required before those legacy columns or rows can be removed.
- Existing AI generation call sites remain on the legacy usage path. A later build must integrate each call site with estimate, explicit confirmation, reservation, broker execution, provider-reported settlement, and receipt display. No conversation or file-reading execution was added here.
- No real provider generation occurred. Production KEK provisioning, provider credentials, budget/pricing policy, production migration, live Telegram webhook configuration, customer messaging, file delivery, publish, and rollout remain explicitly out of scope.

### Telegram Product Implementation 1

- Starting commit: `18256153fe9c82ac149bfca53d9909a0c63d99c8`. Rejected local commit `2e10a1c` is being corrected locally and must not be pushed.
- Corrected source scope: channel-linking only. No RFI/Submittal notification delivery, assistant, AI, file-reading, delivery workflow, live webhook registration, production secret change, publish, or notifier completion was performed.
- Added additive schema/startup migrations for `notification_channels`, `channel_linking_tokens`, `notification_preferences`, `consent_records`, and `telegram_inbound_updates`; linking tokens now store accepted consent version and purpose `channel_linking`.
- Browser Profile now requires explicit unchecked consent before creating a Telegram link. The request must include `consentAccepted: true`, the exact current consent version, and purpose `channel_linking`.
- Telegram preferences start disabled with empty topics. The bot says the BIMLog channel is connected, not that active RFI/Submittal notifications are enabled.
- Webhook behavior now stores a durable inbound receipt first, returns 200 after receipt, treats duplicate adapter/update IDs as safe, and processes from the recoverable inbound-update table outside the acknowledgement path. Startup recovery processes durable `received` rows.
- Identity conflict handling rejects active Telegram identity reassignment to a different BIMLog user instead of silently revoking another user's link. Browser and Telegram disconnect now use one canonical transactional revocation path.
- Profile and deterministic bot responses have reviewed English/Spanish text with UTF-8 accents. Source scans reject `espanol`, `ingles`, `estan`, `task_notifications`, default enabled RFI/Submittal Telegram topics, duplicate disconnect implementations, webhook payload logging, TODO/mock behavior, and destructive migrations.
- Local source gates passed after correction: `git diff --check`, `pnpm run check:mojibake`, `pnpm run check:living-brief`, `pnpm run typecheck`, `$env:PORT='3000'; pnpm run build`, and `pnpm --filter @workspace/api-server exec tsx scripts/telegram-product-proof.ts`.
- Behavior evidence passed against a fresh disposable PostgreSQL 18 database on `127.0.0.1:55433`; the temporary server was stopped after the run. The final runner exited 0 and recorded all consent, token, duplicate-update, adapter/secret rejection, private-chat, concurrent-consumption, identity-conflict, disconnect, restart-recovery, UTF-8, status-privacy, and disabled-topic gates at `C:\Dev\bimlog-tools\evidence\telegram-product-implementation-1\20260714-141736\behavior-results.json`.
- Review status: corrected implementation and local evidence are complete; awaiting independent review. Not self-accepted, not pushed, and not published.

### Canonical RFI Workflow and Complete Issued RFI Package

Purpose: eliminate the divergent New RFI, viewpoint-created RFI, existing RFI, sent RFI,
closed RFI, and reopened RFI experiences. BIMLog records and audits human decisions; it must
not impose one-RFI-per-viewpoint behavior or block authorized users from editing/reopening a
record merely because its status changed.

Canonical platform requirements:
- One numbered 1-7 field structure and one field contract across every RFI state and entry path.
- New, viewpoint-created, existing, sent, closed, revised, and reopened RFIs expose the same
  applicable fields. Titles and state styling may differ; field meaning and edit behavior may not.
- Authorized users can edit every RFI state. Close/reopen/edit actions must be explicit and logged.
- Date Required must be editable and persist in every applicable state.
- Section 4 is always Reference Information / Attachments. Add Reference must immediately show
  the value, allow removal, preserve human-readable names, and save through every create/edit path.
- A viewpoint screenshot is an attachment, not a special alternate RFI layout. The user can
  show/hide it in the issued RFI, replace it, and crop it non-destructively while preserving the
  original evidence file.
- Users can capture or paste a screenshot and crop it with a snipping-tool-style workflow before
  attaching it to the RFI.
- Section 5 is question-only. AI question assistance is click-driven, credit-visible, and never
  reads attachments unless the user explicitly invokes file-reading AI.
- Section 6 keeps each impact choice directly beside its dependent fields. Cost Amount and Cost
  Reason belong with Cost Impact. Calendar Days and Schedule Reason belong with Schedule Impact.
  The same values must persist through create, duplicate-number retry, edit, response, PDF, DOCX,
  Excel/log output, activity history, and audit output.
- Section 7 contains distribution, email, and responses. Generated email has an explicit Copy
  action with visible success feedback. Text-only email AI remains click-driven and does not read files.
- Existing/sent/closed/reopened state must be unmistakable without turning informational labels
  into buttons. Use the shared primary/secondary/danger button hierarchy and remove duplicate controls.
- Preserve attachments, linked items, ball-in-court history, responses, Jump to Viewpoint, Raise
  Change Order, exports, audit, and AI text assistance while unifying the presentation.

Viewpoint relationship and plugin-facing requirements:
- One viewpoint may source any number of RFIs for different questions, disciplines, companies,
  or recipients. `source_viewpoint_id` is lineage, not a uniqueness key.
- Repeated POSTs to the existing `.../rfis/from-viewpoint` contract with the same viewpoint ID
  must create separate RFI records, separate sequential RFI numbers, and separately linked evidence.
- Diagnose the current plugin failure from the exact HTTP status/body and plugin debug log. Do not
  invent a second RFI endpoint or remove the project-mismatch guard.
- The platform endpoint and plugin must show actionable errors instead of `Failed to create RFI.
  Check connection.` when the server returned a more specific cause.

Complete issued-RFI PDF package:
- The final RFI export is one complete PDF containing the BIMLog RFI pages followed by all selected
  supporting documents in deliberate user-controlled order.
- Original PDF attachments must be copied as native PDF pages. Preserve MediaBox, CropBox, page
  rotation/orientation, vector content, and native sizes including 36x48, 24x36, and 11x17.
- Mixed page sizes inside one RFI package are valid. Never shrink drawings to Letter, stretch them,
  crop them, or rasterize them.
- Word, DOCX, Excel, and image attachments require an explicit conversion path that preserves the
  original page/sheet presentation as closely as the source format allows. Conversion failure must
  be visible and must not silently omit an attachment.
- The user selects which attachments appear in the issued package and whether the viewpoint image
  appears. The export must clearly report any attachment that cannot be converted or merged.

Verification required before customer retest:
- Compare all RFI entry/state variants side by side and prove the 1-7 structure and field contract match.
- Create at least two RFIs from the same viewpoint and prove both remain independently editable.
- Verify show/hide/crop screenshot behavior and preservation of the original image.
- Generate a mixed-size PDF package and inspect page boxes and vector preservation, including the
  supplied real River Avenue RFI PDF when available.
- Run behavior checks, `pnpm run check:mojibake`, `pnpm run typecheck`, and the production build.
- Update this register with commit, push, publish, package, and Roberto/customer verification status.

2026-07-13 focused RFI pass:
- Completed: preserved `rfis.cost_impact_reason`, `rfis.schedule_impact_reason`,
  `rfi_responses.cost_impact_reason`, and `rfi_responses.schedule_impact_reason` in the Drizzle
  schemas and confirmed startup migrations remain additive `ADD COLUMN IF NOT EXISTS`; verified
  feedback_items indexes still match the idempotent migration.
- Completed: fixed Section 6 Cost Increase TBD handling so the Cost Reason / Explanation field is
  visible and saved without requiring a cost amount on new RFI, duplicate-number retry payload,
  existing RFI edit, and official response save.
- Completed: normalized official response impact writes so no-impact/TBD paths do not preserve
  stale cost amount, schedule days, or reason values.
- Completed: confirmed `source_viewpoint_id` remains non-unique lineage only and the
  `from-viewpoint` route has no duplicate-prevention check; storage uses unique physical filenames
  for repeated screenshot uploads.
- Completed: removed the silent viewpoint-prefill catch by logging a traceable server message while
  still allowing RFI creation to continue.
- Verification: `pnpm run check:mojibake` passed, `pnpm run typecheck` passed, and
  `$env:PORT='3000'; pnpm run build` passed after rerun with filesystem approval for Vite cache
  writes under the real repo.
- Deferred: browser screenshot crop tools, complete issued-RFI PDF package/native PDF page-copy,
  Word/DOCX/Excel/image conversion verification, River Avenue page-box comparison, and authenticated
  repeated-viewpoint HTTP proof still require the larger RFI package implementation/test harness.

2026-07-13 RFI Build 1A Correction 3:
- Completed: removed the unreachable always-true create/detail shortcuts and deleted the obsolete duplicate New RFI and Existing RFI field markup after moving support controls into the reachable canonical path.
- Completed: kept Add Reference, clean attachment labels, local file upload, image upload/paste/capture review, cloud attachments, package inclusion, question AI, email AI, Copy Email, exports, response save, viewed-by, ball-in-court, jump-viewpoint, and change-order actions reachable from the canonical RFI structure.
- Completed: detail edit now persists priority, drawing number/title, spec section, detail number, note number, and location through the canonical adapter instead of discarding edits. Submitted To address/phone are read-only unless real values exist because the current API save path does not support editing them.
- Verification: `git diff --check` passed with only a pre-existing line-ending warning on the mockup generated file, `pnpm run check:mojibake` passed, `pnpm run typecheck` passed, and `$env:PORT='3000'; pnpm run build` passed after filesystem approval for Vite temp/cache writes.
- Still open for independent Build 1B review: no browser visual acceptance was claimed; dedicated visual crop tooling and the larger complete issued-RFI PDF package work remain deferred above.
- PDF fixture note: local `pdfinfo`, `pypdf`, and resolvable `pdfjs-dist` were unavailable in this
  environment during this pass, so River Avenue page boxes were not programmatically recorded here.
- Publish status: not published.

2026-07-13 RFI Build 1A Correction 4:
- Corrective status: implementation and local Source Gate evidence only. Build 1A remains unaccepted pending independent review; Build 1B was not started and the application was not published.
- Completed: the single production `RfiCanonicalForm` now owns placement for saved-RFI actions and specialized Section 1, 4, 6, and 7 behavior. No fallback or duplicate 1-7 field form was restored.
- Completed: Section 1 visibly restores current ball in court, custody history, activity timeline, and the Viewed By results panel. Section 4 restores linked items, project-file selection, source-viewpoint evidence, interactive package include/order controls, image include/exclude, and saved-crop preservation/reset. Section 6 shows latest confirmed response impacts.
- Completed: Section 7 restores manual Mark as Sent, connected SendGrid delivery and setup guidance, existing responses and clean attachment names, explicit Add Response, local/cloud/project-file response attachments, response AI text assist, Answered By, response cost/schedule accountability fields, closing status, and one Save Response action at the bottom of the response form.
- Completed: the visible Create Revision action now uses the real linked-revision API mutation and audit path. The obsolete preload/create pseudo-revision path and disconnected legacy `.doc` generator were removed.
- Completed: saved RFI actions are passed through `savedRfiActions`; `RfiActionBar` omits any action without a real handler. New viewpoint-prefilled RFIs cannot render Jump to Viewpoint without a handler, while saved RFIs retain the existing local jump handler.
- Completed: New RFI restores project-directory pickers, project-file references, and explicit higher-cost AI file reading with a confirmation warning. Text-only question/email/response AI remains click-driven and states that attachments are not read.
- Source cleanup: the focused definition-only scan found no local constant, state setter, handler, ref, or helper function occurring only at its declaration after correction.
- Local verification: `git diff --check`, `pnpm run check:mojibake`, `pnpm run typecheck`, and `$env:PORT='3000'; pnpm run build` passed. The first sandboxed build attempt was blocked by Vite temp-file permissions; the approved rerun passed. Independent browser behavior and visual acceptance remain required before Build 1A can be accepted.

2026-07-13 Build 1 - Canonical RFI UI:
- Scope: browser UI only for the canonical RFI 1-7 structure. No export routes, PDF/DOCX/Audit
  PDF/Complete PDF generation, Office conversion, plugin code, production data, environment,
  services, or database behavior were changed.
- Completed: widened the RFI create/detail containers to use desktop content width more
  responsibly and removed the narrow floating form presentation shown in rejection screenshots.
- Completed: existing RFI detail now separates Section 3 Submitted To from Section 2 Submitted By
  with its own visible section header instead of rendering "3. Submitted To" inside the Section 2
  card.
- Completed: removed the fake numeric crop UI and the predetermined 10 percent crop action from
  browser RFI controls. Existing saved crop metadata is preserved and can be cleared, but real
  visual crop tooling remains a later gated build.
- Completed: Section 4 keeps references, attachments, viewpoint preview, package include/exclude,
  and package order controls together. Section 5 remains question and AI question assist. Section 6
  keeps cost/schedule conditionals with their related fields. Section 7 keeps distribution, email,
  Copy Email, and responses together.
- Screenshot evidence generated at desktop viewport:
  - `C:\Users\soporte\AppData\Local\Temp\rfi-ui-acceptance-build1\new-rfi.png`
  - `C:\Users\soporte\AppData\Local\Temp\rfi-ui-acceptance-build1\viewpoint-created-rfi.png`
  - `C:\Users\soporte\AppData\Local\Temp\rfi-ui-acceptance-build1\existing-draft-rfi.png`
  - `C:\Users\soporte\AppData\Local\Temp\rfi-ui-acceptance-build1\sent-rfi.png`
  - `C:\Users\soporte\AppData\Local\Temp\rfi-ui-acceptance-build1\closed-rfi.png`
  - `C:\Users\soporte\AppData\Local\Temp\rfi-ui-acceptance-build1\reopened-rfi.png`
- Deferred: export quality changes and real snipping-tool-style visual crop implementation remain
  for later gated builds. The screenshots are deterministic UI acceptance evidence, not a publish
  or production-data verification.

### Platform-Wide Report Design System

Shipped first implementation scope on 2026-07-10:
- Central module/variant theme registry in `artifacts/api-server/src/lib/pdf-kit.ts`.
- Schedule Calendar, Board, and List PDF variants.
- RFI detail and audit PDF variants, with RFI DOCX/log variants reserved in the registry.
- Lens Coordination PDF family and reserved Lens register/audit variants.
- Submittal detail and audit PDF variants, with log/Shop Drawing Control variants reserved.
- Modified PDF title/download filenames aligned; Schedule export controls distinguish configuration from generation.
- Full route/control inventory recorded in `living-brief/REPORT_DESIGN_SYSTEM.md`.

Intentionally deferred to the next report-standardization round:
- Shipped in Phase 2: reserved families are now active for Transmittals, Change Orders, Meetings, Files/CVR, Clash Reports, the general Reports catalog, Submittal Log, Shop Drawing Control, and imported Submittal Tracking reports.
- Shipped in Phase 2: removed the broken individual Meeting PDF control; clarified individual Transmittal/Change Order and Lens PDF/Excel labels.
- Remaining: migrate the longest legacy detail/audit layouts onto shared table/page-break primitives where they still require route-specific construction-document sections.
- Remaining: add authenticated production-data visual regression fixtures for every export route; Phase 2 uses deterministic multi-page fixtures plus typecheck/build verification.

### Submittals / Shop Drawing Control Field Test
Shipped baseline: commit 94c9c4b - Unify submittals shop drawing control.

Watch for:
- Ruben importing his real Shop Drawing Control Excel.
- Drawing Type filters, especially Sleeve / Sleeve V / Sleeve H.
- Trade filter behavior.
- Building Level source and imported row levels.
- Whether Register vs Submittal Packages vs Shop Drawing Control is clear to users.
- Whether exports match Ruben's operational Excel expectations.

Open design issue:
- BIMLog needs two connected worlds, not one confused Submittal bucket:
  - Shop Drawing Control: coordination deliverables, drawing packages, floors, trades, review status, RFI links.
  - Submittal Packages: equipment/material/product/documentation packages, approvals, warranties, O&M, final handover records.
- These worlds must cross-link where a shop drawing depends on an equipment/material submittal package.

## Ready Next

### RFI Unfinished Work
Purpose: finish the RFI handover items without creating a second disconnected RFI workflow.

Open items:
- Cloud file pickers and OAuth environment follow-up from RFI_HANDOVER.md.
- RFI attachment/file handling and generic binary download route for uploaded files.
- RFI impact layout, save unification, configurable RFI types, and numbering cleanup.
- RFI AI assist must stay split between low-cost text/email drafting and explicit-cost file reading.
- Cross-module links from RFIs must persist through the existing linked-items model, not a duplicate relationship system.

### Navisworks Plugin Two-Way Status Sync
Purpose: reduce web/plugin round-trips for status changes.

Known requests:
- Ruben wants to change Lens viewpoint status from the plugin.
- Ruben asked whether moving a viewpoint into a folder such as Resolved should update the platform.
- The plugin must not guess silently. If folder movement is supported, it must be explicit, logged, and reversible.

Guardrails:
- Read BIMLogLensPanel.cs and BIMLogApiClient.cs in full before editing.
- Understand all Lens buttons first: Save Viewpoint(s), Sync with BIMLog, Pull from Platform, Create RFI from Viewpoint, Load Selected Viewpoint, Done Managing Viewpoints, Reconcile/Cleanup.
- Protect non-BIMLog folders such as LEVELS.
- Protect against wrong-project sync. The plugin should clearly show the selected BIMLog project and warn before syncing if the Navisworks model/project context appears mismatched.
- Old dated BIMLog folders must be recognized for migration, but the final operational tree should be simple.

### BIMLog Feedback Widget
Purpose: replace Replit's feedback widget with BIMLog's own feedback/report-bug widget.

Requirements:
- No Replit branding.
- Available across the authenticated app.
- Capture page URL, project id when present, user id/email, category, severity, message, optional screenshot/file.
- Super admin can review submitted feedback.
- Should feed the Open Loop process instead of becoming lost chat context.

### Domain / Replit Branding Follow-Ups
Purpose: remove deployment confusion and keep BIMLog branding/customer paths clean.

Open items:
- Confirm bimlog.app and www.bimlog.app production behavior after DNS/certificate propagation.
- Keep old Replit URLs out of user-facing source, OAuth callback docs, reports, and emails.
- Clearly label future release notes as committed/pushed, needs publish, or live verified.
- Do not publish from this task.

### Lens Excel Custom Report
Purpose: satisfy Ruben's request for a customized Lens Excel export with a report-style summary.

Required behavior:
- Keep the existing raw export.
- Add a configurable report export with a summary/pivot-style worksheet.
- Include filters and layout similar to Ruben's manual Excel customization.
- Export should be useful to send directly to clients without manual cleanup.

### Platform-Wide Duplicate Control Cleanup
Purpose: remove repeated buttons and confusing duplicate controls.

Known issue:
- Pages often show multiple Export PDF / Export Excel buttons that appear identical.

Rule:
- If two buttons do the same thing, keep one.
- If two buttons export different scopes, name them by scope and add hover help.
- This is a Quality 4.0 defect category, not cosmetic polish.

### Mojibake / QUALITY.md Enforcement
Purpose: keep Living Brief, UI text, reports, emails, and exports clean UTF-8.

Open items:
- Run `pnpm run check:mojibake` before production builds, publish prompts, and release handoffs.
- Treat user-facing mojibake as a release blocker.
- Enforce QUALITY.md rules: spreadsheet-simple UI, connected data, no duplicate controls, clear ownership, audit-ready output.
- Do not fix corrupted text by deleting valid Spanish; repair the encoding/source.

### AI Usage / Cost Controls
Purpose: make AI useful without surprising BIMLog or customers with hidden cost.

Current policy direction:
- Roberto/internal accounts can use the platform-managed Anthropic/Replit model path.
- External users should eventually use included quotas, managed paid tiers, or their own AI keys depending on product tier.
- Low-cost AI assist (description/email drafting) should be separate from high-cost file reading.
- Heavy AI file reading must show a clear warning before use.
- AI usage must be visible to the user and to super admin by user, project, feature, billing mode, and time period.

## Watching

### RFI Create/Detail UX + Complete PDF Package
Shipped commit: this RFI quality-pass commit - Finish RFI detail UX and complete PDF export.

What changed in this pass:
- Existing RFIs now expose the same numbered 1-7 structure as New RFI.
- Sent and closed RFIs remain editable for authorized users.
- Closed RFIs use an explicit Reopen RFI action instead of masquerading as a revision.
- Existing RFI edit now persists Date Required and Submitted By address/phone with the rest of the canonical RFI fields.
- Complete RFI PDF export is a distinct action and route.
- Complete RFI PDF copies uploaded PDF attachment pages as native PDF pages via pdf-lib, preserving page boxes/rotation/vector/text as provided by the source PDF.
- Complete RFI PDF converts image attachments to PDF pages with aspect ratio preserved.
- Complete RFI PDF fails explicitly when a DOC/DOCX/XLS/XLSX or unsupported attachment needs a converter that is unavailable in the runtime.

Local proof completed:
- River Avenue source PDF was copied into a package after BIMLog-generated cover pages and before a manifest page.
- River Avenue source page MediaBox, CropBox, rotation, native width/height, and displayed orientation matched the merged package pages.
- River Avenue source file size and modification timestamp were unchanged after the native-copy test.
- Local LibreOffice conversion fixtures passed: DOC, DOCX portrait, DOCX landscape, XLS, and XLSX multi-sheet all converted to PDF pages; corrupt DOCX is rejected before conversion.
- Image package rendering primitive passed for include, exclude, and crop/reset PDF generation.

Continuation added after f1ad6f7:
- RFI records now persist `attachment_package_json` and `image_presentation_json`.
- Existing RFI Section 4 can include/exclude package attachments and reorder the Complete RFI PDF package.
- Viewpoint/image presentation state supports include/exclude, replacement image, crop metadata, reset crop, paste image, upload image, and browser screen capture controls.
- New RFI Section 4 supports upload, paste, capture, pre-attach image review, crop, and reset before attaching the image.
- Server-side image crop bounds are normalized and validated before save/export.
- Complete RFI PDF follows saved package order instead of database order.
- Complete RFI PDF uses Replit-supported `libreoffice`/`soffice` runtime detection and a local LibreOffice fallback path for DOC/DOCX/XLS/XLSX conversion, with timeout, temp directory isolation, cleanup, and explicit attachment-level failure.

Watch after publish:
- Roberto should run authenticated Replit acceptance for create/edit/reload/export with real project data.
- Verify persisted package selection/order after create, edit, sent, closed, and reopened states.
- Verify image include/exclude, replacement, crop, reset, and re-crop in the deployed browser flow.
- Verify DOC, DOCX, XLS, and XLSX conversion in Replit where `.replit` provides `libreoffice`.
- Verify corrupted/unsupported attachment failure returns an explicit failed Complete RFI PDF response.

### Schedule / Coordination Planner
Shipped commit: 2f9093b - Build coordination planner schedule.

What shipped:
- Calendar, Board, and List planner behavior.
- Editable buckets/sprints, default buckets, item moving, bucket rollover, and rollover history.
- RFIs and Submittals remain source-owned while Schedule stores planner placement separately.
- Structured 3D Model schedule fields: level, trade, company, assigned user, notes, due date, and status.
- Backend schema/startup migrations for planner buckets, item placements, rollover history, and milestone planner fields.

Watch after publish:
- Ruben's sprint/kanban workflow with incomplete tasks rolled forward.
- Whether 3D Model tasks are clear enough for trade/company/user responsibility.
- Whether delay attribution can identify repeated bottlenecks by company, trade, and user.
### Submittals Unification
Shipped commit: 94c9c4b - Unify submittals shop drawing control.

What shipped:
- One visible sidebar item: Submittals.
- Internal tabs: Submittal Packages, Register, Shop Drawing Control.
- Shop Drawing Control uses live existing submittals.
- Filters: Building Level, Trade, Drawing Type, Date, Review Status.
- Sleeve filtering includes Sleeve, Sleeve V, and Sleeve H.
- Building Level options combine Convention Builder /levels data with real submittal rows.
- Export labels/files use Shop-Drawing-Control scope.
- Backend Shop Drawing Control PDF/Excel exports respect the same filters.
- BIMLog's own Shop Drawing Control Excel export can be re-imported deterministically.

Watch after publish:
- Ruben's real import file.
- Whether users understand Register vs Submittal Packages vs Shop Drawing Control.
- Whether the Excel export is client-ready.

### Living Brief QUALITY.md
QUALITY.md is now a first-class Living Brief tab and should guide every feature.

Active enforcement needed:
- Run mojibake scan before production builds.
- Keep UI spreadsheet-simple.
- Every feature must answer record, location, owner, responsibility, change, reason, date, state, proof, and next decision.

### RFI Build 1 Correction
Correction started from commit f9793e1ff230632c59ac6dca5ace99b78f87bc9a after the first Build 1 screenshot evidence was rejected as synthetic.

What changed:
- `artifacts/bimlog/src/pages/project/RfisTab.tsx` now defines the canonical RFI section components:
  `RfiSectionHeaderStatus`, `RfiSectionSubmittedBy`, `RfiSectionSubmittedTo`,
  `RfiSectionReferencesAttachments`, `RfiSectionQuestion`, `RfiSectionImpact`, and
  `RfiSectionDistributionResponses`.
- The New RFI create flow renders all seven production sections through those shared components.
- The existing RFI detail/edit flow renders the same seven section component names in view/edit context.
- Saved RFI header state actions are centralized through `getSavedRfiActionMatrix`.
- Test-only harness files were added for real-component evidence:
  `artifacts/bimlog/src/pages/project/RfiCanonicalUiHarness.tsx` and
  `artifacts/bimlog/rfi-canonical-harness.html`.

Evidence note:
- The correction harness imports `RfiCanonicalUiHarness`, which imports the production section components from `RfisTab.tsx`.
- The harness is a Vite-served test fixture and is not linked from production routes.
- PNG screenshot capture was attempted with Playwright, but this machine has neither Playwright's browser payload nor a local Chrome/Edge executable available. No browser was installed because the correction request forbids system installation.
- Do not mark Build 1 accepted until Roberto captures/reviews the nine required harness or production screenshots with a browser available.

Correction 2:
- Starting commit: dff68daae9a8b023c3ac92d9f2569f4575cd9c4d.
- The prior heading-wrapper pattern was rejected because it still allowed separate create/detail/harness field markup.
- `RfiCanonicalForm` now owns the canonical seven-section field markup and renders through `RfiActionBar`.
- `RfiCreatePanel`, `RfiDetailPanel`, and `RfiCanonicalUiHarness` all render `RfiCanonicalForm`.
- The `RfiSection...children` wrapper components were removed.
- The harness no longer defines its own `Field`, `ImpactFields`, section wrappers, or action labels; it supplies fixture values and no-op callbacks only.
- Source proof searches passed for the three `RfiCanonicalForm` call sites and absence of the rejected wrapper/field helper patterns.
- Screenshot capture was retried with the requested existing Chrome executable path (`C:\Program Files\Google\Chrome\Application\chrome.exe`). Chrome launched through Playwright, but localhost Vite startup could not be kept running in this sandbox: direct background process launch hit Windows PATH/environment issues, PowerShell job launch required escalation for Vite temp files, then Vite required `PORT`, and the final `Start-Process -UseNewEnvironment` path caused Node CSPRNG initialization failure. No browser or system package was installed.
- Do not mark Build 1 accepted until the ten requested screenshots are captured from `artifacts/bimlog/rfi-canonical-harness.html` or the live app with Vite bound to `127.0.0.1`.

### RFI Build 1A Correction 5
Starting commit: `9a167fc8598dd93ab4a406c03fa5349e229b4b83`.

Source correction completed:
- The single `RfiCanonicalForm` remains the owner of the seven-section create/detail/edit structure.
- Section 3 restores project-directory company/contact selection, RFI-only external people, and real project-directory company creation without fabricated fallback data.
- Section 7 restores explicit project-contact selection, clean external-recipient display, external-contact creation, and recipient removal without exposing internal `EXT:` storage values.
- Section 4 keeps manual references and uploaded attachments as distinct UI collections, opens authenticated `/api/` attachments through an authorized fetch, opens HTTP(S) references, keeps plain names as text, and removes from the correct source collection.
- Existing RFI edit now persists Project Address through the existing update API and activity record path.

Acceptance state:
- Correction 5 source is ready for independent review.
- Build 1A remains pending independent acceptance.
- Build 1B has not started.
- Do not publish from this source-review step.

Final micro-correction:
- SendGrid CC construction now parses stored distribution entries before validating email addresses, so plain project contacts, legacy external contacts, and URI-encoded external contacts are delivered.
- CC addresses are deduplicated case-insensitively and malformed or empty distribution entries are excluded.
- Build 1A remains pending independent acceptance. Build 1B has not started. Nothing was published.

### RFI Build 1B Browser Acceptance Evidence

- Starting commit: `8b9f9e4ba562f4e74ad61a160204d6738afe0c66`.
- Environment: real BIMLog browser route at `http://127.0.0.1:3100/projects/1/rfis`, current API bundle on `127.0.0.1:3101`, isolated PostgreSQL database `bimlog_rfi_test` on `127.0.0.1:55432`, and existing Chrome `150.0.7871.114`. No harness, static mockup, production service, or production data was used.
- Browser-found corrections: saved-RFI edit mode now exposes one primary `Save RFI` and one neutral `Cancel` action; detail headers now identify `Draft RFI`, `Sent RFI`, `Closed RFI`, `Reopened RFI`, and `Revised RFI` instead of the ambiguous `Existing RFI` label.
- Persisted acceptance records: canonical matrix IDs `39` (draft/edit/upload), `40` (sent/response/email/export), `41` (closed), `42` (reopened), `44` (revision), `45` (viewpoint-created), `46` (browser-created conditional impacts/reference), UI lifecycle IDs `51` and `52`, and participant/directory RFI ID `53`.
- Passed browser matrix: shared 1-7 structure; create and existing edit persistence; immediate manual reference display; cost amount/reason and schedule days/reason conditionals; real attachment upload with clean name; reference-removal isolation; decoded external distribution display; project-directory company/contact creation and selection; encoded external recipient persistence; click-driven Copy Email; zero automatic AI requests; response visibility; ball-in-court history; UI-driven mark-sent, close, reopen, and revise transitions; viewpoint control; linked-item controls; authenticated attachment download; HTTP reference opening; and PDF, Complete PDF, DOCX, and Audit PDF downloads.
- Required screenshots: `C:\Dev\bimlog-tools\evidence\rfi-build-1b\20260714-073359\01-new-rfi-initial.png` through `12-section7-distribution-email-responses.png`. Supporting proofs are `acceptance-results.json`, `state-label-proof.json`, `behavior-proof.json`, `participant-directory-proof.json`, `export-download-proof.json`, and `runtime-proof.json` in the same folder.
- Isolated configuration observation: the local seed contains all four RFI status values but does not declare a default; new API records therefore carried the local configured status `responded` while the independent send lifecycle remained `draft`. This was not hidden or treated as production behavior, and no test-helper or API change was made in this browser-only pass.
- Final verification: `git diff --check`, `pnpm run check:mojibake`, `pnpm run check:living-brief`, `pnpm run typecheck`, and `$env:PORT='3000'; pnpm run build` passed. The approved helper restarted the rebuilt API as PID `22348`; its loopback listener, health 200 response, bundle timestamp, length, and SHA-256 were reverified before a successful post-restart browser read of RFI `40`.
- Acceptance status: evidence submitted for independent master review. Build 1B is not self-accepted. Nothing was published.

### RFI Build 2 Persistence And Lifecycle Integrity

- Starting commit: `082d0519954d3b943931fd43e68ebc9e44aa9e28`.
- Canonical create, duplicate-number retry, existing edit, sent edit, closed edit, reopened edit, reload, and intentional clearing now use the same complete persistence contract. Clearing an impact selection also clears stale amount, day, and reason values.
- Normal and viewpoint-created RFIs resolve a safe configured creation status: explicit safe default first, then semantic `draft`, then semantic `open`; responded/closed defaults and missing safe configuration fail explicitly.
- Close and reopen are explicit transactional operations with persisted actor/timestamp evidence, custody-row termination/restoration, unsent author-held behavior, and lifecycle activity records. Sent drafts advance to the configured semantic `open` status instead of an unconfigured hard-coded value.
- Revision numbers are allocated across the entire family under a transaction advisory lock. Revisions preserve the complete question-side record and viewpoint lineage, do not copy responses, and write source/revision lineage activity.
- Each response owns `response_attachments_json`; response numbering is row-locked and protected by a unique index. Closing through a response is Project Admin-only, invalid statuses return 422, and closed RFIs reject responses until explicit reopen.
- Material edits now write safe before/after activity details. The RFI Audit PDF includes lifecycle, response, and revision activity from the activity log.
- Additive isolated-database operations only: four nullable RFI lifecycle columns, two actor foreign keys, one non-null response attachment JSON column with `[]` default, and two unique indexes. No drop, rename, rebuild, production, Replit, or Neon operation was performed.
- Real API/database acceptance gates A-O passed against `127.0.0.1:3101` and `127.0.0.1:55432/bimlog_rfi_test`. Evidence: `C:\Dev\bimlog-tools\evidence\rfi-build-2\20260714-091443`.
- Build 2 is submitted for independent review and is not self-accepted. Nothing was published. Build 3 was not started.

Discovered and corrected:
- Package selections reload in their explicit saved order; the acceptance fixture was corrected to assert normalized package order.
- Windows PowerShell requires `-PassThru` to retain HTTP status while downloading the Audit PDF with `-OutFile`; this affected only the external evidence runner.
- The prior mark-sent path could persist `in_review` without that value being configured. It now uses the configured semantic `open` value for draft/open records.
- The overdue RFI notifier previously started before the additive RFI migration completed on a fresh schema. It now starts only after that migration succeeds and reports an explicit startup error otherwise.

Deferred:
- Independent acceptance and any production/Replit migration or publish remain outside this build.
- Image crop/export redesign, plugin work, and Build 3 remain out of scope.

### RFI Build 3 Reference And Attachment Integrity

- Starting commit: `cfcb9645ee97c28dd896569c1c1c7d1724aed99d`.
- `files` remains the stored-file and storage-identity authority; `attachmentsJson` owns RFI manual-reference and file membership; `attachmentPackageJson` owns only Complete PDF inclusion/order; and each `rfi_responses.response_attachments_json` owns that response's evidence independently.
- One canonical internal-file locator parser and attachment normalizer now validate same-project file identity, reject malformed/cross-project locators and unsafe schemes, preserve clean display names, deduplicate stable file/reference keys, and remove package ghosts.
- New-RFI uploads remain staged until create succeeds. Creation validates and binds eligible staged files transactionally, duplicate-number retry binds them once, and verified user removal/cancel deletes only the current uploader's unlinked RFI-staging row and storage object.
- Local upload, existing project-file selection, authenticated download, response attachments, revisions, and Complete PDF membership now use stable file IDs rather than filename identity. Selected existing files retain their original ownership; viewpoint evidence remains separate.
- Real authenticated API/database and browser acceptance evidence is stored at `C:\Dev\bimlog-tools\evidence\rfi-build-3\20260714-104133`. It includes byte-for-byte SHA-256 upload/download proof, staged cleanup, database identity, package reload, independent response ownership, security/error statuses, runtime identity, and real-browser screenshots from the production RFI route.
- The isolated environment has no connected cloud provider. No provider URL, token, credential, or fabricated cloud success was persisted; the unavailable state is recorded in the acceptance evidence.
- Acceptance found that Multer's multipart header decoding could misread a valid UTF-8 filename such as `café` as Latin-1. RFI upload normalization now repairs a reversible UTF-8-as-Latin-1 decode while preserving already-valid names; authenticated upload/download and staged cleanup evidence covers the corrected accented filename.
- Build 3 is submitted for independent review and is not self-accepted. Nothing was published and Build 4 was not started.

Final integrity correction:
- Starting commit: `e9fb794103f649ea62f8b4a4a251c3e6821421bf`.
- Every `files.ts` response containing a complete file row now passes through one public serializer. Project-file list/upload/update, CVR proceed/approve/reject, and nested CVR report issue rows omit storage paths, source locations, and internal file metadata.
- Staged cleanup now locks the candidate row transactionally, revalidates project/uploader/source/unlinked eligibility under that lock, deletes storage while binding is excluded, and conditionally deletes the row. A completed bind returns an explicit cleanup conflict instead of allowing storage deletion.
- Real isolated acceptance evidence is stored at `C:\Dev\bimlog-tools\evidence\rfi-build-3\20260714-113827`. Recursive JSON inspection found no `storagePath` or internal storage/provider fields across all audited file responses, including one real nested CVR issue row.
- In the real bind/delete race, cleanup won with HTTP 200, binding failed with HTTP 404, the row and object were absent, and the RFI did not persist the locator. A normal bind regression then returned HTTP 200, cleanup returned HTTP 409, the linked row/object remained, and authenticated upload/download SHA-256 values matched.
- Build 3 remains submitted for independent review and is not self-accepted. Nothing was published and Build 4 was not started.

Deferred:
- Complete PDF/export layout redesign and image crop tooling remain later-build work; Build 3 preserves original evidence files without claiming conversion support.
- Plugin work, production/Replit/Neon operations, migration/publish work, and Build 4 remain out of scope.

### RFI Build 4 Snipping And Non-Destructive Crop Tools

- The original Build 4 submission at `6682875ba8eb608d6c0de5c6bebcde81ae948c43` was independently rejected. It had duplicate Snipping Tool actions, browser-only `showInRfi`, immediate existing-edit file binding, first-image-only multi-select handling, and membership-only server image validation. The earlier completion claims are superseded by this correction record.
- The corrected Snipping Tool has exactly four actions: Continue to Crop, Redraw Selection, Retake Screen Capture, and Cancel. Real browser evidence proves draw, move, resize, crop, upload, pre-upload Cancel, pre-upload Retake, and zero final console errors.
- New and existing RFI image queues preserve every selected file for sequential review. Per-file status distinguishes confirmed, canceled, and failed files; canceled images are not uploaded and document uploads continue independently.
- Existing-RFI question images and cloud files remain staged until Save RFI. Save validates presentation bytes/provenance, persists attachment/package/presentation state, binds staged files, and writes activity in one database transaction. Cancel removes only files staged during that edit; failed validation rolls back state and binding.
- Server image presentation validation now reads stored bytes, accepts only decodable PNG/JPEG data, rejects PDF and corrupt-image sources with explicit 422 responses, and verifies immutable server-known upload, paste, screen-snip, or viewpoint provenance.
- `showInRfi` controls browser presentation, standard RFI PDF, and RFI DOCX. Crop metadata and replacement/original selection are honored without changing stored evidence bytes. `includeInCompletePdf` remains independent; the Complete RFI record page does not duplicate the standard image.
- Correction evidence is stored at `C:\Dev\bimlog-tools\evidence\rfi-build-4-correction\20260714-172059`. It includes authenticated API/database/storage proofs, original-byte hashes, real-browser JSON/screenshots, standard and Complete PDF variants, DOCX package inspection, and LibreOffice-rendered visible/hidden DOCX artifacts.
- Build 4 functional correction was independently accepted. Its focused evidence directory was sanitized, and the accepted correction was cleanly integrated from the exact `origin/master` baseline without unrelated Telegram or Navisworks commits. Nothing was published, and Build 5 has not started.

### RFI Build 5 Professional Standard Exports

- Starting commit: `6919765be8c7cd3f0042fa62b4283d4862210181`.
- RFI PDF and RFI DOCX now consume one canonical saved-record export model in `artifacts/api-server/src/lib/rfi-standard-exports.ts`. The model covers the numbered 1-7 application structure, participants, references and clean attachment names, persisted image presentation, multiline question text, impact accountability, decoded distribution, persisted email wording, and ordered official responses with independent attachments and impacts.
- The standard PDF is a searchable Letter construction record with repeated BIMLog identity, disciplined blue/neutral styling, safe pagination, Page X of Y, generation timestamp, content fingerprint, and draft watermark. Persisted original/replacement crop and show/hide state are honored.
- The DOCX contains editable native Word content with Letter margins, styles, tables, header/footer, Page X of Y fields, embedded aspect-ratio-preserving images, and the same canonical field inventory as the PDF. All focused samples opened and rendered through LibreOffice without broken relationships.
- The Audit PDF is now a factual evidence report with identity, lifecycle state, event-category coverage, chronological actor/timestamp/action history, safe before/after summaries, custody history, response evidence, and view/access history. Missing categories are explicit, and the report makes no unsupported certification claim.
- Acceptance inspection found and corrected two final export defects: odd-length DOCX field groups exposed a padding label as `Not recorded`, and saved audit details exposed numeric BIMLog file locator IDs. Padding cells are now blank and audit file labels retain factual change context without internal IDs.
- Isolated acceptance covered draft, sent, closed, reopened, revised, Cost Increase TBD, known cost, schedule increase/decrease, long text, several references, multiple attachments, decoded distribution, two responses, cropped original image, replacement image, and hidden image. Evidence is stored at `C:\Dev\bimlog-tools\evidence\rfi-build-5\20260714-223603`.
- Build 5 was independently accepted by the master coordinator and cleanly integrated. The standard RFI PDF, editable RFI DOCX, factual RFI Audit PDF, and shared canonical export model are accepted. Nothing was published.

Deferred at Build 5 acceptance:
- Complete RFI PDF attachment/package merging, native PDF pages, Office conversion, and mixed page sizes were assigned to Build 6 and are addressed in the Build 6 review record below.
- Production, Replit, Neon, plugin, Telegram, Lens, Schedule, Submittals, and global-layout work remain outside this build.

### RFI Build 6 Complete PDF Package And Native Fidelity

- Starting baseline: `3fe1b2c5ada4cf6c657a44b90731a3ea6fbe08cd`.
- The Complete RFI PDF now uses a dedicated atomic package pipeline. Build 5 canonical RFI pages remain first and unchanged; saved `attachmentPackageJson` controls binary attachment inclusion/order, while saved `imagePresentationJson` independently controls the original/replacement presentation image, crop, standard-RFI visibility, and Complete PDF inclusion.
- Native PDF pages are copied without rasterization or page-size normalization. Structural comparison of the unchanged five-page River Avenue fixture against merged package pages 3-7 found exact MediaBox, CropBox, TrimBox, BleedBox, ArtBox, rotation, decoded content streams, resource inventories, embedded-image inventories, vector-operator counts, and extracted text. Existing source qpdf resource/AutoCAD character-map warnings remain distinguishable from merge defects.
- DOC, DOCX, XLS, XLSX, CSV, and TXT use a bounded asynchronous LibreOffice capability contract with an isolated profile, restricted child environment, explicit timeout/cancellation, and deterministic cleanup. PNG, JPEG, TIFF, BMP, GIF, and WEBP use validated image decoding, aspect-ratio preservation, reliable DPI when available, and a documented no-DPI policy without crop or stretch. Presentation crop applies only to the presentation image.
- Generation preconverts and validates all selected sources before assembly, validates the final PDF, enforces byte/page/pixel limits, rejects malformed/cross-project/missing/corrupt/zero-byte sources cleanly, and records one sanitized success or failure activity per request. The searchable manifest records clean labels, source and converted hashes, source page inventories, page ranges, methods, warnings, and a stable logical fingerprint derived from canonical saved state and source bytes.
- Real authenticated isolated-local API evidence proves package inclusion/order persistence, duplicate suppression, revision preservation, independent `showInRfi` and `includeInCompletePdf`, original/replacement selection, stable fingerprints, missing/corrupt source rejection, and success/failure activity integrity. Focused evidence is under `C:\Dev\bimlog-tools\evidence\rfi-build-6\20260715-130643`.
- The initial local review commit `0719655fcaae2623daf6283b6dd8f958d62eaed0` was independently rejected for pre-orientation EXIF geometry, synchronous LibreOffice execution, and an overstated converter security claim. The native PDF architecture and River Avenue fidelity proof passed review and were preserved.
- The correction normalizes JPEG/TIFF orientation once before reading displayed dimensions or applying browser-normalized crop coordinates. Four-quadrant EXIF fixtures for orientations 1, 3, 6, and 8 prove rotation, width/height swapping, source-byte immutability, and non-symmetric crop placement for orientations 6 and 8.
- All converter execution is asynchronous and bounded. Real isolated API evidence proves health and authenticated reads remain responsive during a delayed conversion, timeout and client disconnect terminate the child, one disconnect starts no duplicate conversion, concurrent conversions use distinct workspaces, and success/failure/cancellation cleanup leaves no converter process or temporary workspace.
- OOXML external relationships are rejected before LibreOffice starts; a live loopback retrieval trap recorded zero requests. Application secrets are excluded from the child environment, macros and interactive prompts are disabled, and link updating is disabled where supported. This is not an OS-level sandbox: LibreOffice still runs under the API host account and may retain host-account filesystem/network capabilities for legacy DOC/XLS or converter behavior not covered by OOXML preflight.
- Final narrow correction starts each POSIX converter in a new owned process group and signals only that group on timeout, request cancellation, or output-limit failure. Windows retains argument-array `taskkill /PID <owned-pid> /T /F`; both paths await converter closure before workspace cleanup, with direct-child termination only as a fallback when the platform tree mechanism itself is unavailable.
- OOXML preflight now bounds ZIP metadata before reading any relationship payload: 4,096 entries, 256 MiB declared uncompressed data, 1 MiB per relationship entry, 4 MiB total relationship data inspected, and a 1,000:1 compression-ratio ceiling for entries of at least 1 MiB. Excessive archives return `422 resource_limit` before LibreOffice starts.
- Windows parent/child/grandchild termination is covered locally for timeout and cancellation. POSIX strategy selection and negative-process-group ownership are deterministic in local proof; actual Linux/Replit process-tree execution remains a deployment acceptance item because no existing POSIX runtime was available for this correction.
- Build 6 correction is submitted as a replacement local review commit only and is not self-accepted. Nothing was pushed or published, and Build 7 was not started.

Deferred:
- Outlook MSG conversion remains explicitly unsupported. An included MSG returns a clean 422 naming the file; there is no silent omission or partial package.
- Native PDF annotations are imported as supported by pdf-lib. Cross-document destinations are not rewritten and this limitation is stated in the package manifest; no stronger preservation claim is made.
- Independent acceptance and any production/Replit/Neon operation remain outside Build 6.

## Deferred

### Telegram Product Build 3 - Bilingual Conversational Assistant And Support Core

- Local review implementation is complete in the isolated `telegram-product-build3-clean` worktree from baseline `be3a76aa5ea8f2a7749f0f4c845a04d69d5934c9`.
- Added canonical Telegram product conversation, message, support case, and support case event tables through additive startup migration and Drizzle schema exports.
- Telegram inbound processing now supports bilingual help/privacy/language flows, deterministic assistant estimate/confirm/cancel/failure handling through the Build 2 AI control plane, and support case creation from private Telegram chat.
- Browser Profile now exposes recent Telegram conversation summaries, AI funding/status/usage, support cases, and privacy/consent summary from authenticated product routes.
- Super-admin Telegram review routes require a reason and write `admin_actions_log` entries; ordinary users cannot access global conversation/support review.
- Real local evidence passed 30/30 checks against the isolated database `127.0.0.1:55432/bimlog_rfi_test` and real app routes/Telegram queue. Evidence: `C:\Dev\bimlog-tools\evidence\telegram-product-build-3\20260715T140026\telegram-product-build3-evidence.json`.
- No production, Replit, Neon, live webhook configuration, polling/controller startup, push, publish, or customer data access was performed.

Initial submission limitations, superseded by the corrections below:
- The initial local evidence used deterministic settlement/failure broker paths; the accepted correction replaces that limitation with real provider HTTP execution and provider-returned usage.
- Build 4 remains not started.
- Production Telegram webhook setup and deployment remain blocked until explicitly authorized.

Correction after rejected local commit `e25bb8a7803eb93ab618a14e6f193757be9918b7`:
- Removed fake Telegram Assistant execution, hardcoded assistant text, fixed token counts, fabricated provider IDs, and the production `TELEGRAM_PRODUCT_AI_TEST_MODE` branch.
- Added a production provider broker that revalidates the reserved AI run, uses `withProviderSecret`, calls OpenAI/Anthropic HTTP APIs, returns only provider text, and settles only with provider-returned usage.
- Delivery accountability now records outbound messages as pending, stores Telegram `message_id` only after successful Telegram response, records failed delivery categories, and skips resending already-delivered outbound records.
- Support intake is staged and creates a case only after confirmation, using required statuses `new`, `acknowledged`, `in_progress`, `waiting_for_user`, `resolved`, `closed` with transition events.
- Corrected evidence passed the exact 30-item matrix. Evidence: `C:\Dev\bimlog-tools\evidence\telegram-product-build-3-correction\20260715T150459`; manifest SHA-256 `f7b30f30767c0f54e24fbada4aacddc1b973f83044ac749423ac172430d28a47`.

Final focused correction and independent acceptance:
- Accepted source commit: `6585682ca377a5a1f6937f8be23837eef9c80972`, cleanly integrated as `3566ab7b3b20f4529df62b231ca5fdfe005dd8ea` from accepted master baseline `3fe1b2c5ada4cf6c657a44b90731a3ea6fbe08cd` without importing its older ancestry.
- Real provider HTTP execution now supports bounded English and Spanish multi-turn context, provider-returned usage settlement, response-body and response-header request identifiers, and rejection/release without settlement when the provider supplies no request identifier.
- Target-specific super-admin content review requires an exact conversation ID and reason with audit evidence; bulk review remains metadata-only. Ordinary-user and company boundaries remain enforced.
- Final isolated evidence passed 30/30 with real built-API stop/start persistence and delivery accountability. Evidence: `C:\Dev\bimlog-tools\evidence\telegram-product-build-3-final\20260715T174744Z`; manifest SHA-256 `baecba1def3baf1d9f0c4d00fef8d5e1110ac65872deb35b7fe1223a747d8bd0`.
- Clean-integration evidence again passed 30/30 against the isolated local database. Evidence: `C:\Dev\bimlog-tools\evidence\telegram-product-build-3-integration\20260715T183706Z`; manifest SHA-256 `03438111df8c26c281d47dd45d315a3eadb327ea66cc998809ff55828872ceab`.
- Telegram Product Build 3 was independently accepted for clean integration. Nothing was published, and Telegram Product Build 4 was not started.

### Navisworks Superseded Viewpoint Reconciliation v1.60.10 - Watching

- v1.60.9 field regression: web-created successors could remain visible with internal
  `BIMLog successor <rowId> <token>` names when post-insertion direct name mutation failed.
- v1.60.10 source/package produced on 2026-07-14: clean names are assigned before insertion,
  persisted mutation uses the supported API, readback is mandatory, exact-GUID compensation
  removes incomplete copies, and strict existing remnants are repaired without label deletion.
- Platform Jump continues to send immutable row identity; both physical
  plugin sources reconcile by `serverId`, GUID, and lineage rather than display label.
- Web-created Edit/Reassign successors are copied deterministically from their physical predecessor
  and stamped with the new platform row ID. Duplicate display labels remain separate and ambiguous
  label-only jumps are blocked.
- Local gates passed: deterministic successor-name fixtures; 2025 and 2021 plugin Debug builds
  as AnyCPU/net48; v1.60.10 assembly/package inventory and matching DLL hash.
- Package: `H:\BIMLogPlugin2025\BIMLog-Lens-Navisworks2025-v1.60.10.zip`, SHA-256
  `72A9C743D55BB0DFBE275C164E6C93E0248BDEBBC590DDCB0647DF56F8C550EE`.
- Evidence: `C:\Dev\bimlog-tools\evidence\navisworks-successor-name-fix\20260714-141458`.
- Open field gate: Ruben must install the v1.60.10 package and verify the affected web reassignment,
  superseded predecessor, active successor, duplicate-label HV-010, Pull/Reconcile, and Jump flows
  inside Navisworks Manage 2025. Do not call field verification complete before that confirmation.

### Telegram / WhatsApp Briefings
Idea: connect project briefings, schedule alerts, and delay/risk summaries to Telegram or another messaging channel.

Do not build until:
- Schedule data model is stable.
- Notification preferences are designed.
- Customer permission/opt-in rules are clear.

### Heavy AI File Reading
Do not make automatic.

Future behavior:
- User explicitly clicks AI file read.
- BIMLog warns that this may use AI credits.
- The extracted fields must show confidence and require user review.

## Closed / Shipped

### GitHub Merge Reconciliation
Resolved and pushed after manual Shell merge.
Remote master includes the Replit work plus Codex's Replit branding removal commit.

### Replit Branding Removal
Production no longer depends on old bim-log-ignite.replit.app references in searched source paths. Continue to prefer bimlog.app in user-facing URLs and OAuth callback docs.
