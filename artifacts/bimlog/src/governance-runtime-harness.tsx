import { createRoot } from "react-dom/client";
import { useState } from "react";
import { WorkItemDeliveryWorkflowPanel } from "./components/job-operations/WorkItemDeliveryWorkflowPanel";
import { governanceThresholdLabel } from "./lib/governance-threshold-presentation";
import { useAuthStore } from "./store/auth";
import "./index.css";
if (!import.meta.env.DEV || !["localhost","127.0.0.1"].includes(location.hostname)) throw new Error("Local fixture only");
useAuthStore.setState({ user:{id:1} as any, token:"synthetic-local-fixture-only" });
let count = 0;
function Harness() {
  const [spanish,setSpanish]=useState(false),[narrow,setNarrow]=useState(false),[mode,setMode]=useState("allowed");
  const tt=(en:string,es:string)=>spanish?es:en;
  const api=async (_path:string, init?:RequestInit) => {
    if (mode === "error") throw Object.assign(new Error("No se pudo completar la operación."), {code:"DELIVERY_WORKFLOW_TASKS_INCOMPLETE"});
    if (init) count++;
    const complete=count>=2;
    return {workItemId:"TEST",templateCode:"TEST-WORKFLOW",templateVersion:1,source:"company",selection:"explicit",status:"active",phaseIndex:1,
      revision:count+1,canManage:true,fingerprint:"synthetic",governancePolicy:{code:"TEST-POLICY",version:1,versionId:"test-policy-v1",fingerprint:"synthetic",definition:{scope:{allWorkflows:false},validation:{}}},
      governanceDecision:{progress:{approved:Math.min(count,2),stages:[{role:"PROJECT_LEADER",level:1,action:"complete_phase"},{role:"PROJECT_LEADER",level:1,action:"complete_deliverable"}],
        next:complete?null:{role:"PROJECT_LEADER",level:1,action:count?"complete_deliverable":"complete_phase"},complete},
        progressCode:null,approvalCode:complete?"DELIVERY_WORKFLOW_ALREADY_APPROVED":mode==="wrong-role"?"WORKFLOW_POLICY_ROLE_REQUIRED":null,
        currentChangeCode:mode==="locked"?"WORKFLOW_POLICY_CHANGE_FORBIDDEN":null,reopenCode:"WORKFLOW_POLICY_CHANGE_FORBIDDEN",
        executeCode:null,reviewCode:null,advanceRoleCode:null},
      definition:{phases:[{id:"phase",name:"TEST phase",tasks:[{id:"task",name:"TEST checkpoint",requiredDocuments:[]}],completionRule:"all_tasks_complete",qcRequired:false,approvalRequired:false}],transitions:[],reopen:{role:"approve"}},
      roles:[{role:"execute",userId:2},{role:"review",userId:1},{role:"approve",userId:1}],
      steps:[{phaseId:"phase",taskId:"task",status:"complete",completedById:2}],evidence:[],checks:[{phaseId:"phase",qcApprovedAt:null,approvedAt:complete?"2026-09-26":null}],events:[]};
  };
  return <main style={{width:narrow?390:"100%",maxWidth:"100%",padding:12}}>
    <h1>C010 actual-component fixture — synthetic transport, not deployed acceptance</h1>
    <button onClick={()=>setSpanish(!spanish)}>English / Español</button>
    <label><input type="checkbox" checked={narrow} onChange={e=>setNarrow(e.target.checked)}/>390px container</label>
    <label>TEST scenario<select value={mode} onChange={e=>{count=0;setMode(e.target.value);}}><option value="allowed">Allowed</option><option value="wrong-role">Wrong role</option><option value="locked">Locked changes</option><option value="error">Read failure</option></select></label>
    <p>{governanceThresholdLabel({currency:"USD",amountMinor:2500000},spanish)}</p>
    <WorkItemDeliveryWorkflowPanel key={mode} projectId={1} workItemId="TEST" members={[{id:1,fullName:"TEST reviewer"},{id:2,fullName:"TEST executor"}]} files={[]} api={api} tt={tt}/>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
