import assert from "node:assert/strict";
import { projectJobLifecycle, type JobLifecycleEvent } from "./canonical-job-lifecycle";
const base={tenantId:1,projectId:64,at:"2026-10-20T00:00:00Z"};
const events:JobLifecycleEvent[]=[{...base,id:"1",type:"INTAKE_ACTIVATED"},{...base,id:"2",type:"WORK_ASSIGNED",assigneeId:7},{...base,id:"3",type:"HOURS_RECORDED",hours:4},{...base,id:"4",type:"HOURS_REVIEWED",reviewerId:9,approved:true}];
assert.deepEqual(projectJobLifecycle(1,64,events),{tenantId:1,projectId:64,activated:true,assigneeId:7,hours:4,reviewedHours:4,status:"reviewed",audit:events.map(e=>({eventId:e.id,type:e.type,at:e.at}))});
assert.equal(projectJobLifecycle(2,64,events).status,"draft");
assert.throws(()=>projectJobLifecycle(1,64,[events[0],events[1],events[2],{...events[3],reviewerId:7}]),/INDEPENDENT_REVIEW_REQUIRED/);
console.log("GA Block 2 Build 8 canonical activation and job lifecycle: PASS");
