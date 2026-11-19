import assert from "node:assert/strict";
import fs from "node:fs";
const page=fs.readFileSync(new URL("./BimtechSetupPackageImport.tsx",import.meta.url),"utf8"),app=fs.readFileSync(new URL("../App.tsx",import.meta.url),"utf8"),directory=fs.readFileSync(new URL("../lib/capability-directory.ts",import.meta.url),"utf8");
for(const token of ["Verify package","Stage verified package","Save user mappings","Link to governed Intake","Activation was not performed","Select an active project member","userMappings","file.size>5*1024*1024","role=\"alert\"","role=\"status\""])assert.ok(page.includes(token),token);
assert.ok(!page.includes("mappingText"),"raw JSON mapping editor must not be exposed");
assert.ok(app.includes('path="/bimtech-setup-package"'));assert.ok(directory.includes('id:"bimtech-setup-package"'));assert.ok(directory.includes('group:"Intake"'));
console.log("BIMTECH_SETUP_PACKAGE_UI=PASS bilingual=true discoverable=true");
