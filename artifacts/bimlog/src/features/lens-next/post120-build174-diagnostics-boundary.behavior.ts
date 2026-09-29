import assert from "node:assert/strict"; import { readFileSync } from "node:fs";
const view=readFileSync(new URL("./LensNextPanelView.tsx",import.meta.url),"utf8");
assert.match(view,/Diagnostics &amp; repair · Project Admin/);
assert.match(view,/replaces the stored Working View package for this exact issue and revision/);
assert.match(view,/Verify the active project, model, and camera/);
console.log("PASS UX064 diagnostics separated from daily issue actions");
