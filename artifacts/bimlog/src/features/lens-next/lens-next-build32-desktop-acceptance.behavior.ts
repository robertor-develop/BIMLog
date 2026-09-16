import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const evidence = JSON.parse(readFileSync(new URL("../../../evidence/lens-next-build32-desktop-acceptance.json", import.meta.url), "utf8"));
assert.equal(evidence.surface.includes("LensNextPanelView"), true);
assert.equal(evidence.checks.productionComponentRendered, true);
assert.equal(evidence.checks.issueCount, 100);
assert.equal(evidence.checks.pagingFromPage1ToPage2, "PASS");
assert.equal(evidence.checks.selectedIssueChangedTo, "CL-024");
assert.equal(evidence.checks.detailsAdjacentToBrowserPane, true);
assert.equal(evidence.checks.browserPaneWidth + evidence.checks.detailsPaneWidth, 1351);
assert.equal(evidence.checks.horizontalOverflow, false);
console.log("BUILD32_DESKTOP_ACCEPTANCE=PASS adjacent_details=true paging=true overflow=false");
