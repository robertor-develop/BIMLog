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

## Current release and provider contract
- Current accepted Platform release: `v1.05.N18-P34` / `1.5.18.34`; Build 040 corrective source `4472d982c2fc7ab5fde552048f024cd7e90fab96`; Replit publication receipt `b8718795`. Exact live source/package/database identity and authenticated two-tab restoration passed.
- Builds 041–050 are the due ten-build publication batch. Builds 041–045 harden the global shell; Builds 046–050 add governed catalog aliases, canonical Intake classification selection, permanent pricing/workflow/Intake lifecycle regressions, and controlled role acceptance. The only schema delta is the additive, default-empty company-catalog `aliases` column. No Lens Next Native source or installer changed. Publication and authenticated live acceptance are required before Build 051.
- GitHub `master` is the product source authority. Replit is the established BIMLog publication provider; synchronize exact reviewed source through the signed-in Replit Shell, never Replit Agents.
- Publication requires the read-only database operator to prove exact development/production schema correspondence, no destructive action, development-data copy off, and a clean exact source. Build 020 returned `schemaAction=NONE` and changed no production row or schema object.
- Public `/api/v1/healthz` is both health and application-readiness evidence because the startup bootstrap holds that route at HTTP 503 until the real application barrier completes.
- Lens Next is the sole supported Lens product. Original/Legacy Lens exists only as preserved historical migration input and must not appear as a parallel customer-facing product or installed loader.
- The current B051–B060 publication candidate is `v1.05.N18-P37` / `1.5.18.37`; it includes signed year-specific Lens Next automatic-update manifests and packages for Navisworks 2021 and 2025. Production remains at the prior accepted P36 source until this ten-build boundary passes push, publication, and authenticated Chrome acceptance.
- The P37 onboarding schema reconciliation preserves `user_onboarding_work_profile_chk` and `email_verification_tokens_user_idx`. The token index declares descending `created_at` with explicit `NULLS FIRST` semantics so provider migration generation matches the existing production object without replacement.

## Production runtime closure recovery

- A runtime closure whose source identity matches the candidate is reused only after the complete packaged tree, dependency set, source identity and Living Brief identity validate.
- A partial or invalid source-matched closure is retired without recursive pre-build deletion and rebuilt from the exact installed, lock-bound dependency graph before publication.

## Lens Next redline and XML V2 integration

- The Lens Next web workspace sends workflow status with each authoritative Visual Package and scopes XML V2 candidates to the current project-filtered result set. The native bridge writes deterministic BIMLog Viewpoints/Open and BIMLog Viewpoints/Resolved folders without reading or mutating existing Saved Viewpoints during export.
- Saved Viewpoint publication preserves native redline state through an independent Navisworks copy and reports the preservation result. Existing project/model authorization, explicit publishing confirmation, idempotency and non-redline behavior remain unchanged.
- This five-build source block is locally verified but unpublished. Production Platform and installed Native acceptance remain at the prior accepted P36 source until the next ten-build publication boundary.

## Critical Database Facts — Read Before Every Session
- Identity candidate I001–I005 adds nullable company retirement identity/time, guarded collision prevention and fresh request authority. Apply and verify `lib/db/scripts/company-identity-lifecycle.sql` before deploying consumers; no production migration or nine-project binding repair is implied by local tests. Reconciliation appends versions and preserves historical company rows. Invitation token completion remains separate I006–I010 work.
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
- Replit may add and push an automatic empty publish-wrapper commit before build. Production assembly attributes only the exact `Published your App` wrapper to its first parent and only when both commits resolve to the exact same tree. When Replit environment identity is available, `origin/master` must also be an ancestor with that exact tree. Missing parent, changed tree, changed subject or failed ancestry fails closed; ordinary local commits remain bound to `HEAD`.

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
- artifacts/api-server/src/routes/commercial-billing-history-route.behavior.ts
- artifacts/api-server/src/routes/commercial-launch-activation-route.behavior.ts
- artifacts/api-server/src/routes/commercial-launch-live-route.behavior.ts
- artifacts/api-server/src/routes/commercial-provider-webhook.ts
- artifacts/api-server/src/routes/commercial-workspace.behavior.ts
- artifacts/api-server/src/routes/commercial-workspace.ts
- artifacts/api-server/src/routes/company-master-catalogs.ts
- artifacts/api-server/src/routes/company-pricing-templates.ts
- artifacts/api-server/src/routes/company-profile.ts
- artifacts/api-server/src/routes/config.ts
- artifacts/api-server/src/routes/connections.ts
- artifacts/api-server/src/routes/contact.behavior.ts
- artifacts/api-server/src/routes/contact.ts
- artifacts/api-server/src/routes/contract-item-workflows.ts
- artifacts/api-server/src/routes/conventions.ts
- artifacts/api-server/src/routes/coordination-hub.ts
- artifacts/api-server/src/routes/coordination-knowledge.ts
- artifacts/api-server/src/routes/coordination.ts
- artifacts/api-server/src/routes/coordinator-actions.ts
- artifacts/api-server/src/routes/dashboard_briefing.ts
- artifacts/api-server/src/routes/delivery-workflow-templates.ts
- artifacts/api-server/src/routes/documents.ts
- artifacts/api-server/src/routes/downloads.ts
- artifacts/api-server/src/routes/edt-engine.ts
- artifacts/api-server/src/routes/feature-policies.ts
- artifacts/api-server/src/routes/features.ts
- artifacts/api-server/src/routes/feedback.ts
- artifacts/api-server/src/routes/files.ts
- artifacts/api-server/src/routes/financial-apu.ts
- artifacts/api-server/src/routes/financial-budgets.ts
- artifacts/api-server/src/routes/financial-contracts.ts
- artifacts/api-server/src/routes/financial-controls.ts
- artifacts/api-server/src/routes/folder-wizard-imports.ts
- artifacts/api-server/src/routes/folder-wizard-routing.ts
- artifacts/api-server/src/routes/generic-apu-budget-controls.ts
- artifacts/api-server/src/routes/health.ts
- artifacts/api-server/src/routes/index.ts
- artifacts/api-server/src/routes/intelligence.ts
- artifacts/api-server/src/routes/job-intake.ts
- artifacts/api-server/src/routes/job-operations.ts
- artifacts/api-server/src/routes/linked_items.ts
- artifacts/api-server/src/routes/living_brief.ts
- artifacts/api-server/src/routes/master-catalogs.ts
- artifacts/api-server/src/routes/meeting_minutes.ts
- artifacts/api-server/src/routes/members.ts
- artifacts/api-server/src/routes/notifications.ts
- artifacts/api-server/src/routes/onboarding.ts
- artifacts/api-server/src/routes/project_directory.ts
- artifacts/api-server/src/routes/projects.ts
- artifacts/api-server/src/routes/reports.ts
- artifacts/api-server/src/routes/rfis.ts
- artifacts/api-server/src/routes/sales-inquiry-action-workload.behavior.ts
- artifacts/api-server/src/routes/sales-inquiry-next-action.behavior.ts
- artifacts/api-server/src/routes/schedule.ts
- artifacts/api-server/src/routes/search.ts
- artifacts/api-server/src/routes/submittal_reports.ts
- artifacts/api-server/src/routes/submittals.ts
- artifacts/api-server/src/routes/support-case-admin-list.behavior.ts
- artifacts/api-server/src/routes/support-case-administrator-reply-notification.behavior.ts
- artifacts/api-server/src/routes/support-case-assignment-event.behavior.ts
- artifacts/api-server/src/routes/support-case-assignment.behavior.ts
- artifacts/api-server/src/routes/support-case-awareness.behavior.ts
- artifacts/api-server/src/routes/support-case-customer-lifecycle.behavior.ts
- artifacts/api-server/src/routes/support-case-customer-reply-notification.behavior.ts
- artifacts/api-server/src/routes/support-case-list-query.behavior.ts
- artifacts/api-server/src/routes/support-case-messages.behavior.ts
- artifacts/api-server/src/routes/support-case-messages.ts
- artifacts/api-server/src/routes/support-case-open-notification.behavior.ts
- artifacts/api-server/src/routes/support-case-resolution-handoff.behavior.ts
- artifacts/api-server/src/routes/support-case-resolution-route.behavior.ts
- artifacts/api-server/src/routes/support-case-satisfaction.behavior.ts
- artifacts/api-server/src/routes/support-case-satisfaction.ts
- artifacts/api-server/src/routes/support-case-status-event.behavior.ts
- artifacts/api-server/src/routes/support-case-status-notification.behavior.ts
- artifacts/api-server/src/routes/support-case-status.behavior.ts
- artifacts/api-server/src/routes/support-case-unread-filter.behavior.ts
- artifacts/api-server/src/routes/support-cases.behavior.ts
- artifacts/api-server/src/routes/support-cases.ts
- artifacts/api-server/src/routes/support-satisfaction-notification.behavior.ts
- artifacts/api-server/src/routes/team-performance.ts
- artifacts/api-server/src/routes/telegram-product.ts
- artifacts/api-server/src/routes/transmittals.ts
- artifacts/api-server/src/routes/workflow-governance-policies.ts

## Backend route mount order (routes/index.ts, under /api/v1)
- downloadsRouter
- healthRouter
- authRouter
- onboardingRouter
- commercialWorkspaceRouter
- commercialProviderWebhookRouter
- supportCasesRouter
- supportCaseSatisfactionRouter
- supportCaseMessagesRouter
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
- coordinationHubRouter
- folderWizardImportsRouter
- folderWizardRoutingRouter
- masterCatalogsRouter
- companyMasterCatalogsRouter
- deliveryWorkflowTemplatesRouter
- companyPricingTemplatesRouter
- workflowGovernancePoliciesRouter
- coordinationKnowledgeRouter
- edtEngineRouter

## Backend middlewares (artifacts/api-server/src/middlewares)
- artifacts/api-server/src/middlewares/auth.ts
- artifacts/api-server/src/middlewares/config-validator.ts
- artifacts/api-server/src/middlewares/multipart.ts
- artifacts/api-server/src/middlewares/request-diagnostics.ts
- artifacts/api-server/src/middlewares/team-resource-planning-rate-limit.ts

## Backend libs (artifacts/api-server/src/lib)
- artifacts/api-server/src/lib/access-policy.behavior.ts
- artifacts/api-server/src/lib/access-policy.ts
- artifacts/api-server/src/lib/access-profile.ts
- artifacts/api-server/src/lib/access-route-authority.behavior.ts
- artifacts/api-server/src/lib/accountability-outbox.behavior.ts
- artifacts/api-server/src/lib/accountability-outbox.ts
- artifacts/api-server/src/lib/ai-assistance-governance.behavior.ts
- artifacts/api-server/src/lib/ai-assistance-governance.ts
- artifacts/api-server/src/lib/ai-assistance-truth.behavior.ts
- artifacts/api-server/src/lib/ai-control-plane-migration.ts
- artifacts/api-server/src/lib/ai-control-plane.behavior.ts
- artifacts/api-server/src/lib/ai-control-plane.http-evidence.ts
- artifacts/api-server/src/lib/ai-control-plane.ts
- artifacts/api-server/src/lib/ai-control-plane.ui-fixture.ts
- artifacts/api-server/src/lib/ai-usage.ts
- artifacts/api-server/src/lib/approved-contract-economic-source.ts
- artifacts/api-server/src/lib/approved-labor-evidence.behavior.ts
- artifacts/api-server/src/lib/approved-labor-evidence.ts
- artifacts/api-server/src/lib/approved-work-item-economic-plan.ts
- artifacts/api-server/src/lib/apu-budget-authority-http.behavior.ts
- artifacts/api-server/src/lib/apu-budget-authority-real-boundary.behavior.ts
- artifacts/api-server/src/lib/apu-budget-authority-service.ts
- artifacts/api-server/src/lib/apu-library-entry.behavior.ts
- artifacts/api-server/src/lib/apu-library-retirement.behavior.ts
- artifacts/api-server/src/lib/apu-library-reuse.behavior.ts
- artifacts/api-server/src/lib/apu-library-reuse.ts
- artifacts/api-server/src/lib/bimlog-configuration-authorities.behavior.ts
- artifacts/api-server/src/lib/bimlog-configuration-authorities.ts
- artifacts/api-server/src/lib/bimlog-default-configuration-contract.behavior.ts
- artifacts/api-server/src/lib/bimtech-coordination-starter-library.ts
- artifacts/api-server/src/lib/bimtech-template-repair-definitions.behavior.ts
- artifacts/api-server/src/lib/bimtech-template-repair-definitions.ts
- artifacts/api-server/src/lib/block10-controlled-acceptance.behavior.ts
- artifacts/api-server/src/lib/block11-financial-acceptance.behavior.ts
- artifacts/api-server/src/lib/block12-build056-canonical-project-identity.behavior.ts
- artifacts/api-server/src/lib/block12-build057-task-lifecycle.behavior.ts
- artifacts/api-server/src/lib/block12-build058-financial-authority.behavior.ts
- artifacts/api-server/src/lib/block12-build059-operational-projections.behavior.ts
- artifacts/api-server/src/lib/block12-build060-intake-operations-acceptance.behavior.ts
- artifacts/api-server/src/lib/block13-build061-coordination-identity.behavior.ts
- artifacts/api-server/src/lib/block13-build062-lifecycle.behavior.ts
- artifacts/api-server/src/lib/block13-build063-evidence-notifications.behavior.ts
- artifacts/api-server/src/lib/block13-build064-register-export.behavior.ts
- artifacts/api-server/src/lib/block13-build065-coordination-acceptance.behavior.ts
- artifacts/api-server/src/lib/block16-build076-feedback-durability.behavior.ts
- artifacts/api-server/src/lib/block16-build077-feedback-routing.behavior.ts
- artifacts/api-server/src/lib/block16-build078-notification-determinism.behavior.ts
- artifacts/api-server/src/lib/block16-build079-delivery-contracts.behavior.ts
- artifacts/api-server/src/lib/block16-build080-feedback-notification-acceptance.behavior.ts
- artifacts/api-server/src/lib/block17-build081-file-download.behavior.ts
- artifacts/api-server/src/lib/block17-build082-upload-retention.behavior.ts
- artifacts/api-server/src/lib/block17-build083-pdf-fidelity.behavior.ts
- artifacts/api-server/src/lib/block17-build084-portable-exports.behavior.ts
- artifacts/api-server/src/lib/block17-build085-owner-handover-acceptance.behavior.ts
- artifacts/api-server/src/lib/block18-build086-procore-reconciliation.behavior.ts
- artifacts/api-server/src/lib/block18-build086-procore-reconciliation.ts
- artifacts/api-server/src/lib/block18-build087-sharepoint-reference.behavior.ts
- artifacts/api-server/src/lib/block18-build087-sharepoint-reference.ts
- artifacts/api-server/src/lib/block18-build088-outlook-custody.behavior.ts
- artifacts/api-server/src/lib/block18-build088-outlook-custody.ts
- artifacts/api-server/src/lib/block18-build089-connector-matrix.behavior.ts
- artifacts/api-server/src/lib/block18-build089-connector-matrix.ts
- artifacts/api-server/src/lib/block18-build090-integration-recovery.behavior.ts
- artifacts/api-server/src/lib/block18-build090-integration-recovery.ts
- artifacts/api-server/src/lib/block20-build096-performance-budget.behavior.ts
- artifacts/api-server/src/lib/block20-build097-cache-coherence.behavior.ts
- artifacts/api-server/src/lib/block20-build098-request-diagnostics.behavior.ts
- artifacts/api-server/src/lib/block20-build099-runtime-resilience.behavior.ts
- artifacts/api-server/src/lib/block20-build100-release-acceptance.behavior.ts
- artifacts/api-server/src/lib/block21-build101-commercial-truth.behavior.ts
- artifacts/api-server/src/lib/block21-build102-onboarding.behavior.ts
- artifacts/api-server/src/lib/block21-build103-help.behavior.ts
- artifacts/api-server/src/lib/block21-build104-unsupported-actions.behavior.ts
- artifacts/api-server/src/lib/block21-build105-public-onboarding-acceptance.behavior.ts
- artifacts/api-server/src/lib/block21-source-reader.ts
- artifacts/api-server/src/lib/block22-build106-object-authorization.behavior.ts
- artifacts/api-server/src/lib/block22-build107-runtime-security.behavior.ts
- artifacts/api-server/src/lib/block22-build108-data-lifecycle.behavior.ts
- artifacts/api-server/src/lib/block22-build109-recovery-readiness.behavior.ts
- artifacts/api-server/src/lib/block22-build110-security-recovery-acceptance.behavior.ts
- artifacts/api-server/src/lib/block22-data-lifecycle.ts
- artifacts/api-server/src/lib/block22-object-authority.ts
- artifacts/api-server/src/lib/block23-build111-clean-suite.behavior.ts
- artifacts/api-server/src/lib/block23-build112-route-matrix.behavior.ts
- artifacts/api-server/src/lib/block23-build113-responsive-accessibility.behavior.ts
- artifacts/api-server/src/lib/block23-build114-native-acceptance.behavior.ts
- artifacts/api-server/src/lib/block23-build115-final-acceptance.behavior.ts
- artifacts/api-server/src/lib/block24-build116-release-manifest.behavior.ts
- artifacts/api-server/src/lib/block24-build117-publication.behavior.ts
- artifacts/api-server/src/lib/block24-build118-live-smoke.behavior.ts
- artifacts/api-server/src/lib/block24-build119-native-boundary.behavior.ts
- artifacts/api-server/src/lib/block24-build120-final-closure.behavior.ts
- artifacts/api-server/src/lib/block24-final-release-contract.ts
- artifacts/api-server/src/lib/build4-backend.behavior.ts
- artifacts/api-server/src/lib/build4-pdf-ui-consistency.behavior.ts
- artifacts/api-server/src/lib/business-calendar.behavior.ts
- artifacts/api-server/src/lib/business-calendar.ts
- artifacts/api-server/src/lib/clash-report-contracts.ts
- artifacts/api-server/src/lib/clash-report-provenance.ts
- artifacts/api-server/src/lib/clash-visual-package-truth.ts
- artifacts/api-server/src/lib/cloud-files.ts
- artifacts/api-server/src/lib/commercial-billing-authority.behavior.ts
- artifacts/api-server/src/lib/commercial-billing-authority.ts
- artifacts/api-server/src/lib/commercial-billing-history-query.behavior.ts
- artifacts/api-server/src/lib/commercial-billing-history-query.ts
- artifacts/api-server/src/lib/commercial-billing-history.behavior.ts
- artifacts/api-server/src/lib/commercial-billing-history.ts
- artifacts/api-server/src/lib/commercial-billing-operations.behavior.ts
- artifacts/api-server/src/lib/commercial-billing-operations.ts
- artifacts/api-server/src/lib/commercial-change-approval.behavior.ts
- artifacts/api-server/src/lib/commercial-change-approval.ts
- artifacts/api-server/src/lib/commercial-change-order-draft.behavior.ts
- artifacts/api-server/src/lib/commercial-change-order-draft.ts
- artifacts/api-server/src/lib/commercial-checkout-command.behavior.ts
- artifacts/api-server/src/lib/commercial-checkout-command.ts
- artifacts/api-server/src/lib/commercial-checkout-schema.behavior.ts
- artifacts/api-server/src/lib/commercial-credit-schema.behavior.ts
- artifacts/api-server/src/lib/commercial-customer-support.behavior.ts
- artifacts/api-server/src/lib/commercial-customer-support.ts
- artifacts/api-server/src/lib/commercial-dispute-schema.behavior.ts
- artifacts/api-server/src/lib/commercial-entitlement.behavior.ts
- artifacts/api-server/src/lib/commercial-entitlement.ts
- artifacts/api-server/src/lib/commercial-evidence-package.behavior.ts
- artifacts/api-server/src/lib/commercial-evidence-package.ts
- artifacts/api-server/src/lib/commercial-forecast-reconciliation.behavior.ts
- artifacts/api-server/src/lib/commercial-forecast-reconciliation.ts
- artifacts/api-server/src/lib/commercial-invoice-schema.behavior.ts
- artifacts/api-server/src/lib/commercial-launch-activation.behavior.ts
- artifacts/api-server/src/lib/commercial-launch-activation.ts
- artifacts/api-server/src/lib/commercial-launch-live-verification.behavior.ts
- artifacts/api-server/src/lib/commercial-launch-live-verification.ts
- artifacts/api-server/src/lib/commercial-launch-verification-transport.behavior.ts
- artifacts/api-server/src/lib/commercial-launch-verification-transport.ts
- artifacts/api-server/src/lib/commercial-order-schema.behavior.ts
- artifacts/api-server/src/lib/commercial-persistence.behavior.ts
- artifacts/api-server/src/lib/commercial-persistence.ts
- artifacts/api-server/src/lib/commercial-platform-readiness.behavior.ts
- artifacts/api-server/src/lib/commercial-platform-readiness.ts
- artifacts/api-server/src/lib/commercial-portal-command.behavior.ts
- artifacts/api-server/src/lib/commercial-portal-command.ts
- artifacts/api-server/src/lib/commercial-potential-impact.behavior.ts
- artifacts/api-server/src/lib/commercial-potential-impact.ts
- artifacts/api-server/src/lib/commercial-project-scope.ts
- artifacts/api-server/src/lib/commercial-provider-adapter.behavior.ts
- artifacts/api-server/src/lib/commercial-provider-adapter.ts
- artifacts/api-server/src/lib/commercial-provider-events.behavior.ts
- artifacts/api-server/src/lib/commercial-provider-events.ts
- artifacts/api-server/src/lib/commercial-provider-webhook.behavior.ts
- artifacts/api-server/src/lib/commercial-provider-webhook.ts
- artifacts/api-server/src/lib/commercial-receipt-audit-schema.behavior.ts
- artifacts/api-server/src/lib/commercial-sales-inquiry-schema.behavior.ts
- artifacts/api-server/src/lib/commercial-sales-inquiry.behavior.ts
- artifacts/api-server/src/lib/commercial-sales-inquiry.ts
- artifacts/api-server/src/lib/commercial-seat-schema.behavior.ts
- artifacts/api-server/src/lib/commercial-sendgrid-live-verification.behavior.ts
- artifacts/api-server/src/lib/commercial-sendgrid-live-verification.ts
- artifacts/api-server/src/lib/commercial-stripe-live-verification.behavior.ts
- artifacts/api-server/src/lib/commercial-stripe-live-verification.ts
- artifacts/api-server/src/lib/commercial-stripe-service-verification.behavior.ts
- artifacts/api-server/src/lib/commercial-stripe-service-verification.ts
- artifacts/api-server/src/lib/commercial-subscription-migration.ts
- artifacts/api-server/src/lib/commercial-subscription-schema.behavior.ts
- artifacts/api-server/src/lib/commercial-support-case-schema.behavior.ts
- artifacts/api-server/src/lib/commercial-support-case.behavior.ts
- artifacts/api-server/src/lib/commercial-support-case.ts
- artifacts/api-server/src/lib/commercial-workspace-runtime.behavior.ts
- artifacts/api-server/src/lib/commercial-workspace-runtime.ts
- artifacts/api-server/src/lib/commercial-workspace.behavior.ts
- artifacts/api-server/src/lib/commercial-workspace.ts
- artifacts/api-server/src/lib/company-directory-resolution.behavior.ts
- artifacts/api-server/src/lib/company-directory-resolution.ts
- artifacts/api-server/src/lib/company-identity-reconciliation.behavior.ts
- artifacts/api-server/src/lib/company-identity-reconciliation.ts
- artifacts/api-server/src/lib/company-identity.behavior.ts
- artifacts/api-server/src/lib/company-identity.ts
- artifacts/api-server/src/lib/company-master-catalog-migration.ts
- artifacts/api-server/src/lib/company-master-catalog-usage.behavior.ts
- artifacts/api-server/src/lib/company-master-catalog-usage.ts
- artifacts/api-server/src/lib/company-master-catalog.behavior.ts
- artifacts/api-server/src/lib/company-master-catalog.http-evidence.ts
- artifacts/api-server/src/lib/company-pricing-template-binding.ts
- artifacts/api-server/src/lib/company-pricing-template-contract.behavior.ts
- artifacts/api-server/src/lib/company-pricing-template-contract.ts
- artifacts/api-server/src/lib/company-pricing-template-intake.behavior.ts
- artifacts/api-server/src/lib/company-pricing-template-lifecycle.behavior.ts
- artifacts/api-server/src/lib/company-pricing-template.http-evidence.ts
- artifacts/api-server/src/lib/company-profile-presentation.behavior.ts
- artifacts/api-server/src/lib/company-profile-presentation.ts
- artifacts/api-server/src/lib/composite-qc.behavior.ts
- artifacts/api-server/src/lib/composite-qc.ts
- artifacts/api-server/src/lib/composite-source-control.behavior.ts
- artifacts/api-server/src/lib/composite-source-control.ts
- artifacts/api-server/src/lib/connector-credential-enrollment.behavior.ts
- artifacts/api-server/src/lib/connector-credential-enrollment.ts
- artifacts/api-server/src/lib/connector-credential-envelope.behavior.ts
- artifacts/api-server/src/lib/connector-credential-envelope.ts
- artifacts/api-server/src/lib/connector-credential-lease-resolver.behavior.ts
- artifacts/api-server/src/lib/connector-credential-lease-resolver.ts
- artifacts/api-server/src/lib/connector-credential-lifecycle-postgres-store.ts
- artifacts/api-server/src/lib/connector-credential-lifecycle.behavior.ts
- artifacts/api-server/src/lib/connector-credential-lifecycle.ts
- artifacts/api-server/src/lib/connector-credential-rotation.behavior.ts
- artifacts/api-server/src/lib/connector-credential-rotation.ts
- artifacts/api-server/src/lib/connector-foundation-contract.ts
- artifacts/api-server/src/lib/connector-foundation-migration.ts
- artifacts/api-server/src/lib/connector-foundation.behavior.ts
- artifacts/api-server/src/lib/connector-validation-operations-postgres-store.ts
- artifacts/api-server/src/lib/connector-validation-operations.behavior.ts
- artifacts/api-server/src/lib/connector-validation-operations.ts
- artifacts/api-server/src/lib/consolidation-build116-role-isolation.behavior.ts
- artifacts/api-server/src/lib/consolidation-build117-workflow-reconciliation.behavior.ts
- artifacts/api-server/src/lib/consolidation-build118-connected-boundary.behavior.ts
- artifacts/api-server/src/lib/consolidation-build119-guide-acceptance.behavior.ts
- artifacts/api-server/src/lib/consolidation-build120-final-release.behavior.ts
- artifacts/api-server/src/lib/construction-coordination-records.ts
- artifacts/api-server/src/lib/contract-economic-pool-service.ts
- artifacts/api-server/src/lib/contract-item-workflow-contract.ts
- artifacts/api-server/src/lib/contract-item-workflow-migration.ts
- artifacts/api-server/src/lib/contract-item-workflow-service.ts
- artifacts/api-server/src/lib/contract-item-workflow.behavior.ts
- artifacts/api-server/src/lib/coordination-action-projection.behavior.ts
- artifacts/api-server/src/lib/coordination-action-projection.ts
- artifacts/api-server/src/lib/coordination-hub-configuration-postgres-store.ts
- artifacts/api-server/src/lib/coordination-hub-configuration-service.behavior.ts
- artifacts/api-server/src/lib/coordination-hub-configuration-service.ts
- artifacts/api-server/src/lib/coordination-hub-postgres-store.ts
- artifacts/api-server/src/lib/coordination-hub-runtime.behavior.ts
- artifacts/api-server/src/lib/coordination-hub-service.behavior.ts
- artifacts/api-server/src/lib/coordination-hub-service.ts
- artifacts/api-server/src/lib/coordination-knowledge-authorization.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-authorization.ts
- artifacts/api-server/src/lib/coordination-knowledge-block6-activation.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-block7.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-build266.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-build267.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-build268.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-build269.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-build270.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-build271-security.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-build272-migration.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-build274-platform-regression.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-build275-release.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-conflict-api.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-contract.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-contract.ts
- artifacts/api-server/src/lib/coordination-knowledge-database.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-lens-classification-write.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-lens-classification.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-lens-guidance.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-lens-matching.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-lens-methods.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-lens-navigation.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-lens-panel.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-lens-precedent.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-lens-similar-cases.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-migration.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-migration.ts
- artifacts/api-server/src/lib/coordination-knowledge-repository.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-repository.ts
- artifacts/api-server/src/lib/coordination-knowledge-rules-methods-api.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-search.behavior.ts
- artifacts/api-server/src/lib/coordination-knowledge-starter-import.ts
- artifacts/api-server/src/lib/coordination-knowledge-starter-seed.ts
- artifacts/api-server/src/lib/coordination-knowledge-taxonomy.ts
- artifacts/api-server/src/lib/coordination-lesson-merge.behavior.ts
- artifacts/api-server/src/lib/coordination-lesson-promotion.behavior.ts
- artifacts/api-server/src/lib/coordination-lesson-proposal.behavior.ts
- artifacts/api-server/src/lib/coordination-lesson-review.behavior.ts
- artifacts/api-server/src/lib/coordination-lesson-workflow.ts
- artifacts/api-server/src/lib/coordination-release-readiness.behavior.ts
- artifacts/api-server/src/lib/coordination-release-readiness.ts
- artifacts/api-server/src/lib/coordination-resolution-evidence.behavior.ts
- artifacts/api-server/src/lib/coordination-resolution-record-contract.behavior.ts
- artifacts/api-server/src/lib/coordination-resolution-record-contract.ts
- artifacts/api-server/src/lib/coordination-resolution-verification.behavior.ts
- artifacts/api-server/src/lib/coordination-sync-fail-closed.behavior.ts
- artifacts/api-server/src/lib/coordinator-action-register.ts
- artifacts/api-server/src/lib/coordinator-bulk-action-migration.ts
- artifacts/api-server/src/lib/coordinator-bulk-actions.ts
- artifacts/api-server/src/lib/coordinator-saved-view-migration.ts
- artifacts/api-server/src/lib/coordinator-saved-views.ts
- artifacts/api-server/src/lib/cost-value-bonus-allocation.behavior.ts
- artifacts/api-server/src/lib/cost-value-bonus-allocation.ts
- artifacts/api-server/src/lib/cost-value-bonus-service.ts
- artifacts/api-server/src/lib/cost-value-forecast-service.ts
- artifacts/api-server/src/lib/cost-value-forecast.behavior.ts
- artifacts/api-server/src/lib/cost-value-performance-provenance.behavior.ts
- artifacts/api-server/src/lib/cost-value-performance-provenance.ts
- artifacts/api-server/src/lib/cost-value-performance-service.ts
- artifacts/api-server/src/lib/cost-value-performance.behavior.ts
- artifacts/api-server/src/lib/cost-value-plan-service.ts
- artifacts/api-server/src/lib/cost-value-plan.behavior.ts
- artifacts/api-server/src/lib/customer-delivery-preparation.behavior.ts
- artifacts/api-server/src/lib/customer-delivery-preparation.ts
- artifacts/api-server/src/lib/customer-review-request.behavior.ts
- artifacts/api-server/src/lib/customer-review-request.ts
- artifacts/api-server/src/lib/customer-setup-diagnosis.behavior.ts
- artifacts/api-server/src/lib/customer-setup-diagnosis.ts
- artifacts/api-server/src/lib/customer-workspace-landing.behavior.ts
- artifacts/api-server/src/lib/customer-workspace-landing.ts
- artifacts/api-server/src/lib/customer-workspace-records.behavior.ts
- artifacts/api-server/src/lib/customer-workspace-records.ts
- artifacts/api-server/src/lib/daily-evidence-link.behavior.ts
- artifacts/api-server/src/lib/daily-evidence-link.ts
- artifacts/api-server/src/lib/daily-field-record.behavior.ts
- artifacts/api-server/src/lib/daily-field-record.ts
- artifacts/api-server/src/lib/daily-record-report.behavior.ts
- artifacts/api-server/src/lib/daily-record-report.ts
- artifacts/api-server/src/lib/daily-site-observation.behavior.ts
- artifacts/api-server/src/lib/daily-site-observation.ts
- artifacts/api-server/src/lib/daily-workforce-observation.behavior.ts
- artifacts/api-server/src/lib/daily-workforce-observation.ts
- artifacts/api-server/src/lib/database-startup-serialization.behavior.ts
- artifacts/api-server/src/lib/delivery-workflow-allocation-source-contract.ts
- artifacts/api-server/src/lib/delivery-workflow-allocation-source.behavior.ts
- artifacts/api-server/src/lib/delivery-workflow-allocation-source.ts
- artifacts/api-server/src/lib/delivery-workflow-allocation.http-evidence.ts
- artifacts/api-server/src/lib/delivery-workflow-defaults.ts
- artifacts/api-server/src/lib/delivery-workflow-economic-allocation.behavior.ts
- artifacts/api-server/src/lib/delivery-workflow-economic-allocation.ts
- artifacts/api-server/src/lib/delivery-workflow-intake-authority.behavior.ts
- artifacts/api-server/src/lib/delivery-workflow-retirement.behavior.ts
- artifacts/api-server/src/lib/delivery-workflow-retirement.ts
- artifacts/api-server/src/lib/delivery-workflow-runtime.http-evidence.ts
- artifacts/api-server/src/lib/delivery-workflow-runtime.ts
- artifacts/api-server/src/lib/delivery-workflow-selection.behavior.ts
- artifacts/api-server/src/lib/delivery-workflow-selection.ts
- artifacts/api-server/src/lib/delivery-workflow-template-contract.behavior.ts
- artifacts/api-server/src/lib/delivery-workflow-template-contract.ts
- artifacts/api-server/src/lib/delivery-workflow-template-migration.ts
- artifacts/api-server/src/lib/delivery-workflow-template.http-evidence.ts
- artifacts/api-server/src/lib/design-comment-control.behavior.ts
- artifacts/api-server/src/lib/design-comment-control.ts
- artifacts/api-server/src/lib/drawing-correct-revision-journey.behavior.ts
- artifacts/api-server/src/lib/drawing-correct-revision-journey.ts
- artifacts/api-server/src/lib/drawing-current-resolution.behavior.ts
- artifacts/api-server/src/lib/drawing-current-resolution.ts
- artifacts/api-server/src/lib/drawing-import-preview.behavior.ts
- artifacts/api-server/src/lib/drawing-import-preview.ts
- artifacts/api-server/src/lib/drawing-package-manifest.behavior.ts
- artifacts/api-server/src/lib/drawing-package-manifest.ts
- artifacts/api-server/src/lib/drawing-record-links.behavior.ts
- artifacts/api-server/src/lib/drawing-record-links.ts
- artifacts/api-server/src/lib/drawing-register-identity.behavior.ts
- artifacts/api-server/src/lib/drawing-register-identity.ts
- artifacts/api-server/src/lib/drawing-register-release.behavior.ts
- artifacts/api-server/src/lib/drawing-register-release.ts
- artifacts/api-server/src/lib/drawing-revision-matching.behavior.ts
- artifacts/api-server/src/lib/drawing-revision-matching.ts
- artifacts/api-server/src/lib/drawing-revision-viewer.behavior.ts
- artifacts/api-server/src/lib/drawing-revision-viewer.ts
- artifacts/api-server/src/lib/drawing-sheet-log.behavior.ts
- artifacts/api-server/src/lib/drawing-sheet-log.ts
- artifacts/api-server/src/lib/edt-engine-activation-candidate.ts
- artifacts/api-server/src/lib/edt-engine-activation-service.ts
- artifacts/api-server/src/lib/edt-engine-authorization.behavior.ts
- artifacts/api-server/src/lib/edt-engine-authorization.ts
- artifacts/api-server/src/lib/edt-engine-block02-acceptance.behavior.ts
- artifacts/api-server/src/lib/edt-engine-block03-acceptance.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build291.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build292.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build293.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build294.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build295.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build296.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build297.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build298.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build299.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build300.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build301.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build302.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build303.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build304.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build305.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build306.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build307.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build308.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build309.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build310.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build311.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build312.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build313.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build314.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build315.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build316.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build317.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build318.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build319.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build320.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build321.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build322.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build323.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build324.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build325.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build326.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build327.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build328.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build329.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build330.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build331.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build332.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build333.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build335.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build337.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build342.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build343.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build344.behavior.ts
- artifacts/api-server/src/lib/edt-engine-build345.behavior.ts
- artifacts/api-server/src/lib/edt-engine-economic-schema.behavior.ts
- artifacts/api-server/src/lib/edt-engine-economic-service.ts
- artifacts/api-server/src/lib/edt-engine-governance-schema.behavior.ts
- artifacts/api-server/src/lib/edt-engine-governed-change-service.ts
- artifacts/api-server/src/lib/edt-engine-hierarchy.behavior.ts
- artifacts/api-server/src/lib/edt-engine-migration.ts
- artifacts/api-server/src/lib/edt-engine-operations-director.ts
- artifacts/api-server/src/lib/edt-engine-permissions.behavior.ts
- artifacts/api-server/src/lib/edt-engine-permissions.ts
- artifacts/api-server/src/lib/edt-engine-plan-projection.ts
- artifacts/api-server/src/lib/edt-engine-qc-import-schema.behavior.ts
- artifacts/api-server/src/lib/edt-engine-qc-import-service.ts
- artifacts/api-server/src/lib/edt-engine-read-sql.behavior.ts
- artifacts/api-server/src/lib/edt-engine-resolved-activation.ts
- artifacts/api-server/src/lib/edt-engine-route-context.ts
- artifacts/api-server/src/lib/edt-engine-source-service.ts
- artifacts/api-server/src/lib/edt-engine-transaction.ts
- artifacts/api-server/src/lib/edt-operations-director-grant.behavior.ts
- artifacts/api-server/src/lib/edt-operations-director-list.behavior.ts
- artifacts/api-server/src/lib/edt-operations-director-live-db.behavior.ts
- artifacts/api-server/src/lib/edt-operations-director-postgres.behavior.ts
- artifacts/api-server/src/lib/edt-operations-director-role.behavior.ts
- artifacts/api-server/src/lib/email.ts
- artifacts/api-server/src/lib/enterprise-identity-migration.behavior.ts
- artifacts/api-server/src/lib/enterprise-identity-migration.ts
- artifacts/api-server/src/lib/entitlement-contract.ts
- artifacts/api-server/src/lib/entitlement-resolver.behavior.ts
- artifacts/api-server/src/lib/extract-file-text.ts
- artifacts/api-server/src/lib/feature-catalog-concurrency.behavior.ts
- artifacts/api-server/src/lib/feature-catalog-db.behavior.ts
- artifacts/api-server/src/lib/feature-catalog-http.behavior.ts
- artifacts/api-server/src/lib/feature-catalog-migration.ts
- artifacts/api-server/src/lib/feature-catalog-service.ts
- artifacts/api-server/src/lib/feature-policy-browser.behavior.ts
- artifacts/api-server/src/lib/feature-policy-configuration.behavior.ts
- artifacts/api-server/src/lib/feature-policy-configuration.ts
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
- artifacts/api-server/src/lib/field-checklist-definition.behavior.ts
- artifacts/api-server/src/lib/field-checklist-definition.ts
- artifacts/api-server/src/lib/field-corrective-action-link.behavior.ts
- artifacts/api-server/src/lib/field-corrective-action-link.ts
- artifacts/api-server/src/lib/field-inspection-execution.behavior.ts
- artifacts/api-server/src/lib/field-inspection-execution.ts
- artifacts/api-server/src/lib/field-quality-dashboard.behavior.ts
- artifacts/api-server/src/lib/field-quality-dashboard.ts
- artifacts/api-server/src/lib/field-reinspection.behavior.ts
- artifacts/api-server/src/lib/field-reinspection.ts
- artifacts/api-server/src/lib/financial-apu-allocation.behavior.ts
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
- artifacts/api-server/src/lib/financial-contract-apu-binding.ts
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
- artifacts/api-server/src/lib/financial-correctness-contract.ts
- artifacts/api-server/src/lib/financial-correctness-golden-vectors.behavior.ts
- artifacts/api-server/src/lib/financial-export-contract.behavior.ts
- artifacts/api-server/src/lib/financial-export-contract.ts
- artifacts/api-server/src/lib/financial-revision-ledger.behavior.ts
- artifacts/api-server/src/lib/financial-revision-ledger.ts
- artifacts/api-server/src/lib/financial-statement-mapping.behavior.ts
- artifacts/api-server/src/lib/floor-hour-cost-contract.ts
- artifacts/api-server/src/lib/floor-hour-cost-governance.ts
- artifacts/api-server/src/lib/folder-wizard-destination.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-destination.ts
- artifacts/api-server/src/lib/folder-wizard-export.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-export.ts
- artifacts/api-server/src/lib/folder-wizard-graph-identity.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-graph-identity.ts
- artifacts/api-server/src/lib/folder-wizard-graph-upload.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-graph-upload.ts
- artifacts/api-server/src/lib/folder-wizard-import-service.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-import-service.ts
- artifacts/api-server/src/lib/folder-wizard-paths.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-paths.ts
- artifacts/api-server/src/lib/folder-wizard-publish-candidate-route.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-publish-candidate-store.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-publish-candidate-store.ts
- artifacts/api-server/src/lib/folder-wizard-publish-candidate.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-publish-candidate.ts
- artifacts/api-server/src/lib/folder-wizard-publish-execution.ts
- artifacts/api-server/src/lib/folder-wizard-publish-job.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-publish-job.ts
- artifacts/api-server/src/lib/folder-wizard-publish-lease.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-publish-lease.ts
- artifacts/api-server/src/lib/folder-wizard-publish-plan.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-publish-plan.ts
- artifacts/api-server/src/lib/folder-wizard-publish-postgres.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-publish-queue.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-publish-queue.ts
- artifacts/api-server/src/lib/folder-wizard-publish-readiness-store.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-publish-readiness-store.ts
- artifacts/api-server/src/lib/folder-wizard-publish-readiness.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-publish-readiness.ts
- artifacts/api-server/src/lib/folder-wizard-publish-settlement.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-publish-settlement.ts
- artifacts/api-server/src/lib/folder-wizard-publish-source.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-publish-source.ts
- artifacts/api-server/src/lib/folder-wizard-publish-status.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-publish-status.ts
- artifacts/api-server/src/lib/folder-wizard-publish-submission.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-publish-submission.ts
- artifacts/api-server/src/lib/folder-wizard-publish-worker.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-publish-worker.ts
- artifacts/api-server/src/lib/folder-wizard-request-validation.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-request-validation.ts
- artifacts/api-server/src/lib/folder-wizard-resolver.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-resolver.ts
- artifacts/api-server/src/lib/folder-wizard-routing-contract.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-routing-contract.ts
- artifacts/api-server/src/lib/folder-wizard-routing-service.behavior.ts
- artifacts/api-server/src/lib/folder-wizard-routing-service.ts
- artifacts/api-server/src/lib/follow-up-accountability.behavior.ts
- artifacts/api-server/src/lib/follow-up-accountability.ts
- artifacts/api-server/src/lib/for-record-issuance.behavior.ts
- artifacts/api-server/src/lib/for-record-issuance.ts
- artifacts/api-server/src/lib/for-record-receipt.behavior.ts
- artifacts/api-server/src/lib/for-record-receipt.ts
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
- artifacts/api-server/src/lib/handover-package-manifest.behavior.ts
- artifacts/api-server/src/lib/handover-package-manifest.ts
- artifacts/api-server/src/lib/handover-readiness.behavior.ts
- artifacts/api-server/src/lib/handover-readiness.ts
- artifacts/api-server/src/lib/help-center.behavior.ts
- artifacts/api-server/src/lib/import-intelligence.ts
- artifacts/api-server/src/lib/initial-feature-catalog.ts
- artifacts/api-server/src/lib/internal-cost-contract.ts
- artifacts/api-server/src/lib/internal-cost-governance.ts
- artifacts/api-server/src/lib/invitation-acceptance.ts
- artifacts/api-server/src/lib/invitation-token.behavior.ts
- artifacts/api-server/src/lib/invitation-token.ts
- artifacts/api-server/src/lib/job-activation-commercial-baseline.behavior.ts
- artifacts/api-server/src/lib/job-activation-commercial-baseline.ts
- artifacts/api-server/src/lib/job-budget-governance.behavior.ts
- artifacts/api-server/src/lib/job-classification-activation.behavior.ts
- artifacts/api-server/src/lib/job-classification-propagation.behavior.ts
- artifacts/api-server/src/lib/job-document-connections.behavior.ts
- artifacts/api-server/src/lib/job-intake-apu-history.behavior.ts
- artifacts/api-server/src/lib/job-intake-apu-reload.behavior.ts
- artifacts/api-server/src/lib/job-intake-budget-account.behavior.ts
- artifacts/api-server/src/lib/job-intake-combined-scenario.behavior.ts
- artifacts/api-server/src/lib/job-intake-commercial-core-fingerprint.behavior.ts
- artifacts/api-server/src/lib/job-intake-configuration-snapshot.behavior.ts
- artifacts/api-server/src/lib/job-intake-configuration.behavior.ts
- artifacts/api-server/src/lib/job-intake-configuration.ts
- artifacts/api-server/src/lib/job-intake-contract-lineage.ts
- artifacts/api-server/src/lib/job-intake-contract.ts
- artifacts/api-server/src/lib/job-intake-empty-commercial-prerequisites.behavior.ts
- artifacts/api-server/src/lib/job-intake-full-lifecycle.behavior.ts
- artifacts/api-server/src/lib/job-intake-idempotent-activation.behavior.ts
- artifacts/api-server/src/lib/job-intake-mapped-item-pricing.behavior.ts
- artifacts/api-server/src/lib/job-intake-mapped-item-pricing.ts
- artifacts/api-server/src/lib/job-intake-member-assignment.behavior.ts
- artifacts/api-server/src/lib/job-intake-migration.ts
- artifacts/api-server/src/lib/job-intake-policy-catalog.behavior.ts
- artifacts/api-server/src/lib/job-intake-policy-integration.behavior.ts
- artifacts/api-server/src/lib/job-intake-policy-ui.behavior.ts
- artifacts/api-server/src/lib/job-intake-policy.behavior.ts
- artifacts/api-server/src/lib/job-intake-policy.ts
- artifacts/api-server/src/lib/job-intake-pricing-multicontract.http-evidence.ts
- artifacts/api-server/src/lib/job-intake-service.ts
- artifacts/api-server/src/lib/job-intake-spreadsheet.behavior.ts
- artifacts/api-server/src/lib/job-intake-task-assignment.behavior.ts
- artifacts/api-server/src/lib/job-intake-work-package-reload.behavior.ts
- artifacts/api-server/src/lib/job-intake.behavior.ts
- artifacts/api-server/src/lib/job-operations-id.ts
- artifacts/api-server/src/lib/job-operations-service.ts
- artifacts/api-server/src/lib/job-operations.behavior.ts
- artifacts/api-server/src/lib/job-work-packages.behavior.ts
- artifacts/api-server/src/lib/knowledge-company-reuse.behavior.ts
- artifacts/api-server/src/lib/knowledge-company-reuse.ts
- artifacts/api-server/src/lib/knowledge-context-lookup.behavior.ts
- artifacts/api-server/src/lib/knowledge-context-lookup.ts
- artifacts/api-server/src/lib/knowledge-lesson-proposal-link.behavior.ts
- artifacts/api-server/src/lib/knowledge-lesson-proposal-link.ts
- artifacts/api-server/src/lib/lens-import-contract.ts
- artifacts/api-server/src/lib/lens-next-create-failure-telemetry.behavior.ts
- artifacts/api-server/src/lib/lens-next-create-failure-telemetry.ts
- artifacts/api-server/src/lib/lens-next-create.behavior.ts
- artifacts/api-server/src/lib/lens-next-legacy-migration.behavior.ts
- artifacts/api-server/src/lib/lens-next-local-upload.behavior.ts
- artifacts/api-server/src/lib/lens-next-local-upload.ts
- artifacts/api-server/src/lib/lens-next-model-binding.behavior.ts
- artifacts/api-server/src/lib/lens-next-model-binding.ts
- artifacts/api-server/src/lib/lens-next-platform-source.behavior.ts
- artifacts/api-server/src/lib/lens-next-publishing.behavior.ts
- artifacts/api-server/src/lib/lens-next-publishing.ts
- artifacts/api-server/src/lib/lens-next-reference-attachment.ts
- artifacts/api-server/src/lib/lens-next-refresh-responsiveness.behavior.ts
- artifacts/api-server/src/lib/lens-next-visual-digest-v3.behavior.ts
- artifacts/api-server/src/lib/linked-items-creation-ux.behavior.ts
- artifacts/api-server/src/lib/living-brief-gate.behavior.ts
- artifacts/api-server/src/lib/living-brief-gate.ts
- artifacts/api-server/src/lib/living-brief-migration.ts
- artifacts/api-server/src/lib/living-brief-mirror.ts
- artifacts/api-server/src/lib/living-brief-runtime.behavior.ts
- artifacts/api-server/src/lib/living-brief-source.ts
- artifacts/api-server/src/lib/master-catalog-authority.behavior.ts
- artifacts/api-server/src/lib/master-catalog-authority.ts
- artifacts/api-server/src/lib/master-catalog-intake-persistence.behavior.ts
- artifacts/api-server/src/lib/master-catalog-pmo.behavior.ts
- artifacts/api-server/src/lib/meeting-agenda-selection.behavior.ts
- artifacts/api-server/src/lib/meeting-agenda-selection.ts
- artifacts/api-server/src/lib/meeting-canonical-links.ts
- artifacts/api-server/src/lib/meeting-commitment-history.behavior.ts
- artifacts/api-server/src/lib/meeting-commitment-history.ts
- artifacts/api-server/src/lib/meeting-current-view-scope.ts
- artifacts/api-server/src/lib/meeting-lookahead.behavior.ts
- artifacts/api-server/src/lib/meeting-lookahead.ts
- artifacts/api-server/src/lib/meeting-minute-contracts.ts
- artifacts/api-server/src/lib/meeting-pack-preparation.behavior.ts
- artifacts/api-server/src/lib/meeting-pack-preparation.ts
- artifacts/api-server/src/lib/meeting-participant-action-identity.ts
- artifacts/api-server/src/lib/meeting-report-action-extraction.behavior.ts
- artifacts/api-server/src/lib/meeting-report-action-extraction.ts
- artifacts/api-server/src/lib/meeting-schedule-placement.behavior.ts
- artifacts/api-server/src/lib/meeting-schedule-placement.ts
- artifacts/api-server/src/lib/oauth.ts
- artifacts/api-server/src/lib/onboarding-migration.ts
- artifacts/api-server/src/lib/operational-failure.behavior.ts
- artifacts/api-server/src/lib/operational-failure.ts
- artifacts/api-server/src/lib/operational-register-table.ts
- artifacts/api-server/src/lib/outlook-intake-envelope.behavior.ts
- artifacts/api-server/src/lib/outlook-intake-envelope.ts
- artifacts/api-server/src/lib/outlook-project-routing.behavior.ts
- artifacts/api-server/src/lib/outlook-project-routing.ts
- artifacts/api-server/src/lib/overdue-notifier.ts
- artifacts/api-server/src/lib/pdf-kit.ts
- artifacts/api-server/src/lib/pdf-logo.ts
- artifacts/api-server/src/lib/pdf-route-authorization.behavior.ts
- artifacts/api-server/src/lib/performance-budget.ts
- artifacts/api-server/src/lib/post-p17-apu-workbook-acceptance.behavior.ts
- artifacts/api-server/src/lib/post-p17-build21-financial-invariants.behavior.ts
- artifacts/api-server/src/lib/post-p17-intake-file-inspection.behavior.ts
- artifacts/api-server/src/lib/post120-build137-pdf-adapter.behavior.ts
- artifacts/api-server/src/lib/post120-build138-operational-pdf-family.behavior.ts
- artifacts/api-server/src/lib/post120-build139-directory-pdf-family.behavior.ts
- artifacts/api-server/src/lib/post120-build159-rfi-negative-matrix.behavior.ts
- artifacts/api-server/src/lib/post120-build161-clash-contracts.behavior.ts
- artifacts/api-server/src/lib/post120-build162-clash-provenance.behavior.ts
- artifacts/api-server/src/lib/post120-build163-clash-visual-truth.behavior.ts
- artifacts/api-server/src/lib/post120-build164-clash-negative-matrix.behavior.ts
- artifacts/api-server/src/lib/post120-build166-meeting-contracts.behavior.ts
- artifacts/api-server/src/lib/post120-build167-meeting-identities.behavior.ts
- artifacts/api-server/src/lib/post120-build168-meeting-view-scope.behavior.ts
- artifacts/api-server/src/lib/post120-build169-meeting-concurrency.behavior.ts
- artifacts/api-server/src/lib/post120-build208-authorization-negative-matrix.behavior.ts
- artifacts/api-server/src/lib/procore-coordination-return.behavior.ts
- artifacts/api-server/src/lib/procore-coordination-return.ts
- artifacts/api-server/src/lib/procore-rfi-import-atomic-store.behavior.ts
- artifacts/api-server/src/lib/procore-rfi-import-atomic-store.ts
- artifacts/api-server/src/lib/procore-rfi-import-commit.ts
- artifacts/api-server/src/lib/procore-rfi-import-migration.behavior.ts
- artifacts/api-server/src/lib/procore-rfi-import-migration.ts
- artifacts/api-server/src/lib/procore-rfi-import.behavior.ts
- artifacts/api-server/src/lib/procore-rfi-import.ts
- artifacts/api-server/src/lib/procurement-lead-time-risk.behavior.ts
- artifacts/api-server/src/lib/procurement-lead-time-risk.ts
- artifacts/api-server/src/lib/procurement-readiness-chain.behavior.ts
- artifacts/api-server/src/lib/procurement-readiness-chain.ts
- artifacts/api-server/src/lib/production-source-commit.behavior.ts
- artifacts/api-server/src/lib/production-source-commit.ts
- artifacts/api-server/src/lib/professional-report-layout.behavior.ts
- artifacts/api-server/src/lib/professional-report-layout.ts
- artifacts/api-server/src/lib/professional-report-package.behavior.ts
- artifacts/api-server/src/lib/professional-report-package.ts
- artifacts/api-server/src/lib/professional-report-parity.behavior.ts
- artifacts/api-server/src/lib/professional-report-parity.ts
- artifacts/api-server/src/lib/professional-report-presets.behavior.ts
- artifacts/api-server/src/lib/professional-report-presets.ts
- artifacts/api-server/src/lib/professional-report-sections.behavior.ts
- artifacts/api-server/src/lib/professional-report-sections.ts
- artifacts/api-server/src/lib/project-analytics-current-view-export.ts
- artifacts/api-server/src/lib/project-apu-library-service.behavior.ts
- artifacts/api-server/src/lib/project-apu-library-service.ts
- artifacts/api-server/src/lib/project-context-source.behavior.ts
- artifacts/api-server/src/lib/project-controls-dashboard.behavior.ts
- artifacts/api-server/src/lib/project-file-upload-contract.ts
- artifacts/api-server/src/lib/project-handover-package.ts
- artifacts/api-server/src/lib/project-insights-metrics.ts
- artifacts/api-server/src/lib/project-intelligence.ts
- artifacts/api-server/src/lib/project-invitation-contract.ts
- artifacts/api-server/src/lib/project-invitation-migration.ts
- artifacts/api-server/src/lib/project-invitation-service.ts
- artifacts/api-server/src/lib/project-invitation.behavior.ts
- artifacts/api-server/src/lib/project-retirement.ts
- artifacts/api-server/src/lib/project-role-readiness.behavior.ts
- artifacts/api-server/src/lib/project-role-readiness.ts
- artifacts/api-server/src/lib/project-scope-structure.behavior.ts
- artifacts/api-server/src/lib/project-scope-structure.ts
- artifacts/api-server/src/lib/project-setup-readiness.behavior.ts
- artifacts/api-server/src/lib/project-setup-readiness.ts
- artifacts/api-server/src/lib/protected-provider-probe-executor.behavior.ts
- artifacts/api-server/src/lib/protected-provider-probe-executor.ts
- artifacts/api-server/src/lib/provider-governance.ts
- artifacts/api-server/src/lib/release-metadata.behavior.ts
- artifacts/api-server/src/lib/release-metadata.ts
- artifacts/api-server/src/lib/report-view-capabilities.behavior.ts
- artifacts/api-server/src/lib/report-view-capabilities.ts
- artifacts/api-server/src/lib/report-view-ownership.behavior.ts
- artifacts/api-server/src/lib/report-view-ownership.ts
- artifacts/api-server/src/lib/report-view-pivots.behavior.ts
- artifacts/api-server/src/lib/report-view-pivots.ts
- artifacts/api-server/src/lib/report-view-presets.behavior.ts
- artifacts/api-server/src/lib/report-view-presets.ts
- artifacts/api-server/src/lib/report-view-preview.behavior.ts
- artifacts/api-server/src/lib/report-view-preview.ts
- artifacts/api-server/src/lib/reporting-baseline-capture.behavior.ts
- artifacts/api-server/src/lib/reporting-baseline-capture.ts
- artifacts/api-server/src/lib/reporting-baseline-comparison.behavior.ts
- artifacts/api-server/src/lib/reporting-baseline-comparison.ts
- artifacts/api-server/src/lib/reporting-baseline-history-types.ts
- artifacts/api-server/src/lib/reporting-baseline-history.behavior.ts
- artifacts/api-server/src/lib/reporting-baseline-history.ts
- artifacts/api-server/src/lib/reporting-baseline-summary.behavior.ts
- artifacts/api-server/src/lib/reporting-baseline-summary.ts
- artifacts/api-server/src/lib/reporting-baseline.behavior.ts
- artifacts/api-server/src/lib/reporting-baseline.ts
- artifacts/api-server/src/lib/resource-demand-contract.ts
- artifacts/api-server/src/lib/resource-hour-sources.behavior.ts
- artifacts/api-server/src/lib/resource-hour-sources.ts
- artifacts/api-server/src/lib/responsibility-action-routing.behavior.ts
- artifacts/api-server/src/lib/responsibility-action-routing.ts
- artifacts/api-server/src/lib/responsibility-classification.behavior.ts
- artifacts/api-server/src/lib/responsibility-classification.ts
- artifacts/api-server/src/lib/responsibility-performance-summary.behavior.ts
- artifacts/api-server/src/lib/responsibility-performance-summary.ts
- artifacts/api-server/src/lib/responsibility-workspace-scope.behavior.ts
- artifacts/api-server/src/lib/responsibility-workspace-scope.ts
- artifacts/api-server/src/lib/responsibility-workspace.behavior.ts
- artifacts/api-server/src/lib/responsibility-workspace.ts
- artifacts/api-server/src/lib/reviewer-custody-history.behavior.ts
- artifacts/api-server/src/lib/reviewer-custody-history.ts
- artifacts/api-server/src/lib/reviewer-step-tracking.behavior.ts
- artifacts/api-server/src/lib/reviewer-step-tracking.ts
- artifacts/api-server/src/lib/rfi-command-service.ts
- artifacts/api-server/src/lib/rfi-complete-package.behavior.ts
- artifacts/api-server/src/lib/rfi-complete-package.ts
- artifacts/api-server/src/lib/rfi-query-service.ts
- artifacts/api-server/src/lib/rfi-register-export.ts
- artifacts/api-server/src/lib/rfi-standard-exports.ts
- artifacts/api-server/src/lib/runtime-closure-retirement.behavior.ts
- artifacts/api-server/src/lib/runtime-resilience.ts
- artifacts/api-server/src/lib/runtime-security.ts
- artifacts/api-server/src/lib/saas-block12-onboarding.behavior.ts
- artifacts/api-server/src/lib/sales-inquiry-action-urgency.behavior.ts
- artifacts/api-server/src/lib/sales-inquiry-action-urgency.ts
- artifacts/api-server/src/lib/sales-inquiry-assignment-history.behavior.ts
- artifacts/api-server/src/lib/sales-inquiry-assignment-history.ts
- artifacts/api-server/src/lib/sales-inquiry-assignment.behavior.ts
- artifacts/api-server/src/lib/sales-inquiry-assignment.ts
- artifacts/api-server/src/lib/sales-inquiry-follow-up.behavior.ts
- artifacts/api-server/src/lib/sales-inquiry-follow-up.ts
- artifacts/api-server/src/lib/sales-inquiry-next-action-schema.behavior.ts
- artifacts/api-server/src/lib/sales-inquiry-next-action.behavior.ts
- artifacts/api-server/src/lib/sales-inquiry-next-action.ts
- artifacts/api-server/src/lib/sales-inquiry-operations.behavior.ts
- artifacts/api-server/src/lib/sales-inquiry-operations.ts
- artifacts/api-server/src/lib/sales-inquiry-query.behavior.ts
- artifacts/api-server/src/lib/sales-inquiry-query.ts
- artifacts/api-server/src/lib/sales-inquiry-response.behavior.ts
- artifacts/api-server/src/lib/sales-inquiry-response.ts
- artifacts/api-server/src/lib/scoped-authority.ts
- artifacts/api-server/src/lib/scoped-briefing-cache.ts
- artifacts/api-server/src/lib/sendgrid-transport.ts
- artifacts/api-server/src/lib/service-capability-rollout.behavior.ts
- artifacts/api-server/src/lib/service-capability-rollout.ts
- artifacts/api-server/src/lib/sharepoint-allowed-destinations.behavior.ts
- artifacts/api-server/src/lib/sharepoint-allowed-destinations.ts
- artifacts/api-server/src/lib/sharepoint-application-token-lifecycle.behavior.ts
- artifacts/api-server/src/lib/sharepoint-application-token-lifecycle.ts
- artifacts/api-server/src/lib/sharepoint-credential-validator.behavior.ts
- artifacts/api-server/src/lib/sharepoint-credential-validator.ts
- artifacts/api-server/src/lib/sharepoint-discovery-adapter.behavior.ts
- artifacts/api-server/src/lib/sharepoint-discovery-adapter.ts
- artifacts/api-server/src/lib/sharepoint-enrollment-state.behavior.ts
- artifacts/api-server/src/lib/sharepoint-enrollment-state.ts
- artifacts/api-server/src/lib/sharepoint-publication-authority.behavior.ts
- artifacts/api-server/src/lib/sharepoint-publication-authority.ts
- artifacts/api-server/src/lib/sharepoint-publication-confirmation.behavior.ts
- artifacts/api-server/src/lib/sharepoint-publication-confirmation.ts
- artifacts/api-server/src/lib/sharepoint-publication-lifecycle.behavior.ts
- artifacts/api-server/src/lib/sharepoint-publication-lifecycle.ts
- artifacts/api-server/src/lib/sharepoint-publication-outcome.behavior.ts
- artifacts/api-server/src/lib/sharepoint-publication-outcome.ts
- artifacts/api-server/src/lib/sharepoint-publication-readiness.behavior.ts
- artifacts/api-server/src/lib/sharepoint-publication-readiness.ts
- artifacts/api-server/src/lib/sharepoint-publication-receipt.behavior.ts
- artifacts/api-server/src/lib/sharepoint-publication-receipt.ts
- artifacts/api-server/src/lib/sharepoint-publication-recovery.behavior.ts
- artifacts/api-server/src/lib/sharepoint-publication-recovery.ts
- artifacts/api-server/src/lib/sharepoint-publication-security-acceptance.behavior.ts
- artifacts/api-server/src/lib/sharepoint-publication-security.behavior.ts
- artifacts/api-server/src/lib/sharepoint-publication-security.ts
- artifacts/api-server/src/lib/sharepoint-reconciliation.behavior.ts
- artifacts/api-server/src/lib/sharepoint-reconciliation.ts
- artifacts/api-server/src/lib/smart-choice-preferences.behavior.ts
- artifacts/api-server/src/lib/smart-choice-preferences.ts
- artifacts/api-server/src/lib/specification-procurement-readiness-view.behavior.ts
- artifacts/api-server/src/lib/specification-procurement-readiness-view.ts
- artifacts/api-server/src/lib/specification-requirement-preview.behavior.ts
- artifacts/api-server/src/lib/specification-requirement-preview.ts
- artifacts/api-server/src/lib/specification-section-index.behavior.ts
- artifacts/api-server/src/lib/specification-section-index.ts
- artifacts/api-server/src/lib/storage-adapter.behavior.ts
- artifacts/api-server/src/lib/storage-adapter.ts
- artifacts/api-server/src/lib/submittal-register-coverage.ts
- artifacts/api-server/src/lib/submittal-review-tracking.behavior.ts
- artifacts/api-server/src/lib/submittal-review-tracking.ts
- artifacts/api-server/src/lib/subscription-authority.behavior.ts
- artifacts/api-server/src/lib/subscription-authority.ts
- artifacts/api-server/src/lib/support-case-accountability-schema.behavior.ts
- artifacts/api-server/src/lib/support-case-accountability.behavior.ts
- artifacts/api-server/src/lib/support-case-accountability.ts
- artifacts/api-server/src/lib/support-case-assignment.behavior.ts
- artifacts/api-server/src/lib/support-case-assignment.ts
- artifacts/api-server/src/lib/support-case-closure-authority.behavior.ts
- artifacts/api-server/src/lib/support-case-customer-action.behavior.ts
- artifacts/api-server/src/lib/support-case-event.behavior.ts
- artifacts/api-server/src/lib/support-case-event.ts
- artifacts/api-server/src/lib/support-case-lifecycle-event.behavior.ts
- artifacts/api-server/src/lib/support-case-message-schema.behavior.ts
- artifacts/api-server/src/lib/support-case-message.behavior.ts
- artifacts/api-server/src/lib/support-case-message.ts
- artifacts/api-server/src/lib/support-case-notification.behavior.ts
- artifacts/api-server/src/lib/support-case-notification.ts
- artifacts/api-server/src/lib/support-case-open-event.behavior.ts
- artifacts/api-server/src/lib/support-case-operations.behavior.ts
- artifacts/api-server/src/lib/support-case-operations.ts
- artifacts/api-server/src/lib/support-case-query.behavior.ts
- artifacts/api-server/src/lib/support-case-query.ts
- artifacts/api-server/src/lib/support-case-resolution-schema.behavior.ts
- artifacts/api-server/src/lib/support-case-resolution.behavior.ts
- artifacts/api-server/src/lib/support-case-resolution.ts
- artifacts/api-server/src/lib/support-case-satisfaction-schema.behavior.ts
- artifacts/api-server/src/lib/support-case-satisfaction.behavior.ts
- artifacts/api-server/src/lib/support-case-satisfaction.ts
- artifacts/api-server/src/lib/support-conversation-awareness.behavior.ts
- artifacts/api-server/src/lib/support-conversation-awareness.ts
- artifacts/api-server/src/lib/support-conversation-read-route.behavior.ts
- artifacts/api-server/src/lib/support-conversation-read-schema.behavior.ts
- artifacts/api-server/src/lib/support-conversation-read.behavior.ts
- artifacts/api-server/src/lib/support-conversation-read.ts
- artifacts/api-server/src/lib/team-performance-postgres-query.behavior.ts
- artifacts/api-server/src/lib/team-performance-service.ts
- artifacts/api-server/src/lib/team-performance.behavior.ts
- artifacts/api-server/src/lib/team-resource-planning-db.behavior.ts
- artifacts/api-server/src/lib/team-resource-planning-migration.ts
- artifacts/api-server/src/lib/team-resource-planning-service.ts
- artifacts/api-server/src/lib/team-resource-planning.behavior.ts
- artifacts/api-server/src/lib/telegram-delivery-artifacts.ts
- artifacts/api-server/src/lib/telegram-product-delivery-artifacts.behavior.ts
- artifacts/api-server/src/lib/telegram-product-delivery.ts
- artifacts/api-server/src/lib/telegram-product-notifications.ts
- artifacts/api-server/src/lib/telegram-product-provider-broker.ts
- artifacts/api-server/src/lib/telegram-product.ts
- artifacts/api-server/src/lib/telegram-rfi-notifications.ts
- artifacts/api-server/src/lib/trade-file-collection.behavior.ts
- artifacts/api-server/src/lib/trade-file-collection.ts
- artifacts/api-server/src/lib/trade-file-submission-review.behavior.ts
- artifacts/api-server/src/lib/trade-file-submission-review.ts
- artifacts/api-server/src/lib/unified-action-contract.behavior.ts
- artifacts/api-server/src/lib/unified-action-contract.ts
- artifacts/api-server/src/lib/ux-block24-rate-continuity.behavior.ts
- artifacts/api-server/src/lib/ux-block25-resource-demand.behavior.ts
- artifacts/api-server/src/lib/ux-block26-internal-cost.behavior.ts
- artifacts/api-server/src/lib/ux-failure-journey.behavior.ts
- artifacts/api-server/src/lib/ux-failure-journey.ts
- artifacts/api-server/src/lib/ux-financial-reconciliation.behavior.ts
- artifacts/api-server/src/lib/ux-financial-reconciliation.ts
- artifacts/api-server/src/lib/ux-golden-journey.behavior.ts
- artifacts/api-server/src/lib/ux-golden-journey.ts
- artifacts/api-server/src/lib/ux-inclusive-acceptance.behavior.ts
- artifacts/api-server/src/lib/ux-inclusive-acceptance.ts
- artifacts/api-server/src/lib/ux-intake-quantity.behavior.ts
- artifacts/api-server/src/lib/ux-intake-resource-plan.behavior.ts
- artifacts/api-server/src/lib/ux-migration-identity.behavior.ts
- artifacts/api-server/src/lib/ux-migration-identity.ts
- artifacts/api-server/src/lib/ux-record-reconciliation.behavior.ts
- artifacts/api-server/src/lib/ux-record-reconciliation.ts
- artifacts/api-server/src/lib/ux-release-handoff.behavior.ts
- artifacts/api-server/src/lib/ux-release-handoff.ts
- artifacts/api-server/src/lib/ux-reversible-rollout.behavior.ts
- artifacts/api-server/src/lib/ux-reversible-rollout.ts
- artifacts/api-server/src/lib/ux-rollout-cohorts.behavior.ts
- artifacts/api-server/src/lib/ux-rollout-cohorts.ts
- artifacts/api-server/src/lib/ux-user-acceptance.behavior.ts
- artifacts/api-server/src/lib/ux-user-acceptance.ts
- artifacts/api-server/src/lib/ux131-floor-estimate.behavior.ts
- artifacts/api-server/src/lib/ux132-marginal-excess-cost.behavior.ts
- artifacts/api-server/src/lib/ux133-deterministic-hour-allocation.behavior.ts
- artifacts/api-server/src/lib/ux134-hour-cost-revisions.behavior.ts
- artifacts/api-server/src/lib/ux135-floor-cost-acceptance.behavior.ts
- artifacts/api-server/src/lib/ux137-intake-contract-items.behavior.ts
- artifacts/api-server/src/lib/ux138-existing-contract-reconciliation.behavior.ts
- artifacts/api-server/src/lib/ux140-activation-retry.behavior.ts
- artifacts/api-server/src/lib/ux148-sendgrid-verification.behavior.ts
- artifacts/api-server/src/lib/ux150-meeting-journey.behavior.ts
- artifacts/api-server/src/lib/workflow-governance-approval-progress.ts
- artifacts/api-server/src/lib/workflow-governance-binding.behavior.ts
- artifacts/api-server/src/lib/workflow-governance-binding.ts
- artifacts/api-server/src/lib/workflow-governance-policy-contract.behavior.ts
- artifacts/api-server/src/lib/workflow-governance-policy-contract.ts
- artifacts/api-server/src/lib/workflow-governance-policy-migration.ts
- artifacts/api-server/src/lib/workflow-governance-policy.http-evidence.ts
- artifacts/api-server/src/lib/workflow-governance-role-authority.ts
- artifacts/api-server/src/lib/workflow-governance-runtime-change.ts
- artifacts/api-server/src/lib/workflow-governance-threshold.ts

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
- lib/db/src/schema/commercial-subscriptions.ts
- lib/db/src/schema/company_profiles.ts
- lib/db/src/schema/config.ts
- lib/db/src/schema/connector-foundation.ts
- lib/db/src/schema/contact-submissions.ts
- lib/db/src/schema/contract-item-workflows.ts
- lib/db/src/schema/conventions.ts
- lib/db/src/schema/coordination-knowledge.ts
- lib/db/src/schema/coordination_intake_events.ts
- lib/db/src/schema/coordinator-bulk-operations.ts
- lib/db/src/schema/coordinator-saved-views.ts
- lib/db/src/schema/delivery-workflows.ts
- lib/db/src/schema/email-log.ts
- lib/db/src/schema/enterprise-identity.ts
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
- lib/db/src/schema/internal-cost-governance.ts
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
- lib/db/src/schema/onboarding.ts
- lib/db/src/schema/platform-settings.ts
- lib/db/src/schema/project-directory.ts
- lib/db/src/schema/project-milestones.ts
- lib/db/src/schema/projects.ts
- lib/db/src/schema/rfi-ball-in-court-history.ts
- lib/db/src/schema/rfi-report-settings.ts
- lib/db/src/schema/rfi-responses.ts
- lib/db/src/schema/rfi-view-events.ts
- lib/db/src/schema/rfis.ts
- lib/db/src/schema/sales-inquiry-assignment-events.ts
- lib/db/src/schema/sales-inquiry-follow-ups.ts
- lib/db/src/schema/schedule-planner.ts
- lib/db/src/schema/submittal-register.ts
- lib/db/src/schema/submittal-view-events.ts
- lib/db/src/schema/submittal_reports.ts
- lib/db/src/schema/submittals.ts
- lib/db/src/schema/support-cases.ts
- lib/db/src/schema/team-resource-planning.ts
- lib/db/src/schema/telegram-product.ts
- lib/db/src/schema/transmittals.ts
- lib/db/src/schema/user-connections.ts
- lib/db/src/schema/users.ts
- lib/db/src/schema/workflow-governance-policies.ts

## Frontend pages (artifacts/bimlog/src/pages)
- artifacts/bimlog/src/pages/About.tsx
- artifacts/bimlog/src/pages/AdminPanel.tsx
- artifacts/bimlog/src/pages/CommercialWorkspace.tsx
- artifacts/bimlog/src/pages/CompanyDeliveryWorkflows.tsx
- artifacts/bimlog/src/pages/CompanyMasterCatalogs.tsx
- artifacts/bimlog/src/pages/CompanyPricingTemplates.tsx
- artifacts/bimlog/src/pages/CompanyProfile.tsx
- artifacts/bimlog/src/pages/CompanyWorkflowGovernance.tsx
- artifacts/bimlog/src/pages/Contact.tsx
- artifacts/bimlog/src/pages/CoordinationKnowledgeAuthoring.tsx
- artifacts/bimlog/src/pages/CoordinationKnowledgeLibrary.tsx
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
- artifacts/bimlog/src/pages/ProjectSetupTraining.tsx
- artifacts/bimlog/src/pages/Register.tsx
- artifacts/bimlog/src/pages/ResetPassword.tsx
- artifacts/bimlog/src/pages/SetupGuide.tsx
- artifacts/bimlog/src/pages/TeamPerformanceWorkspace.tsx
- artifacts/bimlog/src/pages/Terms.tsx
- artifacts/bimlog/src/pages/TotalControl.tsx
- artifacts/bimlog/src/pages/VerifyEmail.tsx
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
- artifacts/bimlog/src/pages/project/FolderWizardDestinationPanel.tsx
- artifacts/bimlog/src/pages/project/FolderWizardImportPanel.tsx
- artifacts/bimlog/src/pages/project/FolderWizardPublishPanel.tsx
- artifacts/bimlog/src/pages/project/FolderWizardRoutingPanel.tsx
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
- artifacts/bimlog/src/pages/project/SharePointEnrollmentStatus.tsx
- artifacts/bimlog/src/pages/project/SubmittalsTab.tsx
- artifacts/bimlog/src/pages/project/TeamTab.tsx
- artifacts/bimlog/src/pages/project/TransmittalsTab.tsx
- artifacts/bimlog/src/pages/project/convention-builder/ConventionPartyAssignment.tsx
- artifacts/bimlog/src/pages/project/meetings/MeetingActionItemsTable.tsx
- artifacts/bimlog/src/pages/project/meetings/MeetingParticipantField.tsx

## Frontend routes (artifacts/bimlog/src/App.tsx, wouter)
- /
- /login
- /register
- /verify-email
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
- /projects/:id/submittal-tracker
- /projects/:id/:tab?
- /help
- /setup-guide
- /training/project-setup
- /profile
- /settings/company-profile
- /settings/notifications
- /settings/financial-controls
- /settings/billing-support
- /admin/feedback
- /company-catalogs
- /company-workflows
- /company-workflow-governance
- /company-pricing-templates
- /knowledge
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
- The Platform project route and project page must honor that Super Administrator membership
  bypass consistently; ordinary accounts still require their own active project membership.
- Cross-company Super Administrator Analytics and its PDF export require an explicit, bounded
  audit reason for project-read access; the browser must collect it and bind it to the current
  account and project rather than silently bypass the coordinator read boundary.
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
- Company Delivery Workflow and Workflow Governance publication share a company-scoped advisory
  boundary. Independent approval also rechecks published-policy compatibility and policy scope;
  publication rechecks again before replacing a live version. The governed runtime freezes the
  selected policy and workflow definition by version and fingerprint. Policy threshold and
  company-role matrices remain recorded intent rather than independent execution grants. A
  Super Administrator can assign or revoke narrow project-scoped EDT Operations Director
  authority for an active same-company member with an append-only reason and history. The
  guarded EDT activation mutations are not represented as a completed six-role production journey.
- Smart Intake uses the existing project-scoped `job_intakes.data` draft as its only pre-activation
  authority. Preserved XLS/XLSX/XLSM/CSV sources expose bounded multi-sheet previews; the user must
  explicitly choose the sheet, header row, Contract Item Name column, and Quantity column. A
  fingerprint- and revision-bound confirmation appends deterministic-ID rows with document/hash/
  sheet/row/column provenance. Ambiguous or truncated previews fail closed, and PDF/DOCX extraction
  remains manual-review evidence that cannot silently create financial records. The default editor
  exposes only Contract Item Name and Quantity for 100-plus rows; unit, currency, APU/rate, calculated
  value, workflow, budget, and descriptive overrides remain explicit Advanced controls. Activation,
  rather than import preview, creates shared operational and entitled Commercial records.
- Job Intake workspace state and document-assistance contracts are maintained outside the routed
  page component. Browser recovery remains revision-bound: an equal-revision partial draft may be
  resumed, a stale draft is discarded, and upload/save failures preserve the latest recoverable
  state. Spreadsheet inspection and mapping remain deterministic and consume zero AI credits;
  PDF/DOCX remain manual-review evidence. Any future AI text or file operation must fail closed
  unless its funding source, estimated cost, and explicit user confirmation are all visible first.
- Submittals use separated list/query, editor/review, and presentation-scope contracts. Editor,
  attachment, and review mutations carry exact record-version identity and reject stale writes with
  HTTP 409; report/export/history operations remain explicitly project and submittal scoped.
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
- Navbar and Help consume the same generated release-identity module. Regression checks compare
  that generated module with the canonical release contract instead of freezing a stale release label.
- Commercial Contract Items turn an approved budget line and saved APU version into an operational
  contract scope. Quantity multiplied by the frozen APU selling price calculates the contractual value;
  the immutable item snapshot preserves the APU content, evaluation, fingerprint, BIM Submittal display,
  and Phase to Revision to Version to Task workflow selection. Contract detail, searchable PDF, and native
  XLSX exports expose the same Contract Item quantities, rates, values, APU identity, and workflow metadata.
- A Generic Cost & Value APU version's selling price is a plan total, not an Intake Contract Item
  hourly or unit rate. Selecting or auto-binding the sole currency-compatible version preserves the item rate;
  a new or imported item starts at zero until its unit rate is entered. Multiple saved versions require
  an explicit version choice. Activation calculates quantity times the independently entered unit rate.

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

## Prework 06 connector and Coordination File foundation

- Connector credentials are provider/company scoped and persist only a protected ciphertext envelope, wrapped data key, and positive key version. Plaintext secrets are outside the persistence contract.
- Durable connector work uses one job authority with stable idempotency, payload digest, bounded attempts, scheduled retry, leased claims, fencing tokens, dead-letter state, explicit replay lineage and immutable attributable job events.
- A Coordination File is a stable project-scoped logical identity. Every provider revision is immutable and retains provider item/version identity, content SHA-256 and byte size; the current designation is held separately so revision evidence is never rewritten.
- SharePoint foundation maps each BIMLog project to an approved site/library and each category/optional trade to one folder. Delta cursor material uses the same protected-envelope model, while status, last sync and mismatch remain visible operational state.
- The forward-only migration is an explicit transactional operator action and is not called by application startup. This checkpoint provides no SharePoint synchronization worker, Outlook add-in, route, UI, deployment or live-database change.

## BT Folder Wizard publication candidate — Builds 16–20

- An existing project Files record and durable storage object provide the sole source custody. A read-only candidate verifies exact stored byte count and SHA-256, current Wizard import/routing profile, active mapped credential, and Graph-verified site/library identity.
- The deterministic candidate freezes the current source, routing fingerprint and drive-relative path into one request digest. An isolated Graph adapter can create a small file only with no-overwrite semantics, but no production route invokes that write transport.
- The authenticated project endpoint previews eligibility only. No delivery job, worker, retry, external file write or user-facing publishing control is activated by this block. A real authorized tenant/site round-trip remains required before delivery acceptance.

## BT Folder Wizard disconnected job foundation — Builds 21–25

- A deterministic request can be frozen as a byte-free job. The queue adapter rechecks current project/company membership, Wizard import, routing profile, SharePoint mapping, active credential and durable Files identity inside one transaction before insertion and an immutable event.
- A separate worker boundary claims only Wizard publish jobs through a finite lease and fencing token, rechecks current source and destination authority, and can settle by exact lease into completed, bounded retry or dead-letter with an immutable audit event.
- These adapters are not mounted on a production route or scheduled. The visible publishing action stays disabled. Real PostgreSQL/provider round-trip, conflict reconciliation and user confirmation remain open; no SharePoint delivery is claimed.

## BT Folder Wizard confirmed publication candidate — Builds 26–30

- The queue, lease, retry, settlement and immutable event chain has isolated real-PostgreSQL proof. A project administrator previews a verified Files source and exact destination, confirms the digest, and can inspect project-scoped job status.
- The request-bound executor claims only the confirmed job, revalidates current project authority, source bytes and destination mapping, then uses a Graph upload session with create-only conflict behavior. An uncertain provider result reconciles only an exact drive, name, size and byte match; mismatches never overwrite.
- This is source and synthetic-provider acceptance, not a claim of real SharePoint delivery. The release still requires full local gate, exact GitHub/Replit identity, authenticated Chrome smoke, and an authorized tenant/site round-trip. No Native or Lens Next source changes are included.

## Coordination Delivery Release A — Build 1 service boundary

- The first delivery layer is provider-neutral and operates only through an injected transaction/store boundary; it is not connected to application startup, routes, UI or a live provider.
- Every revision or job command carries explicit project, company and attributable user scope. Persistence is unavailable until the store confirms that exact authority.
- Stable Coordination File identity and immutable provider revision evidence replay only when every authoritative field matches. Provider identity reused with a different hash, byte size, scope or classification fails closed.
- Current revision designation is explicit and compare-and-set guarded by the caller's observed revision. Job idempotency likewise accepts replay only when the request digest matches.
- This build adds no schema and activates no connector. It preserves the complete Prework 02–06 and MAIN 04 Build 47 lineage.

## POST-P18 Coordination Hub authorization hardening — Build 66

- Coordination summary and intake history remain readable by authenticated current-project members.
- Coordination intake analysis, intake confirmation, immutable revision registration, and connector-job enqueue are mutations and therefore require the established project `admin` or `write` permission on the server.
- Credential enrollment, rotation, validation, lifecycle visibility, and SharePoint mapping retain their stricter project-administrator boundary.
- Every command continues to replace caller-supplied scope with the authenticated route project, actor, and company context; provider revision identity and summary queries remain project-scoped.
- This correction changes no schema, stored record, connector activation, Native/Lens Next behavior, or deployment state.

## POST-P18 Coordination synchronization lifecycle — Build 67

- Connector-job enqueue and its first immutable lifecycle event are committed in one transaction. The sequence-1 event is bound to exact job, company, project, actor, provider, job type, and request digest evidence.
- Existing job states remain `queued`, `leased`, `retry`, `completed`, `dead_letter`, and `cancelled`; claims remain attempt-bounded, lease-aware, `SKIP LOCKED`, and fencing-token protected.
- Exact idempotent replay remains accepted only for the same request digest. Digest conflict fails closed, and terminal dead-letter jobs remain visible as attention items.
- This checkpoint activates no connector worker, provider call, migration, outbound action, or deployment.

## POST-P18 Coordination linked-record isolation — Build 68

- Generic linked-item creation accepts only the established authoritative entity types and positive numeric record identities.
- Before relationship persistence, both source and target records must independently exist in the exact requested project. Missing, malformed, unsupported, and cross-project endpoints fail closed.
- Relationship creation and removal affect only the project-scoped relationship and its activity evidence; connected authoritative RFI, Submittal, Transmittal, Change Order, Meeting, File, Clash, and Lens Next records are not mutated.
- Coordination File source revisions retain their independent same-project source-file proof, and action projections remain persistence-free proposals.

## Coordination Delivery Release A — Builds 2–11 contracts

- Builds 2–3 add an authority-scoped, read-only SharePoint discovery port and deterministic reconciliation. Discovery is bounded and credential references remain opaque; reconciliation never silently changes the current BIMLog revision.
- Builds 4–5 define a strict Microsoft Graph message envelope and deterministic project routing. Provider tokens are excluded, attachment identity is immutable, and zero or multiple project matches require review.
- Builds 6–7 define trade-file collection requests and immutable submission review. Requests bind project, company, trade, accountable contact, required artifacts, deadline and allowed formats; acceptance requires a clean malware result and an attributable human decision.
- Builds 8–9 separate accountability evaluation from outbound delivery. Overdue work proposes escalation, while external delivery remains an approval-gated, digest-bound, idempotent outbox intent; this checkpoint sends nothing.
- Builds 10–11 define composite source authority and QC decisions. A composite is blocked when any discipline is not the observed current revision, and approval is prohibited when blocking checks fail or applicable checks lack immutable evidence.
- All ten builds are provider-neutral or provider-bound contracts and pure services only. They add no routes, UI, startup hooks, schema, database application, provider activation, message sending, deployment or Native/Lens Next change.

## Coordination Delivery Release A — Builds 12–18 completion

- Builds 12–13 stage approved, digest-bound Procore return intent and preserve design comments against exact provider, project, Coordination File and revision evidence. No provider write is activated.
- Builds 14–15 project design comments and meeting-report commitments into the existing unified action authority. Meeting-derived actions remain proposals and carry the report snapshot digest, attributable principals, scope and due date.
- Builds 16–17 control For Record issuance and immutable delivery receipts. Issuance requires approved QC, the observed current revision, explicit recipients and human approval; provider outcomes replay only when immutable receipt evidence agrees.
- Build 18 evaluates one complete 18-gate release-readiness record and fails closed on any missing, duplicated or failed gate. Its contract requires the local checkpoint to attest that database application, provider activation, outbound messaging, deployment and publication are all false.
- The full 18-build Coordination Delivery roadmap is now implemented as locally tested contracts and service boundaries. Provider adapters, routes, UI, migrations, live activation and deployment remain separately reviewed delivery work rather than implied effects of this checkpoint.

## 120-build stabilization — Block 13 coordination records

- Issue/clash, RFI, submittal, transmittal, meeting, schedule, and change-order records now share one strict project-bound identity and link contract. Schedule placements participate in the same authoritative same-project check as the existing record families.
- Lifecycle actions use explicit per-record matrices. Reopen, revise, void, and reject require reasons, and accepted transitions append ordered actor/time/from/to evidence.
- Attachments, references, comments, responsible-company evidence, and notifications bind to the exact canonical record version. Attachment hashes and notification event keys are deterministic; evidence identities cannot be rebound.
- Saved views own filters, search, sorting, and page size. Screen pagination and PDF/CSV producers consume the same project-scoped filtered rows, preventing hidden or cross-project export divergence.
- Block 13 changes no schema, Native source, installer, provider configuration, or customer data. It is push-only; Build 070 remains the next publication milestone.

## 120-build stabilization — Block 14 Lens Next Platform sole-product completion

- The September 17 dirty mockup worktree remains preserved but is not a source authority. Its useful responsible-company behavior is implemented without its proposed schema: Lens Next combines names from exact-project membership and the existing Convention assignment response, deduplicates them, and never fabricates a company name from an unbound code.
- A tracked inventory mechanically separates Lens Next supported runtime, migration-only compatibility, governance, tests, and historical evidence. New unclassified Original/Legacy Lens, retired bundle, or `lens-sync` references fail the focused acceptance gate.
- The Lens Next Platform capability contract binds list/detail, grouping, filters, captured-image states, references, same-project RFI/Submittal links, responsive/keyboard behavior, and the truthful rule that a captured image is not interactive 3D.
- Create, Working View, repair, refresh, and reconciliation acceptance preserves exact project/model identity, idempotency, stale-response refusal, manual conflict handling, readback, and transaction rollback.
- Customer Platform source no longer presents Original/Legacy Lens. `/lens-next` is the sole Lens product route. The shared release identity advances only the Platform counter to `v1.05.N18-P35`; generated Native metadata remains behaviorally unchanged and requires focused dual-year package/contract smoke before push.

## Build 070 publication schema-correspondence correction

- `job_activation_tasks` lifecycle dates and predecessor identities are jointly owned by the Build 057 startup migration and the authoritative Drizzle schema. The declared contract includes `start_date`, `due_date`, `predecessor_task_ids`, and `job_activation_task_dates_chk`; provider synchronization may not remove them.
- Publication correspondence introspects the executable Drizzle schema and compares every table, explicit index, column, and table-qualified check constraint against both provider databases. Duplicate constraint names on different tables remain distinct, and the existing master-catalog aliases-array check is declared in both startup and Drizzle authorities. Any missing or extra column/check returns a stopped publication decision instead of a zero-change receipt.
- The first P35 provider preview exposed the prior mismatch against 18 populated records and was cancelled before promotion. Production remained unchanged; the corrective release must pass a fresh provider preview before publication.

## 120-build stabilization — Block 16 feedback and notifications

- Platform candidate `v1.05.N18-P36` completes the current ten-build publication batch through Build 080 with durable feedback recovery, canonical customer/reviewer routes, deterministic preferences, governed delivery contracts, and production-safe feedback-to-resolution acceptance.
- Replit remains the established publication provider. Publication uses Replit Shell and visible Chrome; Replit Agents are prohibited. No external email, Telegram message, or document is sent by the acceptance gate.
- Native behavior remains N18. Shared P36 metadata was rebuilt deterministically for Navisworks 2021 and 2025 without installation; installed compatibility and absence of customer-facing Legacy Lens remain a focused post-publication scan.

## Post-120 RFI frontend decomposition — Build 155

- Builds 151–155 isolate RFI list/query state, create evidence state, and permission-aware action presentation under `artifacts/bimlog/src/pages/project/rfi-frontend/`.
- The route, API contracts, database, customer data, Native boundary, installers, and release cadence are unchanged.
- The permanent Block 31 regression covers cross-role status actions and project-scoped deep links.

## Post-120 RFI backend decomposition — Build 160

- RFI query parsing, date bounds, ball-in-court derivation, filtering, and sorting are owned by one project-scoped query service used by governed PDF and Excel exports.
- Lifecycle administration and attributable audit-record construction are centralized without widening existing project-member, write, project-admin, or super-admin boundaries.
- The permanent Block 32 negative matrix denies project/object mismatch, non-admin lifecycle authority, malformed filters, and contradictory date ranges.

## Post-120 clash-report architecture — Build 165

- Clash import parsing, report-number allocation, and status presentation now have focused shared contracts instead of duplicated route-local implementations.
- Classic clash reads and mutations bind project, report, and clash identity through shared provenance predicates; cross-project and cross-object identities fail closed.
- Lens Next Visual Package completeness and reference-attachment presentation have one project-scoped truth source. Partial packages are explicitly invalid rather than silently presented as unavailable.
- The permanent Block 33 matrix covers large reports, exact chunk preservation, malformed AI output, duplicate identities, cross-project/object denial, and incomplete Visual Package denial.

## Post-120 meeting-minutes backend — Build 170

- Meeting command payloads, current-view query scope, and report presentation use bounded shared contracts instead of route-local interpretations.
- Participant and action-assignee identity normalization is centralized. Exact duplicate participant identities fail closed before persistence.
- The live meeting register, action list, PDF, native XLSX, and activity history consume one project-scoped scope contract; invalid date ranges fail closed.
- Create retries serialize under an actor/project/command-bound receipt and PostgreSQL transaction advisory lock. Concurrent meeting updates compare the observed version inside the update predicate and reject stale writers atomically.
- Block 34 changes no schema, Native source, installer, bridge protocol, provider configuration, or customer data.

## Route and interconnection integrity — Build 185

- The tracked route graph is generated by `scripts/route-interconnection-graph.mjs` and records frontend routes, project screens, navigation, frontend API references, API operations, and route-owned database tables.
- The normal pre-push gate rejects stale graph evidence, duplicate API ownership, unreachable project navigation, incorrect specific-before-generic ordering, or removal of the compatibility redirects for setup-guide and legacy Submittals tracking URLs.

## Open-loop current-authority reconciliation — Build 190

- Exactly one marked section in `living-brief/OPEN_LOOP.md` owns current open-loop truth; historical sections remain evidence and cannot become current by heading text alone.
- The generated disposition inventory classifies every open record, binds ownership and module/route responsibility, and links repeated historical statements to one canonical record.
- The normal pre-push gate rejects unresolved duplicate statements, competing or missing current markers, unowned records, route-less product work, and stale contradictions classified as active.

## Settings, notifications and reusable libraries - UX071-UX075

- Profile navigation distinguishes personal settings, company configuration and platform administration, and names the role responsible for each scope.
- Notification Center displays the effective result after global enablement, pause, delivery cadence, connector readiness and channel availability. Existing stored preferences and event/module overrides remain canonical.
- Integration cards distinguish ready, setup-required and permission-required states with an explicit next action. Status failures state that no external request was sent.
- Stored project roles are translated into readable effective authority labels. Unknown legacy labels remain visible as preserved history and never broaden permissions.
- Company pricing and coordination knowledge selection states distinguish loading, unavailable, published options, filter-empty results and authoring-unavailable empty states. Published immutable versions and existing project prices remain unchanged.
- UX071-UX075 are the first five unpublished builds after the UX061-UX070 release; publication and authenticated Chrome smoke are due at UX080.

## Shared experience system - UX076-UX080

- Shared spacing, panel and semantic status primitives use the existing theme authority in light and dark modes.
- Plain-language English and Spanish glossary labels keep internal diagnostic identifiers inside expandable technical details.
- The production header, footer, actions, tables and content padding share responsive behavior for 320, 390, 768 and 1280 widths and compact behavior under zoom.
- Shared form controls associate help and assertive errors; shared dialogs and alert dialogs remain bounded, scrollable and operable on compact viewports with visible keyboard focus and focus restoration retained by Radix.
- The tracked regression matrix covers loading, empty, error, read and edit states for Project Setup, Operations, RFI Control, Submittal Control, Personal Settings and Company Library surfaces.
- UX071-UX080 reach the ten-build publication and authenticated Chrome smoke boundary. Canonical permissions, workflow records, database schema, customer data, Native source, installers and provider sends are unchanged.

## Public experience, trust and task continuity - UX081-UX085

- BIMLog is the product and IgniteSmart is the parent technology brand. Public copy identifies BIM coordinators, BIM managers, project administrators and delivery teams as the primary audience.
- The landing page uses repository-held product captures and sends authenticated users to their projects; public visitors retain registration, sign-in and workflow-review paths.
- The Features page groups released capabilities by user role and states membership, permission, entitlement and configuration prerequisites instead of presenting unqualified feature or plan promises.
- Public trust copy treats file storage, retention, deletion, hosting, encryption, backups and production access as deployment/customer-policy facts. BIMLog reports remain informational project records rather than independent certification.
- Help validates a same-project origin, preserves the exact path and query, and sends Convention setup back to that origin. Hostile, malformed or cross-project origins fall back to Dashboard.

## Pricing and conversion continuity - UX086-UX090

- One canonical offer contract owns public plan names, price illustrations, project/member limits, availability boundaries and the self-service or sales-assisted next step. Customer entitlement and signed agreements remain authoritative.
- Validated plan, billing and bounded use-case intent follows the visitor into Contact or free registration without requiring re-entry. Unknown plan or billing values are discarded.
- Free registration and paid-plan consultation use distinct labels, destinations and expectations. No paid entitlement is implied by submitting Contact.
- The ROI illustration uses editable event, time, loaded-cost and annual-software-cost assumptions, shows its arithmetic and explicitly promises no realized saving or return.
- The funnel baseline stores event-name counts locally in the browser and displays its definitions. It sends no identity, free text, document/project content, credential, token, URL or device data.
- UX081-UX090 reach the ten-build publication and authenticated Chrome smoke boundary. No schema, customer data, permission authority, Native source, installer or provider-secret change is included.

## Migration and reversible rollout - UX091-UX095

- Identity reconciliation is a zero-write dry run. Stable identities or explicit reviewed mappings are required; names and filenames never merge records.
- Before/after reconciliation covers record IDs, attachments, assignments and historical links. Every missing or new identity requires an explicit reviewed disposition.
- Financial reconciliation compares exact six-decimal totals, currency, immutable version and approval identities, and role grants against the accepted baseline.
- Compatibility preview covers canonical legacy web destinations and the existing Native 2021/2025 upload route. Rollback restores route and cohort exposure without rewinding legitimate business events.
- Rollout cohorts require explicit reviewed customer, synthetic, demo or training metadata and explicit enrollment. Unclassified projects remain excluded; name-based classification is prohibited.
- UX091-UX095 are the first five unpublished builds after the UX081-UX090 publication. No database row, schema, customer record, permission grant, Native source, installer or provider secret is changed.

## Final experience acceptance - UX096-UX100

- The transactional golden journey verifies setup, activation, task, evidence, decision and report in order with exact record identities and exactly one mutation per step.
- Failure acceptance covers retry, date boundaries, permission denial and cross-tenant denial; input is preserved, retry is bounded and unauthorized records are never exposed.
- Representative journeys cover mobile and desktop, keyboard and pointer, and English and Spanish. Applicable Native 2021/2025 field gates remain explicitly passed or deferred with a reason.
- Roberto, Ruben and representative-user observations require dated journey evidence. Coaching dependence and unresolved confusing states block acceptance rather than becoming assumed success.
- Release handoff binds exact source, deployment and rollback commits, completed gates, known limits and scope. Unresolved P0/P1 issues or an unrehearsed rollback block release.
- UX091-UX100 reach the ten-build publication boundary. These acceptance contracts add no schema, customer-data, permission-authority, Native-source, installer or provider-secret changes.

## Connected commercial Intake - UX026-UX030

Activated Intake with a canonical contract displays authoritative saved setup in read-only fields. Browser recovery copies remain preserved without false autosave retries; stage navigation and linked commercial records remain available. Operational activation without a canonical contract retains its existing enrichment path.

- APU selection filters exact compatible project-currency versions, preserves unavailable saved references, and never replaces an item unit rate with the plan total. Active Intake no longer offers hardcoded rate presets.
- Item calculations show quantity, unit, rate, currency and exact total independently of labor hours. Help describes the same calculation.
- Approved budget changes load before changing the draft, clear old line mappings and ignore stale responses. The controlled import selects named registered CSV/XLSX versions; backend authorization and evidence verification remain canonical.
- Contract setup opens exact created contracts and retains validated Intake return context. Budget navigation and individual History snapshot links also preserve that origin.
- Optional commercial service failures expose retry while preserving core Intake and saved references. Commercial creation still requires authoritative access and existing validation.
- Production runtime packaging bounds sibling file copies to eight and hashes small files directly, preserving ordered material fingerprints, cancellation, containment and the existing ten-minute timeout.
- Semantic runtime test cases allow thirty seconds on slower hosts; dedicated timeout/cancellation budgets and the production limit are unchanged.
- Local responsive fixtures wrap their diagnostic destination independently of production layout.
- UX030 is the B05+B06 ten-build publication boundary; live acceptance requires exact source and authenticated Chrome smoke.

## One full Job Intake setup - UX021-UX025

- Active Intake has six stages; historical Quick Setup drafts resume in the same full draft.
- Scope quantity and unit are separate from planned labor hours. Legacy quantity falls back to previous hours; canonical contract lines use quantity. Non-hour unit prices do not create fictitious hourly resource revenue.
- Delivery contains eligible published workflow versions and work-package locations. Convention Builder and company workflows preserve a validated return to the saved Intake stage.
- Optional generic role budgets can activate without named employees, a leader or full staffing coverage. Existing assignments remain preserved; employee-profile cost approval and excess-hours policy are not enabled by this block.
- Legacy staffing release has a focused regression asserting preserved row identity, scope, hours and cost.
- Denied prerequisite pages retain the validated Intake return without granting access. Draft-only controls can release legacy named staffing or leader selections to pending while retaining the underlying generic plan; activated records do not expose these conversions.
- B05 is five unpublished builds after push; publication and full authenticated Chrome smoke are due with B06 at UX030.

## Connected project navigation - UX016-UX020

- ProjectLocation shares project/home/Analytics links and a validated same-project Intake return across ProjectDetail and FinancialProjectShell, preserving existing role and code display.
- Intake prerequisite navigation preserves browser recovery and explicit stage/item context. Invalid external, cross-project and malformed return destinations are ignored. Convention, APU and Budget retain their own save controls and authorization.
- Contract query links load the selected record only from the authorized register, guard stale responses, and show recovery when unavailable. Historical contracts and financial actions are unchanged.
- Bare project home resolves verified membership and Intake activation state; explicit Analytics and legacy dashboard links remain available. Unknown setup state has retry, never invented readiness.
- Search includes project codes/names within active memberships; document results identify source project and supported record destinations. Files/changes explicitly open their registers; people are informational. Five-per-type and excluded contract/model content scope is visible. No cross-project membership expansion.
- Acceptance corrections explicitly parse internal return paths, refresh role-based redirects, classify the shared project entry router separately from workspace tabs, and inventory 62 accessibility surfaces.
- Live-smoke correction: Profile project policy choices collapse duplicate identities without widening permissions; project policy requests are scoped to the project tab, with explicit binding and membership prerequisites.
- UX020 is the next ten-build publication boundary. Final release and authenticated live smoke receipts remain external to the frozen source.

## Shared project parties and account identity - UX011-UX015

- RFI, Transmittal and Change Order forms reuse the authenticated project directory for company choices and canonical project company/contact creators. RFI retains authorized active project member recipients; manual delivery fields remain available. Existing selected company labels remain visible without creating records.
- Company-only internal placeholder emails are excluded from recipient choices, rejected by directory invitations and blocked by the central email sender. Existing directory and document history is not rewritten.
- Intake discipline choices distinguish loading, denied/unavailable, genuine empty and approved-company scope, with retry and preserved legacy selection.
- Current account company identity is read from the database binding. Personal company-profile branding remains editable and cannot rebind the account or rewrite stored party names.
- UX001-UX010 are published at source 2b49e507c6f6abf04589ca4788e65f9b197e9444 with authenticated Chrome smoke PASS. UX011-UX015 are the next push-only block; publication is due at UX020.

## Experience makeover state and trust repairs — UX006–UX010

- Intake distinguishes active jobs from draft readiness and labels configuration as setup, staffing and commercial coverage. The active next action opens the same job workspace; active review headings and guidance no longer request initial activation.
- RFI create/edit choices deduplicate stable values and retain legacy selections without mutating configuration.
- Submittal detail is read-first, with explicit Edit and dirty Cancel/close protection. Save preserves revision validation and exits to inspection; denied saves retain edits.
- Shared calendarDate/formatCalendarDate normalize calendar fields for editor/detail/control and export, including the legacy dueDate editor fallback. Missing financial effective dates remain absent; valid effective timestamps retain local-day display through a separate guarded instant formatter. Audit/event instants and historical rows are unchanged.
- Commercial-entitlement authority dates show Included with Commercial access instead of exposing the internal epoch sentinel; recorded grant dates and authorization semantics are unchanged.
- Bare project links share the optional-tab route parser and preserve the existing analytics default and membership checks.
- UX010 is the ten-build publication boundary; exact release evidence is external until completed.

## Experience makeover foundation — UX001–UX005

- Help > Task guides consumes TaskJourneyGuide and task-journeys.ts for manager setup, coordinator delivery, operator execution and administrator access.
- Each step identifies an action, completion check and recovery. Valid numeric project context scopes links; absent or invalid context recovers to Dashboard. Destination authorization remains authoritative.
- URL journey/step persistence stores guidance selection only, never project progress. Setup guidance links Intake → Convention → Intake → Operations; automatic editor draft/step return remains UX017/UX021.
- The source route inventory, entity/snapshot preservation map, usability protocol and prior audit are in docs/experience/ux-program. No backend authority, schema, provider send, PDF or Native behavior changes.

## Browser performance and lazy-loading integrity — Build 205

- The production Vite manifest is the machine-readable authority for initial-entry and route-owned browser chunks.
- Anonymous startup excludes authenticated feedback tooling. Authenticated feedback mounts after a bounded 400 ms delay with teardown cancellation.
- Capture markup editing is a separate deployment-recoverable dynamic entry keyed to the selected file, preventing stale editor state from crossing captures.
- Reports and convention editing remain independently lazy project workspaces. Initial-entry, route-chunk, total-JavaScript, feedback, and editor size budgets run in the normal pre-push gate.

## Coordination Knowledge Resolution Records — Builds 256–260

- The canonical coordination issue remains `lens_viewpoints`. A Resolution Record is a company/project/issue-scoped outcome and history object; it never becomes a second issue authority and cannot be rebound across tenants, projects, or issues.
- Resolution Records reference only reviewed Resolution Methods, preserve the selected method and actual field outcome, and append immutable revisions for draft save, completion, verification, and reopening. Optimistic concurrency rejects stale writers.
- Before, after, and supporting evidence remain project-file/revision scoped. Linking evidence records metadata and the immutable model-view reference without copying file authority or weakening the established project attachment boundary.
- Completion may occur directly from a valid first submission. Verification is a separate accountable action, and the resolver cannot verify their own resolution. Reopening requires an attributable reason and preserves the prior completed and verified history.
- Lens Next exposes this workflow in its existing issue-detail surface. The API, Platform client, and UI share the same action vocabulary, role checks, version, and audit outcome; Native bridge and installer contracts are unchanged.
- Builds 256–260 are a source-only five-build push boundary. No provider migration, customer data mutation, Replit publication, or external delivery is implied; publication and authenticated Chrome acceptance remain due at Build 265.

## Coordination Knowledge Lessons Learned — Builds 261–265

- A Lesson Learned proposal is a company/project-scoped review object linked to the exact canonical Project Case, closed Resolution Record, classification, and supporting evidence. It never replaces or changes the source issue.
- Lens Next exposes the proposal action only for a completed or verified outcome with evidence. The authenticated Coordination Knowledge Library exposes the live company-scoped queue and controlled proposed, under-review, approved, rejected, and merged states.
- Reviewer decisions are optimistic-concurrency protected, attributable, rationale-bearing, and audited. Duplicate proposals may merge only into a same-company canonical proposal and retain their redirect history.
- An approved proposal may create or revise draft Conflict Types, Coordination Rules, or Resolution Methods through a separate controlled action. No proposal, review transition, or merge automatically approves or publishes organizational knowledge.
- Block 8 adds no schema and changes no Native, bridge, camera, installer, package, Autodesk load path, or Navisworks-facing source. Build 265 is the scheduled Replit publication and authenticated Chrome acceptance boundary.
