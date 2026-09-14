import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.resolve(here, "../routes/master-catalogs.ts"), "utf8");
assert.match(route, /router\.get\("\/master-catalogs\/:catalog", authMiddleware/);
assert.match(route, /router\.post\("\/admin\/master-catalogs\/:catalog", authMiddleware, isSuperAdminMiddleware/);
assert.match(route, /router\.patch\("\/admin\/master-catalogs\/:catalog\/:id", authMiddleware, isSuperAdminMiddleware/);
assert.match(route, /MASTER_CATALOG_VERSION_CONFLICT/);
assert.match(route, /retiredAt: state === "retired" \? new Date\(\) : null/);
assert.doesNotMatch(route, /delete\(/i);
console.log("PMO master catalog route authority: PASS");
