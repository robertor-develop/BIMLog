import assert from "node:assert/strict";
import { loadProcoreIntakeState, saveProcoreIntakeState } from "./procore-intake-state";

const rows=new Map<string,any>();
const fake={async query(sql:string,values:unknown[]=[]){
  if(sql.includes("CREATE TABLE"))return {rows:[]};
  const key=`${values[0]}:${values[1]}:${values[2]}`;
  if(sql.includes("SELECT goal"))return {rows:rows.has(key)?[rows.get(key)]:[]};
  if(sql.includes("INSERT INTO procore_intake_states")){
    rows.set(key,{goal:values[3],needed:values[4],destination_project_id:values[2],messages:JSON.parse(String(values[5])),selected_sources:JSON.parse(String(values[6])),updated_at:new Date("2026-10-30T12:00:00Z")});
    return {rows:[]};
  }
  throw new Error("unexpected query");
}};

const saved=await saveProcoreIntakeState(20,31,700,{goal:"Review submittals",needed:"Current approved PDFs",messages:[{role:"user",content:"Continue"}],selectedSources:[{ref:"file:900:4",projectRef:"project:900",fileId:"4",name:"A.pdf",versionId:"v3",versionLabel:"3",mimeType:"application/pdf"}]},fake);
assert.equal(saved.goal,"Review submittals");
assert.equal(saved.selectedSources[0].versionId,"v3");
assert.equal((await loadProcoreIntakeState(20,31,700,fake)).messages[0].content,"Continue");
assert.equal((await loadProcoreIntakeState(21,31,700,fake)).goal,"");
assert.equal((await loadProcoreIntakeState(20,38,700,fake)).goal,"");
assert.equal((await loadProcoreIntakeState(20,31,701,fake)).goal,"");
console.log("Procore intake durable state contract and user/company/project isolation: PASS");
