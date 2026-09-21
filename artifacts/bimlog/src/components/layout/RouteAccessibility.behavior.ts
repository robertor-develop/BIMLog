import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./RouteAccessibility.tsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");
const expected = [
  "/dashboard", "/pending", "/lens-next", "/help", "/profile", "/admin",
  "/company-catalogs", "/company-workflows", "/company-workflow-governance",
  "/company-pricing-templates", "/total-control", "/living-brief",
  "/knowledge",
];

for (const route of expected) assert.ok(source.includes(`"${route}"`), `missing title contract for ${route}`);
assert.match(source, /document\.title = `\$\{title\} \| BIMLog`/);
assert.match(source, /requestAnimationFrame\(\(\) => document\.getElementById\("main-content"\)\?\.focus\(\{ preventScroll: true \}\)\)/);
assert.match(app, /<RouteAccessibility \/>/);
assert.match(app, /<main id="main-content" tabIndex=\{-1\}/);
assert.match(app, /className="skip-to-main" href="#main-content"/);

console.log(JSON.stringify({ status: "PASS", routes: expected.length, title: true, focus: true, skipLink: true }));
