import fs from "node:fs";
import path from "node:path";

const root=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/,value=>value.slice(1)));
const authoring=fs.readFileSync(path.join(root,"CoordinationKnowledgeAuthoring.tsx"),"utf8");
const library=fs.readFileSync(path.join(root,"CoordinationKnowledgeLibrary.tsx"),"utf8");
function expect(fragment:string,message:string){if(!authoring.includes(fragment)&&!library.includes(fragment))throw new Error(message);}
expect("expectedRevision:item.revision","Conflict editor must send optimistic revision authority.");
expect('item.status === "draft"',"Only draft Conflict Types may expose editing.");
expect("Approved revisions are immutable","Approved Conflict Types must explain immutability.");
expect("beforeunload","Dirty Conflict Type edits must warn before navigation.");
expect("Revision history","Conflict Type detail must expose history.");
console.log("coordination knowledge Build 241 behavior: PASS");
