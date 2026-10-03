import assert from "node:assert/strict";import {supportNotification,uniqueSupportRecipients} from "./support-case-notification";
assert.deepEqual(uniqueSupportRecipients([4,2,4,3],3),[2,4]);
assert.deepEqual(supportNotification("case_opened",12,"Cannot publish"),{type:"support_case_opened",title:"New support case #12",message:"Cannot publish",actionUrl:"/total-control?supportCase=12"});
assert.equal(supportNotification("administrator_replied",12,"Cannot publish").actionUrl,"/settings/billing-support?supportCase=12");
assert.match(supportNotification("status_changed",12,"Cannot publish","in_progress").message,/in progress/);
for(const value of [()=>supportNotification("case_opened",0,"x"),()=>supportNotification("case_opened",1," "),()=>supportNotification("status_changed",1,"x","invented"),()=>uniqueSupportRecipients([1,0])])assert.throws(value);
console.log("B176 governed support notification contracts: PASS");
