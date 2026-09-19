import fs from "node:fs";
import path from "node:path";
import { validateReleaseReceipt } from "./release-receipt.mjs";

const flag = process.argv.indexOf("--receipt");
if (flag < 0 || !process.argv[flag + 1]) throw new Error("Usage: node scripts/check-release-receipt.mjs --receipt <path>");
const receiptPath = path.resolve(process.argv[flag + 1]);
const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
const result = validateReleaseReceipt(receipt);
if (!result.ok) {
  for (const error of result.errors) console.error(`RELEASE_RECEIPT_MISMATCH field=${error.field} reason=${error.message}`);
  process.exit(1);
}
console.log(`RELEASE_RECEIPT=PASS source=${receipt.source.commit} publication=${receipt.provider.publicationReceiptId} deployment=${receipt.provider.deploymentId}`);
