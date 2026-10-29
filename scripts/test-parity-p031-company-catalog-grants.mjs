import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const component = read("artifacts/bimlog/src/components/admin/CompanyMasterCatalogsTab.tsx");
const routes = read("artifacts/api-server/src/routes/company-master-catalogs.ts");

assert.match(component, /request\(`\/admin\/company-master-catalog-grants\/\$\{cap\.companyId\}`\)/);
assert.match(component, /Company PMO authority/);
assert.match(component, /No Company PMO grants are recorded/);
assert.match(component, /Grant history could not be loaded/);
assert.match(component, /request\(`\/admin\/company-master-catalog-grants\/\$\{id\}\/revoke`/);
assert.match(component, /item\.state === "active"/);
assert.match(component, /disabled=\{busy \|\| !grantEmail\.includes\("@"\) \|\| Boolean\(grantsError\)\}/);
assert.match(routes, /router\.get\("\/admin\/company-master-catalog-grants\/:companyId", authMiddleware, isSuperAdminMiddleware/);
assert.match(routes, /WHERE a\.company_id=\$1/);
assert.match(routes, /router\.post\("\/admin\/company-master-catalog-grants\/:id\/revoke", authMiddleware, isSuperAdminMiddleware/);

console.log("P031 company catalog grant parity checks passed");
