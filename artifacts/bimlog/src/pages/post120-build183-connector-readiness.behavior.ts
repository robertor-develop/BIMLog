import assert from "node:assert/strict";
import { connectorReadinessCopy } from "./settings-experience";
assert.deepEqual(connectorReadinessCopy("ready"), { label: "Ready", action: "Use connector", detail: "Connection and required permission are verified." });
assert.match(connectorReadinessCopy("setup_required").detail, /administrator must configure/);
assert.equal(connectorReadinessCopy("permission_required").action, "Contact administrator");
assert.match(connectorReadinessCopy("error").detail, /No external request was sent/);
console.log("post120 Build 183 connector readiness: PASS");
