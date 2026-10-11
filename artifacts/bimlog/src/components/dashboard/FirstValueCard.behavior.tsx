import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("./FirstValueCard.tsx",import.meta.url),"utf8");
assert.match(source,/Create a controlled RFI/);
assert.match(source,/Create a controlled Submittal/);
assert.match(source,/Add a governed project file/);
assert.match(source,/PRIMER RESULTADO CONTROLADO/);
assert.match(source,/aria-labelledby="first-value-title"/);
console.log("Simplification and guided adoption build 018 first-value card: PASS");
