import { runNodeGate } from "./lib/observable-gate-runner.mjs";
for(let build=6;build<=10;build+=1){const suffix={6:"shell",7:"project",8:"procore-browse",9:"procore-rfi",10:"agent"}[build];runNodeGate(`scripts/test-live-journey-build${String(build).padStart(3,"0")}-${suffix}.mjs`);}
console.log("LIVE_JOURNEY_BLOCK02_CONTRACT_PASS builds=006-010 fixtures=synthetic liveAcceptance=false");
