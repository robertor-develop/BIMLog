import assert from "node:assert/strict";
import { coordinatorShopDrawingOverview } from "./shop-drawing-delivery";
const base={packageType:"shop_drawing",description:"floor: Level 7",disciplineName:"Mechanical",progressPercent:0};
const packages=[{...base,id:"A",packageCode:"SD-L7-M",status:"draft"},{...base,id:"B",packageCode:"SD-L7-E",status:"submitted"},{...base,id:"C",packageCode:"SD-L7-P",status:"approved"}];
const rows=coordinatorShopDrawingOverview({packages,packageTasks:[{packageId:"A",taskId:"T"}],tasks:[{id:"T",status:"not_started",assigneeUserId:null}]});
assert.deepEqual(rows.map(row=>row.nextAction),["prepare","review","complete"]); assert.equal(rows[0]!.unassigned,true); assert.equal(rows[0]!.floor,"Level 7");
console.log("UX145_RESULT=PASS coordinator overview separates planned, issued and approved packages with floor, discipline, next action and unassigned work visible");
