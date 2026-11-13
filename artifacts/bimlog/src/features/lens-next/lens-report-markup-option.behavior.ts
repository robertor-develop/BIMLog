import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("../../pages/project/LensViewpointsView.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../../../../api-server/src/routes/clash_reports.ts", import.meta.url), "utf8");

assert.match(view, /includeCaptureAppendix:\s*true/);
assert.match(view, /includeCaptureAppendix:\s*form\.includeCaptureAppendix/);
assert.match(view, /Include verified issue captures and markups/);
assert.match(view, /Incluir capturas y marcas verificadas de los Issues/);
assert.match(view, /disabled=\{form\.isExecutiveOnePager\}/);
assert.match(route, /includeCaptureAppendix = body\.includeCaptureAppendix !== false && !isOnePager/);
assert.match(route, /if \(includeCaptureAppendix\) for \(const viewpoint of vps\)/);
assert.match(route, /computeContentHash\(\{[^}]*includeCaptureAppendix/);

console.log("Lens report UI exposes truthful marked-capture appendix control: PASS");
