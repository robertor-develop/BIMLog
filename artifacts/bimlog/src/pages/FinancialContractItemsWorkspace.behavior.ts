import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./FinancialContractItemsWorkspace.tsx", import.meta.url), "utf8");
const register = readFileSync(new URL("./FinancialContractWorkspace.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

assert.match(app, /projects\/:id\/financial\/contracts\/:contractId\/items/);
assert.match(register, /View Contract Items/);
assert.match(register, /Ver Partidas de Contrato/);
assert.match(page, /api\/v1\/projects\/\$\{projectId\}\/financial\/contracts\/\$\{encodeURIComponent\(contractId\)\}/);
assert.match(page, /String\(body\.detail\.id\) !== contractId/);
assert.match(page, /No other contract was substituted/);
assert.match(page, /Contract Items table/);
assert.match(page, /Trade/);
assert.match(page, /Service/);
assert.match(page, /Quantity × Rate/);
assert.match(page, /APU snapshot/);
assert.match(page, /detail\.lines\.length === 0/);
assert.match(page, /role="alert"/);
assert.match(page, /@media\(max-width:720px\)/);

console.log(JSON.stringify({ suite: "lorena-contract-items-navigation", status: "passed", checks: 14 }, null, 2));
