import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");
assert.match(view, /onClick=\{\(\) => activateWorkspace\("viewpoints"\)\}[^>]*>\{tt\("View results", "Ver resultados"\)\}/);
assert.match(view, /onFiltersChange\(\{ \.\.\.filters, search: event\.target\.value \}\)/);
assert.match(css, /\[data-workspace="filters"\] \.lens-next__filter-pane\s*\{[^}]*display:\s*block;[^}]*overflow-y:\s*auto;/);
assert.match(css, /\[data-workspace="viewpoints"\] \.lens-next__filter-pane,/);
console.log("Lens Next compact filter workspace and shared filter state: PASS");
