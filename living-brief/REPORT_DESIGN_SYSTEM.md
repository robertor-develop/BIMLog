# BIMLog Report Design System Audit

Audit date: 2026-07-10 (Phase 2)

## Governance and ownership

[ECOSYSTEM_DOCTRINE.md](./ECOSYSTEM_DOCTRINE.md) is the permanent product-doctrine authority
beneath Roberto's explicit current instruction. This document owns report inventory, visual
specifications, and presentation requirements. All formal outputs must follow the doctrine's
[native-document-fidelity requirement](./ECOSYSTEM_DOCTRINE.md#bimlogs-permanent-product-laws)
and pass [QUALITY.md's Artifact Gate](./QUALITY.md#evidence-and-release-quality-gate). A generated
file, successful download, or build does not by itself prove artifact quality or field acceptance.

## Central system

- Theme registry and shared PDF primitives: `artifacts/api-server/src/lib/pdf-kit.ts`
- Company logo helper: `artifacts/api-server/src/lib/pdf-logo.ts`

## Report and export inventory

### Schedule

- Calendar, Board, and List PDFs: `artifacts/api-server/src/routes/schedule.ts`
- Export configuration and download control: `artifacts/bimlog/src/pages/project/ScheduleTab.tsx`

### RFI

- RFI detail PDF, RFI audit PDF, RFI DOCX, RFI Log/Summary Excel: `artifacts/api-server/src/routes/rfis.ts`
- Row/detail export controls: `artifacts/bimlog/src/pages/project/RfisTab.tsx`
- RFI Aging PDF: `artifacts/api-server/src/routes/reports.ts`

### Lens Viewpoints and Clash Reports

- Lens Coordination PDF, clash report PDF, Lens Excel: `artifacts/api-server/src/routes/clash_reports.ts`
- Lens report modal and PDF/Excel controls: `artifacts/bimlog/src/pages/project/LensViewpointsView.tsx`
- Clash report controls: `artifacts/bimlog/src/pages/project/ClashReportsTab.tsx`

### Submittals

- Submittal detail PDF, audit PDF, Word-style `.doc`, Submittal Log PDF/Excel, Shop Drawing Control PDF/Excel: `artifacts/api-server/src/routes/submittals.ts`
- Imported tracker report PDF: `artifacts/api-server/src/routes/submittal_reports.ts`
- Submittal and Shop Drawing Control controls: `artifacts/bimlog/src/pages/project/SubmittalsTab.tsx`
- Submittal Status PDF: `artifacts/api-server/src/routes/reports.ts`

### Transmittals

- Individual transmittal PDF: `artifacts/api-server/src/routes/transmittals.ts`
- Transmittal Log PDF: `artifacts/api-server/src/routes/reports.ts`
- Export control: `artifacts/bimlog/src/pages/project/TransmittalsTab.tsx`

### Change Orders

- Individual change order PDF: `artifacts/api-server/src/routes/change_orders.ts`
- Change Order Log PDF: `artifacts/api-server/src/routes/reports.ts`
- Export control: `artifacts/bimlog/src/pages/project/ChangeOrdersTab.tsx`

### Meetings

- Meeting Minutes Log PDF: `artifacts/api-server/src/routes/reports.ts`
- Report control: `artifacts/bimlog/src/pages/project/ReportsTab.tsx`

### Files, CVR, and platform reports

- Generated file PDF and file download route: `artifacts/api-server/src/routes/files.ts`
- Project Health, Compliance, Performance, Dispute, platform Audit Certificate, and CVR PDFs: `artifacts/api-server/src/routes/reports.ts`
- Report catalog controls: `artifacts/bimlog/src/pages/project/ReportsTab.tsx`
- Convention PDF control: `artifacts/bimlog/src/pages/project/ConventionBuilder.tsx`

## First implementation scope

- Schedule: one Schedule blue family with Calendar, Board, and List variants.
- RFI: one RFI blue family with detail, DOCX, audit, and log variants reserved.
- Lens: one Lens blue family with coordination, register, and audit variants reserved.
- Submittal: one Submittal blue family with detail, log, Shop Drawing Control, and audit variants reserved.
- Reserved central families: Transmittals, Change Orders, Meetings, Files, and platform/future reports.

Business queries, filters, database schema, and record mutation behavior were not changed.

## Phase 2 implementation

- Added central Clash, Transmittal, Change Order, Meeting, Files/Document Control, and platform-report families.
- Applied named variants to Project Health, Naming Compliance, RFI Aging, Submittal Status, Project Performance, Dispute, Document Audit, Meeting Minutes, Change Order Log, Transmittal Log, and Content Verification reports.
- Applied the central system to individual Transmittal and Change Order PDFs, Clash Coordination PDFs, imported Submittal Tracking PDFs, Submittal Log, Shop Drawing Control, and system-generated official response PDFs.
- Report titles and response filenames now use the same canonical report-type name for changed outputs.
- Individual Transmittal and Change Order controls now identify their PDF scope.
- Lens controls distinguish the Lens Register Excel workbook from the Lens Coordination PDF.
- Removed the Meetings-page PDF control because it targeted a nonexistent backend route. The valid project-wide Meeting Minutes Report remains in the Reports catalog.
- Existing Schedule, RFI, Lens, and Submittal Phase 1 families remain unchanged except where a deferred log/tracker variant was activated.

### Canonical changed PDF titles

- Project Health Report
- Naming Compliance Report
- RFI Aging Report
- Submittal Status Report
- Project Performance Report
- Dispute Report - `{MODULE} {ID}`
- Document Audit Certificate
- Meeting Minutes Report
- Change Order Log
- Transmittal Log
- Content Verification Report
- `{NUMBER}` - Transmittal Report
- `{NUMBER}` - Change Order Report
- `{REPORT NUMBER}` - Clash Coordination Report
- `{REPORT NUMBER}` - Submittal Tracking Report
- Submittal Log
- Shop Drawing Control Report

Phase 2 did not change database schema, filters, report record selection, or module business logic.
