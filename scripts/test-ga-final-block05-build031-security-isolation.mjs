import { runNodeGate as runNode, runTsGate as runTs } from "./lib/observable-gate-runner.mjs";

runNode("scripts/test-ga-final-block01-build001-agent-access.mjs");
runNode("scripts/test-ga-final-block01-build002-agent-isolation.mjs");
runNode("scripts/test-recovery-ga-block04.mjs", { timeout: 300_000 });
for(const file of [
  "artifacts/api-server/src/lib/block22-build106-object-authorization.behavior.ts",
  "artifacts/api-server/src/lib/consolidation-build116-role-isolation.behavior.ts",
  "artifacts/api-server/src/lib/coordination-knowledge-authorization.behavior.ts",
  "artifacts/api-server/src/lib/post120-build208-authorization-negative-matrix.behavior.ts"
]) runTs(file);
console.log("GA-F05-B031 PASS: authenticated mounted HTTP/database tenant, project, role, convention, file and Agent isolation plus the complete object-authority surface matrix");
