import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");
assert.match(source, /assignedItemDestination\(item\)/);
assert.match(source, /return href \? \[\{ kind: item\.kind/);
assert.doesNotMatch(source, /assigned\.map\(item => \(\{[\s\S]*?href: `\/projects\/\$\{item\.projectId\}/);
assert.match(source, /chooseRoleAwareTodayAction/);
console.log("Simplification and guided adoption build 039 exact Today record navigation: PASS");
