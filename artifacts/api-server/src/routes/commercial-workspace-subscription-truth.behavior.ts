import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("./commercial-workspace.ts",import.meta.url),"utf8");
assert.match(source,/readPersistentCommercialAuthority\(pool,company\.id\)/);
assert.match(source,/rawStatus===undefined\?"not_configured":rawStatus/);
assert.match(source,/catalogConfigured:platform\.subscriptionConfigured/);
assert.doesNotMatch(source,/subscriptionStatus:platform\.subscriptionConfigured/);
console.log("B287 workspace reports company subscription authority separately from catalog readiness: PASS");
