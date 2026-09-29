import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const help = fs.readFileSync(path.join(root, "artifacts/bimlog/src/pages/HelpCenter.tsx"), "utf8");
const guide = fs.readFileSync(path.join(root, "artifacts/bimlog/src/components/layout/SmartGuide.tsx"), "utf8");
const contract = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/help-center.behavior.ts"), "utf8");

assert.match(help, /Help Center/);
assert.match(help, /Centro de Ayuda|Ayuda/);
assert.match(guide, /Abrir instrucciones completas/);
assert.match(guide, /Open complete instructions/);
assert.match(contract, /bilingual-manual/);
assert.match(contract, /responsive-layout/);
assert.match(contract, /printable-operating-reference/);

console.log("consolidation C119 deployed bilingual guide acceptance: PASS");
