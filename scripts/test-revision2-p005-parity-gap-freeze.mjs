import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const backend = JSON.parse(fs.readFileSync(new URL("../evidence/revision2-r01-r05/R02_BACKEND_CAPABILITY_INVENTORY.json", import.meta.url)));
const result = JSON.parse(fs.readFileSync(new URL("../evidence/revision2-p001-p005/P005_FROZEN_PARITY_GAP_SET.json", import.meta.url)));
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
assert.equal(result.routeDispositions.length, backend.routes.length);
assert.equal(new Set(result.routeDispositions.map(({ backendIdentity }) => backendIdentity)).size, backend.routes.length);
assert.deepEqual(new Set(result.routeDispositions.map(({ backendIdentity }) => backendIdentity)), new Set(backend.routes.map(({ identity }) => identity)));
assert.equal(result.routeDispositionSha256, digest(result.routeDispositions));
assert.equal(result.gapSetSha256, digest(result.gaps));
assert.equal(result.counts.gaps, result.gaps.length);
assert.equal(result.counts.missingFrontend, result.gaps.filter(({ gapType }) => gapType === "missing-frontend").length);
assert.ok(result.gaps.every(({ prohibitedResolution }) => prohibitedResolution.includes("delete-hide")));
assert.ok(Object.values(result.permanentGate).every(Boolean));
console.log(`REVISION2_P005=PASS routes=${result.counts.routes} gaps=${result.counts.gaps} sha256=${result.gapSetSha256}`);
