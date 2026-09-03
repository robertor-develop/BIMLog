# PLATFORM.md

> AUTO-GENERATED at build time by artifacts/api-server/scripts/generate-platform-md.ts.
> Do not hand-edit — changes are overwritten on every api-server build. Edit the generator.

This is the structural map of the BIMLog monorepo, generated from the actual codebase.
It changes only when the code structure or curated architectural facts change.

## Living Brief authoritative catalog
- living-brief/ECOSYSTEM_DOCTRINE.md
- living-brief/CLAUDE.md
- living-brief/QUALITY.md
- living-brief/VISION.md
- living-brief/PLATFORM.md
- living-brief/PLUGIN.md
- living-brief/REPORT_DESIGN_SYSTEM.md
- living-brief/STANDARDS_REGISTER.md
- living-brief/STATUS.md
- living-brief/OPEN_LOOP.md
- living-brief/AUDIT.md
- Document and catalog SHA-256 values use canonical UTF-8 text with LF line endings so Windows and Linux checkouts verify identically.

## Critical Database Facts — Read Before Every Session
- PROD_DATABASE_URL = Neon production database. This is what the running app uses for ALL reads and writes at runtime. This is the only real database.
- DATABASE_URL = Replit Helium development database. It is used ONLY by guarded drizzle-kit development-schema synchronization and never at runtime. Its structural state can influence Replit's generated production migration at Publish.
- Database URL and secret values must not be assigned in tracked .replit or recognized configuration files. Replit Secrets/environment injection supplies runtime values; the repository gate permits variable-name references but rejects literal credential material.
- The ENV startup banner historically showed DB_HOST: helium and DB_NAME: heliumdb — this was MISLEADING. It was reading PGHOST and PGDATABASE which point to heliumdb not the actual runtime connection. This has now been fixed.
- NEVER diagnose data loss by querying heliumdb. Always query Neon via PROD_DATABASE_URL.
- NEVER trust PGHOST or PGDATABASE for runtime database diagnostics.
- lens_viewpoints data that appeared to disappear on rebuild was never on Neon — it was on heliumdb which resets. All writes now go to Neon and survive all rebuilds.
- Any future database diagnostics must confirm PROD_DATABASE_URL is the connection target before drawing any conclusions.
- Replit currently documents that development structural changes may be applied to production at Publish. No supported repository configuration is proven to disable that managed migration authority. Every Publish remains human-gated; a root build cannot stop a migration Replit may apply before the build.
- Authoritative source is the explicitly fetched remote master ref, not the older remote default main. Before Helium sync or Publish, the clean Replit workspace, local master, origin/master, and freshly read remote master must match exactly and pass the commit-bound publication-source attestation.

## Monorepo shape
- pnpm workspaces.
- artifacts/bimlog — React + Vite + wouter web app (the BIMLog UI).
- artifacts/api-server — Express API. Every route is mounted under the global prefix /api/v1.
- artifacts/mockup-sandbox — component preview server (design).
- lib/db — shared drizzle schema + pg pool.

## Backend route files (artifacts/api-server/src/routes)
- artifacts/api-server/src/routes/activity.ts
- artifacts/api-server/src/routes/admin.ts
- artifacts/api-server/src/routes/agents.ts
- artifacts/api-server/src/routes/ai-control-plane.ts
- artifacts/api-server/src/routes/auth.ts
- artifacts/api-server/src/routes/autodesk.ts
- artifacts/api-server/src/routes/change_orders.ts
- artifacts/api-server/src/routes/clash_reports.ts
- artifacts/api-server/src/routes/company-profile.ts
- artifacts/api-server/src/routes/config.ts
- artifacts/api-server/src/routes/connections.ts
- artifacts/api-server/src/routes/contact.ts
- artifacts/api-server/src/routes/contract-item-workflows.ts
- artifacts/api-server/src/routes/conventions.ts
- artifacts/api-server/src/routes/coordination.ts
- artifacts/api-server/src/routes/coordinator-actions.ts
- artifacts/api-server/src/routes/dashboard_briefing.ts
- artifacts/api-server/src/routes/documents.ts
- artifacts/api-server/src/routes/downloads.ts
- artifacts/api-server/src/routes/feature-policies.ts
- artifacts/api-server/src/routes/features.ts
- artifacts/api-server/src/routes/feedback.ts
- artifacts/api-server/src/routes/files.ts
- artifacts/api-server/src/routes/financial-apu.ts
- artifacts/api-server/src/routes/financial-budgets.ts
- artifacts/api-server/src/routes/financial-contracts.ts
- artifacts/api-server/src/routes/financial-controls.ts
- artifacts/api-server/src/routes/generic-apu-budget-controls.ts
- artifacts/api-server/src/routes/health.ts
- artifacts/api-server/src/routes/index.ts
- artifacts/api-server/src/routes/intelligence.ts
- artifacts/api-server/src/routes/job-intake.ts
- artifacts/api-server/src/routes/job-operations.ts
- artifacts/api-server/src/routes/linked_items.ts
- artifacts/api-server/src/routes/living_brief.ts
- artifacts/api-server/src/routes/meeting_minutes.ts
- artifacts/api-server/src/routes/members.ts
- artifacts/api-server/src/routes/notifications.ts
- artifacts/api-server/src/routes/project_directory.ts
- artifacts/api-server/src/routes/projects.ts
- artifacts/api-server/src/routes/reports.ts
- artifacts/api-server/src/routes/rfis.ts
- artifacts/api-server/src/routes/schedule.ts
- artifacts/api-server/src/routes/search.ts
- artifacts/api-server/src/routes/submittal_reports.ts
- artifacts/api-server/src/routes/submittals.ts
- artifacts/api-server/src/routes/team-performance.ts
- artifacts/api-server/src/routes/telegram-product.ts
- artifacts/api-server/src/routes/transmittals.ts

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
- featurePoliciesRouter
- featuresRouter
- financialControlsRouter
- financialBudgetsRouter
- financialContractsRouter
- genericApuBudgetControlsRouter
- financialApuRouter
- coordinatorActionsRouter
- jobIntakeRouter
- contractItemWorkflowsRouter
- jobOperationsRouter
- teamPerformanceRouter

## Backend middlewares (artifacts/api-server/src/middlewares)
- artifacts/api-server/src/middlewares/auth.ts
- artifacts/api-server/src/middlewares/config-validator.ts
- artifacts/api-server/src/middlewares/multipart.ts
- artifacts/api-server/src/middlewares/team-resource-planning-rate-limit.ts

## Backend libs (artifacts/api-server/src/lib)
- artifacts/api-server/src/lib/ai-control-plane-migration.ts
- artifacts/api-server/src/lib/ai-control-plane.behavior.ts
- artifacts/api-server/src/lib/ai-control-plane.http-evidence.ts
- artifacts/api-server/src/lib/ai-control-plane.ts
- artifacts/api-server/src/lib/ai-control-plane.ui-fixture.ts
- artifacts/api-server/src/lib/ai-usage.ts
- artifacts/api-server/src/lib/apu-budget-authority-http.behavior.ts
- artifacts/api-server/src/lib/apu-budget-authority-real-boundary.behavior.ts
- artifacts/api-server/src/lib/apu-budget-authority-service.ts
- artifacts/api-server/src/lib/bimlog-shared-version.behavior.ts
- artifacts/api-server/src/lib/bimlog-shared-version.ts
- artifacts/api-server/src/lib/build4-backend.behavior.ts
- artifacts/api-server/src/lib/build4-pdf-ui-consistency.behavior.ts
- artifacts/api-server/src/lib/cloud-files.ts
- artifacts/api-server/src/lib/commercial-entitlement.behavior.ts
- artifacts/api-server/src/lib/commercial-entitlement.ts
- artifacts/api-server/src/lib/commercial-project-scope.ts
- artifacts/api-server/src/lib/contract-item-workflow-contract.ts
- artifacts/api-server/src/lib/contract-item-workflow-migration.ts
- artifacts/api-server/src/lib/contract-item-workflow-service.ts
- artifacts/api-server/src/lib/contract-item-workflow.behavior.ts
- artifacts/api-server/src/lib/coordinator-action-register.ts
- artifacts/api-server/src/lib/coordinator-bulk-action-migration.ts
- artifacts/api-server/src/lib/coordinator-bulk-actions.ts
- artifacts/api-server/src/lib/coordinator-saved-view-migration.ts
- artifacts/api-server/src/lib/coordinator-saved-views.ts
- artifacts/api-server/src/lib/cost-value-forecast-service.ts
- artifacts/api-server/src/lib/cost-value-forecast.behavior.ts
- artifacts/api-server/src/lib/cost-value-performance-service.ts
- artifacts/api-server/src/lib/cost-value-performance.behavior.ts
- artifacts/api-server/src/lib/cost-value-plan-service.ts
- artifacts/api-server/src/lib/cost-value-plan.behavior.ts
- artifacts/api-server/src/lib/database-startup-serialization.behavior.ts
- artifacts/api-server/src/lib/email.ts
- artifacts/api-server/src/lib/entitlement-contract.ts
- artifacts/api-server/src/lib/entitlement-resolver.behavior.ts
- artifacts/api-server/src/lib/extract-file-text.ts
- artifacts/api-server/src/lib/feature-catalog-concurrency.behavior.ts
- artifacts/api-server/src/lib/feature-catalog-db.behavior.ts
- artifacts/api-server/src/lib/feature-catalog-http.behavior.ts
- artifacts/api-server/src/lib/feature-catalog-migration.ts
- artifacts/api-server/src/lib/feature-catalog-service.ts
- artifacts/api-server/src/lib/feature-policy-browser.behavior.ts
- artifacts/api-server/src/lib/feature-policy-migration.ts
- artifacts/api-server/src/lib/feature-policy-service.ts
- artifacts/api-server/src/lib/feature-policy-support-matrix.ts
- artifacts/api-server/src/lib/feature-policy.behavior.ts
- artifacts/api-server/src/lib/feedback-backup-db.behavior.ts
- artifacts/api-server/src/lib/feedback-backup-worker.behavior.ts
- artifacts/api-server/src/lib/feedback-backup-worker.ts
- artifacts/api-server/src/lib/feedback-evidence-contract.behavior.ts
- artifacts/api-server/src/lib/feedback-evidence-contract.ts
- artifacts/api-server/src/lib/feedback-follow-up-register.behavior.ts
- artifacts/api-server/src/lib/feedback-follow-up-register.ts
- artifacts/api-server/src/lib/feedback-follow-up.behavior.ts
- artifacts/api-server/src/lib/feedback-follow-up.ts
- artifacts/api-server/src/lib/feedback-http-db.behavior.ts
- artifacts/api-server/src/lib/feedback-notification-worker.behavior.ts
- artifacts/api-server/src/lib/feedback-notification-worker.ts
- artifacts/api-server/src/lib/feedback-package-source.ts
- artifacts/api-server/src/lib/feedback-package-worker.ts
- artifacts/api-server/src/lib/feedback-package.behavior.ts
- artifacts/api-server/src/lib/feedback-package.ts
- artifacts/api-server/src/lib/feedback-relay-schema-db.behavior.ts
- artifacts/api-server/src/lib/feedback-relay-schema-migration.behavior.ts
- artifacts/api-server/src/lib/feedback-relay/delivery.ts
- artifacts/api-server/src/lib/feedback-relay/protocol-transport.behavior.ts
- artifacts/api-server/src/lib/feedback-relay/protocol.behavior.ts
- artifacts/api-server/src/lib/feedback-relay/protocol.ts
- artifacts/api-server/src/lib/feedback-relay/receiver-http.behavior.ts
- artifacts/api-server/src/lib/feedback-relay/receiver-http.ts
- artifacts/api-server/src/lib/feedback-relay/receiver-service.ts
- artifacts/api-server/src/lib/feedback-relay/receiver-v2.behavior.ts
- artifacts/api-server/src/lib/feedback-relay/receiver.behavior.ts
- artifacts/api-server/src/lib/feedback-relay/state-machine.behavior.ts
- artifacts/api-server/src/lib/feedback-relay/state-machine.ts
- artifacts/api-server/src/lib/feedback-relay/transport.ts
- artifacts/api-server/src/lib/feedback-reviewer-projection.behavior.ts
- artifacts/api-server/src/lib/feedback-reviewer-projection.ts
- artifacts/api-server/src/lib/feedback-route-authority.behavior.ts
- artifacts/api-server/src/lib/feedback-scan-worker.behavior.ts
- artifacts/api-server/src/lib/feedback-scan-worker.ts
- artifacts/api-server/src/lib/feedback-scanner.behavior.ts
- artifacts/api-server/src/lib/feedback-scanner.ts
- artifacts/api-server/src/lib/feedback-schema-migration.ts
- artifacts/api-server/src/lib/feedback-telegram-policy.ts
- artifacts/api-server/src/lib/feedback-telegram-worker.behavior.ts
- artifacts/api-server/src/lib/feedback-telegram-worker.ts
- artifacts/api-server/src/lib/ffmpeg-capability.ts
- artifacts/api-server/src/lib/financial-budget-browser.behavior.ts
- artifacts/api-server/src/lib/financial-budget-contract.ts
- artifacts/api-server/src/lib/financial-budget-db.behavior.ts
- artifacts/api-server/src/lib/financial-budget-export.ts
- artifacts/api-server/src/lib/financial-budget-http.behavior.ts
- artifacts/api-server/src/lib/financial-budget-import.behavior.ts
- artifacts/api-server/src/lib/financial-budget-import.ts
- artifacts/api-server/src/lib/financial-budget-migration.ts
- artifacts/api-server/src/lib/financial-budget-service.ts
- artifacts/api-server/src/lib/financial-budget.behavior.ts
- artifacts/api-server/src/lib/financial-contract-browser.behavior.ts
- artifacts/api-server/src/lib/financial-contract-contract.ts
- artifacts/api-server/src/lib/financial-contract-db.behavior.ts
- artifacts/api-server/src/lib/financial-contract-export.ts
- artifacts/api-server/src/lib/financial-contract-http.behavior.ts
- artifacts/api-server/src/lib/financial-contract-import.behavior.ts
- artifacts/api-server/src/lib/financial-contract-import.ts
- artifacts/api-server/src/lib/financial-contract-migration.ts
- artifacts/api-server/src/lib/financial-contract-payment-service.ts
- artifacts/api-server/src/lib/financial-contract-payment.behavior.ts
- artifacts/api-server/src/lib/financial-contract-payment.ts
- artifacts/api-server/src/lib/financial-contract-service.ts
- artifacts/api-server/src/lib/financial-contract.behavior.ts
- artifacts/api-server/src/lib/financial-control-browser.behavior.ts
- artifacts/api-server/src/lib/financial-control-contract.ts
- artifacts/api-server/src/lib/financial-control-db.behavior.ts
- artifacts/api-server/src/lib/financial-control-migration.ts
- artifacts/api-server/src/lib/financial-control-service.ts
- artifacts/api-server/src/lib/financial-control.behavior.ts
- artifacts/api-server/src/lib/generic-apu-budget-control.ts
- artifacts/api-server/src/lib/generic-apu-contract.ts
- artifacts/api-server/src/lib/generic-apu-engine-edge.behavior.ts
- artifacts/api-server/src/lib/generic-apu-engine.ts
- artifacts/api-server/src/lib/generic-apu-persistence-db-harness.behavior.ts
- artifacts/api-server/src/lib/generic-apu-persistence-db-harness.ts
- artifacts/api-server/src/lib/generic-apu-persistence-db.behavior.ts
- artifacts/api-server/src/lib/generic-apu-persistence-migration.ts
- artifacts/api-server/src/lib/generic-apu-persistence-startup.behavior.ts
- artifacts/api-server/src/lib/generic-apu.behavior.ts
- artifacts/api-server/src/lib/help-center.behavior.ts
- artifacts/api-server/src/lib/import-intelligence.ts
- artifacts/api-server/src/lib/initial-feature-catalog.ts
- artifacts/api-server/src/lib/intake-apu-foundation.behavior.ts
- artifacts/api-server/src/lib/intake-apu-foundation.ts
- artifacts/api-server/src/lib/intake-release-readiness.behavior.ts
- artifacts/api-server/src/lib/intake-release-readiness.ts
- artifacts/api-server/src/lib/job-activation-commercial-baseline.behavior.ts
- artifacts/api-server/src/lib/job-activation-commercial-baseline.ts
- artifacts/api-server/src/lib/job-agreement-lifecycle.behavior.ts
- artifacts/api-server/src/lib/job-apu-builder.behavior.ts
- artifacts/api-server/src/lib/job-apu-builder.ts
- artifacts/api-server/src/lib/job-budget-governance.behavior.ts
- artifacts/api-server/src/lib/job-command-center.behavior.ts
- artifacts/api-server/src/lib/job-command-center.ts
- artifacts/api-server/src/lib/job-company-map.behavior.ts
- artifacts/api-server/src/lib/job-document-connections.behavior.ts
- artifacts/api-server/src/lib/job-intake-contract.ts
- artifacts/api-server/src/lib/job-intake-migration.ts
- artifacts/api-server/src/lib/job-intake-service.ts
- artifacts/api-server/src/lib/job-intake-spreadsheet.behavior.ts
- artifacts/api-server/src/lib/job-intake.behavior.ts
- artifacts/api-server/src/lib/job-operations-service.ts
- artifacts/api-server/src/lib/job-operations.behavior.ts
- artifacts/api-server/src/lib/job-resource-plan.behavior.ts
- artifacts/api-server/src/lib/job-resource-plan.ts
- artifacts/api-server/src/lib/job-work-package-builder.behavior.ts
- artifacts/api-server/src/lib/job-work-package-builder.ts
- artifacts/api-server/src/lib/job-work-packages.behavior.ts
- artifacts/api-server/src/lib/lens-import-contract.ts
- artifacts/api-server/src/lib/lens-next-create.behavior.ts
- artifacts/api-server/src/lib/lens-next-local-upload.behavior.ts
- artifacts/api-server/src/lib/lens-next-local-upload.ts
- artifacts/api-server/src/lib/lens-next-model-binding.behavior.ts
- artifacts/api-server/src/lib/lens-next-model-binding.ts
- artifacts/api-server/src/lib/lens-next-platform-source.behavior.ts
- artifacts/api-server/src/lib/lens-next-publishing.behavior.ts
- artifacts/api-server/src/lib/lens-next-publishing.ts
- artifacts/api-server/src/lib/lens-next-visual-digest-v3.behavior.ts
- artifacts/api-server/src/lib/linked-items-creation-ux.behavior.ts
- artifacts/api-server/src/lib/living-brief-gate.behavior.ts
- artifacts/api-server/src/lib/living-brief-gate.ts
- artifacts/api-server/src/lib/living-brief-migration.ts
- artifacts/api-server/src/lib/living-brief-mirror.ts
- artifacts/api-server/src/lib/living-brief-runtime.behavior.ts
- artifacts/api-server/src/lib/living-brief-source.ts
- artifacts/api-server/src/lib/meeting-canonical-links.ts
- artifacts/api-server/src/lib/oauth.ts
- artifacts/api-server/src/lib/operational-register-table.ts
- artifacts/api-server/src/lib/overdue-notifier.ts
- artifacts/api-server/src/lib/pdf-kit.ts
- artifacts/api-server/src/lib/pdf-logo.ts
- artifacts/api-server/src/lib/procore-rfi-import-atomic-store.behavior.ts
- artifacts/api-server/src/lib/procore-rfi-import-atomic-store.ts
- artifacts/api-server/src/lib/procore-rfi-import-commit.ts
- artifacts/api-server/src/lib/procore-rfi-import-migration.behavior.ts
- artifacts/api-server/src/lib/procore-rfi-import-migration.ts
- artifacts/api-server/src/lib/procore-rfi-import.behavior.ts
- artifacts/api-server/src/lib/procore-rfi-import.ts
- artifacts/api-server/src/lib/project-analytics-current-view-export.ts
- artifacts/api-server/src/lib/project-controls-dashboard.behavior.ts
- artifacts/api-server/src/lib/project-insights-metrics.ts
- artifacts/api-server/src/lib/project-intelligence.ts
- artifacts/api-server/src/lib/project-invitation-contract.ts
- artifacts/api-server/src/lib/project-invitation-migration.ts
- artifacts/api-server/src/lib/project-invitation-service.ts
- artifacts/api-server/src/lib/project-invitation.behavior.ts
- artifacts/api-server/src/lib/provider-governance.ts
- artifacts/api-server/src/lib/rfi-complete-package.behavior.ts
- artifacts/api-server/src/lib/rfi-complete-package.ts
- artifacts/api-server/src/lib/rfi-register-export.ts
- artifacts/api-server/src/lib/rfi-standard-exports.ts
- artifacts/api-server/src/lib/scoped-authority.ts
- artifacts/api-server/src/lib/sendgrid-transport.ts
- artifacts/api-server/src/lib/storage-adapter.behavior.ts
- artifacts/api-server/src/lib/storage-adapter.ts
- artifacts/api-server/src/lib/team-performance-service.ts
- artifacts/api-server/src/lib/team-performance.behavior.ts
- artifacts/api-server/src/lib/team-resource-planning-db.behavior.ts
- artifacts/api-server/src/lib/team-resource-planning-migration.ts
- artifacts/api-server/src/lib/team-resource-planning-service.ts
- artifacts/api-server/src/lib/team-resource-planning.behavior.ts
- artifacts/api-server/src/lib/telegram-product-delivery.ts
- artifacts/api-server/src/lib/telegram-product-notifications.ts
- artifacts/api-server/src/lib/telegram-product-provider-broker.ts
- artifacts/api-server/src/lib/telegram-product.ts
- artifacts/api-server/src/lib/telegram-rfi-notifications.ts

## Agents (artifacts/api-server/src/agents)
- artifacts/api-server/src/agents/base-agent.ts
- artifacts/api-server/src/agents/briefing-agent.ts
- artifacts/api-server/src/agents/clash-agent.ts
- artifacts/api-server/src/agents/rfi-agent.ts

## Database schema files (lib/db/src/schema)
- lib/db/src/schema/action-items.ts
- lib/db/src/schema/activity.ts
- lib/db/src/schema/admin-actions-log.ts
- lib/db/src/schema/agent-insights.ts
- lib/db/src/schema/ai-control-plane.ts
- lib/db/src/schema/ai-usage-events.ts
- lib/db/src/schema/change-orders.ts
- lib/db/src/schema/clash_reports.ts
- lib/db/src/schema/commercial-entitlements.ts
- lib/db/src/schema/company_profiles.ts
- lib/db/src/schema/config.ts
- lib/db/src/schema/contact-submissions.ts
- lib/db/src/schema/contract-item-workflows.ts
- lib/db/src/schema/conventions.ts
- lib/db/src/schema/coordination_intake_events.ts
- lib/db/src/schema/coordinator-bulk-operations.ts
- lib/db/src/schema/coordinator-saved-views.ts
- lib/db/src/schema/email-log.ts
- lib/db/src/schema/feature-catalog.ts
- lib/db/src/schema/feature-flags.ts
- lib/db/src/schema/feature-policies.ts
- lib/db/src/schema/feedback-items.ts
- lib/db/src/schema/files.ts
- lib/db/src/schema/financial-budgets.ts
- lib/db/src/schema/financial-contracts.ts
- lib/db/src/schema/financial-controls.ts
- lib/db/src/schema/generic-apu.ts
- lib/db/src/schema/index.ts
- lib/db/src/schema/invitations.ts
- lib/db/src/schema/job-intakes.ts
- lib/db/src/schema/lens-imports.ts
- lib/db/src/schema/lens-next-model-bindings.ts
- lib/db/src/schema/lens-next-publishing.ts
- lib/db/src/schema/lens-viewpoint-reports.ts
- lib/db/src/schema/lens-viewpoint-sequence-counters.ts
- lib/db/src/schema/lens-viewpoints.ts
- lib/db/src/schema/linked-items.ts
- lib/db/src/schema/living-brief-documents.ts
- lib/db/src/schema/living-brief-gate.ts
- lib/db/src/schema/meeting-minutes.ts
- lib/db/src/schema/notifications.ts
- lib/db/src/schema/platform-settings.ts
- lib/db/src/schema/project-directory.ts
- lib/db/src/schema/project-milestones.ts
- lib/db/src/schema/projects.ts
- lib/db/src/schema/rfi-ball-in-court-history.ts
- lib/db/src/schema/rfi-report-settings.ts
- lib/db/src/schema/rfi-responses.ts
- lib/db/src/schema/rfi-view-events.ts
- lib/db/src/schema/rfis.ts
- lib/db/src/schema/schedule-planner.ts
- lib/db/src/schema/submittal-register.ts
- lib/db/src/schema/submittal-view-events.ts
- lib/db/src/schema/submittal_reports.ts
- lib/db/src/schema/submittals.ts
- lib/db/src/schema/team-resource-planning.ts
- lib/db/src/schema/telegram-product.ts
- lib/db/src/schema/transmittals.ts
- lib/db/src/schema/user-connections.ts
- lib/db/src/schema/users.ts

## Frontend pages (artifacts/bimlog/src/pages)
- artifacts/bimlog/src/pages/About.tsx
- artifacts/bimlog/src/pages/AdminPanel.tsx
- artifacts/bimlog/src/pages/CompanyProfile.tsx
- artifacts/bimlog/src/pages/Contact.tsx
- artifacts/bimlog/src/pages/Dashboard.tsx
- artifacts/bimlog/src/pages/DataRetention.tsx
- artifacts/bimlog/src/pages/Disclaimer.tsx
- artifacts/bimlog/src/pages/Features.tsx
- artifacts/bimlog/src/pages/FeedbackAdmin.behavior.tsx
- artifacts/bimlog/src/pages/FinancialApuWorkspace.tsx
- artifacts/bimlog/src/pages/FinancialBudgetWorkspace.tsx
- artifacts/bimlog/src/pages/FinancialContractWorkspace.tsx
- artifacts/bimlog/src/pages/FinancialControlsSettings.tsx
- artifacts/bimlog/src/pages/HelpCenter.tsx
- artifacts/bimlog/src/pages/JobIntakeWorkspace.tsx
- artifacts/bimlog/src/pages/JobOperationsDocumentConnections.behavior.tsx
- artifacts/bimlog/src/pages/JobOperationsWorkspace.tsx
- artifacts/bimlog/src/pages/Landing.tsx
- artifacts/bimlog/src/pages/LivingBrief.tsx
- artifacts/bimlog/src/pages/Login.tsx
- artifacts/bimlog/src/pages/NotificationSettings.tsx
- artifacts/bimlog/src/pages/PendingItems.tsx
- artifacts/bimlog/src/pages/Pricing.tsx
- artifacts/bimlog/src/pages/Privacy.tsx
- artifacts/bimlog/src/pages/Profile.tsx
- artifacts/bimlog/src/pages/ProjectDetail.tsx
- artifacts/bimlog/src/pages/Register.tsx
- artifacts/bimlog/src/pages/ResetPassword.tsx
- artifacts/bimlog/src/pages/SetupGuide.tsx
- artifacts/bimlog/src/pages/TeamPerformanceWorkspace.tsx
- artifacts/bimlog/src/pages/Terms.tsx
- artifacts/bimlog/src/pages/TotalControl.tsx
- artifacts/bimlog/src/pages/not-found.tsx
- artifacts/bimlog/src/pages/project/ActivityTab.tsx
- artifacts/bimlog/src/pages/project/AnalyticsTab.tsx
- artifacts/bimlog/src/pages/project/ChangeOrdersTab.tsx
- artifacts/bimlog/src/pages/project/ClashReportsTab.tsx
- artifacts/bimlog/src/pages/project/ConventionBuilder.tsx
- artifacts/bimlog/src/pages/project/CoordinationHub.tsx
- artifacts/bimlog/src/pages/project/CoordinatorBulkActions.tsx
- artifacts/bimlog/src/pages/project/CoordinatorCommandCenter.tsx
- artifacts/bimlog/src/pages/project/DirectoryTab.tsx
- artifacts/bimlog/src/pages/project/FilesTab.tsx
- artifacts/bimlog/src/pages/project/IntegrationsTab.tsx
- artifacts/bimlog/src/pages/project/LegacyIntegrationsTab.tsx
- artifacts/bimlog/src/pages/project/LensViewpointsView.tsx
- artifacts/bimlog/src/pages/project/MeetingClashesPanel.tsx
- artifacts/bimlog/src/pages/project/MeetingsTab.tsx
- artifacts/bimlog/src/pages/project/NameGenerator.tsx
- artifacts/bimlog/src/pages/project/ReportsTab.tsx
- artifacts/bimlog/src/pages/project/RfiCanonicalUiHarness.tsx
- artifacts/bimlog/src/pages/project/RfisTab.tsx
- artifacts/bimlog/src/pages/project/ScheduleTab.tsx
- artifacts/bimlog/src/pages/project/SubmittalsTab.tsx
- artifacts/bimlog/src/pages/project/TeamTab.tsx
- artifacts/bimlog/src/pages/project/TransmittalsTab.tsx

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
- /lens-next
- /projects/:id/financial/cost-structure
- /projects/:id/financial/budget
- /projects/:id/financial/history
- /projects/:id/financial/snapshots/:snapshotId
- /projects/:id/financial/contracts
- /projects/:id/financial/apu
- /projects/:id/commercial/team-performance
- /projects/:id/intake
- /projects/:id/operations
- /projects/:id/:tab?
- /help
- /setup-guide
- /profile
- /settings/company-profile
- /settings/notifications
- /settings/financial-controls
- /admin/feedback
- /admin
- /feedback
- /total-control
- /living-brief
- /pricing
- /features
- /about
- /contact

## Curated interconnections and gotchas (maintained in the generator)
- All API routes are served under the /api/v1 prefix. res.redirect in route files MUST
  include /api/v1 or it 404s.
- Replit monorepo deployment promotion probes GET /api. After the synchronous durable-storage
  authority preflight succeeds, the early-bound listener returns HTTP 200 from exact /api with
  an explicit {status:"starting",ready:false} liveness body while application initialization runs.
  /api/v1/healthz and every other route remain HTTP 503 until the real application is ready;
  the ready app then owns both paths and returns HTTP 200 from its canonical handlers.
- Auth: JWT Bearer; payload carries isSuperAdmin. authMiddleware verifies; requireProjectMember
  / requirePermission gate project access (super admins bypass membership);
  isSuperAdminMiddleware re-checks users.is_super_admin.
- Schema changes go in BOTH the drizzle schema file AND the idempotent startup migration block
  in artifacts/api-server/src/app.ts (ALTER TABLE / CREATE TABLE ... IF NOT EXISTS).
- Declarative schemas preserve established production constraint, foreign-key, unique, check, and index names
  plus ordering semantics so provider comparison cannot replace compatible objects through destructive churn.
- Direct schema force-push is disabled. The guarded development sync requires exact authoritative
  master attestation, a Replit Helium target distinct from the runtime production identity, and
  read-only table/index parity. Publish additionally requires the complete generated SQL, a
  hash-bound additive inventory, a verified restore point, and affected-table count manifests.
- Route ordering: literal sub-paths (e.g. .../lens-pull, .../plugin-pull) must be registered
  before parameterized catch-alls like .../:reportId (no NaN guard).
- Soft-delete DELETE routes live inside their feature route files (see routes/index.ts comments).
- Clash reports support a Navisworks plugin sync round-trip (fingerprint dedup; pull uses
  updatedAt > lastPluginSyncAt). Lens viewpoints use a manual refresh banner (polling removed).
- Lens Next owns only BIMLog construction project/model binding, issue workflows, viewpoint
  workflows, and their governed Navisworks 2021/2025 bridge contracts. It may consume versioned
  external handoffs, but it must refuse marketing execution, portfolio finance/allocation
  authority, legal approval authority, and Knowledge Intake routing authority. The Build 10
  acceptance gate fails on semantic cross-platform authority drift.
- Lens Next local upload and create use the `lens-next-visual-digest.v2` SHA-256 contract with
  exact IEEE-754 tokens for camera and appearance doubles. Cryptographically verified v1 native
  captures remain compatible across .NET/JavaScript decimal formatting, while material changes
  remain fail-closed HTTP 409 with no issue/package mutation. Server diagnostics record both
  digests and the first differing field. The existing XML export reads Navisworks Saved Viewpoints
  and does not silently substitute BIMLog web viewpoint records.
- Lens Next normal create/open navigation uses the purpose-specific `lens-next-navigation.v1`
  contract. The persisted navigation package contains project/model identity, camera, optional
  sectioning, and an independently stored screenshot; screenshot bytes do not affect its digest.
  Normal navigation deliberately excludes full-model visibility and appearance scans. The N06
  exact-state engine is retained only behind the explicit `restore-exact-visual-state` diagnostic
  action and is not part of normal issue creation or Open Working View.
- Living Brief: all documents in living-brief/catalog.json are served in authority order through
  /api/v1/living-brief/* from the verified deployed source bundle. living_brief_documents is an
  exact, metadata-bearing database mirror; it never overrides source doctrine. Controlled admin
  reconciliation requires observed mirror hashes. Eligible authenticated users receive a
  short-lived brief token without a separate gate password; only super admins administer the
  durable credential/revocation state, grant access, or reconcile a mismatched mirror.
- RFI report template settings: accepted source integration uses one project-scoped report settings
  snapshot for Standard PDF, DOCX, and Complete PDF embedded canonical pages. Settings live in
  rfi_report_settings, are added through additive startup/schema wiring, and never mutate canonical RFI
  data or Lens/Viewpoint source identity.
- Cost & Value Planner presents stored compatible allocation keys as Labor Operating Pool, Project
  Incentive Reserve, and Project Earnings. Amount and percentage inputs stay synchronized across the
  allocation tree, and saved labor/phase/administrative percentages cascade when parent values change;
  the included BIM-services sample is configurable, not a platform-hardcoded policy.
  Optional section guidance, automatic detail-line remainder/equal splits, and exact save-readiness
  explanations make the complete allocation actionable. Draft and saved plans can be exported as CSV
  or generated through the governed Print PDF flow; saved plan versions remain immutable.
- Smart Intake uses the existing project-scoped `job_intakes.data` draft as its only pre-activation
  authority. Preserved XLS/XLSX/XLSM/CSV sources expose bounded multi-sheet previews; the user must
  explicitly choose the sheet, header row, Contract Item Name column, and Quantity column. A
  fingerprint- and revision-bound confirmation appends deterministic-ID rows with document/hash/
  sheet/row/column provenance. Ambiguous or truncated previews fail closed, and PDF/DOCX extraction
  remains manual-review evidence that cannot silently create financial records. The default editor
  exposes only Contract Item Name and Quantity for 100-plus rows; unit, currency, APU/rate, calculated
  value, workflow, budget, and descriptive overrides remain explicit Advanced controls. Activation,
  rather than import preview, creates shared operational and entitled Commercial records.
- Build 3 multi-contract activation keeps up to 50 independent contract profiles in the same
  canonical Intake draft. Every Contract Item references one owning contract. Activation creates
  or reuses the canonical Commercial contract records, freezes the selected APU or pricing snapshot
  separately for each contract, applies project-to-contract-to-item workflow inheritance, and writes
  the connected Contract Item and budget relationships idempotently. Source documents remain
  optional, ordered draft persistence remains intact, and no duplicate Intake, contract, APU,
  workflow, or budget authority is created.
- Build 4 extends that same activation transaction with generated project-budget aggregates,
  immutable Contract Item financial/APU baselines, project cost-node Budget Accounts, and
  Project to Contract to Contract Item to Budget Account drill-down. The generated execution
  baseline and content fingerprints are immutable; replay is idempotent and conflicting
  baselines fail closed rather than creating a parallel financial authority.
- Help, Job Intake, Job Operations, Cost & Value Planner, Team Performance, and Project Controls
  use the shared governed Print PDF confirmation and authenticated PDF response. Current-view
  filters are preserved where present; otherwise PDF-only section choices are explicit. The
  completed PDF downloads directly, without blank tabs, browser print screens, or window.print.
- Commercial Contract Items turn an approved budget line and saved APU version into an operational
  contract scope. Quantity multiplied by the frozen APU selling price calculates the contractual value;
  the immutable item snapshot preserves the APU content, evaluation, fingerprint, BIM Submittal display,
  and Phase to Revision to Version to Task workflow selection. Contract detail, searchable PDF, and native
  XLSX exports expose the same Contract Item quantities, rates, values, APU identity, and workflow metadata.

## N07 deterministic map provenance

- The `lens-next-navigation.v1` entry is emitted by `artifacts/api-server/scripts/generate-platform-md.ts`;
  build-gate fix `b45c5ac3ade23b7a67c26423cb96d56b4dcb85b7` makes the generated and committed
  platform authority identical.
- Build: bimlog needs PORT set (PORT=3000 pnpm build); api-server bundles to dist/index.cjs via
  esbuild and this generator runs as a pre-build step.

## N08 historical unversioned digest boundary

- Platform persistence continues to validate every explicitly versioned v1, v2, v3, and
  lens-next-navigation.v1 package under its declared contract. A historical package that has no
  contract metadata cannot be silently reinterpreted under the current v2 canonicalizer.
- When that historical package has matching stored and embedded digests plus exact issue identity,
  but lacks the original canonical evidence needed to prove its algorithm, BIMLog returns the
  dedicated historical_digest_evidence_unavailable quarantine result. It does not mutate the row,
  weaken digest validation, or claim that a current recomputation proves the old package.
- The permanent cross-language vector records the exact historical bytes, stored digest, current-v2
  recomputation, and expected quarantine result. Current navigation and explicit versioned visual
  packages retain their existing acceptance and tamper-denial behavior.

## N08-P03 production startup authority preflight

- The production entrypoint loads the storage adapter before the full application import. Missing or
  invalid durable storage authority therefore fails closed before database or application initialization.
- Valid production startup uses the same cached storage singleton and retains the existing readiness,
  listener, authentication, and durable-storage contracts. This repair changes no schema or persisted data.
- Every database startup initializer is registered on one ordered process-local queue. This preserves
  each initializer's existing fatal or nonfatal behavior while preventing independent PostgreSQL pool
  clients from deadlocking on overlapping DDL during a fresh production-artifact startup. Readiness
  remains closed until the entire queue drains successfully.
- The production-artifact gate requires an invalid authority child to exit naturally with the sanitized
  FEEDBACK_STORAGE_AUTHORITY_INVALID code and without readiness or TCP binding; the valid artifact must
  still start and pass the existing authenticated storage closure proof.

## N09-P04 Replit promotion liveness correction

- Replit deployment `8809d211` proved that application import and ordered database startup required
  23.889 seconds while Promote repeatedly rejected the unbound `/api` service. The process eventually
  bound correctly, but only after the provider's promotion health window had already failed.
- The entrypoint now binds immediately after the synchronous storage-authority preflight and before the
  full application import. Exact `/api` is a liveness-only HTTP 200 during that bounded interval;
  `/api/v1/healthz` stays HTTP 503 until the real Express application and startup barrier are complete.
- Initialization failure changes all bootstrap responses to HTTP 503 and closes the listener. Workers
  still start exactly once and only after the ready transition. This changes no schema or persisted data.
