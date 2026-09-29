import assert from "node:assert/strict";
import { adoptedExperienceSurfaces, experienceStates, missingRegressionStates, regressionMatrixCases } from "./experience-regression-matrix";

assert.deepEqual(experienceStates, ["loading", "empty", "error", "read", "edit"]);
assert.equal(adoptedExperienceSurfaces.length, 6);
assert.equal(regressionMatrixCases().length, adoptedExperienceSurfaces.length * experienceStates.length);
assert.ok(adoptedExperienceSurfaces.every(surface => surface.route.startsWith("/")));
assert.ok(adoptedExperienceSurfaces.every(surface => missingRegressionStates(surface).length === 0));
assert.equal(new Set(adoptedExperienceSurfaces.map(surface => surface.key)).size, adoptedExperienceSurfaces.length);
console.log("post120 Build 190 experience regression matrix: PASS");
