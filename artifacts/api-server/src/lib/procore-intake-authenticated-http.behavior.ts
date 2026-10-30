import assert from "node:assert/strict";
import express from "express";
import { pool } from "@workspace/db";
import { signToken } from "../middlewares/auth";
import { createAgentsRouter } from "../routes/agents";
import { startCompanyProviderApprovalMigration } from "./provider-governance";
import { callProcoreIntakeTool } from "./procore-intake-mcp";
import { parseProcoreFileVersions } from "./cloud-files";
import connectionsRouter from "../routes/connections";
import { getTableConfig } from "drizzle-orm/pg-core";
import {companyCommercialEntitlementEventsTable,companyProviderApprovalEventsTable,procoreIntakeStatesTable} from "@workspace/db/schema";
import { startCommercialEntitlementMigration, effectiveCommercialAccessForUser } from "./commercial-entitlement";

const connectionString = process.env.PROD_DATABASE_URL;
if (!connectionString) throw new Error("An isolated local PROD_DATABASE_URL is required.");
const database = new URL(connectionString);
if (!["127.0.0.1", "localhost", "::1"].includes(database.hostname) ||
    !["55434", "55439"].includes(database.port) || database.pathname !== "/procore_intake_http_test") {
  throw new Error("Refusing to run outside the disposable local Procore intake HTTP database.");
}

await pool.query(`
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  CREATE TABLE companies(
    id integer PRIMARY KEY, name text NOT NULL, retired_at timestamptz,
    retired_into_company_id integer REFERENCES companies(id)
  );
  CREATE TABLE users(
    id serial PRIMARY KEY, email text NOT NULL UNIQUE, full_name text NOT NULL,
    password_hash text NOT NULL, company_id integer NOT NULL REFERENCES companies(id),
    is_super_admin boolean NOT NULL DEFAULT false
  );
  CREATE TABLE projects(id serial PRIMARY KEY, created_by_id integer REFERENCES users(id));
  CREATE TABLE project_members(
    id serial PRIMARY KEY, project_id integer NOT NULL REFERENCES projects(id),
    user_id integer NOT NULL REFERENCES users(id), role text NOT NULL,
    joined_at timestamptz NOT NULL DEFAULT now(), permissions_override jsonb,
    status text NOT NULL DEFAULT 'active'
  );
  INSERT INTO companies(id,name) VALUES(31,'BIMTECH CORP'),(38,'Bimtech'),(39,'Other company');
`);
const userRows = await pool.query(`INSERT INTO users(email,full_name,password_hash,company_id) VALUES
  ('intake-owner@example.test','Fixture User','fixture-password-hash',31),
  ('same-company@example.test','Same Company','fixture-password-hash',31),
  ('company38@example.test','Company 38','fixture-password-hash',38),
  ('inactive-member@example.test','Inactive Member','fixture-password-hash',31)
  RETURNING id,email`);
const userIds = new Map(userRows.rows.map((row) => [String(row.email), Number(row.id)]));
const projectRows = await pool.query(`INSERT INTO projects(created_by_id) VALUES($1),($1) RETURNING id`, [userIds.get("intake-owner@example.test")]);
const projectId = Number(projectRows.rows[0].id);
const otherProjectId = Number(projectRows.rows[1].id);
await pool.query(`INSERT INTO project_members(project_id,user_id,role,status) VALUES
  ($1,$2,'read_only','active'),($1,$3,'member','active'),($1,$4,'member','active'),
  ($1,$5,'member','inactive'),($6,$2,'member','active')`,
  [projectId,userIds.get("intake-owner@example.test"),userIds.get("same-company@example.test"),
    userIds.get("company38@example.test"),userIds.get("inactive-member@example.test"),otherProjectId]);
await startCompanyProviderApprovalMigration();

let providerSnapshot = {
  fileId: "120",
  projectRef: "project:700",
  name: "Submittal.pdf",
  mimeType: "application/pdf",
};
let rawVersionPayload: unknown = [{ id: "version-1", version_number: "1", created_at: "2026-10-30T00:00:00.000Z" }];
await pool.query(`CREATE TABLE user_connections(id serial PRIMARY KEY,user_id integer NOT NULL REFERENCES users(id),provider text NOT NULL,kind text,status text NOT NULL DEFAULT 'connected',credentials jsonb,account_label text,metadata jsonb,last_error text,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now())`);
await pool.query(`INSERT INTO user_connections(user_id,provider,kind,credentials,account_label) VALUES($1,'procore','file_source','{"accessToken":"fixture-private-secret"}','Fixture authorized source')`,[userIds.get('intake-owner@example.test')]);
await startCommercialEntitlementMigration();
const app = express();
app.use(express.json({ limit: "32kb" }));
app.use("/api/v1",connectionsRouter);
app.use("/api/v1", createAgentsRouter({
  callIntakeTool: (actor, name, input) => callProcoreIntakeTool(actor, name, input, {
    versions: async (_userId, ref) => {
      if (ref !== "file:120:700") throw new Error("PROCORE_FILE_REF_INVALID");
      return {
        ...providerSnapshot,
        versions: parseProcoreFileVersions({ file_versions: structuredClone(rawVersionPayload) }),
      };
    },
  }),
}));

async function listen() {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const value = app.listen(0, "127.0.0.1", () => resolve(value));
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { server, base: `http://127.0.0.1:${address.port}/api/v1` };
}
async function close(server: ReturnType<typeof app.listen>) {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
function token(email: string, claimedCompanyId: number) {
  return signToken({ userId: userIds.get(email)!, email, companyId: claimedCompanyId,
    fullName: "Fixture", companyName: "Untrusted token company" });
}
async function request(base: string, path: string, email?: string, claimedCompanyId = 31, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (email) headers.set("Authorization", `Bearer ${token(email, claimedCompanyId)}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* retain plain response */ }
  return { status: response.status, body, text, headers:response.headers };
}
const statePath = `/projects/${projectId}/intake-agent/state`;
const mcpPath = `/projects/${projectId}/intake-agent/mcp`;
const jsonRpc = (method: string, params?: unknown) => ({
  jsonrpc: "2.0", id: "http-test", method, ...(params === undefined ? {} : { params }),
});
const sourceInput = (versionId = "version-1", name = "Submittal.pdf") => ({
  projectId, sources: [{ ref: "file:120:700", name, versionId }],
  goal: "Review submittals", needed: "Latest approved PDF", destination: String(projectId),
});
const checks: Record<string, string | number | boolean> = {};
let server: ReturnType<typeof app.listen> | undefined;

try {
  let current = await listen();
  server = current.server;
  assert.equal((await request(current.base, statePath)).status, 401);
  checks.unauthenticatedDenied = true;
  const catalog31=await request(current.base,'/me/provider-catalog','intake-owner@example.test');assert.equal(catalog31.status,200);const procore31=catalog31.body.providers.find((p:any)=>p.key==='procore');assert.equal(procore31.permissionState,'approved');assert.notEqual(procore31.availability,'review_required');
  const catalog38=await request(current.base,'/me/provider-catalog','company38@example.test',38);assert.equal(catalog38.body.providers.find((p:any)=>p.key==='procore').permissionState,'approval_required');
  const status31=await request(current.base,`/projects/${projectId}/connections/procore/status`,'intake-owner@example.test');assert.equal(status31.status,200);assert.equal(status31.body.approved,true);assert.equal(status31.headers.get('x-bimlog-project-id'),String(projectId));assert.equal(status31.body.connection.status,'connected');assert.equal(status31.text.includes('fixture-private-secret'),false);
  checks.company31CatalogApprovalAndSafeConnectionStatus=true;
  const future31=(await pool.query(`INSERT INTO users(email,full_name,password_hash,company_id) VALUES('future31@example.test','Future company31 member','unused',31) RETURNING id`)).rows[0].id;
  const future38=(await pool.query(`INSERT INTO users(email,full_name,password_hash,company_id) VALUES('future38@example.test','Future other member','unused',38) RETURNING id`)).rows[0].id;
  const full31=await effectiveCommercialAccessForUser(future31),full38=await effectiveCommercialAccessForUser(future38);assert.equal(full31.package,true);assert.equal(full31.budget,true);assert.equal(full31.contracts,true);assert.equal(full38.package,false);
  checks.futureCompany31FullCommercialGrantWithoutPackageAndCompany38Isolation=true;

  const save = await request(current.base, statePath, "intake-owner@example.test", 38, {
    method: "PUT", body: JSON.stringify({
      goal: "Review submittals", needed: "Latest approved PDF",
      messages: [{ role: "user", content: "Use the latest version" }],
      selectedSources: [],
    }),
  });
  assert.equal(save.status, 200);
  assert.equal(save.headers.get("x-bimlog-project-id"),String(projectId));
  assert.equal(save.headers.get("x-bimlog-caller-id"),String(userIds.get("intake-owner@example.test")));
  assert.equal(save.headers.get("x-bimlog-company-id"),"31");
  assert.equal(save.body.state.destinationProjectId, projectId);
  assert.equal(save.body.state.goal, "Review submittals");
  checks.staleCompanyClaimUsesCurrentDatabaseCompany = true;

  const reopened = await request(current.base, statePath, "intake-owner@example.test", 39);
  assert.equal(reopened.body.state.goal, "Review submittals");
  assert.equal(reopened.body.state.messages[0].content, "Use the latest version");
  checks.refreshAndFreshSessionReentry = true;
  assert.equal((await request(current.base, statePath, "same-company@example.test")).body.state.goal, "");
  assert.equal((await request(current.base, `/projects/${otherProjectId}/intake-agent/state`, "same-company@example.test")).status, 403);
  assert.equal((await request(current.base, `/projects/${otherProjectId}/intake-agent/state`, "intake-owner@example.test")).body.state.goal, "");
  checks.userAndProjectIsolation = true;
  assert.equal((await request(current.base, statePath, "inactive-member@example.test")).status, 403);
  checks.inactiveMembershipDenied = true;
  await pool.query(`UPDATE users SET company_id=38 WHERE id=$1`, [userIds.get("intake-owner@example.test")]);
  const movedCompany = await request(current.base, statePath, "intake-owner@example.test", 31);
  assert.equal(movedCompany.status, 200);
  assert.equal(movedCompany.body.state.goal, "");
  await pool.query(`UPDATE users SET company_id=31 WHERE id=$1`, [userIds.get("intake-owner@example.test")]);
  checks.currentCompanyMoveSeparatesSavedState = true;

  const company38List = await request(current.base, mcpPath, "company38@example.test", 38, {
    method: "POST", body: JSON.stringify(jsonRpc("tools/list")),
  });
  assert.equal(company38List.status, 200);
  assert.deepEqual(company38List.body.result.tools, []);
  checks.company38ApprovalIsolated = true;

  const listed = await request(current.base, mcpPath, "intake-owner@example.test", 38, {
    method: "POST", body: JSON.stringify(jsonRpc("tools/list")),
  });
  assert.equal(listed.status, 200);
  assert.ok(listed.body.result.tools.some((tool: any) => tool.name === "procore_file_versions"));
  assert.ok(listed.body.result.tools.every((tool:any)=>tool.inputSchema?.type==="object"&&!Object.hasOwn(tool,"input_schema")),"MCP wire tools must expose standard inputSchema");
  checks.company31ToolsDiscoverWithCurrentApproval = true;

  const malformedRef = await request(current.base, mcpPath, "intake-owner@example.test", 38, {
    method: "POST", body: JSON.stringify(jsonRpc("tools/call", { name: "procore_file_versions", arguments: { projectId, fileRef: "bad-ref" } })),
  });
  assert.equal(malformedRef.body.error.data.code, "PROCORE_FILE_REF_INVALID");
  assert.ok(Number.isInteger(malformedRef.body.error.code),"JSON-RPC errors require numeric codes");
  checks.malformedVersionReferenceRejected = true;

  const proposal = await request(current.base, mcpPath, "intake-owner@example.test", 38, {
    method: "POST", body: JSON.stringify(jsonRpc("tools/call", { name: "bimlog_propose_intake_plan", arguments: sourceInput() })),
  });
  assert.equal(proposal.status, 200);
  const proposalResult = JSON.parse(proposal.body.result.content[0].text);
  assert.equal(proposalResult.versionPinned, true);
  assert.equal(proposalResult.sources[0].versionId, "version-1");
  assert.equal((await request(current.base, statePath, "intake-owner@example.test")).body.state.selectedSources[0].versionId, "version-1");
  checks.exactVersionProposalPersistedOverAuthenticatedHttp = true;

  rawVersionPayload = ["malformed", {}, { id: null }];
  const malformedVersions = await request(current.base, mcpPath, "intake-owner@example.test", 31, {
    method: "POST", body: JSON.stringify(jsonRpc("tools/call", { name: "bimlog_propose_intake_plan", arguments: sourceInput() })),
  });
  assert.equal(malformedVersions.body.error.data.code, "PROCORE_VERSION_UNAVAILABLE");
  checks.malformedProviderVersionsRejected = true;

  rawVersionPayload = [{ id: "version-1", version_number: "1" }];
  providerSnapshot = { ...providerSnapshot, name: "Renamed.pdf" };
  const changed = await request(current.base, mcpPath, "intake-owner@example.test", 31, {
    method: "POST", body: JSON.stringify(jsonRpc("tools/call", { name: "bimlog_propose_intake_plan", arguments: sourceInput() })),
  });
  assert.equal(changed.body.error.data.code, "PROCORE_SOURCE_CHANGED");
  providerSnapshot = { ...providerSnapshot, name: "Submittal.pdf" };
  rawVersionPayload = [];
  const unavailable = await request(current.base, mcpPath, "intake-owner@example.test", 31, {
    method: "POST", body: JSON.stringify(jsonRpc("tools/call", { name: "bimlog_propose_intake_plan", arguments: sourceInput() })),
  });
  assert.equal(unavailable.body.error.data.code, "PROCORE_VERSION_UNAVAILABLE");
  checks.changedAndUnavailableProviderVersionsRejected = true;

  await pool.query(`INSERT INTO company_provider_approval_events(
    event_key,company_id,provider_key,operation,enabled,reason,source
  ) VALUES('http-test-revoke-company31',31,'procore','*',false,'Controlled HTTP revocation','owner_instruction')`);
  const revokedTools = await request(current.base, mcpPath, "intake-owner@example.test", 31, {
    method: "POST", body: JSON.stringify(jsonRpc("tools/list")),
  });
  assert.deepEqual(revokedTools.body.result.tools, []);
  const revokedCall = await request(current.base, mcpPath, "intake-owner@example.test", 31, {
    method: "POST", body: JSON.stringify(jsonRpc("tools/call", { name: "procore_file_versions", arguments: { projectId, fileRef: "file:120:700" } })),
  });
  assert.equal(revokedCall.body.error.data.code, "PROVIDER_NOT_APPROVED");
  checks.approvalRevocationTakesEffectWithoutRestart = true;
  const revokedStatus=await request(current.base,`/projects/${projectId}/connections/procore/status`,"intake-owner@example.test");assert.equal(revokedStatus.body.approved,false);

  await close(current.server);
  server = undefined;
  current = await listen();
  server = current.server;
  const reentry = await request(current.base, statePath, "same-company@example.test");
  assert.equal(reentry.status, 200);
  assert.equal(reentry.body.state.goal, "");
  checks.httpServerReopenPreservesTenantIsolation = true;

  await pool.query(`UPDATE companies SET retired_at=now(),retired_into_company_id=38 WHERE id=31`);
  const retired = await request(current.base, statePath, "intake-owner@example.test");
  assert.equal(retired.status, 401);
  assert.equal(retired.body.code, "AUTHORITY_INVALID");
  checks.retiredCompanySessionDenied = true;

  const ping=await request(current.base,mcpPath,"intake-owner@example.test",31,{method:"POST",body:JSON.stringify(jsonRpc("ping"))});
  assert.equal(ping.status,401,"Retired account cannot ping across the authenticated boundary");
  checks.standardMcpWireSchemaAndNumericErrors=true;
  for(const table of [companyCommercialEntitlementEventsTable,companyProviderApprovalEventsTable,procoreIntakeStatesTable]){
    const config=getTableConfig(table);
    const actualColumns=(await pool.query(`SELECT column_name,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY column_name`,[config.name])).rows;
    assert.deepEqual(actualColumns,config.columns.map(c=>({column_name:c.name,is_nullable:c.notNull?'NO':'YES'})).sort((a,b)=>a.column_name.localeCompare(b.column_name)),'Startup columns must match the exported Drizzle declaration');
    const foreign=(await pool.query(`SELECT conname,confdeltype FROM pg_constraint WHERE conrelid=$1::regclass AND contype='f' ORDER BY conname`,[config.name])).rows;
    assert.deepEqual(foreign,config.foreignKeys.map(f=>({conname:f.getName(),confdeltype:'a'})).sort((a,b)=>a.conname.localeCompare(b.conname)),'New foreign keys must retain records rather than cascade deletion');
    const indexes=(await pool.query(`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename=$1`,[config.name])).rows.map(r=>r.indexname);
    for(const item of config.indexes)assert.ok(indexes.includes(item.config.name),'Declared startup index must exist');
  }
  await assert.rejects(pool.query(`UPDATE company_provider_approval_events SET enabled=false WHERE company_id=31`),/append-only/);
  await assert.rejects(pool.query(`UPDATE company_commercial_entitlement_events SET enabled=false WHERE company_id=31`),/append-only/);
  checks.additiveStartupSchemaMatchesDrizzleAndPreservesHistory=true;
  console.log(JSON.stringify({ suite: "procore-intake-authenticated-http", provider: "controlled fixture only", passed: Object.keys(checks).length, checks }, null, 2));
} finally {
  if (server) await close(server);
  await pool.end();
}
