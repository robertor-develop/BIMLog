import assert from "node:assert/strict";
import fs from "node:fs";
import { governedCorsOptions, productionOrigins, resolveSessionSecret, securityHeaders } from "./runtime-security";

const env = { BIMLOG_PUBLIC_URL: "https://bimlog.example.test", REPLIT_DOMAINS: "workspace.example.test", SESSION_SECRET: "s".repeat(32) };
assert.deepEqual([...productionOrigins(env)], ["https://bimlog.example.test", "https://workspace.example.test"]);
assert.equal(resolveSessionSecret(env), "s".repeat(32));
assert.throws(() => resolveSessionSecret({ NODE_ENV: "production" }), /SESSION_SECRET_REQUIRED/);

const cors = governedCorsOptions(env);
const decide = (origin: string | undefined) => new Promise<{ error: Error | null; allow?: boolean }>((resolve) => {
  (cors.origin as Function)(origin, (error: Error | null, allow?: boolean) => resolve({ error, allow }));
});
assert.equal((await decide(undefined)).allow, true);
assert.equal((await decide("https://bimlog.example.test")).allow, true);
assert.match((await decide("https://attacker.example")).error?.message ?? "", /CORS_ORIGIN_DENIED/);

const headers = new Map<string, string>();
securityHeaders({} as never, { setHeader: (name: string, value: string) => headers.set(name, value) } as never, () => undefined);
for (const name of ["Content-Security-Policy", "Referrer-Policy", "X-Content-Type-Options", "X-Frame-Options", "Permissions-Policy"]) assert.ok(headers.has(name), name);

const app = fs.readFileSync(new URL("../app.ts", import.meta.url), "utf8");
assert.doesNotMatch(app, /app\.use\(cors\(\)\)/);
assert.doesNotMatch(app, /dbHost:\s*DB_HOST|dbName:\s*DB_NAME/);
assert.doesNotMatch(app, /process\.env\.SESSION_SECRET \|\| "bimlog-aps-session-secret"/);
const diagnostics = fs.readFileSync(new URL("../middlewares/request-diagnostics.ts", import.meta.url), "utf8");
assert.doesNotMatch(diagnostics, /authorization|cookie|password|request\.body|request\.query/i);
const multipart = fs.readFileSync(new URL("../middlewares/multipart.ts", import.meta.url), "utf8");
assert.match(multipart, /fileSize/);

console.log("block22 build107 runtime security: PASS cors=governed headers=5 session_secret=fail_closed env_probe=redacted diagnostics=redacted uploads=bounded");
