import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");
const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");

assert.match(css, /grid-template-columns: clamp\(380px, 42vw, 520px\) minmax\(360px, 1fr\)/);
assert.match(css, /\.lens-next-workspace--embedded \.lens-next__browser,[\s\S]*overflow-y: auto/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
assert.match(css, /\.lens-next__inventory-summary[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(view, /className="lens-next__browser"/);
assert.match(view, /className="lens-next__details"/);
assert.match(view, /className="lens-next__details lens-next__details--empty"/);
assert.match(view, /No thumbnail available/);
assert.doesNotMatch(view, /placeholder\.com|placehold\.co|dummyimage/i);

console.log("PASS Lens Next Stage One stable two-pane layout and honest thumbnail states");
