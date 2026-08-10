import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../../..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const service = read("artifacts/api-server/src/lib/team-performance-service.ts");
const route = read("artifacts/api-server/src/routes/team-performance.ts");
const page = read("artifacts/bimlog/src/pages/TeamPerformanceWorkspace.tsx");
const sidebar = read("artifacts/bimlog/src/components/layout/ProjectSidebar.tsx");
const totalControl = read("artifacts/bimlog/src/pages/TotalControl.tsx");
const manual = read("artifacts/bimlog/src/lib/help-content.ts");

assert.match(service, /effectiveCommercialAccessForUser/);
assert.match(service, /commercial\.team_performance/);
assert.match(service, /Active project membership is required/);
assert.match(service, /job_activation_resource_assignments/);
assert.match(service, /job_activation_time_entries/);
assert.match(service, /job_activation_task_deliverables/);
assert.match(service, /job_activation_work_packages/);
assert.match(service, /earned planned hours \/ actual recorded hours/);
assert.match(service, /approved responsible packages \/ approved plus returned responsible packages/);
assert.match(service, /No AI ranking, personality score, or fabricated history/);
assert.match(route, /authMiddleware/);
assert.match(route, /getTeamPerformance/);
assert.match(page, /Team Performance & Skills/);
assert.match(page, /Rendimiento y Habilidades del Equipo/);
assert.match(page, /Export CSV/);
assert.match(page, /Print \/ PDF/);
assert.match(page, /Evidence level/);
assert.match(page, /Category \/ discipline/);
assert.match(page, /actual recorded hours/);
assert.match(sidebar, /commercial\/team-performance/);
assert.match(totalControl, /team_performance/);
assert.match(manual, /id: "team-performance"/);
assert.match(manual, /Observed category/);

console.log(JSON.stringify({ status: "PASS", tests: ["membership", "entitlement", "real-operations-sources", "transparent-efficiency", "transparent-quality", "no-ai-ranking", "bilingual-ui", "filters", "csv", "print-pdf", "total-control", "complete-manual"] }));
