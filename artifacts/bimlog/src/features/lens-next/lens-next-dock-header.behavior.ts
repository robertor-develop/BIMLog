import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");
assert.match(view, /BIMLOG_RELEASE_VERSION/);
assert.match(view, /activeProject\?\.name \?\? "No BIMLog project"/);
assert.match(view, /bridgeDisplayName \?\? "No active Navisworks model"/);
assert.match(view, /ConnectionBadge label="BIMLog" state=\{apiState\}/);
assert.match(view, /ConnectionBadge label="Navisworks" state=\{bridgeState\}/);
assert.match(css, /\.lens-next\[data-dock-width="narrow"\] \.lens-next__header/);
console.log("Lens Next compact global project/model/connection context: PASS");
