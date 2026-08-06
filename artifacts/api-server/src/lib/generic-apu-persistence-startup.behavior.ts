import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../app.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(
  new URL("./generic-apu-persistence-migration.ts", import.meta.url),
  "utf8",
);

let checks = 0;
const check = (condition: unknown, message: string) => {
  assert.ok(condition, message);
  checks += 1;
};

const importMatch = appSource.match(
  /import\s*\{([\s\S]*?)\}\s*from\s*["']\.\/lib\/generic-apu-persistence-migration["'];/,
);
check(importMatch, "app.ts must import the accepted Generic APU migration module");
check(
  /\bstartGenericApuPersistenceMigration\b/.test(importMatch?.[1] ?? ""),
  "app.ts must import the migration start function",
);
check(
  /\bwaitForGenericApuPersistenceMigration\b/.test(importMatch?.[1] ?? ""),
  "app.ts must import the migration readiness function",
);

const startupMatch = appSource.match(
  /\(async\s*\(\)\s*=>\s*\{\s*try\s*\{([\s\S]*?startGenericApuPersistenceMigration\(\);[\s\S]*?waitForGenericApuPersistenceMigration\(\);[\s\S]*?)\}\s*catch\s*\(\s*error\s*\)\s*\{([\s\S]*?Generic APU persistence migration failed[\s\S]*?)\}\s*\}\)\(\);/,
);
check(startupMatch, "app.ts must register one explicit Generic APU startup boundary");

const startupBody = startupMatch?.[1] ?? "";
const failureBody = startupMatch?.[2] ?? "";
const startOffset = startupBody.indexOf("startGenericApuPersistenceMigration();");
const waitOffset = startupBody.indexOf(
  "await waitForGenericApuPersistenceMigration();",
);
const readyOffset = startupBody.indexOf(
  'console.log("[migration] Generic APU persistence tables ensured")',
);
check(startOffset >= 0, "startup must begin the accepted migration");
check(waitOffset > startOffset, "startup must wait only after starting migration");
check(readyOffset > waitOffset, "readiness must be logged only after migration wait");
check(
  /console\.error\([\s\S]*Generic APU persistence migration failed[\s\S]*error[\s\S]*\)/.test(
    failureBody,
  ),
  "startup failure must be logged with its original error",
);
check(
  /\bthrow\s+error\s*;/.test(failureBody),
  "startup migration failures must be rethrown rather than swallowed",
);

const routeRegistration = appSource.indexOf('app.use("/api/v1", router);');
const startupRegistration = appSource.indexOf("startGenericApuPersistenceMigration();");
const featureCatalogRegistration = appSource.indexOf(
  "await startFeatureCatalogMigration();",
);
check(
  routeRegistration >= 0 && routeRegistration < startupRegistration,
  "Generic APU registration must retain the established post-router startup position",
);
check(
  featureCatalogRegistration > startupRegistration,
  "Generic APU startup must retain its declared ordering before feature catalog startup",
);

check(
  /let\s+ready:\s*Promise<void>\s*\|\s*null\s*=\s*null;/.test(migrationSource) &&
    /return\s+ready\s*\?\?\s*\(ready\s*=\s*ensureGenericApuPersistenceSchema\(\)\);/.test(
      migrationSource,
    ),
  "accepted migration start must remain process-idempotent",
);
check(
  /export\s+async\s+function\s+waitForGenericApuPersistenceMigration\(\):\s*Promise<void>\s*\{\s*await\s+startGenericApuPersistenceMigration\(\);\s*\}/.test(
    migrationSource,
  ),
  "accepted readiness function must await the same migration promise",
);

console.log(
  JSON.stringify({
    suite: "generic-apu-persistence-startup-registration",
    status: "PASS",
    checks,
    networkConnections: 0,
    databaseMutations: 0,
    inspected: [
      "artifacts/api-server/src/app.ts",
      "artifacts/api-server/src/lib/generic-apu-persistence-migration.ts",
    ],
  }),
);
