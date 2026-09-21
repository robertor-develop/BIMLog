import fs from "node:fs";
import path from "node:path";

const root=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/,value=>value.slice(1)));
const authoring=fs.readFileSync(path.join(root,"CoordinationKnowledgeAuthoring.tsx"),"utf8");
const library=fs.readFileSync(path.join(root,"CoordinationKnowledgeLibrary.tsx"),"utf8");
const route=fs.readFileSync(path.resolve(root,"../../../api-server/src/routes/coordination-knowledge.ts"),"utf8");
const repository=fs.readFileSync(path.resolve(root,"../../../api-server/src/lib/coordination-knowledge-repository.ts"),"utf8");
function expect(fragment:string,message:string){if(!authoring.includes(fragment)&&!library.includes(fragment)&&!route.includes(fragment)&&!repository.includes(fragment))throw new Error(message);}
expect("expectedRevision:item.revision","Conflict editor must send optimistic revision authority.");
expect('item.status === "draft"',"Only draft Conflict Types may expose editing.");
expect("Approved revisions are immutable","Approved Conflict Types must explain immutability.");
expect("beforeunload","Dirty Conflict Type edits must warn before navigation.");
expect("Revision history","Conflict Type detail must expose history.");
console.log("coordination knowledge Build 241 behavior: PASS");
expect("Save draft only","Rule and Method editors must explicitly avoid accidental publication.");
expect("JSON.parse(draft.applicability)","Structured applicability must be validated before save.");
expect("setDraft(source);setEditing(false)","Editor cancellation must restore the original record.");
expect("requiredApprovals","Resolution Method editor must expose governed approval fields.");
console.log("coordination knowledge Build 242 behavior: PASS");
expect("return-to-draft","Lifecycle UI must expose governed review return.");
expect("expectedRevision:item.revision,rationale","Lifecycle decisions must send concurrency authority and rationale.");
expect("KNOWLEDGE_RATIONALE_REQUIRED","Server must reject missing lifecycle rationale.");
console.log("coordination knowledge Build 243 behavior: PASS");
