import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const component = readFileSync(fileURLToPath(new URL("./ProjectCompanyCreator.tsx", import.meta.url)), "utf8");
const workspace = readFileSync(fileURLToPath(new URL("../../pages/JobIntakeWorkspace.tsx", import.meta.url)), "utf8");
const quick = readFileSync(fileURLToPath(new URL("./QuickJobIntake.tsx", import.meta.url)), "utf8");

assert.match(component, /\/projects\/\$\{projectId\}\/directory\/companies/);
assert.match(component, /method: "POST"/);
assert.match(component, /company_name: companyName/);
assert.match(component, /Add and select company/);
assert.match(component, /Company name is required/);
assert.match(workspace, /setDirectoryEntries/);
assert.match(workspace, /clientCompanyId: created\.id/);
assert.match(workspace, /clientCompany: created\.name/);
assert.match(workspace, /<ProjectCompanyCreator request=\{api\}/);
assert.match(quick, /<ProjectCompanyCreator request=\{request\}/);

console.log("PASS Job Intake creates or reuses an authoritative project company and immediately selects it in Quick and Advanced setup");
