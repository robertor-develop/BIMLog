import assert from "node:assert/strict";
import { experienceSpacing, experienceStatus, statusPresentation } from "./experience-system";

assert.deepEqual(Object.keys(experienceSpacing), ["xs", "sm", "md", "lg", "xl", "xxl"]);
assert.deepEqual(Object.keys(experienceStatus), ["neutral", "info", "success", "warning", "danger"]);
assert.equal(statusPresentation("warning").label, "Needs attention");
assert.equal(statusPresentation("warning", true).label, "Requiere atención");
assert.match(statusPresentation("success").className, /^experience-status-/);
console.log("post120 Build 186 shared experience tokens: PASS");
