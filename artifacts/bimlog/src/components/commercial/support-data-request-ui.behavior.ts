import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("./SupportCasesPanel.tsx",import.meta.url),"utf8");
for(const token of ["Data request type","Tipo de solicitud de datos","Export my data","Correct my data","Request deletion review","Restrict data processing","A deletion request starts a review","Una solicitud de eliminación inicia una revisión","dataRequestKind"] )assert.ok(source.includes(token),token);
assert.ok(source.includes('categoryValue==="data"'));
assert.ok(source.includes('item.dataRequestKind?'));
console.log("LR085 bilingual customer data-right request workspace: PASS");
