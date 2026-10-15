import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const run = file => {
  const result = spawnSync(process.execPath, ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run("artifacts/bimlog/src/lib/company-catalog-guidance.behavior.ts");
run("artifacts/bimlog/src/components/admin/CompanyMasterCatalogsTab.authorities.behavior.tsx");

const source = fs.readFileSync(new URL("../artifacts/bimlog/src/components/admin/CompanyMasterCatalogsTab.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../artifacts/bimlog/src/index.css", import.meta.url), "utf8");
for (const [name, pattern] of [
  ["catalog sections are explicit", /Company catalog sections/],
  ["catalog values are searchable", /Search code, name, or alias/],
  ["catalog values filter by lifecycle state", /All states/],
  ["empty filter results are announced", /No company values match these filters/],
  ["draft validation is associated with fields", /aria-describedby=\{`catalog-\$\{kind\}-draft-guidance`\}/],
  ["related authorities are linked", /Where related setup belongs/],
]) assert.match(source, pattern, name);
assert.match(styles, /\.company-catalog-workspace button,[\s\S]*min-height: 44px/, "interactive controls preserve touch sizing");
assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.company-catalog-kind-nav[\s\S]*grid-template-columns: minmax\(0, 1fr\) !important/, "catalog navigation stacks on narrow screens");
assert.match(styles, /\.company-catalog-workspace :focus-visible/, "catalog controls expose keyboard focus");
console.log("Gauntlet company catalogs Block 19: PASS");
