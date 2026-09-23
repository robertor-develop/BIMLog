import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");
assert.match(css, /\.lens-next:is\(\[data-dock-width="narrow"\], \[data-dock-width="medium"\]\) \.lens-next__body\s*\{[^}]*display:\s*block;[^}]*overflow:\s*hidden;/);
assert.match(css, /\.lens-next:is\(\[data-dock-width="narrow"\], \[data-dock-width="medium"\]\) \.lens-next__browser,[\s\S]*?\.lens-next__details\s*\{[^}]*height:\s*100%;/);
assert.match(css, /\.lens-next\[data-dock-width="wide"\] \.lens-next__body\s*\{/);
console.log("Lens Next compact single-workspace shell: PASS");
