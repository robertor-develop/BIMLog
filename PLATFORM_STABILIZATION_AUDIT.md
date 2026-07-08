# BIMLog Platform Stabilization Audit

Generated: 2026-07-07

This audit is a stabilization map, not a feature backlog. The goal is to stop repeated patching over duplicate or stale systems and make BIMLog predictable across backend routes, frontend UX, AI usage, reports, exports, and integrations.

## Current Evidence

Command added:

```bash
pnpm audit:platform
```

Current result:

```text
P0=22
P1=96
P2=8
```

The command is intentionally non-blocking for now. It should become stricter category by category as the code is cleaned.

## P0 Stabilization Items

### AI usage is not fully governed

The platform now has a canonical AI usage helper:

- `artifacts/api-server/src/lib/ai-usage.ts`
- internal platform users use BIMLog's platform Anthropic key
- external users use their own connected key, or limited included platform credits
- usage events are tracked for admin reporting

But older code still bypasses it with direct `new Anthropic(...)` calls. These bypasses can spend AI without showing up correctly in the AI Usage dashboard.

Known bypass files:

- `artifacts/api-server/src/agents/base-agent.ts`
- `artifacts/api-server/src/lib/import-intelligence.ts`
- `artifacts/api-server/src/routes/change_orders.ts`
- `artifacts/api-server/src/routes/clash_reports.ts`
- `artifacts/api-server/src/routes/conventions.ts`
- `artifacts/api-server/src/routes/coordination.ts`
- `artifacts/api-server/src/routes/dashboard_briefing.ts`
- `artifacts/api-server/src/routes/meeting_minutes.ts`
- `artifacts/api-server/src/routes/project_directory.ts`
- `artifacts/api-server/src/routes/rfis.ts`
- `artifacts/api-server/src/routes/submittal_reports.ts`
- `artifacts/api-server/src/routes/transmittals.ts`

Several older paths also use a dummy Anthropic key fallback. That violates the fail-loud rule.

Recommendation:

Convert these routes to `getAnthropicClientForUser(...)` in controlled batches. Every conversion must preserve existing behavior, add clear setup/limit messaging, and avoid file-reading AI unless the user explicitly asks for it.

## P1 Stabilization Items

### Reports are not using one standard

`artifacts/api-server/src/lib/pdf-kit.ts` exists and documents the shared BIMLog PDF standard, but multiple report routes still hand-roll PDF output directly with `pdfkit`.

High-risk report routes:

- `artifacts/api-server/src/routes/reports.ts`
- `artifacts/api-server/src/routes/rfis.ts`
- `artifacts/api-server/src/routes/submittals.ts`
- `artifacts/api-server/src/routes/submittal_reports.ts`
- `artifacts/api-server/src/routes/change_orders.ts`
- `artifacts/api-server/src/routes/transmittals.ts`
- `artifacts/api-server/src/routes/files.ts`
- parts of `artifacts/api-server/src/routes/clash_reports.ts`

Recommendation:

Do not keep fixing report headers one PDF at a time. Standardize one module at a time on `pdf-kit.ts`, starting with submittals and RFIs because Ruben is actively testing those.

### Silent catches hide broken workflows

There are many `catch {}` / `.catch(() => {})` patterns in backend and frontend code. Some are harmless cleanup paths, but many hide load/save failures from users.

Risk examples:

- admin panels silently fail to load data
- profile/integration saves can fail without user-visible messaging
- background notifiers can fail with no durable warning
- submittal helper code has empty catches

Recommendation:

Replace silent catches in user-facing flows with visible error state or logged server-side warnings. Keep silent catches only for best-effort cleanup, and comment why.

## P2 Stabilization Items

### Excel exports are inconsistent

Some exports are client-side `XLSX.writeFile(...)`, while others are backend-generated. This makes branding, column labels, filters, and formatting inconsistent.

Known client-side exports:

- `artifacts/bimlog/src/pages/project/RfisTab.tsx`
- `artifacts/bimlog/src/pages/project/SubmittalsTab.tsx`
- `artifacts/bimlog/src/pages/project/LensViewpointsView.tsx`

Recommendation:

Move official exports server-side where practical, or create a shared frontend Excel helper that enforces BIMLog headers, human-readable labels, column sizing, and active filter scope.

## Module Cleanup Priorities

### 1. Submittals

Current problem:

Submittals are split across:

- `SubmittalsTab.tsx`
- `SubmittalTrackerTab.tsx`
- internal `RegisterView`
- internal `SubmittalTrackingList`
- `submittals.ts`
- `submittal_reports.ts`

User impact:

The user sees Submittals, Register, Tracking List, and Submittal Tracker as separate products. Attachments, linked RFIs/transmittals/change orders, edit flow, AI assist, PDF, Word, Audit Certificate, and Excel are not presented as one coherent workflow.

Recommendation:

Make `SubmittalsTab.tsx` the single source of truth. The register and tracker should become views inside that module, not separate mental models. Keep the old route/page only as a compatibility redirect or remove it after confirming navigation.

### 2. Schedule

Current problem:

The schedule has Calendar, Board, and List views, but the user cannot immediately understand how to add, link, move, or complete items. Calendar/Board feel like static displays unless data exists.

Recommendation:

Make schedule a live coordination planner:

- one Add button that opens a clear task/milestone drawer
- linked source selector for RFI/Submittal/Meeting/Change Order
- calendar cards clickable
- board cards draggable or at least moveable with status buttons
- visible empty-state actions
- no dead buttons

### 3. Reports and Exports

Current problem:

PDFs and Excel exports do not yet share one report contract. This creates repeated bugs: missing attachments, unclear labels, wrong filters, stale structures, and inconsistent branding.

Recommendation:

Create a shared report/export contract:

- one column definition per module
- same filters for table, PDF, and Excel
- attachments displayed consistently
- page numbers and fingerprints in every PDF
- Excel branded and auto-sized

### 4. AI Governance

Current problem:

The new AI cost system is correct in concept, but not universally enforced.

Recommendation:

Finish the AI migration before adding more AI-heavy features:

- all AI calls use `getAnthropicClientForUser`
- AI dashboard shows all platform usage
- text-only AI assists stay cheap and explicit
- file-reading AI requires an explicit warning
- external users are guided to connect their own provider after included credits

## Guardrail Strategy

The new `pnpm audit:platform` command should be used before and after stabilization batches.

## Build Verification

Verified on 2026-07-07:

- `pnpm build` passes from the repository root with `PORT=3000`.
- API server typecheck and build pass.
- BIMLog web app typecheck and Vite build pass.
- Mockup sandbox typecheck and build pass.
- Scripts typecheck passes.
- `pnpm audit:platform` runs successfully and reports the current cleanup backlog without blocking the build.

Fix made during this pass:

- `artifacts/mockup-sandbox/vite.config.ts` now defaults `BASE_PATH` to `/` for production builds only, so the root monorepo build works while the development guard remains strict.

Target progression:

1. Today: non-blocking visibility.
2. After AI migration: fail build on direct `new Anthropic` outside `ai-usage.ts`.
3. After dummy cleanup: fail build on dummy AI keys.
4. After report standardization: fail build on new direct `PDFDocument` usage outside approved helper files.
5. After UX cleanup: add module-level smoke tests for Submittals, RFIs, Schedule, and Lens Viewpoints.

## Recommended Next Batch

Batch 1 should be small and high-impact:

- migrate `dashboard_briefing.ts`, `project_directory.ts`, `change_orders.ts`, and `transmittals.ts` to the AI usage helper
- remove dummy AI fallbacks from `coordination.ts`, `conventions.ts`, and `rfis.ts`
- keep `pnpm audit:platform` green as a command
- run both builds

Batch 2:

- submittals UX consolidation
- official submittal Excel/PDF polish
- remove or demote the separate Submittal Tracker page

Batch 3:

- schedule planner UX rebuild
- link RFIs/submittals into calendar and board with useful actions

Batch 4:

- reports/export standardization across modules
