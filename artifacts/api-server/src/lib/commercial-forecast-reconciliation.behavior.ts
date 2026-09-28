import assert from "node:assert/strict";import {reconcileCommercialForecast} from "./commercial-forecast-reconciliation";
const baseline={projectId:26,budgetVersionId:"B4",budgetFingerprint:"b",apuVersionId:"A7",apuFingerprint:"a",currency:"USD",originalContractValue:"10000.00",currentApprovedValue:"10500.25",version:4};
const view=reconcileCommercialForecast({baseline,approvedChanges:[{changeOrderId:"CO-4",amount:"500.25",version:1}],potentialImpacts:[{impactId:"potential:26:rfi:81:v2",amount:"250.00"}],actualCosts:[{costRecordId:"ACT-1",amount:"6200.00"}]});
assert.deepEqual([view.originalApprovedValue,view.currentApprovedValue,view.potentialUnapprovedValue,view.forecastValue,view.actualCostToDate],["10000.00","10500.25","250.00","10750.25","6200.00"]);
assert.deepEqual(view.approvedChangeOrderIds,["CO-4"]);assert.throws(()=>reconcileCommercialForecast({baseline,approvedChanges:[{changeOrderId:"CO-4",amount:"1",version:1},{changeOrderId:"CO-4",amount:"1",version:1}],potentialImpacts:[],actualCosts:[]}),/duplicated/);
console.log("C084 commercial forecast reconciliation: PASS");
