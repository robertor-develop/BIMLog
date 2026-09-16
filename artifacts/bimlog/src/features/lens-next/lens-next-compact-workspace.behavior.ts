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
assert.match(css, /\.lens-next-workspace--embedded \.lens-next__details > \[aria-label="Controlled issue publishing"\]\s*\{\s*order:\s*5;/);
assert.match(css, /\.lens-next-workspace--embedded \.lens-next__details > \[aria-label="Linked BIMLog items"\]\s*\{\s*order:\s*6;/);
assert.match(css, /\.lens-next-workspace--embedded \.lens-next__details > \[aria-label="Reference attachments"\]\s*\{\s*order:\s*7;/);
assert.match(view, /key=\{selectedIssue\.identity\.serverId\}[\s\S]*?className="lens-next__details"/);
assert.match(view, /<details[^>]*className="lens-next__create">/);
assert.doesNotMatch(view, /<details[^>]*className="lens-next__create"[^>]*\sopen(?:=|>)/);
assert.match(view, /<details className="lens-next__active-model" aria-label="Active Navisworks model and synchronization tools">/);
assert.doesNotMatch(view, /<details className="lens-next__active-model"[^>]*\sopen(?:=|>)/);
assert.match(css, /\.lens-next__active-model > summary[\s\S]*?padding:\s*0\.55rem 0\.8rem;/);
assert.match(css, /\.lens-next-workspace:not\(\.lens-next-workspace--embedded\)\s*\{[\s\S]*?height:\s*calc\(100dvh - 64px\);[\s\S]*?overflow:\s*hidden;/);
assert.match(css, /\.lens-next-workspace:not\(\.lens-next-workspace--embedded\) \.lens-next__browser \.lens-next__issue-list\s*\{[\s\S]*?flex:\s*1 1 240px;[\s\S]*?overflow-y:\s*auto;/);
assert.match(css, /\.lens-next-workspace:not\(\.lens-next-workspace--embedded\) \.lens-next__body > \.lens-next__details\s*\{[\s\S]*?overflow-y:\s*auto;/);
assert.doesNotMatch(css, /\.lens-next-workspace:not\(\.lens-next-workspace--embedded\)[\s\S]{0,220}?overflow:\s*visible;/);

console.log("Lens Next compact independent-pane embedded and Platform workspaces with visible issue list: PASS");
