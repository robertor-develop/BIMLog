import fs from "node:fs";
import path from "node:path";
import { generatedReleaseFiles, readReleaseIdentity, repositoryRoot } from "./release-identity.mjs";

const identity = readReleaseIdentity();
const drift = [];
for (const [relativePath, expected] of generatedReleaseFiles(identity)) {
  const outputPath = path.join(repositoryRoot, relativePath);
  const actual = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : null;
  if (actual?.replace(/\r\n/g, "\n") !== expected.replace(/\r\n/g, "\n")) drift.push(relativePath);
}
if (drift.length) {
  console.error(`RELEASE_IDENTITY_DRIFT=${drift.join(",")}`);
  process.exit(1);
}
console.log(`RELEASE_IDENTITY=PASS label=${identity.label} binary=${identity.binaryVersion} generated=${generatedReleaseFiles(identity).size}`);
