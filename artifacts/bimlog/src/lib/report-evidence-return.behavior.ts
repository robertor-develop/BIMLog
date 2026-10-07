import assert from "node:assert/strict";
import { parseReportEvidenceReturn } from "./report-evidence-return.ts";

assert.deepEqual(parseReportEvidenceReturn("from=%2Fprojects%2F63%2Freports", 63), { returnTo: "/projects/63/reports" });
for (const unsafe of [
  "from=https%3A%2F%2Fevil.test",
  "from=%2Fprojects%2F64%2Freports",
  "from=%2Fprojects%2F63%2Freports%3Fadmin%3D1",
  "from=%2Fprojects%2F63%2Freports&token=secret",
  "from=%2Fprojects%2F63%2Freports&from=%2Fprojects%2F63%2Freports",
]) assert.equal(parseReportEvidenceReturn(unsafe, 63), null);

console.log("Report evidence return contract: PASS");
