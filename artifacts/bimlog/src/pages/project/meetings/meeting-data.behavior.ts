import assert from "node:assert/strict";
import {loadMeetingWorkspace,updateMeetingActionItem} from "./meeting-data";
const original=globalThis.fetch;
let updateStatus=403,listStatus=200,invalid=false;
const calls:Array<{url:string;method:string;body:string|undefined}>=[];
globalThis.fetch=async(input,init)=>{const url=String(input);calls.push({url,method:init?.method??"GET",body:init?.body as string|undefined});if(init?.method==="PATCH")return Response.json({id:7,status:"completed"},{status:updateStatus});return Response.json(invalid?{invalid:true}:url.endsWith("action-items")?[{id:7,status:"open"}]:[{id:3}],{status:url.endsWith("action-items")?listStatus:200});};
try{
  const context={projectId:91,token:"synthetic-local-only"};
  assert.equal((await loadMeetingWorkspace(context)).actionItems?.length,1);
  await assert.rejects(updateMeetingActionItem(context,7,"completed"),/ACTION_ITEM_UPDATE_REJECTED:403/);
  updateStatus=404;await assert.rejects(updateMeetingActionItem(context,7,"completed"),/404/);
  updateStatus=200;await updateMeetingActionItem(context,7,"completed");assert.equal(calls.at(-1)?.url,"/api/v1/projects/91/action-items/7");assert.deepEqual(JSON.parse(calls.at(-1)!.body!),{status:"completed"});
  listStatus=403;await assert.rejects(loadMeetingWorkspace(context),/MEETING_WORKSPACE_UNAVAILABLE:200:403/);
  listStatus=200;invalid=true;await assert.rejects(loadMeetingWorkspace(context),/MEETING_WORKSPACE_RESPONSE_INVALID/);
  invalid=false;assert.equal((await loadMeetingWorkspace(context)).meetings?.length,1);
  console.log("Meeting action client: rejected403/404 updates never succeed, exact scoped PATCH, partial/invalid workspace rejected, reload recovery PASS");
}finally{globalThis.fetch=original;}
