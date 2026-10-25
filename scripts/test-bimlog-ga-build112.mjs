import { runObservableGate } from "./lib/observable-gate-runner.mjs";

runObservableGate("api-typecheck", process.execPath, ["node_modules/typescript/bin/tsc", "-p", "artifacts/api-server/tsconfig.json", "--noEmit"], { timeout: 300_000 });
runObservableGate("frontend-typecheck", process.execPath, ["node_modules/typescript/bin/tsc", "-p", "artifacts/bimlog/tsconfig.json", "--noEmit"], { timeout: 300_000 });
console.log("BIMLog GA Build 112: PASS current API and frontend source type integrity");
