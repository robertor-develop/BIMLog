import assert from "node:assert/strict";import fs from "node:fs";
const source=fs.readFileSync(new URL("./SalesInquiryQueue.tsx",import.meta.url),"utf8");
assert.match(source,/parseSalesInquiryList/);assert.match(source,/params\.set\("status",status\)/);assert.match(source,/role="alert"/);assert.match(source,/overflowX:"auto"/);assert.match(source,/No inquiries match the filters/);
assert.match(source,/role="dialog"/);assert.match(source,/aria-modal="true"/);assert.match(source,/whiteSpace:"pre-wrap"/);assert.match(source,/overflowWrap:"anywhere"/);
assert.match(source,/expectedStatus:selected\.status/);assert.match(source,/response\.status===409/);assert.match(source,/nextStatuses\[selected\.status\]/);assert.match(source,/disabled=\{updating\}/);
assert.match(source,/Consultas comerciales/);assert.match(source,/Ninguna consulta coincide/);assert.match(source,/width:"min\(680px,100%\)"/);
assert.match(source,/new URLSearchParams/);assert.match(source,/role="search"/);assert.match(source,/setOffset\(0\)/);assert.match(source,/copy\.pages/);assert.match(source,/offset\+items\.length>=total/);
for(const phrase of ["Buscar por contacto","Reintentar","Anterior","Siguiente","No se pudieron cargar","Nueva","Calificada","Cerrada"])assert.match(source,new RegExp(phrase));
console.log("B109 bilingual searchable sales inquiry operations: PASS");
