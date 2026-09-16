import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");
const evidence = JSON.parse(readFileSync(new URL("../../../evidence/lens-next-build34-keyboard-accessibility.json", import.meta.url), "utf8"));
assert.match(view, /aria-label="Skip within Lens Next"/);
assert.match(view, /role="dialog" aria-modal="true" aria-labelledby="lens-next-guide-title"/);
assert.match(view, /helpCloseRef\.current\?\.focus\(\)/);
assert.match(view, /event\.key !== "Escape"/);
assert.match(view, /helpButtonRef\.current\?\.focus\(\)/);
assert.match(css, /:focus-visible\{outline:3px solid #1d6fe8/);
assert.equal(evidence.checks.languageControlKeyboardActivation, "PASS");
assert.equal(evidence.checks.helpDialogEscapeDismissal, "PASS");
assert.equal(evidence.checks.helpDialogFocusRestoration, "PASS");
console.log("BUILD34_KEYBOARD_ACCESSIBILITY=PASS skip_links=true dialog_focus=true escape=true");
