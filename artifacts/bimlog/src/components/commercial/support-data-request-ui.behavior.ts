import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("./SupportCasesPanel.tsx",import.meta.url),"utf8");
for(const token of ["Data type","Tipo de solicitud","Export data","Correct data","Deletion review","Restrict processing","Deletion requires review","La eliminación requiere revisión","dataRequestKind"] )assert.ok(source.includes(token),token);
assert.ok(source.includes('categoryValue==="data"'));
assert.ok(source.includes('item.dataRequestKind?'));
console.log("LR085 bilingual customer data-right request workspace: PASS");
