import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboard = await readFile(new URL("./Dashboard.tsx", import.meta.url), "utf8");

for (const group of ["active", "testing", "retired", "all"]) {
  assert.match(dashboard, new RegExp(`workspaceCounts\\[group\\]`));
  assert.match(dashboard, new RegExp(`value=\\"${group}\\"|group === \\"${group}\\"|\\[\\"active\\", \\"testing\\", \\"retired\\", \\"all\\"\\]`));
}
assert.match(dashboard, /bimlog:headquarters-project-view/);
assert.match(dashboard, /bimlog:preferred-test-project/);
assert.match(dashboard, /left\.id === preferredTestProjectId/);
assert.match(dashboard, /Do you need another project\?/);
assert.match(dashboard, /Open preferred test workspace/);
assert.match(dashboard, /Create a separate project/);
assert.match(dashboard, /role="dialog" aria-label=/);
console.log("PASS Headquarters lifecycle Block 3");
