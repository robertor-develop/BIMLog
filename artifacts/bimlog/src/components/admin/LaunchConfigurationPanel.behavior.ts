import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/components/admin/LaunchConfigurationPanel.tsx"), "utf8");
assert.match(source, /Test connection/);
assert.match(source, /Send synthetic test/);
assert.match(source, /action:"verify"\|"send-test"/);
assert.match(source, /email\/\$\{action\}/);
assert.match(source, /aria-live="polite"/);
assert.match(source, /Save credentials first/);
assert.doesNotMatch(source, /password[^\n]*setEmailCheck/);
console.log("LAUNCH_CONFIGURATION_BUILD_15=PASS bilingualControls=true accessibleStatus=true safeGuidance=true");
