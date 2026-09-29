import assert from "node:assert/strict";
import { intakeOrigin, validatedReturn, withIntakeReturn } from "./return-context";
const link=withIntakeReturn("/projects/7/convention",7,"delivery","ji-assignment-2");
assert.equal(validatedReturn(link.split("?")[1],7),intakeOrigin(7,"delivery","ji-assignment-2"));
for(const bad of ["https://evil.test/projects/7/intake","//evil.test/projects/7/intake","/projects/8/intake?stage=scope","/projects/7/intake?stage=nope","/projects/7/intake?token=secret"]) assert.equal(validatedReturn("returnTo="+encodeURIComponent(bad),7),null);
console.log("UX017 exact same-project return context and unsafe-origin denial PASS");
