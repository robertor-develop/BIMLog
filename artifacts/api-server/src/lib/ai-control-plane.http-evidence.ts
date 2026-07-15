import crypto from "crypto";
import express from "express";
import { pool } from "@workspace/db";
import { signToken } from "../middlewares/auth";
import { ensureAiControlPlaneSchema } from "./ai-control-plane-migration";
import { createProviderConnection, type Actor } from "./ai-control-plane";
import aiControlRouter from "../routes/ai-control-plane";

type Result = { name: string; pass: boolean; detail: string };
const results: Result[] = [];
const check = (name: string, pass: boolean, detail: string) => {
  results.push({ name, pass, detail });
  if (!pass) throw new Error(`${name}: ${detail}`);
};
const id = () => crypto.randomUUID();
const key = (fill: number) => Buffer.alloc(32, fill).toString("base64url");

async function main() {
  process.env.AI_PROVIDER_ACTIVE_KEK_VERSION = "v1";
  process.env.AI_PROVIDER_KEK_V1 = process.env.AI_PROVIDER_KEK_V1 || key(8);
  await ensureAiControlPlaneSchema();

  const marker = `ai-http-${id()}`;
  const company = (await pool.query(`INSERT INTO companies(name) VALUES($1) RETURNING id,name`, [`${marker}-company`])).rows[0];
  const otherCompany = (await pool.query(`INSERT INTO companies(name) VALUES($1) RETURNING id,name`, [`${marker}-other`])).rows[0];
  const ordinary = (await pool.query(`INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'proof','HTTP Ordinary',$2,false) RETURNING id,email,full_name,company_id,is_super_admin`, [`${marker}-ordinary@example.test`, company.id])).rows[0];
  const companyAdmin = (await pool.query(`INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'proof','HTTP Company Admin',$2,false) RETURNING id,email,full_name,company_id,is_super_admin`, [`${marker}-admin@example.test`, company.id])).rows[0];
  const superAdmin = (await pool.query(`INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'proof','HTTP Super',$2,true) RETURNING id,email,full_name,company_id,is_super_admin`, [`${marker}-super@example.test`, company.id])).rows[0];
  const otherUser = (await pool.query(`INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'proof','HTTP Other',$2,false) RETURNING id,email,full_name,company_id,is_super_admin`, [`${marker}-other@example.test`, otherCompany.id])).rows[0];
  await pool.query(`INSERT INTO company_ai_administrators(id,company_id,user_id,status,granted_by_id) VALUES($1,$2,$3,'active',$4)`, [id(), company.id, companyAdmin.id, superAdmin.id]);

  const tokenFor = (u: typeof ordinary) => signToken({ userId: u.id, email: u.email, companyId: u.company_id, fullName: u.full_name, companyName: company.name, isSuperAdmin: u.is_super_admin });
  const httpApp = express();
  httpApp.use(express.json({ limit: "1mb" }));
  httpApp.use("/api/v1", aiControlRouter);
  const server = httpApp.listen(0);
  const port = (server.address() as { port: number }).port;
  const call = async (token: string, path: string, init: RequestInit = {}): Promise<{ status: number; body: any }> => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/ai-control${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    return { status: response.status, body };
  };

  try {
    const companyActor: Actor = { userId: companyAdmin.id, companyId: company.id, isCompanyAdmin: true, isSuperAdmin: false };
    const companyConnection = await createProviderConnection({ actorUserId: companyActor.userId, actorCompanyId: companyActor.companyId, actorIsCompanyAdmin: true, actorIsSuperAdmin: false, ownerType: "company", provider: "openai", secret: `secret-${marker}`, allowedModels: ["test-model"], label: "HTTP company key" });
    const budget = (await call(tokenFor(companyAdmin), "/budgets", { method: "POST", body: JSON.stringify({ fundingOwnerType: "company", version: Math.floor(Date.now()/1000), currency: "USD", limitMicros: "1000000", perRequestLimitMicros: "100000", dailyLimitMicros: "1000000", monthlyLimitMicros: "1000000", sessionLimitMicros: "100000", providerAllowlist: ["openai"], modelAllowlist: ["test-model"], capabilityAllowlist: ["assistant"], effectiveFrom: new Date().toISOString() }) })).body;
    await call(tokenFor(companyAdmin), `/budgets/${budget.id}/allocations`, { method: "POST", body: JSON.stringify({ userId: ordinary.id, limitMicros: "100000", dailyLimitMicros: "100000", monthlyLimitMicros: "100000", sessionLimitMicros: "100000" }) });

    const ordinaryStatus = await call(tokenFor(ordinary), "/status");
    check("ordinary cannot manage company/system", ordinaryStatus.status === 200 && ordinaryStatus.body.canManageCompany === false && ordinaryStatus.body.canManageSystem === false, JSON.stringify(ordinaryStatus.body));

    const ordinaryBudgets = await call(tokenFor(ordinary), "/budgets");
    check("ordinary budget response hides names and emails", ordinaryBudgets.status === 200 && !JSON.stringify(ordinaryBudgets.body).includes("@example.test") && !JSON.stringify(ordinaryBudgets.body).includes("HTTP Company Admin"), JSON.stringify(ordinaryBudgets.body));

    const validateCompany = await call(tokenFor(ordinary), `/provider-connections/${companyConnection.id}/validate`, { method: "POST", body: "{}" });
    check("ordinary cannot validate company key", validateCompany.status === 403 && validateCompany.body.error === "CONNECTION_FORBIDDEN", JSON.stringify(validateCompany.body));

    const patchActive = await call(tokenFor(companyAdmin), `/provider-connections/${companyConnection.id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) });
    check("pending key cannot be activated by patch", patchActive.status === 409 && patchActive.body.error === "VALIDATION_REQUIRED", JSON.stringify(patchActive.body));

    const entitlement = await call(tokenFor(ordinary), "/entitlements", { method: "POST", body: JSON.stringify({ version: Math.floor(Date.now()/1000), capability: "assistant", fundingType: "personal", providerAllowlist: ["openai"], modelAllowlist: ["test-model"], effectiveFrom: new Date().toISOString() }) });
    check("ordinary cannot write entitlement policy", entitlement.status === 403 && entitlement.body.error === "COMPANY_AI_ADMIN_REQUIRED", JSON.stringify(entitlement.body));

    const crossCompanyUsers = await call(tokenFor(companyAdmin), `/company-users?companyId=${otherCompany.id}`);
    check("company admin query ignores cross-company selector", crossCompanyUsers.status === 200 && crossCompanyUsers.body.every((u: { id: number }) => u.id !== otherUser.id), JSON.stringify(crossCompanyUsers.body));

    const systemBudget = (await call(tokenFor(superAdmin), "/budgets", { method: "POST", body: JSON.stringify({ fundingOwnerType: "system", version: Math.floor(Date.now()/1000), currency: "USD", limitMicros: "1000000", perRequestLimitMicros: "100000", dailyLimitMicros: "1000000", monthlyLimitMicros: "1000000", sessionLimitMicros: "100000", providerAllowlist: ["openai"], modelAllowlist: ["test-model"], capabilityAllowlist: ["assistant"], effectiveFrom: new Date().toISOString() }) })).body;
    const missingTarget = await call(tokenFor(superAdmin), `/budgets/${systemBudget.id}/allocations`, { method: "POST", body: JSON.stringify({ userId: ordinary.id, limitMicros: "100000", dailyLimitMicros: "100000", monthlyLimitMicros: "100000", sessionLimitMicros: "100000" }) });
    check("system allocation requires explicit target company", missingTarget.status === 400 && missingTarget.body.error === "TARGET_COMPANY_REQUIRED", JSON.stringify(missingTarget.body));

    const report = { suite: "ai-control-plane-authenticated-http", marker, passed: results.length, total: results.length, results };
    console.log(JSON.stringify(report, null, 2));
    if (process.env.AI_CONTROL_HTTP_EVIDENCE_OUTPUT) await import("node:fs/promises").then(fs => fs.writeFile(process.env.AI_CONTROL_HTTP_EVIDENCE_OUTPUT!, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" }));
  } finally {
    server.close();
    await pool.end();
  }
}

main().catch(async (error) => {
  console.error(JSON.stringify({ suite: "ai-control-plane-authenticated-http", passed: results.filter(r => r.pass).length, failed: error instanceof Error ? error.message : String(error), results }, null, 2));
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});
