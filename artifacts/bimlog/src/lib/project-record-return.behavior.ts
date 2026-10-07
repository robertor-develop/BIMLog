import assert from "node:assert/strict";
import { parseChangeOriginContext, parseTransmittalEvidenceContext } from "./project-record-return";

const change = "originType=rfi&originId=5&originLabel=RFI-5&returnTo=";
assert.equal(parseChangeOriginContext(change + encodeURIComponent("/projects/7/rfis?rfi=5"), 7)?.returnTo, "/projects/7/rfis?rfi=5");
assert.equal(parseChangeOriginContext(change + encodeURIComponent("/projects/8/rfis?rfi=5"), 7), null);
assert.equal(parseChangeOriginContext(change + encodeURIComponent("/projects/7/../8/rfis"), 7), null);

const transmittal = "sourceType=file&sourceId=9&sourceLabel=Drawing&sourceVersion=V2&returnTo=";
assert.equal(parseTransmittalEvidenceContext(transmittal + encodeURIComponent("/projects/7/files?file=9"), 7)?.returnTo, "/projects/7/files?file=9");
assert.equal(parseTransmittalEvidenceContext(transmittal + encodeURIComponent("https://evil.test/projects/7/files"), 7), null);
assert.equal(parseTransmittalEvidenceContext(transmittal + encodeURIComponent("/projects/7/files#escape"), 7), null);

console.log("Project record return contexts remain inside the exact project PASS");
