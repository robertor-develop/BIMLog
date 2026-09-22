import assert from "node:assert/strict";
import fs from "node:fs";

const context = fs.readFileSync(new URL("./edt-engine-route-context.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../routes/edt-engine.ts", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../routes/index.ts", import.meta.url), "utf8");

assert.match(context, /pm\.status='active'/);
assert.match(context, /company_master_catalog_admins/);
assert.match(context, /Number\(row\.company_id\) !== Number\(req\.user\.companyId\)/);
assert.doesNotMatch(context, /req\.body.*eligibleRole|req\.headers.*role/);
assert.match(route, /capabilities", authMiddleware/);
assert.match(index, /router\.use\(edtEngineRouter\)/);
console.log("EDT_ENGINE_BUILD296_RESULT=PASS");
console.log("SERVER_RESOLVED_ROLE_AUTHORITY=PASS");
