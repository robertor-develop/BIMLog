import assert from "node:assert/strict";
import fs from "node:fs";

const ui = fs.readFileSync(new URL("../../../bimlog/src/pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
assert.match(ui, /api\(`\/projects\/\$\{projectId\}\/directory`\)/);
assert.match(ui, /clientCompanyId: selected\?\.id \?\? null/);
assert.match(ui, /contactBelongsToCompany/);
assert.match(ui, /primaryContactId: contactStillBelongs \? old\.identity\.primaryContactId : null/);
assert.match(service, /JOB_INTAKE_CLIENT_COMPANY_OUT_OF_SCOPE/);
assert.match(service, /JOB_INTAKE_PRIMARY_CONTACT_OUT_OF_SCOPE/);
assert.match(service, /Number\(contact\.companyId\) !== companyId/);
console.log("POST-P17 Build 11 project-company/contact authority: PASS");
