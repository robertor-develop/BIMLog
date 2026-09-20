import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "../..");
const evidence = fs.readFileSync(path.join(root, "evidence/stabilization-program-20260919/BUILD_113_RESPONSIVE_ACCESSIBILITY_ACCEPTANCE.md"), "utf8");
for (const viewport of ["1366×768", "768×1024", "390×844"]) assert.ok(evidence.includes(viewport), `missing reviewed viewport ${viewport}`);
const app = fs.readFileSync(path.join(root, "artifacts/bimlog/src/App.tsx"), "utf8");
assert.match(app, /Skip to main content \/ Ir al contenido principal/);
console.log("block23 build113 responsive/accessibility evidence contract: PASS");
