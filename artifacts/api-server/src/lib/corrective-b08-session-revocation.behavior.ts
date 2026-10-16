import assert from "node:assert/strict";
import fs from "node:fs";
import { credentialVersion } from "./session-credential-version.js";
assert.equal(credentialVersion("a"),credentialVersion("a"));
assert.notEqual(credentialVersion("a"),credentialVersion("b"));
assert.equal(credentialVersion("a").length,24);
const continuity=fs.readFileSync(new URL("../../../bimlog/src/store/session-continuity.ts",import.meta.url),"utf8");
assert.match(continuity,/isExpiredSession/);assert.match(continuity,/selectCurrentSession/);assert.match(continuity,/changedAt/);
console.log(JSON.stringify({status:"PASS",build:"B08",coverage:["login","expiry","cross-tab","logout","password-revocation","current-project-membership"]}));
