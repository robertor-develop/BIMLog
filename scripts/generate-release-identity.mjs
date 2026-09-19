import fs from "node:fs";
import path from "node:path";
import { generatedReleaseFiles, readReleaseIdentity, repositoryRoot } from "./release-identity.mjs";

for (const [relativePath, content] of generatedReleaseFiles(readReleaseIdentity())) {
  const outputPath = path.join(repositoryRoot, relativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, "utf8");
  console.log(`GENERATED ${relativePath}`);
}
