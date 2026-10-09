import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pending = readFileSync("artifacts/bimlog/src/pages/PendingItems.tsx", "utf8");
const css = readFileSync("artifacts/bimlog/src/index.css", "utf8");

for (const queue of ["rfis", "submittals", "files"]) assert.match(pending, new RegExp(`\\b${queue}:\\s*\\{`));
assert.match(pending, /setLocation\(`\/pending\?type=\$\{queueType\}`\)/);
assert.match(pending, /const \[location, setLocation\] = useLocation\(\)/);
assert.match(pending, /new URLSearchParams\(location\.includes\("\?"\)/);
for (const spanish of ["RFI abiertos", "Submittals pendientes", "Archivos que requieren atención", "Volver a la Sede", "Intentar de nuevo"]) {
  assert.ok(pending.includes(spanish), `missing Spanish queue text: ${spanish}`);
}
assert.match(pending, /<nav className="pending-type-tabs"[\s\S]*aria-current=\{type === queueType \? "page"/);
assert.match(pending, /<button[\s\S]*className="pending-item-action"[\s\S]*aria-label=\{tt\(`/);
assert.match(pending, /requestedType && requestedType in TYPE_META \? requestedType as ItemType : "rfis"/);
assert.match(pending, /setRows\(\[\]\)/);
assert.match(pending, /role="alert"/);
assert.match(pending, /setLoadAttempt\(value => value \+ 1\)/);
assert.match(pending, /className="pending-loading-state" role="status" aria-live="polite"/);
assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.pending-type-tabs \{ grid-template-columns: 1fr; \}/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.pending-loading-state svg \{ animation: none; \}/);

console.log("Headquarters daily clarity Block 2 acceptance: PASS");
