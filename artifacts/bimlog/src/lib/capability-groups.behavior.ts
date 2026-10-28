import assert from "node:assert/strict";
import fs from "node:fs";
import { capabilityDirectory, capabilityGroups } from "./capability-directory";

assert.deepEqual(capabilityGroups.map(group => group.id), ["Home", "Intake", "Operations", "Documents", "Coordination", "Reports", "Administration", "Settings"]);
assert.equal(new Set(capabilityGroups.map(group => group.id)).size, capabilityGroups.length);
assert.ok(capabilityGroups.every(group => group.label.en && group.label.es && group.description.en && group.description.es));
assert.ok(capabilityDirectory.every(entry => capabilityGroups.some(group => group.id === entry.group)));
assert.ok(!capabilityGroups.some(group => /^(more|advanced)$/i.test(group.label.en)));

const source = fs.readFileSync(new URL("../pages/AllTools.tsx", import.meta.url), "utf8");
assert.match(source, /capabilityGroups\.filter\(group => entries\.some/);
assert.match(source, /group\.description\[lang\]/);
assert.match(source, /entries\.filter\(entry => entry\.group === group\.id\)/);
console.log(`STABLE_CAPABILITY_GROUPS_P012=PASS groups=${capabilityGroups.length} capabilities=${capabilityDirectory.length}`);
