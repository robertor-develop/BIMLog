import assert from "node:assert/strict";
import { shopDrawingEvidenceContinuity } from "./shop-drawing-delivery";
const rows=shopDrawingEvidenceContinuity({packages:[{id:"P",packageType:"shop_drawing"}],packageTasks:[{packageId:"P",taskId:"T"}],deliverables:[{taskId:"T",deliverableType:"submittal"}],connections:[{targetType:"task",targetId:"T",entityType:"rfi"}]});
assert.deepEqual(rows,[{packageId:"P",taskIds:["T"],submittals:1,rfis:1,evidence:2}]);
console.log("UX144_RESULT=PASS one shop-drawing package projects its task, received submittal evidence and relevant RFI without re-entering scope");
