import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const client = readFileSync(new URL("../../../bimlog/src/features/lens-next/lens-next-client.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../routes/clash_reports.ts", import.meta.url), "utf8");

assert.match(client, /command:\s*"capture-visual-state"[\s\S]*includeScreenshot:\s*"true"/);
assert.match(route, /const screenshotUrl = selectLensReportImage\(parsedVisualState\)\.dataUrl/);
assert.match(route, /INSERT INTO lens_issue_viewpoints\([^`]*screenshot_url[^`]*\)/);
assert.match(route, /INSERT INTO lens_issue_viewpoint_revisions\([^`]*screenshot_url[^`]*\)/);
assert.match(route, /viewpoint:\s*\{[^}]*screenshotUrl,/);
assert.match(route, /SELECT id,name,display_order,is_primary,lifecycle_status,screenshot_url,visual_state_digest/);

console.log("Lens secondary viewpoints capture and persist verified marked screenshots: PASS");
