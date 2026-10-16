import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (file) => readFileSync(file, "utf8");
const runNode = (file) => {
  const result = spawnSync(process.execPath, [file], { encoding: "utf8" });
  assert.equal(result.status, 0, `${file} failed:\n${result.stdout}\n${result.stderr}`);
};
const runTs = (file) => {
  const result = spawnSync(process.execPath, ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", file], { encoding: "utf8" });
  assert.equal(result.status, 0, `${file} failed:\n${result.stdout}\n${result.stderr}`);
};

runNode("scripts/test-ga-final-block01-build001-agent-access.mjs");
runNode("scripts/test-ga-final-block01-build002-agent-isolation.mjs");
runTs("artifacts/api-server/src/lib/block22-build106-object-authorization.behavior.ts");

const pdfAuthorization = read("artifacts/api-server/src/lib/pdf-route-authorization.behavior.ts");
for (const contract of [
  "submittal-reports\\/:reportId\\/pdf",
  "clash-reports\\/:reportId\\/pdf",
  "A query-only JWT must not authenticate",
  "A non-member must be denied",
]) assert.ok(pdfAuthorization.includes(contract), `PDF authorization behavior missing ${contract}`);

const surfaces = [
  ["files", "artifacts/api-server/src/routes/files.ts", /projects\/:projectId\/files[\s\S]*requireProjectMember\(\)/, /filesTable\.projectId, projectId/],
  ["rfis", "artifacts/api-server/src/routes/rfis.ts", /projects\/:projectId\/rfis[\s\S]*requireProjectMember\(\)/, /rfisTable\.projectId, projectId/],
  ["submittals", "artifacts/api-server/src/routes/submittals.ts", /projects\/:projectId\/submittals[\s\S]*requireProjectMember\(\)/, /submittalsTable\.projectId, projectId/],
  ["reports", "artifacts/api-server/src/routes/reports.ts", /projects\/:projectId[\s\S]*requireProjectMember\(\)/, /projectId/],
  ["conventions", "artifacts/api-server/src/routes/conventions.ts", /projects\/:projectId[\s\S]*requireProjectMember\(\)/, /projectId/],
  ["integrations", "artifacts/api-server/src/routes/connections.ts", /authMiddleware/, /companyId|projectId/],
];

for (const [name, file, membership, scope] of surfaces) {
  const source = read(file);
  assert.match(source, membership, `${name} must require authenticated membership or authority`);
  assert.match(source, scope, `${name} must retain company/project identity in its query or authority contract`);
}

const financialRoute = read("artifacts/api-server/src/routes/financial-apu.ts");
const financialService = read("artifacts/api-server/src/lib/cost-value-plan-service.ts");
assert.match(financialRoute, /router\.use\("\/projects\/:projectId\/financial\/apu", authMiddleware\)/);
assert.match(financialService, /authorizeFinancialOperation\(\{ actorUserId, projectId/);

const teamRoute = read("artifacts/api-server/src/routes/team-performance.ts");
const teamService = read("artifacts/api-server/src/lib/team-performance-service.ts");
assert.match(teamRoute, /router\.use\("\/projects\/:projectId\/commercial\/team-performance", authMiddleware\)/);
assert.match(teamService, /project_members pm[\s\S]*pm\.project_id=p\.id[\s\S]*pm\.user_id=u\.id[\s\S]*pm\.status='active'/);

const auth = read("artifacts/api-server/src/middlewares/auth.ts");
for (const token of ["requireProjectMember", "Not a member of this project", "requirePermission", "Insufficient permissions for this action", "AUTHORITY_INVALID"]) {
  assert.ok(auth.includes(token), `authorization middleware missing ${token}`);
}

console.log("GA-F05-B031 direct/indirect company and project isolation across records, exports, integrations and BIMLog Agent: PASS");
