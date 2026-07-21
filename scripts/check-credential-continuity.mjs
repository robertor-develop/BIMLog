import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_PROTECTED_FILE_SHA256 =
  "345f301804b5ab027ba7d97d492ffb78408436ef1451b9fd9e6f1fb7e16933ce";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const protectedFile = path.join(repositoryRoot, ".replit");

function fail(message) {
  console.error(`Credential continuity guard failed: ${message}`);
  process.exitCode = 1;
}

function matchesFingerprint(contents, expectedHex) {
  const observed = createHash("sha256").update(contents).digest();
  const expected = Buffer.from(expectedHex, "hex");
  return observed.length === expected.length && timingSafeEqual(observed, expected);
}

function readFailureMessage(error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    return "protected rebuild configuration is missing; stop without attempting recovery or credential entry.";
  }
  return "protected rebuild configuration could not be verified; stop and request owner review.";
}

if (process.argv.includes("--self-test")) {
  const fixture = Buffer.from("phase1a-continuity-guard-fixture", "utf8");
  const fixtureFingerprint = createHash("sha256").update(fixture).digest("hex");
  const missingFileError = Object.assign(new Error("synthetic missing file"), { code: "ENOENT" });

  if (
    !matchesFingerprint(fixture, fixtureFingerprint) ||
    matchesFingerprint(Buffer.from("changed-fixture", "utf8"), fixtureFingerprint) ||
    !readFailureMessage(missingFileError).includes("is missing")
  ) {
    fail("internal value-blind self-test did not pass.");
  } else {
    console.log("Credential continuity guard self-test passed.");
  }
  process.exit();
}

try {
  const contents = await readFile(protectedFile);

  if (!matchesFingerprint(contents, EXPECTED_PROTECTED_FILE_SHA256)) {
    fail("protected rebuild configuration differs from the owner-approved baseline; stop without inspecting or replacing values.");
  } else {
    console.log("Credential continuity guard passed: protected rebuild configuration is unchanged.");
  }
} catch (error) {
  fail(readFailureMessage(error));
}
