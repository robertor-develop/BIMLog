import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(root, "lens-next-panel.css"), "utf8");

assert.match(css, /\.lens-next-workspace--embedded \.lens-next__browser \.lens-next__issue-list\s*\{[\s\S]*?flex:\s*1 1 240px;[\s\S]*?overflow-y:\s*auto;/);
assert.match(css, /\.lens-next-workspace--embedded \.lens-next__body > \.lens-next__details\s*\{[\s\S]*?overflow-y:\s*auto;/);
assert.match(css, /\.lens-next-workspace--embedded \.lens-next__issue-card\s*\{[\s\S]*?grid-template-columns:\s*56px minmax\(0, 1fr\);/);

console.log("Lens Next compact independent-pane workspace: PASS");
