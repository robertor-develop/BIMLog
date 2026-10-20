import assert from "node:assert/strict";
import { safeAssistantSession, readAssistantOpen, writeAssistantOpen, ASSISTANT_WIDTH_DEFAULT, ASSISTANT_WORKSPACE_MIN, assistantMainWorkspaceWidth, assistantWidthFromPointer, assistantWorkspaceMode, assistantWorkspaceForViewport, clampAssistantWidth, fitAssistantWidthToViewport, readAssistantWorkspace, stepAssistantWidth, writeAssistantWorkspace } from "./page-assistant-workspace";

assert.equal(clampAssistantWidth(120), 320);
assert.equal(clampAssistantWidth(900), 680);
assert.equal(clampAssistantWidth(600, 800), 480);
assert.equal(assistantWidthFromPointer(300,1200,"left"),320);
assert.equal(assistantWidthFromPointer(700,1200,"right"),500);
assert.equal(stepAssistantWidth(440,"ArrowLeft","left",1200),420);
assert.equal(stepAssistantWidth(440,"ArrowLeft","right",1200),460);
assert.equal(fitAssistantWidthToViewport(680,980),660);
assert.equal(fitAssistantWidthToViewport(680,390),680);
assert.equal(assistantWorkspaceMode(761),"split");
assert.equal(assistantWorkspaceMode(760),"fullscreen");
assert.equal(assistantMainWorkspaceWidth(680,761),ASSISTANT_WORKSPACE_MIN);
assert.equal(assistantMainWorkspaceWidth(352,900),548);
assert.equal(assistantMainWorkspaceWidth(352,1024),672);
assert.deepEqual(readAssistantWorkspace(null), { width: ASSISTANT_WIDTH_DEFAULT, dock: "right", collapsed: false });

const values = new Map<string,string>();
const storage = { getItem: (key:string)=>values.get(key) ?? null, setItem: (key:string,value:string)=>void values.set(key,value) };
writeAssistantWorkspace(storage, 512, "left", true);
assert.deepEqual(readAssistantWorkspace(storage), { width: 512, dock: "left", collapsed: true });
assert.deepEqual(assistantWorkspaceForViewport(storage, 1180), { width: 512, dock: "left", collapsed: true });
assert.deepEqual(assistantWorkspaceForViewport(storage, 900), { width: 512, dock: "left", collapsed: true });
assert.deepEqual(assistantWorkspaceForViewport(storage, 760), { width: 512, dock: "left", collapsed: false });
writeAssistantWorkspace(storage, 680, "right", false);
assert.deepEqual(assistantWorkspaceForViewport(storage, 761), { width: 441, dock: "right", collapsed: false });
assert.equal(assistantMainWorkspaceWidth(assistantWorkspaceForViewport(storage,761).width,761),320);
console.log("page assistant workspace behavior: pass");

writeAssistantOpen(storage,1,true);assert.equal(readAssistantOpen(storage,1),true);assert.equal(readAssistantOpen(storage,2),false);writeAssistantOpen(storage,1,false);assert.equal(readAssistantOpen(storage,1),false);assert.equal(readAssistantOpen({getItem(){throw new Error('blocked');}},1),false);assert.doesNotThrow(()=>writeAssistantOpen({setItem(){throw new Error('blocked');}},1,true));
assert.deepEqual(readAssistantWorkspace({getItem(){throw new Error("blocked");}}), {width:352,dock:"right",collapsed:false}); assert.doesNotThrow(()=>writeAssistantWorkspace({setItem(){throw new Error("quota");}},512,"left",true));

const deniedSession = safeAssistantSession(()=>{throw new Error("denied getter");}); assert.equal(deniedSession.getItem("draft"),null); assert.doesNotThrow(()=>deniedSession.setItem("draft","test")); assert.doesNotThrow(()=>deniedSession.removeItem("draft"));
