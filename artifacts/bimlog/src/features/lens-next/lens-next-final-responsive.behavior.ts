import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");
const narrow = css.match(/@media \(max-width: 420px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
assert.match(narrow, /overflow-x:\s*hidden/);
assert.match(narrow, /min-height:\s*44px/);
assert.match(narrow, /grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.match(narrow, /overflow-x:\s*auto/);
assert.match(narrow, /lens-next__sync-recovery/);
console.log("Lens Next exact-390 responsive contract: PASS");
