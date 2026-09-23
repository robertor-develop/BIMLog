import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");
assert.match(view, /useState\(false\);\s*const listScrollTop = React\.useRef\(0\)/);
assert.match(view, /listScrollTop\.current = issueListRef\.current\?\.scrollTop/);
assert.match(view, /setCompactDetailOpen\(true\);[\s\S]*?onSelectIssue\(serverId\)/);
assert.match(view, /setCompactDetailOpen\(false\);[\s\S]*?issueListRef\.current\.scrollTop = listScrollTop\.current/);
assert.match(view, /className="lens-next__back-to-list" onClick=\{backToList\}/);
assert.match(css, /\[data-detail-open="true"\] \.lens-next__browser \{ display: none; \}/);
assert.match(css, /\[data-detail-open="true"\] \.lens-next__details:not\(\.lens-next__details--empty\)/);
console.log("Lens Next compact list/detail/back state contract: PASS");
