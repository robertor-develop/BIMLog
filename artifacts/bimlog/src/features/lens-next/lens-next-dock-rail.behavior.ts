import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");
assert.match(view, /useState<"filters" \| "viewpoints" \| "create" \| "settings">\("viewpoints"\)/);
for (const workspace of ["filters", "viewpoints", "create", "settings"]) {
  assert.match(view, new RegExp(`\\["${workspace}",`));
}
assert.match(view, /aria-pressed=\{activeWorkspace === workspace\}/);
assert.match(css, /\.lens-next__side-rail\s*\{[^}]*width:\s*48px;/);
console.log("Lens Next persistent four-workspace rail: PASS");
