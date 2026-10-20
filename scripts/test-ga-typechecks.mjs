import { runObservableGate } from "./lib/observable-gate-runner.mjs";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
runObservableGate("frontend TypeScript", pnpm, ["--filter", "@workspace/bimlog", "run", "typecheck"]);
runObservableGate("API TypeScript", pnpm, ["--filter", "@workspace/api-server", "run", "typecheck"]);
console.log("GA_TYPESCRIPT_PASS frontend=0 api=0");
