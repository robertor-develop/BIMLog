import {execFileSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsx = path.join(root, "artifacts/api-server/node_modules/tsx/dist/cli.mjs");

for (const file of [
  "artifacts/bimlog/src/lib/commercial-intent.behavior.ts",
  "artifacts/bimlog/src/pages/commercial-registration-continuity.behavior.ts",
  "artifacts/bimlog/src/components/commercial-onboarding-continuity.behavior.ts",
  "artifacts/api-server/src/routes/contact.behavior.ts",
  "artifacts/bimlog/src/lib/sales-inquiry-receipt.behavior.ts",
  "artifacts/bimlog/src/pages/contact-sales-inquiry.behavior.ts",
]) {
  execFileSync(process.execPath, [tsx, path.join(root, file)], {stdio: "inherit"});
}

console.log("B281-B285 Block 57 commercial conversion continuity: PASS");
