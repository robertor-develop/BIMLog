import assert from "node:assert/strict";
import { assistantMainWorkspaceWidth, assistantWorkspaceMode, fitAssistantWidthToViewport } from "./page-assistant-workspace";
for(const width of [320,390,768,1440,1920]){
  const mode=assistantWorkspaceMode(width);const panel=fitAssistantWidthToViewport(483,width);const workspace=assistantMainWorkspaceWidth(panel,width);
  if(width<=760){assert.equal(mode,"sheet");assert.equal(workspace,width);}else{assert.equal(mode,"split");assert.ok(workspace>=320);}
}
console.log("GA Block 1 build 5 responsive Agent viewport contract: PASS");
