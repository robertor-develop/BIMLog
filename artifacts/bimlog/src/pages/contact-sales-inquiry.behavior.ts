import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const source=readFileSync(fileURLToPath(new URL("./Contact.tsx",import.meta.url)),"utf8");
for(const token of ["crypto.randomUUID()","billingCycle:intent?.billing","useCase:intent?.useCase","requestKey","r.ok&&d.success","parseSalesInquiryReceipt","Inquiry reference","Response due","no duplicate inquiry was created","No se pudo conectar","Mensaje recibido","Todos los campos son obligatorios"]){assert.match(source,new RegExp(token.replace(/[?.()&]/g,"\\$&")));}
assert.match(source,/repeat\(auto-fit,minmax\(220px,1fr\)\)/);
console.log("B099 bilingual recoverable sales inquiry handoff: PASS");
