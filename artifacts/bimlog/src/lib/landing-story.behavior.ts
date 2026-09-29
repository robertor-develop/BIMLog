import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const page = readFileSync(new URL("../pages/Landing.tsx", import.meta.url), "utf8");
assert.match(page, /user \? "\/dashboard" : "\/register"/);
assert.match(page, /Actual product screen/);
for (const file of ["project-dashboard.png", "project-controls.png"]) {
  assert.equal(existsSync(new URL(`../../public/images/product-proof/${file}`, import.meta.url)), true);
}
console.log("landing story behavior: PASS");
