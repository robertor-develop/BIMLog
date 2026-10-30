import assert from "node:assert/strict";
import { parseProcoreFileVersions } from "./cloud-files";

process.env.BIMLOG_PROVIDER_APPROVALS = "42:procore:browse";
const { callProcoreIntakeTool, discoverProcoreIntakeTools } = await import("./procore-intake-mcp");
const { runDiscoveredMcpTurn } = await import("./procore-intake-agent");

const tools = await discoverProcoreIntakeTools(42, async () => true);
assert.deepEqual(tools.map((tool) => tool.name), ["procore_browse", "procore_file_versions", "bimlog_propose_intake_plan"]);
assert.equal(tools[0].input_schema.required?.includes("projectId"), true);
assert.deepEqual(parseProcoreFileVersions({file_versions:[{id:77,version_number:4,created_at:"2026-10-01"}]}),[{id:"77",label:"4",createdAt:"2026-10-01"}]);
assert.deepEqual(parseProcoreFileVersions({file_versions:["bad",{}, {id:null}]}),[]);

const actor = { userId: 8, companyId: 42, projectId: 71 };
const fixtureFile = { projectRef:"project:999",fileId:"120",name:"Fixture.pdf",mimeType:"application/pdf",versions:[{id:"ver-7",label:"7",createdAt:"2026-10-01T00:00:00Z"}] };
const deps = { approved:async()=>true, versions:async(_userId:number,_ref:string)=>fixtureFile };
const proposal = await callProcoreIntakeTool(actor, "bimlog_propose_intake_plan", {
  projectId: 71,
  goal: "Review submittal evidence",
  destination: "71",
  sources: [{ ref: "file:999:120", name: "Fixture.pdf", versionId:"ver-7" }],
}, deps);
assert.equal(proposal.canonicalMutation, false);
assert.equal(proposal.confirmationRequired, true);
assert.equal(proposal.importAvailable, true);
assert.equal(proposal.confirmationTransport,"explicit_document_review_ui");
assert.equal(proposal.versionPinned, true);
assert.equal((proposal.sources as Array<{ ref: string; versionId: string }>)[0].versionId, "ver-7");
assert.equal((proposal.sources as Array<{ versionLabel: string }>)[0].versionLabel, "7");
await assert.rejects(callProcoreIntakeTool(actor,"bimlog_propose_intake_plan",{
  projectId:71,goal:"x",destination:"72",needed:"PDFs",sources:[{ref:"file:999:120",name:"Fixture.pdf",versionId:"ver-7"}],
},deps),/INTAKE_DESTINATION_SCOPE_MISMATCH/);
await assert.rejects(callProcoreIntakeTool(actor,"bimlog_propose_intake_plan",{
  projectId:71,goal:"x",destination:"71",sources:[{ref:"file:999:120",name:"Fixture.pdf",versionId:"gone"}],
},deps),/PROCORE_VERSION_UNAVAILABLE/);
await assert.rejects(callProcoreIntakeTool(actor,"bimlog_propose_intake_plan",{
  projectId:71,goal:"x",destination:"71",sources:[{ref:"file:999:120",name:"Old.pdf",versionId:"ver-7"}],
},deps),/PROCORE_SOURCE_CHANGED/);

await assert.rejects(
  callProcoreIntakeTool(actor, "procore_browse", { projectId: 72, ref: "" },deps),
  /INTAKE_PROJECT_SCOPE_MISMATCH/,
);
await assert.rejects(
  callProcoreIntakeTool(actor, "unknown_tool", { projectId: 71 },deps),
  /MCP_TOOL_NOT_FOUND/,
);

let modelSteps = 0;
let selectedTool = "";
const modelTurn = await runDiscoveredMcpTurn({
  tools,
  messages: [{ role: "user", content: "Prepare an intake plan for these sources." }],
  createMessage: async (discovered, messages) => {
    modelSteps++;
      assert.deepEqual(discovered.map((tool) => tool.name), tools.map((tool) => tool.name));
    if (modelSteps === 1) {
      selectedTool = "bimlog_propose_intake_plan";
      return {
        stop_reason: "tool_use",
        content: [{
          type: "tool_use",
          id: "fixture-tool-use",
          name: selectedTool,
          input: { projectId: 71, goal: "Review submittal evidence", destination: "71", sources: [{ ref: "file:999:120", name: "Fixture.pdf", versionId:"ver-7" }] },
        }],
      };
    }
    assert.ok(messages.some((message: any) => Array.isArray(message.content) && message.content.some((part: any) => part.type === "tool_result")));
    return { stop_reason: "end_turn", content: [{ type: "text", text: "The fixture plan is a proposal only." }] };
  },
  executeTool: (name, args) => callProcoreIntakeTool(actor, name, args,deps),
});
assert.equal(selectedTool, "bimlog_propose_intake_plan");
assert.equal(modelSteps, 2);
assert.equal(modelTurn.toolCalls.length, 1);
assert.equal(modelTurn.toolCalls[0].name, selectedTool);
assert.match(modelTurn.answer, /proposal only/);
console.log("Procore MCP discovery, exact-version proposal, scope and changed-source rejection: PASS");
