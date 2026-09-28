import assert from "node:assert/strict";
import {capturePotentialCommercialImpact} from "./commercial-potential-impact";
const input={projectId:26,sourceType:"rfi" as const,sourceId:"RFI-81",sourceVersion:"v2",currency:"usd",potentialCost:"1250",potentialDays:3,description:"Potential reroute impact",recordedBy:"coordinator-1",recordedAt:"2026-09-28T18:00:00Z"};
const impact=capturePotentialCommercialImpact(input,[]);
assert.equal(impact.potentialCost,"1250.00");assert.equal(impact.authority,"potential_only");assert.equal(impact.approvedContractValue,false);
assert.strictEqual(capturePotentialCommercialImpact({...input,potentialCost:"9999"},[impact]),impact,"same source/version cannot be counted twice");
assert.notEqual(capturePotentialCommercialImpact({...input,sourceVersion:"v3"},[impact]).impactId,impact.impactId);
assert.throws(()=>capturePotentialCommercialImpact({...input,potentialCost:null,potentialDays:null},[]),/required/);
console.log("C081 potential commercial impact lineage: PASS");
