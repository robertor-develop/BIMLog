import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../app.ts", import.meta.url), "utf8");

let checks = 0;
const check = (condition: unknown, message: string) => {
  assert.ok(condition, message);
  checks += 1;
};

check(
  /let\s+databaseStartupTail:\s*Promise<void>\s*=\s*Promise\.resolve\(\);/.test(
    appSource,
  ),
  "database startup must begin with one resolved queue tail",
);
check(
  /function\s+queueDatabaseStartup<T>\(task:\s*\(\)\s*=>\s*Promise<T>\):\s*Promise<T>\s*\{[\s\S]*?databaseStartupTail\.then\(task\)[\s\S]*?databaseStartupTail\s*=\s*queued\.then\(/.test(
    appSource,
  ),
  "each startup task must be chained from the prior queue tail",
);
check(
  /if\s*\(!databaseStartupFailed\)\s*databaseStartupFailure\s*=\s*error;[\s\S]*?databaseStartupFailed\s*=\s*true;/.test(
    appSource,
  ),
  "the queue must retain the first startup failure",
);
check(
  /async\s+function\s+waitForDatabaseStartup\(\):\s*Promise<void>[\s\S]*?await\s+databaseStartupTail;[\s\S]*?if\s*\(databaseStartupFailed\)\s*throw\s+databaseStartupFailure;/.test(
    appSource,
  ),
  "readiness must wait for the queue and surface its retained failure",
);
check(
  /export\s+const\s+startupBarrier\s*=\s*Promise\.all\(\[\s*waitForDatabaseStartup\(\),/.test(
    appSource,
  ),
  "the exported startup barrier must include the complete database queue",
);
check(
  !/^\s*\(async\s*\(\)\s*=>/m.test(appSource) &&
    !/^\s*const\s+\w+StartupBarrier\s*=\s*\(async\s*\(\)\s*=>/m.test(appSource),
  "database startup must not retain unqueued top-level async IIFEs",
);

const queueRegistrations =
  appSource.match(/queueDatabaseStartup\(/g)?.length ?? 0;
check(
  queueRegistrations >= 23,
  "all established database startup registrations must remain queued",
);

console.log(
  JSON.stringify({
    suite: "database-startup-serialization",
    status: "PASS",
    checks,
    queueRegistrations,
    networkConnections: 0,
    databaseMutations: 0,
    inspected: ["artifacts/api-server/src/app.ts"],
  }),
);
