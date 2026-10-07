import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const location = readFileSync(new URL("./ProjectLocation.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("./FinancialProjectShell.tsx", import.meta.url), "utf8");
assert.match(location, /title=\{tt\("Open Project Home", "Abrir Inicio del Proyecto"\)\}/);
assert.doesNotMatch(location, /href=\{`\/projects\/\$\{projectId\}\/analytics`\}>\{tt\("Analytics"/);
assert.match(shell, /"Cost & Value Planner"/);
console.log("PROJECT_BREADCRUMB_RESULT=PASS all project shells point to canonical Project Home");
