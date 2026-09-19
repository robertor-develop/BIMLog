import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generatedReleaseFiles, readReleaseIdentity, repositoryRoot, validateReleaseIdentity } from "./release-identity.mjs";

const identity = readReleaseIdentity();
assert.equal(identity.label, "v1.05.N18-P33");
assert.equal(identity.binaryVersion, "1.5.18.33");
assert.throws(() => validateReleaseIdentity({ ...identity, label: "v1.05.N17-P12" }), /label mismatch/i);
assert.throws(() => validateReleaseIdentity({ ...identity, binaryVersion: "1.5.17.12" }), /binary version mismatch/i);
assert.throws(() => validateReleaseIdentity({ ...identity, release: { ...identity.release, platform: 34 } }), /label mismatch/i);

for (const [relativePath, expected] of generatedReleaseFiles(identity)) {
  assert.equal(fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8").replace(/\r\n/g, "\n"), expected.replace(/\r\n/g, "\n"), `${relativePath} must match the contract`);
}

const navbar = fs.readFileSync(path.join(repositoryRoot, "artifacts/bimlog/src/components/layout/Navbar.tsx"), "utf8");
const help = fs.readFileSync(path.join(repositoryRoot, "artifacts/bimlog/src/pages/HelpCenter.tsx"), "utf8");
const constants = fs.readFileSync(path.join(repositoryRoot, "plugins/BIMLogLensNext/src/LensNextConstants.cs"), "utf8");
assert.match(navbar, /BIMLOG_RELEASE_VERSION.*@workspace\/api-zod/);
assert.match(help, /HELP_RELEASE_VERSION = BIMLOG_RELEASE_VERSION/);
assert.match(constants, /ProductVersionLabel = ReleaseIdentity\.ProductVersionLabel/);
console.log("RELEASE_IDENTITY_TESTS=PASS positive=1 negative=3 consumers=3");
