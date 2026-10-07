import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeEmailReturnTarget } from "./email-configuration-return";
import { conventionResolverUrl } from "./file-intake-journey";
import { parseChangeOriginContext, parseTransmittalEvidenceContext } from "./project-record-return";
import { safeProjectReturnTarget } from "./return-context";

assert.equal(safeProjectReturnTarget("/projects/12/files?resume=file-intake", 12), "/projects/12/files?resume=file-intake");
assert.equal(safeProjectReturnTarget("/projects/13/files", 12), null);
assert.match(decodeURIComponent(conventionResolverUrl(12)), /\/projects\/12\/files\?resume=file-intake/);
assert.equal(safeEmailReturnTarget("/projects/12/intake?stage=delivery&item=ji-email-readiness"), "/projects/12/intake?stage=delivery&item=ji-email-readiness");

const change = parseChangeOriginContext("originType=rfi&originId=2&originLabel=RFI-2&returnTo=%2Fprojects%2F12%2Frfis%3Frfi%3D2", 12);
const transmittal = parseTransmittalEvidenceContext("sourceType=file&sourceId=4&sourceLabel=Plan&sourceVersion=V1&returnTo=%2Fprojects%2F12%2Ffiles%3Ffile%3D4", 12);
assert.equal(change?.returnTo, "/projects/12/rfis?rfi=2");
assert.equal(transmittal?.returnTo, "/projects/12/files?file=4");
assert.equal(parseChangeOriginContext("originType=rfi&originId=999999999999999999999&originLabel=RFI&returnTo=%2Fprojects%2F12%2Frfis", 12), null);
assert.equal(parseTransmittalEvidenceContext("sourceType=file&sourceId=999999999999999999999&sourceLabel=Plan&sourceVersion=V1&returnTo=%2Fprojects%2F12%2Ffiles", 12), null);

const generator = readFileSync(new URL("../pages/project/NameGenerator.tsx", import.meta.url), "utf8");
const profile = readFileSync(new URL("../pages/Profile.tsx", import.meta.url), "utf8");
assert.match(generator, /safeProjectReturnTarget\(requestedReturnTo, projectId\)/);
assert.match(profile, /Your previous work is preserved/);
console.log("Flow continuity block 2: exact same-project returns and visible recovery guidance PASS");
