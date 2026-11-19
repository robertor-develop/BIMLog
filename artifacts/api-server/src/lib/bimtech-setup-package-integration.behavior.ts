import assert from "node:assert/strict";
import fs from "node:fs";
const route=fs.readFileSync(new URL("../routes/bimtech-setup-packages.ts",import.meta.url),"utf8"),service=fs.readFileSync(new URL("./bimtech-setup-package-service.ts",import.meta.url),"utf8"),migration=fs.readFileSync(new URL("./bimtech-setup-package-migration.ts",import.meta.url),"utf8");
for(const token of ["preview","mappings","apply","requireProjectMember(...admins)"])assert.ok(route.includes(token),token);
for(const token of ["FOR UPDATE","source_export_id","content_sha256","BIMTECH_PACKAGE_REVISION_STALE","BIMTECH_PACKAGE_USER_MAPPING_REQUIRED","activationPerformed:false","initializeJobIntake"])assert.ok(service.includes(token),token);
for(const token of ["UNIQUE(project_id,content_sha256)","bimtech_setup_package_events","target_intake_id","CHECK(status IN('staged','mapped','applied','rejected'))"])assert.ok(migration.includes(token),token);
assert.doesNotMatch(service,/activateJobIntake/);assert.doesNotMatch(service,/DELETE FROM projects|UPDATE projects/);
console.log("BIMTECH_SETUP_PACKAGE_INTEGRATION=PASS additive=true activation=false");
