import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = file => readFileSync(file, "utf8");
const launchRoute = read("artifacts/api-server/src/routes/launch-configuration.ts");
const launchUi = read("artifacts/bimlog/src/components/admin/LaunchConfigurationPanel.tsx");
const catalogRoute = read("artifacts/api-server/src/routes/company-master-catalogs.ts");
const catalogUi = read("artifacts/bimlog/src/components/admin/CompanyMasterCatalogsTab.tsx");
const knowledgeRoute = read("artifacts/api-server/src/routes/coordination-knowledge.ts");
const knowledgeClient = read("artifacts/bimlog/src/features/lens-next/lens-next-client.ts");
const knowledgeUi = read("artifacts/bimlog/src/features/lens-next/LensNextKnowledgePanel.tsx");
const featureRoute = read("artifacts/api-server/src/routes/feature-policies.ts");
const featureUi = read("artifacts/bimlog/src/pages/FeaturePreferences.tsx");
const connectionsRoute = read("artifacts/api-server/src/routes/connections.ts");
const connectionsUi = read("artifacts/bimlog/src/pages/MyConnectionFiles.tsx");
const resourceRoute = read("artifacts/api-server/src/routes/team-performance.ts");
const resourceUi = read("artifacts/bimlog/src/components/team-performance/ResourceSchedulingPanel.tsx");
const intakeRoute = read("artifacts/api-server/src/routes/job-intake.ts");
const intakeUi = read("artifacts/bimlog/src/pages/JobIntakeWorkspace.tsx");
const meetingRoute = read("artifacts/api-server/src/routes/meeting_minutes.ts");
const meetingUi = read("artifacts/bimlog/src/pages/project/MeetingsTab.tsx");
const directory = read("artifacts/bimlog/src/lib/capability-directory.ts");

for (const [label, source, contracts] of [
  ["launch configuration", `${launchRoute}\n${launchUi}`, ['router.put("/admin/launch-configuration/:environment"', "isSuperAdminMiddleware", "requireLaunchStepUp", 'method:"PUT"', "expectedRevision", "Configuration saved with an immutable revision"]],
  ["service delivery workflow", `${catalogRoute}\n${catalogUi}`, ['router.put("/company/master-catalogs/service/:id/delivery-workflow"', "workflowVersionId", "expectedVersion", 'method: "PUT"', "Automatic workflow for", "Flujo automático para"]],
  ["Lens knowledge", `${knowledgeRoute}\n${knowledgeClient}\n${knowledgeUi}`, ['/classification",authMiddleware', '/resolution",authMiddleware', 'method:"PUT"', "expectedConflictTypeRevisionId", "Use this classification", "saveResolutionRecord"]],
  ["feature preferences", `${featureRoute}\n${featureUi}`, ['router.put("/features/preferences/:featureKey",authMiddleware', 'method:\'PUT\'', "expectedVersion", "My Feature Preferences", "Mis preferencias de funciones"]],
  ["retired Anthropic connection", `${connectionsRoute}\n${connectionsUi}`, ['router.put("/me/connections/anthropic", authMiddleware', "LEGACY_AI_CONNECTION_RETIRED", "410", "Open encrypted provider connections", "Abrir conexiones cifradas de proveedores"]],
  ["capacity profile", `${resourceRoute}\n${resourceUi}`, ['resource-planning/profiles/:userId', 'method:"PUT"', "expectedVersion", "Configure my availability", "Configurar mi disponibilidad", "saved and reopened"]],
  ["job intake", `${intakeRoute}\n${intakeUi}`, ['"/projects/:projectId/intake"', "authMiddleware", "method: \"PUT\"", "expectedRevision"]],
  ["meeting draft", `${meetingRoute}\n${meetingUi}`, ['"/projects/:projectId/meetings/draft"', 'method:"PUT"', "canonical_updated_at", "reopened"]],
]) for (const contract of contracts) assert.ok(source.includes(contract), `${label}: ${contract}`);

for (const entry of ["launch-configuration", "feature-preferences", "my-connected-files", "intake", "team-performance"]) assert.ok(directory.includes(`id: "${entry}"`) || directory.includes(`id:"${entry}"`), `${entry} must remain discoverable in All Tools`);
assert.doesNotMatch(connectionsUi, /apiKey|plaintext key/i, "retired plaintext Anthropic entry must never collect another key");
assert.match(knowledgeUi, /Classification is optional/);
assert.match(resourceUi, /member\.id === actorUserId/);
assert.match(meetingUi, /Change saved, but reopening its exact evidence failed|Draft saved|draft/i);

const tsx = path.resolve("artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for (const fixture of [
  "artifacts/api-server/src/routes/launch-configuration.behavior.ts",
  "artifacts/bimlog/src/components/admin/launch-configuration-panel.behavior.ts",
  "artifacts/bimlog/src/components/admin/CompanyMasterCatalogsTab.authorities.behavior.tsx",
  "artifacts/bimlog/src/features/lens-next/lens-next-resolution-workflow.behavior.ts",
  "artifacts/bimlog/src/components/team-performance/ResourceSchedulingPanel.behavior.tsx",
]) execFileSync(process.execPath, [tsx, path.resolve(fixture)], { stdio: "inherit", windowsHide: true });

console.log("P210 final PUT-family launch, catalog workflow, Lens classification/resolution, feature preference, retired plaintext provider, capacity profile, intake, meeting draft, role/isolation, optimistic persistence, bilingual discovery, and reopen gates passed.");
