import assert from "node:assert/strict";
import { ASSISTANT_WIDTH_DEFAULT, clampAssistantWidth, readAssistantWorkspace, writeAssistantWorkspace } from "./page-assistant-workspace";

assert.equal(clampAssistantWidth(120), 360);
assert.equal(clampAssistantWidth(900), 680);
assert.equal(clampAssistantWidth(600, 800), 480);
assert.deepEqual(readAssistantWorkspace(null), { width: ASSISTANT_WIDTH_DEFAULT, dock: "right", collapsed: false });

const values = new Map<string,string>();
const storage = { getItem: (key:string)=>values.get(key) ?? null, setItem: (key:string,value:string)=>void values.set(key,value) };
writeAssistantWorkspace(storage, 512, "left", true);
assert.deepEqual(readAssistantWorkspace(storage), { width: 512, dock: "left", collapsed: true });
console.log("page assistant workspace behavior: pass");
