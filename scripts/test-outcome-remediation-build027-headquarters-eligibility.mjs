import { runTsGate } from "./lib/observable-gate-runner.mjs";

runTsGate("artifacts/bimlog/src/lib/headquarters-project-eligibility.behavior.ts");
runTsGate("artifacts/api-server/src/lib/dashboard-adoption-route.behavior.ts");
console.log("OUTCOME-B027 PASS: retired and inactive projects remain administrable but cannot drive live Headquarters recommendations");
