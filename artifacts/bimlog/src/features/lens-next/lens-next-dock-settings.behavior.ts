import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");
assert.match(view, /ref=\{settingsSectionRef\} className="lens-next__view-settings"/);
assert.match(view, /onViewPresetChange\(event\.target\.value as LensNextViewPresetId\)/);
assert.match(css, /\[data-workspace="settings"\] \.lens-next__browser-grid\s*\{[^}]*display:\s*none;/);
assert.match(css, /\[data-workspace="settings"\] \.lens-next__browser > :is\(\.lens-next__active-model, \.lens-next__view-settings\)\s*\{[^}]*display:\s*block;/);
assert.match(css, /\.lens-next__body:has\(> \.lens-next__details:not\(\.lens-next__details--empty\)\) > \.lens-next__browser\s*\{[^}]*display:\s*flex;/);
console.log("Lens Next compact Settings and selected-issue visibility: PASS");
