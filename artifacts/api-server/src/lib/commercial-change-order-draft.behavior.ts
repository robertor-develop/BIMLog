import assert from "node:assert/strict";import {capturePotentialCommercialImpact} from "./commercial-potential-impact";import {routeImpactsToChangeOrderDraft} from "./commercial-change-order-draft";
const impact=capturePotentialCommercialImpact({projectId:26,sourceType:"submittal",sourceId:"SUB-9",sourceVersion:"r1",currency:"USD",potentialCost:"500",potentialDays:1,description:"Review impact",recordedBy:"reviewer",recordedAt:"2026-09-28T18:00:00Z"},[]);
const draft=routeImpactsToChangeOrderDraft({projectId:26,requestKey:"REQ-82",impacts:[impact],existing:[],canonicalChangeOrderId:"CO-26-4",createdBy:"commercial-reviewer",createdAt:"2026-09-28T19:00:00Z"});
assert.equal(draft.state,"draft");assert.equal(draft.canonicalChangeOrderId,"CO-26-4");assert.strictEqual(routeImpactsToChangeOrderDraft({projectId:26,requestKey:"REQ-82",impacts:[impact],existing:[draft],createdBy:"x",createdAt:"x"}),draft);
assert.throws(()=>routeImpactsToChangeOrderDraft({projectId:27,requestKey:"REQ",impacts:[impact],existing:[],createdBy:"x",createdAt:"x"}),/scope/);
console.log("C082 canonical Change Order draft lineage: PASS");
