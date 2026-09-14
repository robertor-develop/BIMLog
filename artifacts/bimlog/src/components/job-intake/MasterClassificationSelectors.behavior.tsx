import assert from "node:assert/strict";
import fs from "node:fs";
const component = fs.readFileSync(new URL("./MasterClassificationSelectors.tsx", import.meta.url), "utf8");
const quick = fs.readFileSync(new URL("./QuickJobIntake.tsx", import.meta.url), "utf8");
for (const kind of ["disciplines", "services", "phases"]) assert.match(component, new RegExp(`"${kind}"`));
assert.match(component, /classification/);
assert.doesNotMatch(component, /<input/);
assert.match(quick, /<MasterClassificationSelectors data=\{data\}/);
console.log("master project classification selectors: PASS");
