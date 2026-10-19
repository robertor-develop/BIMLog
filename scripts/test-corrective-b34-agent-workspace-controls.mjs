import assert from "node:assert/strict";
import {verifyAgentWorkspace} from "./lib/hosted-agent-live-acceptance.mjs";

const valid={dock:"right",widthBefore:443,widthAfter:503,mainWorkspaceWidth:812,contentClipped:false,feedbackEnabled:false,fixEnabled:false,feedbackHint:"Coming soon",fixHint:"Coming soon",focusRestored:true};
assert.deepEqual(verifyAgentWorkspace(valid),{pass:true,errors:[]});
for(const patch of [
  {dock:"floating"},
  {widthAfter:443},
  {widthAfter:900},
  {mainWorkspaceWidth:280},
  {contentClipped:true},
  {feedbackEnabled:true},
  {fixHint:""},
  {focusRestored:false},
]) assert.equal(verifyAgentWorkspace({...valid,...patch}).pass,false);
console.log("CORRECTIVE-B34 hosted Agent workspace controls: PASS");
