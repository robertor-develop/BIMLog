import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("./CommercialLaunchPanel.tsx",import.meta.url),"utf8");
assert.match(source,/\/admin\/commercial-launch\/authorization/);
assert.match(source,/parseCommercialLaunchAuthorization/);
assert.match(source,/Commercial launch currently authorized/);
assert.match(source,/Commercial launch is not currently authorized/);
assert.match(source,/authorization\.receipt\?\.id===item\.id/);
assert.match(source,/Historical verification/);
console.log("B279 current versus historical commercial verification UI: PASS");
