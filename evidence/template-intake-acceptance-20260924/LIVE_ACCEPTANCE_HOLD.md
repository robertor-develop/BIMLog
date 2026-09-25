# BIMLog live acceptance — HOLD (2026-09-24)

This is an internal, partial test record, not acceptance evidence or an external tester guide. All records below are synthetic QA data.

## Release identity

- URL: https://bimlog.app
- UI release: `v1.05.N18-P36`
- Published `sourceCommit`: `26fcd08011d4bb214cfcb92422acf7aae1ed424c`
- Health endpoint: `status=ok`, `identityBound=true`, observed from Replit Shell after publication.
- Replit Shell build and publication database receipt passed before Republish; schema action `NONE`, database receipt `publishable=true`.

## Live UI observations

1. BIMCorp ordinary account created synthetic project `QA-INT-B-0924` / project 58 through the normal New Project route. Quick Intake saved canonical synthetic client company `QA Cliente Sintetico 20260924 B`, Contract Item `QA Shop Drawing L1`, 12 planned hours. Refresh preserved those values and floor Work Package `QA Shop Drawing Floor L1` at `L1`.
2. The deployed Advanced Intake now states that budget-linked commercial activation requires a floor or area Work Package with discipline and deliverable; otherwise packages are optional. This corrects the earlier contradictory instruction.
3. Quick Intake in English and Spanish no longer shows Service or Phase as project-wide fields. It reports that BIMCorp has no active disciplines and explicitly directs a company PMO administrator to Company Catalogs. The discipline selector contains no selectable discipline.
4. RRY Super Admin created synthetic company workflow `QA-FRESH-SD-0924` for Shop Drawing. Edited two phases (`DRAFT`, `QC`) and two tasks (`MODEL_SHEET`, `REVIEW_SHEET`), enabled QC and approval on phase 2, validated preview, saved, refreshed, reopened, and confirmed values and audit count persisted. Its state remains `draft`.
5. The live workflow UI requires a different PMO administrator to approve a creator/last editor's draft. Self-approval is disabled in this flow. No second RRY PMO reviewer was available in this test.
6. Existing synthetic governance policy `QA-GOV-B20-20260924` remains draft. Its UI explicitly says approval thresholds, other change-control rules, and role rows are recorded intent rather than runtime execution permissions. Therefore full governance enforcement is not proven and must not be claimed.
7. After Roberto explicitly specified the existing BIMCorp account and scope, RRY Super Admin granted **BIMCorp company-scoped PMO** to `robertor@bimcorpinc.com` in Company Catalogs. The live UI confirmed: `Acceso PMO de empresa otorgado a la cuenta existente.` This was not a Global Super Admin grant. Catalog and downstream rights have not yet been re-tested under that account.
8. RRY Super Admin created synthetic pricing draft `QA-APU-SD-0924` with 12 planned hours, USD 50/hour, and DRAFT/QC allocation of 70%/30%. The live list showed version 1 as `Borrador`; it has not been approved, published, activated, or resolved into Intake.
9. Production read-only Replit Shell audit found two distinct tenant rows named `BIMTECH CORP` (company IDs 31 and 35). Neither has a company Delivery Workflow version. A second read-only query found no company Governance or generic APU/Pricing template versions in either tenant. Rubén's final production templates therefore are **not available** in those company catalogs; the RRY synthetic drafts are not substitutes.
10. Roberto completed the credential-entry handoff for `testuser@bimcorpinc.com`. The RRY Super Admin live user list now shows `BIMCorp QA Reviewer` under BIMCorp Inc with one project. No credential was entered or printed by this test record. Company PMO reviewer authority has not yet been granted or tested on that account.
11. A production read-only user-to-company query resolved the duplicate BIMTECH names: Rubén Crespo's account is in BIMTECH company ID 31; Lorena Choquevillca's account is in BIMTECH company ID 35. The two accounts are therefore in different company tenants despite the same displayed company name. This is a real isolation/configuration defect to resolve before claiming shared template visibility or end-to-end acceptance.
12. Signed in live as `robertor@bimcorpinc.com` after the company-scoped PMO grant. Company Catalogs displayed `Administración PMO de la empresa habilitada`. Created synthetic active discipline `QA-ELEC-0924` / `QA Electrical 20260924`; the UI confirmed `Valor de la empresa creado` and showed active v1.
13. Under BIMCorp PMO, created and validated two distinct synthetic Delivery Workflow drafts: `QA-SD-BC-0924` (Shop Drawing: two phases/two tasks, QC/approval on phase 2) and `QA-SLV-BC-0924` (Sleeve: three phases/three tasks, QC/approval on phase 3). Each preview validated and was saved; neither is approved or active. These are QA fixtures, not Rubén's final production templates.
14. Under BIMCorp PMO, created synthetic APU/Pricing draft `QA-APU-SD-BC-0924`: 12 hours × USD 50 = USD 600; direct-production allocation `SD-DRAFT` 70%, `SD-QC` 30%. The UI required an audit reason, then confirmed `Borrador creado` and listed v1 `Borrador`. It is not yet published or active, so workflow economic linkage remains untested.
15. A live Quick Intake regression was reproduced after selecting the newly created active discipline. The UI displayed `El ingreso de trabajo no está disponible temporalmente.` and the browser console recorded `JOB_INTAKE_AUTOSAVE_FAILED` plus retry failures. Root cause: `validateRelationshipAuthority` unions integer IDs from `enterprise_trades` with text IDs from `company_master_catalog_entries` without casting the selected integer ID. A read-only production `psql` reproduction returned `ERROR: UNION types integer and text cannot be matched`; the corrected `SELECT id::text AS id` query completed successfully in the same production schema. The source fix and static regression assertion are local only, not pushed or published at the time of this record. Local TypeScript typecheck passed; the broader test run was unavailable locally because the required `PROD_DATABASE_URL` is intentionally absent.

## Blocking gates

- The prior BIMCorp missing-discipline issue was remedied with a clearly synthetic active discipline; its selection and downstream EDT behavior have not yet been re-tested.
- Quick Intake autosave currently fails when the new discipline is selected in the deployed version. The local SQL cast fix requires clean build, push, publish, and a repeated live Chrome test before this gate can pass.
- The separate BIMCorp reviewer account exists, but its company-scoped PMO/financial review authority and sign-in remain untested. Independent template approval cannot yet proceed.
- Maker/checker approval of the synthetic workflow needs a separate authorized PMO reviewer. The available RRY Super Admin account cannot approve its own workflow draft.
- The synthetic RRY APU exists only as a draft. APU association/economic allocation was not exercised end-to-end.
- Neither BIMTECH CORP tenant has published company Delivery Workflow, Governance, or APU/Pricing template versions in the audited production tables. This is a substantive gap relative to Rubén's requested final templates.
- Rubén and Lorena currently belong to different BIMTECH company IDs (31 and 35); a template authored in either tenant would not automatically be visible to the other under company scoping.
- End-to-end template approval, Intake selection, budget approval, activation, EDT/Work Items, assignments, hours, QC, reporting, and Ruben/Lorena account testing remain unproven.
- No full external smoke-test DOCX or complete Spanish user guide should be represented as validated against the deployed UI yet. No Telegram delivery occurred.

## Release truth

`RESULT=HOLD`; `READY_FOR_EXTERNAL_TESTING=NO`.

The next step is the requested action-time confirmation for a BIMCorp-scoped PMO grant to `testuser@bimcorpinc.com`, then reviewer sign-in, maker/checker approval, and the remaining synthetic end-to-end flow. Independently, Rubén's actual BIMTECH template definitions and correct tenant identity must be resolved; QA fixtures must not be presented as his approved production templates. Repair any product defects found before issuing the external guide.
