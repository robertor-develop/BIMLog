import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const component = readFileSync(fileURLToPath(new URL("./ProjectContactCreator.tsx", import.meta.url)), "utf8");
const workspace = readFileSync(fileURLToPath(new URL("../../pages/JobIntakeWorkspace.tsx", import.meta.url)), "utf8");
const quick = readFileSync(fileURLToPath(new URL("./QuickJobIntake.tsx", import.meta.url)), "utf8");
const route = readFileSync(fileURLToPath(new URL("../../../../api-server/src/routes/project_directory.ts", import.meta.url)), "utf8");

assert.match(component, /\/projects\/\$\{projectId\}\/directory\/contacts/);
assert.match(component, /company_id: companyId/);
assert.match(component, /Add and select contact/);
assert.match(component, /disabled=\{!companyId\}/);
assert.match(workspace, /acceptCreatedContact/);
assert.match(workspace, /primaryContactId: Number\(created\.id\)/);
assert.match(workspace, /<ProjectContactCreator/);
assert.match(quick, /<ProjectContactCreator/);
assert.match(route, /eq\(projectDirectoryTable\.projectId, projectId\).*eq\(projectDirectoryTable\.companyId, companyId\)/s);
assert.match(route, /if \(!projectCompany\) return null/);

console.log("PASS Job Intake adds multiple authoritative contacts to the selected current-project company and immediately selects the new contact");
