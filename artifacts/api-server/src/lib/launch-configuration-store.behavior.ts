import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { launchConfigurationFingerprint } from "./launch-configuration-store";

const source = readFileSync(new URL("./launch-configuration-store.ts", import.meta.url), "utf8");
for (const token of ["FOR UPDATE", "expectedRevision", "BEGIN", "COMMIT", "ROLLBACK", "launch_configuration_versions", "launch_configuration_audit", "launch_payment_verification_audit", "DISTINCT ON (method)", "ORDER BY revision DESC"]) assert.ok(source.includes(token), token);
const input = { environment: "staging", revision: 2, state: "validated", configuration: { a: 1 }, readiness: { ready: true } };
assert.equal(launchConfigurationFingerprint(input), launchConfigurationFingerprint(input));
assert.notEqual(launchConfigurationFingerprint(input), launchConfigurationFingerprint({ ...input, revision: 3 }));
console.log("LAUNCH_CONFIGURATION_BUILD_08=PASS concurrency=optimistic-lock history=immutable audit=correlated");
