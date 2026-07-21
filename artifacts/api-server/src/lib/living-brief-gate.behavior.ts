import assert from "node:assert/strict";
import http from "node:http";
import bcrypt from "bcryptjs";
import app from "../app";
import { pool } from "@workspace/db";
import { signToken } from "../middlewares/auth";
import { ensureLivingBriefGateSchema, ensureLivingBriefMirrorSchema } from "./living-brief-migration";
import { getLivingBriefGateCredential, resetLivingBriefGateCredential } from "./living-brief-gate";
import { synchronizeLivingBriefMirror } from "./living-brief-mirror";

const checks: string[] = [];
const marker = `lb-gate-${Date.now()}`;
const accountPassword = `${marker}-account-password`;
const legacyGatePassword = `${marker}-legacy-gate-password`;
const nextGatePassword = `${marker}-next-gate-password`;
const concurrentGatePasswordA = `${marker}-concurrent-a-password`;
const concurrentGatePasswordB = `${marker}-concurrent-b-password`;

function check(name: string): void {
  checks.push(name);
}

function safeDatabaseIdentity(): void {
  const raw = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL || "";
  const url = new URL(raw);
  const database = url.pathname.slice(1);
  assert.ok(["127.0.0.1", "localhost", "::1"].includes(url.hostname), "database must be loopback");
  assert.equal(url.port, "55432");
  assert.equal(database, "bimlog_rfi_test");
  assert.doesNotMatch(url.hostname, /neon|replit/i);
  check("verified isolated loopback PostgreSQL target");
}

async function api(base: string, path: string, token?: string, init: RequestInit = {}) {
  const response = await fetch(`${base}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body: unknown = {};
  if (text) body = JSON.parse(text);
  return { status: response.status, body, text };
}

async function main(): Promise<void> {
  safeDatabaseIdentity();
  const client = await pool.connect();
  let originalPlatform: string | null = null;
  let originalGate: { password_hash: string; version: string; created_by_user_id: number | null; updated_by_user_id: number | null; session_invalidated_at: string } | null = null;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('living_brief_gate_credential'))");
    await client.query(`CREATE TABLE IF NOT EXISTS platform_settings (id serial PRIMARY KEY, key text NOT NULL UNIQUE, value text NOT NULL, updated_at timestamp NOT NULL DEFAULT now())`);
    await ensureLivingBriefGateSchema();
    await ensureLivingBriefMirrorSchema();
    const platform = await client.query<{ value: string }>(`SELECT value FROM platform_settings WHERE key='living_brief_password_hash' LIMIT 1`);
    originalPlatform = platform.rows[0]?.value ?? null;
    const gate = await client.query<{ password_hash: string; version: string; created_by_user_id: number | null; updated_by_user_id: number | null; session_invalidated_at: string }>(
      `SELECT password_hash, version::text, created_by_user_id, updated_by_user_id, session_invalidated_at::text FROM living_brief_gate_credentials WHERE credential_key='primary' LIMIT 1`,
    );
    originalGate = gate.rows[0] ?? null;
    await client.query(`DELETE FROM living_brief_gate_audit WHERE actor_email LIKE $1`, [`${marker}%`]);
    await client.query(`DELETE FROM living_brief_gate_audit WHERE action='legacy_migrated' AND actor_email='system'`);
    await client.query(`DELETE FROM living_brief_gate_credentials WHERE credential_key='primary'`);
    await client.query(`DELETE FROM platform_settings WHERE key='living_brief_password_hash'`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    await ensureLivingBriefGateSchema();
    assert.equal(await getLivingBriefGateCredential(), null);
    check("fresh startup creates schema without default credential");

    const company = await pool.query<{ id: number }>(
      `INSERT INTO companies (name) VALUES ($1) RETURNING id`,
      [`${marker}-company`],
    );
    const companyId = company.rows[0]!.id;
    const accountHash = await bcrypt.hash(accountPassword, 10);
    const users = await Promise.all([
      pool.query<{ id: number; email: string }>(`INSERT INTO users (email,password_hash,full_name,company_id,is_super_admin,can_access_living_brief) VALUES ($1,$2,$3,$4,true,true) RETURNING id,email`, [`${marker}-super@example.test`, accountHash, "Living Brief Super", companyId]),
      pool.query<{ id: number; email: string }>(`INSERT INTO users (email,password_hash,full_name,company_id,is_super_admin,can_access_living_brief) VALUES ($1,$2,$3,$4,false,true) RETURNING id,email`, [`${marker}-ordinary@example.test`, accountHash, "Living Brief Ordinary", companyId]),
      pool.query<{ id: number; email: string }>(`INSERT INTO users (email,password_hash,full_name,company_id,is_super_admin,can_access_living_brief) VALUES ($1,$2,$3,$4,false,true) RETURNING id,email`, [`${marker}-project-admin@example.test`, accountHash, "Living Brief Project Admin", companyId]),
      pool.query<{ id: number; email: string }>(`INSERT INTO users (email,password_hash,full_name,company_id,is_super_admin,can_access_living_brief) VALUES ($1,$2,$3,$4,false,true) RETURNING id,email`, [`${marker}-company-admin@example.test`, accountHash, "Living Brief Company Admin", companyId]),
    ]);
    const [superUser, ordinaryUser, projectAdminUser, companyAdminUser] = users.map((result) => result.rows[0]!);
    const superToken = signToken({ userId: superUser.id, email: superUser.email, companyId, fullName: "Living Brief Super", companyName: `${marker}-company`, isSuperAdmin: true });
    const ordinaryToken = signToken({ userId: ordinaryUser.id, email: ordinaryUser.email, companyId, fullName: "Living Brief Ordinary", companyName: `${marker}-company`, isSuperAdmin: false });
    const projectAdminToken = signToken({ userId: projectAdminUser.id, email: projectAdminUser.email, companyId, fullName: "Living Brief Project Admin", companyName: `${marker}-company`, isSuperAdmin: false });
    const companyAdminToken = signToken({ userId: companyAdminUser.id, email: companyAdminUser.email, companyId, fullName: "Living Brief Company Admin", companyName: `${marker}-company`, isSuperAdmin: false });

    assert.equal((await api(base, "/living-brief/unlock", superToken, { method: "POST", body: JSON.stringify({ password: legacyGatePassword }) })).status, 503);
    check("missing durable credential fails closed without default fallback");

    const legacyHash = await bcrypt.hash(legacyGatePassword, 10);
    await pool.query(`INSERT INTO platform_settings (key,value) VALUES ('living_brief_password_hash',$1)`, [legacyHash]);
    await Promise.all([
      ensureLivingBriefGateSchema(),
      ensureLivingBriefGateSchema(),
      ensureLivingBriefGateSchema(),
    ]);
    const migrated = await getLivingBriefGateCredential();
    assert.equal(migrated?.version, 1);
    assert.ok(await bcrypt.compare(legacyGatePassword, migrated!.password_hash));
    const legacyAudit = await pool.query<{ count: string }>(`SELECT count(*)::text FROM living_brief_gate_audit WHERE action='legacy_migrated' AND actor_email='system'`);
    assert.equal(legacyAudit.rows[0]!.count, "1");
    await ensureLivingBriefGateSchema();
    const repeated = await getLivingBriefGateCredential();
    assert.equal(repeated?.version, 1);
    assert.equal(repeated?.password_hash, migrated?.password_hash);
    const repeatedLegacyAudit = await pool.query<{ count: string }>(`SELECT count(*)::text FROM living_brief_gate_audit WHERE action='legacy_migrated' AND actor_email='system'`);
    assert.equal(repeatedLegacyAudit.rows[0]!.count, "1");
    check("concurrent legacy startup creates one credential and one migration audit row");
    check("legacy hash migrates once and repeated startup preserves it");

    await ensureLivingBriefMirrorSchema();
    await synchronizeLivingBriefMirror();
    await synchronizeLivingBriefMirror();
    assert.equal((await getLivingBriefGateCredential())?.password_hash, migrated?.password_hash);
    check("startup mirror synchronization preserves credential record");

    const unlock = await api(base, "/living-brief/unlock", superToken, { method: "POST", body: JSON.stringify({ password: legacyGatePassword }) });
    assert.equal(unlock.status, 200);
    const briefToken = (unlock.body as { briefToken: string }).briefToken;
    assert.equal((await api(base, "/living-brief/docs", superToken, { headers: { "X-Brief-Token": briefToken } })).status, 200);
    check("old migrated gate password unlocks and reads documents");

    assert.equal((await api(base, "/living-brief/password", undefined, { method: "POST", body: "{}" })).status, 401);
    assert.equal((await api(base, "/living-brief/password", ordinaryToken, { method: "POST", body: "{}" })).status, 403);
    assert.equal((await api(base, "/living-brief/password", projectAdminToken, { method: "POST", body: "{}" })).status, 403);
    assert.equal((await api(base, "/living-brief/password", companyAdminToken, { method: "POST", body: "{}" })).status, 403);
    assert.equal((await api(base, "/living-brief/password", superToken, { method: "POST", body: "{}" })).status, 401);
    assert.equal((await api(base, "/living-brief/password", superToken, { method: "POST", headers: { "X-Brief-Token": briefToken }, body: JSON.stringify({ currentAccountPassword: accountPassword, newPassword: "short", reason: "too short", confirmation: "wrong" }) })).status, 400);
    check("reset authorization denies anonymous ordinary project admin company admin and weak super-admin requests");

    const reset = await api(base, "/living-brief/password", superToken, {
      method: "POST",
      headers: { "X-Brief-Token": briefToken },
      body: JSON.stringify({ currentAccountPassword: accountPassword, newPassword: nextGatePassword, reason: "controlled credential persistence reset", confirmation: "RESET_LIVING_BRIEF_GATE" }),
    });
    assert.equal(reset.status, 200);
    assert.equal((await api(base, "/living-brief/docs", superToken, { headers: { "X-Brief-Token": briefToken } })).status, 401);
    assert.equal((await api(base, "/living-brief/unlock", superToken, { method: "POST", body: JSON.stringify({ password: legacyGatePassword }) })).status, 401);
    const nextUnlock = await api(base, "/living-brief/unlock", superToken, { method: "POST", body: JSON.stringify({ password: nextGatePassword }) });
    assert.equal(nextUnlock.status, 200);
    const nextBriefToken = (nextUnlock.body as { briefToken: string }).briefToken;
    check("successful reset invalidates old sessions and old gate password");

    assert.equal((await api(base, "/living-brief/password", superToken, {
      method: "POST",
      headers: { "X-Brief-Token": briefToken },
      body: JSON.stringify({ currentAccountPassword: accountPassword, newPassword: `${marker}-stale-password`, reason: "stale token reset attempt", confirmation: "RESET_LIVING_BRIEF_GATE" }),
    })).status, 409);
    check("stale observed credential version is rejected");

    const concurrentPayload = (newPassword: string) => ({
      method: "POST",
      headers: { "X-Brief-Token": nextBriefToken },
      body: JSON.stringify({ currentAccountPassword: accountPassword, newPassword, reason: "concurrent reset serialization check", confirmation: "RESET_LIVING_BRIEF_GATE" }),
    });
    const concurrent = await Promise.all([
      api(base, "/living-brief/password", superToken, concurrentPayload(concurrentGatePasswordA)),
      api(base, "/living-brief/password", superToken, concurrentPayload(concurrentGatePasswordB)),
    ]);
    assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 409]);
    check("concurrent reset serializes and rejects stale overwrite");

    const beforeRollback = await getLivingBriefGateCredential();
    const auditBefore = await pool.query<{ count: string }>(`SELECT count(*)::text FROM living_brief_gate_audit WHERE actor_email LIKE $1`, [`${marker}%`]);
    await assert.rejects(() => resetLivingBriefGateCredential({
      actorUserId: superUser.id,
      actorEmail: superUser.email,
      currentAccountPassword: accountPassword,
      newPassword: `${marker}-rollback-password`,
      reason: "rollback proof after update",
      confirmation: "RESET_LIVING_BRIEF_GATE",
      expectedCredentialVersion: beforeRollback!.version,
      failureAfterUpdate: true,
    }));
    const afterRollback = await getLivingBriefGateCredential();
    const auditAfter = await pool.query<{ count: string }>(`SELECT count(*)::text FROM living_brief_gate_audit WHERE actor_email LIKE $1`, [`${marker}%`]);
    assert.equal(afterRollback?.version, beforeRollback?.version);
    assert.equal(afterRollback?.password_hash, beforeRollback?.password_hash);
    assert.equal(auditAfter.rows[0]!.count, auditBefore.rows[0]!.count);
    check("failed reset transaction rolls back completely");

    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.BIMLOG_SOURCE_COMMIT = process.env.BIMLOG_SOURCE_COMMIT || "2c1ffc4b5c08618610cdb70b42fcb08556726f1c";
    await ensureLivingBriefGateSchema();
    await synchronizeLivingBriefMirror();
    assert.equal((await getLivingBriefGateCredential())?.password_hash, afterRollback?.password_hash);
    check("simulated source/deployment commit change does not rotate credential");

    await pool.query(`DELETE FROM living_brief_gate_credentials WHERE credential_key='primary'`);
    await pool.query(`DELETE FROM platform_settings WHERE key='living_brief_password_hash'`);
    await pool.query(`DELETE FROM living_brief_gate_audit WHERE action='legacy_migrated' AND actor_email='system'`);
    const bootstrap = await api(base, "/living-brief/password", superToken, {
      method: "POST",
      body: JSON.stringify({ currentAccountPassword: accountPassword, newPassword: `${marker}-bootstrap-password`, reason: "controlled bootstrap after missing state", confirmation: "RESET_LIVING_BRIEF_GATE" }),
    });
    assert.equal(bootstrap.status, 200);
    const bootstrapped = await getLivingBriefGateCredential();
    await Promise.all([ensureLivingBriefGateSchema(), ensureLivingBriefGateSchema()]);
    const afterBootstrapRestart = await getLivingBriefGateCredential();
    assert.equal(afterBootstrapRestart?.version, bootstrapped?.version);
    assert.equal(afterBootstrapRestart?.password_hash, bootstrapped?.password_hash);
    const bootstrapLegacyAudit = await pool.query<{ count: string }>(`SELECT count(*)::text FROM living_brief_gate_audit WHERE action='legacy_migrated' AND actor_email='system'`);
    assert.equal(bootstrapLegacyAudit.rows[0]!.count, "0");
    check("fresh install bootstrap uses controlled Super Administrator path only");
    check("controlled bootstrap restart creates no legacy migration audit row");

    const responseText = JSON.stringify({ unlock, reset, concurrent, bootstrap });
    assert.doesNotMatch(responseText, /password_hash|postgres(?:ql)?:\/\/|JWT_SECRET|[A-Z]:\\|node_modules|\.git[\\/]|BEGIN RSA|PRIVATE KEY/i);
    check("API responses and evidence omit credentials internals and filesystem paths");
  } finally {
    server.close();
    await new Promise((resolve) => server.once("close", resolve));
    await pool.query(`DELETE FROM living_brief_gate_audit WHERE actor_email LIKE $1`, [`${marker}%`]);
    await pool.query(`DELETE FROM living_brief_gate_credentials WHERE credential_key='primary'`);
    await pool.query(`DELETE FROM platform_settings WHERE key='living_brief_password_hash'`);
    if (originalPlatform) {
      await pool.query(`INSERT INTO platform_settings (key,value) VALUES ('living_brief_password_hash',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`, [originalPlatform]);
    }
    if (originalGate) {
      await pool.query(
        `INSERT INTO living_brief_gate_credentials (credential_key,password_hash,version,created_by_user_id,updated_by_user_id,session_invalidated_at)
         VALUES ('primary',$1,$2,$3,$4,$5)
         ON CONFLICT (credential_key) DO UPDATE SET password_hash=EXCLUDED.password_hash, version=EXCLUDED.version, created_by_user_id=EXCLUDED.created_by_user_id, updated_by_user_id=EXCLUDED.updated_by_user_id, session_invalidated_at=EXCLUDED.session_invalidated_at`,
        [originalGate.password_hash, originalGate.version, originalGate.created_by_user_id, originalGate.updated_by_user_id, originalGate.session_invalidated_at],
      );
    }
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`${marker}%`]);
    await pool.query(`DELETE FROM companies WHERE name=$1`, [`${marker}-company`]);
    const remaining = await pool.query<{ count: string }>(
      `SELECT (
        (SELECT count(*) FROM users WHERE email LIKE $1) +
        (SELECT count(*) FROM companies WHERE name=$2) +
        (SELECT count(*) FROM living_brief_gate_audit WHERE actor_email LIKE $1)
      )::text AS count`,
      [`${marker}%`, `${marker}-company`],
    );
    assert.equal(remaining.rows[0]!.count, "0");
    await pool.end();
  }

  console.log(JSON.stringify({ suite: "living-brief-gate-disposable-runtime", database: { local: true, host: "127.0.0.1", port: 55432, name: "bimlog_rfi_test" }, passed: checks.length, checks }, null, 2));
}

await main();
process.exit(0);
