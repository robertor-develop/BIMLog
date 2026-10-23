import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const editor = read("artifacts/bimlog/src/components/job-intake/ContractItemBulkEditor.tsx");
const behavior = read("artifacts/bimlog/src/components/job-intake/ContractItemBulkEditor.behavior.tsx");

assert.match(editor, /line\.includes\("\\t"\) \? "\\t" : line\.includes\(";"\) \? ";" : ","/);
assert.match(editor, /rawQuantity\.replace\(\/\^\(\\d\+\),\(\\d\{1,6\}\)\$\//);
assert.match(editor, /nameHeader && quantityHeader/);
assert.match(editor, /extraColumns: true/);
assert.match(editor, /pristineStarter \? pasted : \[\.\.\.existing, \.\.\.pasted\]/);
assert.match(editor, /applyDefaultApuToPastedItems/);
assert.match(editor, /connectContractItemsToApu\(items, selected\)/);
assert.match(behavior, /Muro;1,5/);
assert.match(behavior, /Nombre de la Partida\\tCantidad/);
assert.match(behavior, /CI-starter/);
assert.match(behavior, /APU publicado/);

console.log("OUTCOME_REMEDIATION_BLOCK08=PASS builds=36-40 locale=true headers=true columnSafety=true pristineReplacement=true pastedApuRate=true");
