import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");
assert.match(panel, /const receipt = await apiClient\.createIssue\([\s\S]*?await loadIssues\("refresh"\);\s*setSelectedServerId\(receipt\.serverId\);\s*setCreatedIssueServerId\(receipt\.serverId\)/);
assert.match(view, /handledCreatedIssueId\.current = createdIssueServerId;\s*setActiveWorkspace\("viewpoints"\);\s*setCompactDetailOpen\(true\)/);
assert.match(view, /className="lens-next__create-cancel"[^>]*onClick=\{\(\) => \{ setCreateReviewReady\(false\); activateWorkspace\("viewpoints"\); \}\}/);
assert.match(css, /\[data-workspace="create"\] \.lens-next__browser-grid\s*\{[^}]*display:\s*none;/);
console.log("Lens Next compact Create preserves canonical capture and returns to created issue: PASS");
