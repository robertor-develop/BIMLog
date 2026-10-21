import assert from "node:assert/strict";
import { acceptanceViewports, accessibilityJourneys, hasViewportCoverage } from "./responsive-accessibility.ts";

assert.equal(hasViewportCoverage([390, 768, 1440]), true);
assert.equal(hasViewportCoverage([390, 1440]), false);
assert.equal(new Set(acceptanceViewports.map(item => item.name)).size, 3);
assert.ok(accessibilityJourneys.includes("agent") && accessibilityJourneys.includes("intake"));
console.log("RESPONSIVE_ACCESSIBILITY_RESULT=PASS mobile tablet desktop and primary journeys are explicit");
