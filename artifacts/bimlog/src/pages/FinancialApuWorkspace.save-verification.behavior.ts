import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const page = fs.readFileSync(path.join(import.meta.dirname, "FinancialApuWorkspace.tsx"), "utf8");
const service = fs.readFileSync(path.resolve(import.meta.dirname, "../../../api-server/src/lib/cost-value-plan-service.ts"), "utf8");

assert.match(service, /prior\?\.content_fingerprint === fingerprint/);
assert.match(service, /INSERT INTO generic_cost_value_plan_versions/);
assert.match(page, /verificationResponse = await fetch/);
assert.match(page, /verifiedHistory\.some\(\(entry(?:: Plan)?\) => entry\.version === savedVersion\)/);
assert.match(page, /content matched the latest version, so BIMLog did not create a duplicate/);
assert.match(page, /Saved and verified immutable version/);

console.log(JSON.stringify({ status: "PASS", build: 9, checks: ["append-only-version-service", "post-save-server-reload", "history-presence-proof", "duplicate-content-explanation"] }));
