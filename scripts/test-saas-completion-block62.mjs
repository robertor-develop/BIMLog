import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsx = path.join(root, "artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for (const file of [
  "artifacts/bimlog/src/lib/legal-information.behavior.ts",
  "artifacts/bimlog/src/pages/terms-public.behavior.ts",
  "artifacts/bimlog/src/pages/privacy-public.behavior.ts",
  "artifacts/bimlog/src/pages/legal-notice-public.behavior.ts",
  "artifacts/bimlog/src/pages/legal-information-path.behavior.ts",
]) execFileSync(process.execPath, [tsx, path.join(root, file)], { stdio: "inherit" });
console.log("B306-B310 Block 62 public legal-information path: PASS");
