import fs from "node:fs";
import path from "node:path";
import { validateAuthenticatedReleaseAcceptance } from "./authenticated-release-acceptance.mjs";

const flag = process.argv.indexOf("--receipt");
if (flag < 0 || !process.argv[flag + 1]) throw new Error("Usage: node scripts/check-authenticated-release-acceptance.mjs --receipt <external receipt path>");
const receipt = JSON.parse(fs.readFileSync(path.resolve(process.argv[flag + 1]), "utf8"));
const result = validateAuthenticatedReleaseAcceptance(receipt);
if (!result.ok) {
  for (const error of result.errors) console.error(`AUTHENTICATED_RELEASE_ACCEPTANCE_FAIL field=${error.field} reason=${error.message}`);
  process.exit(1);
}
console.log(`AUTHENTICATED_RELEASE_ACCEPTANCE=PASS release=${receipt.release} source=${receipt.source.commit} publication=${receipt.provider.publicationReceiptId}`);
