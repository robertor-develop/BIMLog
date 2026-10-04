import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("./CommercialLaunchPanel.tsx",import.meta.url),"utf8");
assert.match(source,/\/admin\/commercial-launch\/verifications/);
assert.match(source,/parseCommercialVerificationHistory/);
assert.match(source,/Verification history/);
assert.match(source,/Historial de verificaciones/);
assert.match(source,/No durable verification receipts recorded yet/);
assert.match(source,/item\.sourceCommit\.slice\(0,12\)/);
assert.match(source,/item\.evidenceSha256\.slice\(0,12\)/);
console.log("B274 bilingual commercial verification history panel: PASS");
