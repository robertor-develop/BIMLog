import assert from "node:assert/strict";
import { BIMLOG_BRAND, brandLabel } from "./brand-positioning";

assert.equal(BIMLOG_BRAND.product, "BIMLog");
assert.equal(BIMLOG_BRAND.parent, "IgniteSmart");
assert.match(brandLabel("en"), /job intake through coordinated delivery/i);
assert.match(brandLabel("es"), /ingreso del trabajo/i);
console.log("brand positioning behavior: PASS");
