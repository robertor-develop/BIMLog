import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");
const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
assert.match(css, /\.lens-next\[data-dock-width="wide"\] \.lens-next__body\s*\{\s*grid-template-columns:/);
assert.match(css, /\.lens-next\[data-dock-width="wide"\] \.lens-next__browser-grid\s*\{\s*grid-template-columns:/);
assert.match(view, /lens-next__browser-grid/);
assert.match(view, /lens-next__filter-pane/);
assert.match(view, /className="lens-next__details"/);
console.log("Lens Next measured-width wide three-pane composition: PASS");
