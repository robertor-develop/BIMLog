import assert from "node:assert/strict";
import { intakePhaseHoursPreview, intakePhaseHoursPreviewLabel } from "./intake-phase-hours-preview";
const phases=[{id:"p",code:"PRE",name:"Preliminary"},{id:"c",code:"COO",name:"Coordination"},{id:"f",code:"FOR",name:"For record"},{id:"a",code:"ASB",name:"As built"}];
const definition={phases,economicAllocation:{phases:[{phaseId:"p",code:"PRE",workflowPercent:"20"},{phaseId:"c",code:"COO",workflowPercent:"30"},{phaseId:"f",code:"FOR",workflowPercent:"40"},{phaseId:"a",code:"ASB",workflowPercent:"10"}]}};
assert.deepEqual(intakePhaseHoursPreview("37.5",definition).map((row:{code:string;plannedHours:string})=>[row.code,row.plannedHours]),[["PRE","7.5"],["COO","11.25"],["FOR","15"],["ASB","3.75"]]);
assert.deepEqual(intakePhaseHoursPreview("37.5",{phases}),[]);
console.log("Intake phase-hour preview: PASS");
assert.equal(intakePhaseHoursPreviewLabel(100,definition),"Verified workflow allocation (100h total): PRE 20h · COO 30h · FOR 40h · ASB 10h");
