import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("./FirstValueSuccessCard.tsx",import.meta.url),"utf8");
for(const token of ["FIRST RESULT ACHIEVED","PRIMER RESULTADO LOGRADO","project memory","memoria del proyecto","evidence.projectCode","evidence.label","View result","Ver resultado","aria-labelledby"]) assert.ok(source.includes(token),token);
assert.ok(!source.includes("celebrat"));
console.log("Simplification and guided adoption build 024 first-value reinforcement card: PASS");
