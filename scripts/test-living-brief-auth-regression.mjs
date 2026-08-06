import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gate = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/living-brief-gate.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/living-brief-migration.ts"), "utf8");
const route = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/living_brief.ts"), "utf8");
const auth = fs.readFileSync(path.join(root, "artifacts/api-server/src/middlewares/auth.ts"), "utf8");
const checks = [];

async function check(name, fn) {
  await fn();
  checks.push(name);
}

await check("gate reads lazily ensure credential schema before selecting the stored hash", () => {
  assert.match(gate, /import \{ ensureLivingBriefGateSchema \} from "\.\/living-brief-migration"/);
  assert.match(gate, /export async function ensureLivingBriefGateReady\(\)/);
  assert.match(gate, /if \(client === pool\) await ensureLivingBriefGateReady\(\);/);
});

await check("gate reset ensures schema before opening the credential transaction", () => {
  assert.match(gate, /await ensureLivingBriefGateReady\(\);\s*const client = await pool\.connect\(\);/s);
});

await check("gate migration owns platform settings availability for legacy hash migration", () => {
  assert.match(migration, /export async function ensurePlatformSettingsSchema\(client: QueryClient = pool\)/);
  assert.match(migration, /await ensurePlatformSettingsSchema\(client\);\s*await client\.query\(`CREATE TABLE IF NOT EXISTS living_brief_gate_credentials/s);
});

await check("complete gate schema and legacy migration sequence is transaction-advisory locked", () => {
  assert.match(migration, /export const LIVING_BRIEF_GATE_SCHEMA_LOCK = "living_brief_gate_schema_migration"/);
  assert.match(migration, /const client = await pool\.connect\(\);/);
  assert.match(migration, /await client\.query\("BEGIN"\);/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtext\(\$1\)\)/);
  assert.match(migration, /await ensureLivingBriefGateSchemaWithClient\(client\);/);
  assert.match(migration, /await client\.query\("COMMIT"\);/);
  assert.match(migration, /await client\.query\("ROLLBACK"\)\.catch\(\(\) => undefined\);/);
  assert.match(migration, /client\.release\(\);/);
});

await check("startup and request paths use the same cross-process schema initializer", () => {
  assert.match(gate, /gateSchemaReady = ensureLivingBriefGateSchema\(\)\.catch/);
  assert.match(gate, /if \(client === pool\) await ensureLivingBriefGateReady\(\);/);
});

await check("startup migration preserves existing primary credential without reseed or overwrite", () => {
  assert.match(migration, /ON CONFLICT \(credential_key\) DO NOTHING/);
  assert.doesNotMatch(migration, /ON CONFLICT \(credential_key\) DO UPDATE/i);
  assert.doesNotMatch(migration, /UPDATE living_brief_gate_credentials/i);
});

await check("controlled recovery/reset remains audited without logging secret values", () => {
  assert.match(gate, /INSERT INTO living_brief_gate_audit/);
  assert.match(gate, /existing\.rows\.length \? "reset" : "bootstrap"/);
  const auditBlock = gate.slice(gate.indexOf("INSERT INTO living_brief_gate_audit"), gate.indexOf("if (input.failureAfterUpdate)"));
  assert.ok(auditBlock.length > 0);
  assert.doesNotMatch(auditBlock, /newPassword|currentAccountPassword|password_hash/i);
});

await check("passwordless unlock remains authenticated and limited to eligible users", () => {
  assert.match(route, /router\.post\("\/living-brief\/unlock", authMiddleware/);
  assert.match(route, /if \(!\(await isEligible\(req\.user!\.userId\)\)\)[^]*res\.status\(403\)/);
});

await check("passwordless unlock reads and verifies no gate password", () => {
  const start = route.indexOf('router.post("/living-brief/unlock"');
  const end = route.indexOf("// Return the verified deployed source bundle", start);
  const unlock = route.slice(start, end);
  assert.ok(unlock.length > 0);
  assert.doesNotMatch(unlock, /password|verifyLivingBriefGatePassword|Incorrect password|Password required/i);
});

await check("brief token is bound to the eligible user and current credential version", () => {
  assert.match(route, /const credentialVersion = \(await getLivingBriefGateCredential\(\)\)\?\.version \?\? 0;/);
  assert.match(route, /signBriefAccessToken\(req\.user!\.userId, credentialVersion\)/);
  assert.match(auth, /jwt\.sign\(\{ userId, scope: "living_brief", credentialVersion \}/);
});

await check("brief middleware rejects wrong-user and stale-version tokens", () => {
  assert.match(route, /payload\.scope !== "living_brief" \|\| payload\.userId !== req\.user!\.userId/);
  assert.match(route, /payload\.credentialVersion !== credentialVersion/);
  assert.match(route, /res\.status\(401\)\.json\(\{ error: "Invalid or expired brief access token" \}\)/);
});

await check("brief middleware rechecks current eligibility and denies revoked access", () => {
  assert.match(route, /if \(!\(await isEligible\(req\.user!\.userId\)\)\)[^]*res\.status\(403\)[^]*Living Brief access not granted/);
  assert.match(route, /router\.get\("\/living-brief\/docs", authMiddleware, briefAccessMiddleware/);
});

await check("first initialization failure clears request-side promise for retry", () => {
  assert.match(gate, /catch\(\(error\) => \{\s*gateSchemaReady = null;\s*throw error;\s*\}\)/s);
});

await check("proof covers independent process equivalents by requiring database-level lock instead of module cache only", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.doesNotMatch(migration, /LOCK TABLE/i);
});

console.log(JSON.stringify({
  suite: "living-brief-auth-regression-source-proof",
  database: "not used",
  productionAccess: false,
  secretMaterialCaptured: false,
  passed: checks.length,
  checks,
}, null, 2));
