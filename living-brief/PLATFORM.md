# PLATFORM.md

> AUTO-GENERATED at build time by artifacts/api-server/scripts/generate-platform-md.ts.
> Do not hand-edit — changes are overwritten on every api-server build. Edit the generator.
> Last generated: 2026-07-16T22:15:56.132Z

This is the structural map of the BIMLog monorepo, generated from the actual codebase.

## Critical Database Facts — Read Before Every Session
- PROD_DATABASE_URL = Neon production database. This is what the running app uses for ALL reads and writes at runtime. This is the only real database.
- DATABASE_URL = Replit built-in heliumdb. Used ONLY by drizzle-kit CLI for schema migrations. Never used at runtime. Data here is ephemeral and resets on rebuild.
- The ENV startup banner historically showed DB_HOST: helium and DB_NAME: heliumdb — this was MISLEADING. It was reading PGHOST and PGDATABASE which point to heliumdb not the actual runtime connection. This has now been fixed.
- NEVER diagnose data loss by querying heliumdb. Always query Neon via PROD_DATABASE_URL.
- NEVER trust PGHOST or PGDATABASE for runtime database diagnostics.
- lens_viewpoints data that appeared to disappear on rebuild was never on Neon — it was on heliumdb which resets. All writes now go to Neon and survive all rebuilds.
- Any future database diagnostics must confirm PROD_DATABASE_URL is the connection target before drawing any conclusions.

## Monorepo shape
- pnpm workspaces.
- artifacts/bimlog — React + Vite + wouter web app (the BIMLog UI).
- artifacts/api-server — Express API. Every route is mounted under the global prefix /api/v1.
- artifacts/mockup-sandbox — component preview server (design).
- lib/db — shared drizzle schema + pg pool.

## Backend route files (artifacts/api-server/src/routes)
- artifacts\api-server\src\routes\activity.ts
- artifacts\api-server\src\routes\admin.ts
- artifacts\api-server\src\routes\agents.ts
- artifacts\api-server\src\routes\ai-control-plane.ts
- artifacts\api-server\src\routes\auth.ts
- artifacts\api-server\src\routes\autodesk.ts
- artifacts\api-server\src\routes\change_orders.ts
- artifacts\api-server\src\routes\clash_reports.ts
- artifacts\api-server\src\routes\company-profile.ts
- artifacts\api-server\src\routes\config.ts
- artifacts\api-server\src\routes\connections.ts
- artifacts\api-server\src\routes\contact.ts
- artifacts\api-server\src\routes\conventions.ts
- artifacts\api-server\src\routes\coordination.ts
- artifacts\api-server\src\routes\dashboard_briefing.ts
- artifacts\api-server\src\routes\documents.ts
- artifacts\api-server\src\routes\downloads.ts
- artifacts\api-server\src\routes\features.ts
- artifacts\api-server\src\routes\feedback.ts
- artifacts\api-server\src\routes\files.ts
- artifacts\api-server\src\routes\health.ts
- artifacts\api-server\src\routes\index.ts
- artifacts\api-server\src\routes\intelligence.ts
- artifacts\api-server\src\routes\linked_items.ts
- artifacts\api-server\src\routes\living_brief.ts
- artifacts\api-server\src\routes\meeting_minutes.ts
- artifacts\api-server\src\routes\members.ts
- artifacts\api-server\src\routes\notifications.ts
- artifacts\api-server\src\routes\project_directory.ts
- artifacts\api-server\src\routes\projects.ts
- artifacts\api-server\src\routes\reports.ts
- artifacts\api-server\src\routes\rfis.ts
- artifacts\api-server\src\routes\schedule.ts
- artifacts\api-server\src\routes\search.ts
- artifacts\api-server\src\routes\submittal_reports.ts
- artifacts\api-server\src\routes\submittals.ts
- artifacts\api-server\src\routes\telegram-product.ts
- artifacts\api-server\src\routes\transmittals.ts

## Backend route mount order (routes/index.ts, under /api/v1)
- downloadsRouter
- healthRouter
- authRouter
- configRouter
- projectsRouter
- filesRouter
- documentsRouter
- rfisRouter
- submittalsRouter
- activityRouter
- conventionsRouter
- membersRouter
- adminRouter
- contactRouter
- notificationsRouter
- directoryRouter
- transmittalsRouter
- changeOrdersRouter
- meetingMinutesRouter
- scheduleRouter
- searchRouter
- reportsRouter
- dashboardBriefingRouter
- intelligenceRouter
- coordinationRouter
- companyProfileRouter
- clashReportsRouter
- submittalReportsRouter
- linkedItemsRouter
- agentsRouter
- autodeskRouter
- livingBriefRouter
- connectionsRouter
- feedbackRouter
- telegramProductRouter
- aiControlPlaneRouter
- featuresRouter

## Backend middlewares (artifacts/api-server/src/middlewares)
- artifacts\api-server\src\middlewares\auth.ts
- artifacts\api-server\src\middlewares\config-validator.ts

## Backend libs (artifacts/api-server/src/lib)
- artifacts\api-server\src\lib\ai-control-plane-migration.ts
- artifacts\api-server\src\lib\ai-control-plane.behavior.ts
- artifacts\api-server\src\lib\ai-control-plane.http-evidence.ts
- artifacts\api-server\src\lib\ai-control-plane.ts
- artifacts\api-server\src\lib\ai-control-plane.ui-fixture.ts
- artifacts\api-server\src\lib\ai-usage.ts
- artifacts\api-server\src\lib\cloud-files.ts
- artifacts\api-server\src\lib\email.ts
- artifacts\api-server\src\lib\entitlement-contract.ts
- artifacts\api-server\src\lib\entitlement-resolver.behavior.ts
- artifacts\api-server\src\lib\extract-file-text.ts
- artifacts\api-server\src\lib\feature-catalog-concurrency.behavior.ts
- artifacts\api-server\src\lib\feature-catalog-db.behavior.ts
- artifacts\api-server\src\lib\feature-catalog-http.behavior.ts
- artifacts\api-server\src\lib\feature-catalog-migration.ts
- artifacts\api-server\src\lib\feature-catalog-service.ts
- artifacts\api-server\src\lib\import-intelligence.ts
- artifacts\api-server\src\lib\initial-feature-catalog.ts
- artifacts\api-server\src\lib\lens-import-contract.ts
- artifacts\api-server\src\lib\oauth.ts
- artifacts\api-server\src\lib\overdue-notifier.ts
- artifacts\api-server\src\lib\pdf-kit.ts
- artifacts\api-server\src\lib\pdf-logo.ts
- artifacts\api-server\src\lib\project-intelligence.ts
- artifacts\api-server\src\lib\rfi-complete-package.behavior.ts
- artifacts\api-server\src\lib\rfi-complete-package.ts
- artifacts\api-server\src\lib\rfi-register-export.ts
- artifacts\api-server\src\lib\rfi-standard-exports.ts
- artifacts\api-server\src\lib\scoped-authority.ts
- artifacts\api-server\src\lib\storage-adapter.ts
- artifacts\api-server\src\lib\telegram-product-delivery.ts
- artifacts\api-server\src\lib\telegram-product-notifications.ts
- artifacts\api-server\src\lib\telegram-product-provider-broker.ts
- artifacts\api-server\src\lib\telegram-product.ts

## Agents (artifacts/api-server/src/agents)
- artifacts\api-server\src\agents\base-agent.ts
- artifacts\api-server\src\agents\briefing-agent.ts
- artifacts\api-server\src\agents\clash-agent.ts
- artifacts\api-server\src\agents\rfi-agent.ts

## Database schema files (lib/db/src/schema)
- lib\db\src\schema\action-items.ts
- lib\db\src\schema\activity.ts
- lib\db\src\schema\admin-actions-log.ts
- lib\db\src\schema\agent-insights.ts
- lib\db\src\schema\ai-control-plane.ts
- lib\db\src\schema\ai-usage-events.ts
- lib\db\src\schema\change-orders.ts
- lib\db\src\schema\clash_reports.ts
- lib\db\src\schema\company_profiles.ts
- lib\db\src\schema\config.ts
- lib\db\src\schema\contact-submissions.ts
- lib\db\src\schema\conventions.ts
- lib\db\src\schema\coordination_intake_events.ts
- lib\db\src\schema\email-log.ts
- lib\db\src\schema\feature-catalog.ts
- lib\db\src\schema\feature-flags.ts
- lib\db\src\schema\feedback-items.ts
- lib\db\src\schema\files.ts
- lib\db\src\schema\index.ts
- lib\db\src\schema\invitations.ts
- lib\db\src\schema\lens-imports.ts
- lib\db\src\schema\lens-viewpoint-reports.ts
- lib\db\src\schema\lens-viewpoint-sequence-counters.ts
- lib\db\src\schema\lens-viewpoints.ts
- lib\db\src\schema\linked-items.ts
- lib\db\src\schema\meeting-minutes.ts
- lib\db\src\schema\notifications.ts
- lib\db\src\schema\platform-settings.ts
- lib\db\src\schema\project-directory.ts
- lib\db\src\schema\project-milestones.ts
- lib\db\src\schema\projects.ts
- lib\db\src\schema\rfi-ball-in-court-history.ts
- lib\db\src\schema\rfi-responses.ts
- lib\db\src\schema\rfi-view-events.ts
- lib\db\src\schema\rfis.ts
- lib\db\src\schema\schedule-planner.ts
- lib\db\src\schema\submittal-register.ts
- lib\db\src\schema\submittal-view-events.ts
- lib\db\src\schema\submittal_reports.ts
- lib\db\src\schema\submittals.ts
- lib\db\src\schema\telegram-product.ts
- lib\db\src\schema\transmittals.ts
- lib\db\src\schema\user-connections.ts
- lib\db\src\schema\users.ts

## Frontend pages (artifacts/bimlog/src/pages)
- artifacts\bimlog\src\pages\About.tsx
- artifacts\bimlog\src\pages\AdminPanel.tsx
- artifacts\bimlog\src\pages\CompanyProfile.tsx
- artifacts\bimlog\src\pages\Contact.tsx
- artifacts\bimlog\src\pages\Dashboard.tsx
- artifacts\bimlog\src\pages\DataRetention.tsx
- artifacts\bimlog\src\pages\Disclaimer.tsx
- artifacts\bimlog\src\pages\Features.tsx
- artifacts\bimlog\src\pages\Landing.tsx
- artifacts\bimlog\src\pages\LivingBrief.tsx
- artifacts\bimlog\src\pages\Login.tsx
- artifacts\bimlog\src\pages\NotificationSettings.tsx
- artifacts\bimlog\src\pages\PendingItems.tsx
- artifacts\bimlog\src\pages\Pricing.tsx
- artifacts\bimlog\src\pages\Privacy.tsx
- artifacts\bimlog\src\pages\Profile.tsx
- artifacts\bimlog\src\pages\ProjectDetail.tsx
- artifacts\bimlog\src\pages\Register.tsx
- artifacts\bimlog\src\pages\ResetPassword.tsx
- artifacts\bimlog\src\pages\SetupGuide.tsx
- artifacts\bimlog\src\pages\Terms.tsx
- artifacts\bimlog\src\pages\TotalControl.tsx
- artifacts\bimlog\src\pages\not-found.tsx
- artifacts\bimlog\src\pages\project\ActivityTab.tsx
- artifacts\bimlog\src\pages\project\AnalyticsTab.tsx
- artifacts\bimlog\src\pages\project\ChangeOrdersTab.tsx
- artifacts\bimlog\src\pages\project\ClashReportsTab.tsx
- artifacts\bimlog\src\pages\project\ConventionBuilder.tsx
- artifacts\bimlog\src\pages\project\CoordinationHub.tsx
- artifacts\bimlog\src\pages\project\DirectoryTab.tsx
- artifacts\bimlog\src\pages\project\FilesTab.tsx
- artifacts\bimlog\src\pages\project\IntegrationsTab.tsx
- artifacts\bimlog\src\pages\project\LensViewpointsView.tsx
- artifacts\bimlog\src\pages\project\MeetingsTab.tsx
- artifacts\bimlog\src\pages\project\NameGenerator.tsx
- artifacts\bimlog\src\pages\project\ReportsTab.tsx
- artifacts\bimlog\src\pages\project\RfiCanonicalUiHarness.tsx
- artifacts\bimlog\src\pages\project\RfisTab.tsx
- artifacts\bimlog\src\pages\project\ScheduleTab.tsx
- artifacts\bimlog\src\pages\project\SubmittalsTab.tsx
- artifacts\bimlog\src\pages\project\TeamTab.tsx
- artifacts\bimlog\src\pages\project\TransmittalsTab.tsx

## Frontend routes (artifacts/bimlog/src/App.tsx, wouter)
- /
- /login
- /register
- /reset-password
- /privacy
- /terms
- /disclaimer
- /data-retention
- /dashboard
- /pending
- /projects/:id/:tab?
- /setup-guide
- /profile
- /settings/company-profile
- /settings/notifications
- /admin
- /total-control
- /living-brief
- /pricing
- /features
- /about
- /contact

## Curated interconnections and gotchas (maintained in the generator)
- All API routes are served under the /api/v1 prefix. res.redirect in route files MUST
  include /api/v1 or it 404s.
- Auth: JWT Bearer; payload carries isSuperAdmin. authMiddleware verifies; requireProjectMember
  / requirePermission gate project access (super admins bypass membership);
  isSuperAdminMiddleware re-checks users.is_super_admin.
- Schema changes go in BOTH the drizzle schema file AND the idempotent startup migration block
  in artifacts/api-server/src/app.ts (ALTER TABLE / CREATE TABLE ... IF NOT EXISTS).
- Route ordering: literal sub-paths (e.g. .../lens-pull, .../plugin-pull) must be registered
  before parameterized catch-alls like .../:reportId (no NaN guard).
- Soft-delete DELETE routes live inside their feature route files (see routes/index.ts comments).
- Clash reports support a Navisworks plugin sync round-trip (fingerprint dedup; pull uses
  updatedAt > lastPluginSyncAt). Lens viewpoints use a manual refresh banner (polling removed).
- Living Brief: four docs in /living-brief served via /api/v1/living-brief/*, gated by a hashed
  password (default BIMAI360) plus eligibility (users.is_super_admin OR users.can_access_living_brief).
  Only super admins change the password or grant access. This PLATFORM.md is regenerated on build.
- Build: bimlog needs PORT set (PORT=3000 pnpm build); api-server bundles to dist/index.cjs via
  esbuild and this generator runs as a pre-build step.
