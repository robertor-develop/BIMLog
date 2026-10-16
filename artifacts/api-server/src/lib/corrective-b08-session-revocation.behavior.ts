import assert from "node:assert/strict";
import { credentialVersion } from "./session-credential-version.js";
assert.equal(credentialVersion("a"),credentialVersion("a"));
assert.notEqual(credentialVersion("a"),credentialVersion("b"));
assert.equal(credentialVersion("a").length,24);
await import("../../../bimlog/src/store/session-continuity.behavior.js");
console.log(JSON.stringify({status:"PASS",build:"B08",coverage:["login","expiry","cross-tab","logout","password-revocation","current-project-membership"]}));
