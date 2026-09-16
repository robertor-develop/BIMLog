import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");

assert.match(view, /lensNextSelectionTarget\(filteredIssues/);
assert.match(view, /target\.page !== issuePage/);
assert.match(view, /onIssuePageChange\(target\.page\)/);
assert.match(view, /onSelectIssue\(target\.issue\.identity\.serverId\)/);
assert.match(view, /tt\("Previous issue", "Incidencia anterior"\)/);
assert.match(view, /tt\("Next issue", "Incidencia siguiente"\)/);
assert.match(view, /tt\("Close issue details", "Cerrar detalles de la incidencia"\)/);
assert.match(css, /\.lens-next__detail-navigation/);
assert.match(css, /grid-column: 1 \/ -1/);

console.log("Lens Next Build 38 selection acceptance: PASS");
