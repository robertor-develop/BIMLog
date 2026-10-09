import assert from "node:assert/strict";
import { ASSISTANT_WIDTH_DEFAULT, assistantWidthFromPointer, clampAssistantWidth, readAssistantWorkspace, stepAssistantWidth, writeAssistantWorkspace } from "./page-assistant-workspace";

assert.equal(clampAssistantWidth(120), 360);
assert.equal(clampAssistantWidth(900), 680);
assert.equal(clampAssistantWidth(600, 800), 480);
assert.equal(assistantWidthFromPointer(300,1200,"left"),360);
assert.equal(assistantWidthFromPointer(700,1200,"right"),500);
assert.equal(stepAssistantWidth(440,"ArrowLeft","left",1200),420);
assert.equal(stepAssistantWidth(440,"ArrowLeft","right",1200),460);
assert.deepEqual(readAssistantWorkspace(null), { width: ASSISTANT_WIDTH_DEFAULT, dock: "right", collapsed: false });

const values = new Map<string,string>();
const storage = { getItem: (key:string)=>values.get(key) ?? null, setItem: (key:string,value:string)=>void values.set(key,value) };
writeAssistantWorkspace(storage, 512, "left", true);
assert.deepEqual(readAssistantWorkspace(storage), { width: 512, dock: "left", collapsed: true });
console.log("page assistant workspace behavior: pass");
