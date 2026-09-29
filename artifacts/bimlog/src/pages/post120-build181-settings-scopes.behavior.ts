import assert from "node:assert/strict";
import { settingsDestinations } from "./settings-experience";
assert.deepEqual(settingsDestinations.map(item => item.scope), ["personal", "company", "platform"]);
assert.deepEqual(settingsDestinations.map(item => item.owner), ["You", "Company administrator", "Global administrator"]);
assert.equal(new Set(settingsDestinations.map(item => item.href)).size, 3);
console.log("post120 Build 181 settings scopes: PASS");
