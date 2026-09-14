import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(import.meta.dirname, "JobOperationsWorkspace.tsx"), "utf8");

assert.match(source, /Assignment controls appear here only after Job Intake creates the operational tasks/);
assert.match(source, /In Team & resource plan, choose the project leader and add each assignment/);
assert.match(source, /In Review & activate, complete the confirmations/);
assert.match(source, /href=\{`\/projects\/\$\{projectId\}\/intake`\}/);
assert.match(source, /Abrir Ingreso y Configuración del Trabajo/);

console.log(JSON.stringify({ status: "PASS", build: 7, checks: ["inactive-operations-explanation", "assignment-path", "activation-path", "visible-primary-cta"] }));
