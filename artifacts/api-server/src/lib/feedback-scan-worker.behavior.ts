import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./feedback-scan-worker.ts", import.meta.url), "utf8");
const checks: Array<[string, RegExp]> = [
  ["only governed ClamAV activation starts the worker", /BIMLOG_FEEDBACK_SCANNER === "clamav-cli"/],
  ["startup verifies scanner authority", /verifyFeedbackScannerStartup.*verifyStartup\(\)/s],
  ["worker claims each asset across processes", /pg_try_advisory_lock.*feedback-scan:/s],
  ["worker reads bounded private bytes", /storage\.downloadBounded\(asset\.storagePath, FEEDBACK_MAX_FILE_BYTES\)/],
  ["worker rechecks structure, byte count, hash, and MIME", /inspectFeedbackEvidence.*byteLength !== asset\.byteSize.*sha256 !== asset\.sha256.*mediaType !== asset\.mediaType/s],
  ["clean transition is conditional on immutable identity", /scanState: nextState.*scanState, "quarantined".*sha256, receipt\.sha256.*byteSize, receipt\.byteCount/s],
  ["infected evidence is rejected", /receipt\.verdict === "clean" \? "clean" : "rejected"/],
  ["scanner receipt is audit-bound", /scannerVersion: receipt\.scannerVersion.*scannerExecutableSha256: receipt\.executableSha256.*inspectedAt: receipt\.inspectedAt/s],
  ["failures remain quarantined for retry", /evidence_scan_failed.*state: "retry-required"/s],
];
for (const [name, pattern] of checks) assert.match(source, pattern, name);
console.log(`Feedback scan worker source assertions: ${checks.length}/${checks.length} passed`);
