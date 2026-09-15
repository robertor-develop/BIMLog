import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(root, "lens-next-panel.css"), "utf8");
const view = fs.readFileSync(path.join(root, "LensNextPanelView.tsx"), "utf8");

assert.match(css, /\.lens-next-workspace--embedded \.lens-next__browser \.lens-next__issue-list\s*\{[\s\S]*?flex:\s*1 1 240px;[\s\S]*?overflow-y:\s*auto;/);
assert.match(css, /\.lens-next-workspace--embedded \.lens-next__body > \.lens-next__details\s*\{[\s\S]*?overflow-y:\s*auto;/);
assert.match(css, /\.lens-next-workspace--embedded \.lens-next__issue-card\s*\{[\s\S]*?grid-template-columns:\s*56px minmax\(0, 1fr\);/);
assert.match(css, /\[aria-label="Controlled issue publishing"\]\s*\{\s*order:\s*6;/);
assert.match(css, /\[aria-label="Reference attachments"\]\s*\{\s*order:\s*8;/);
assert.match(view, /key=\{selectedIssue\.identity\.serverId\}[\s\S]*?className="lens-next__details"/);
assert.match(view, /<details className="lens-next__create">/);
assert.doesNotMatch(view, /<details className="lens-next__create" open>/);

console.log("Lens Next compact independent-pane workspace: PASS");
