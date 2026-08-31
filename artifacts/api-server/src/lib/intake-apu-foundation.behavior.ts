import assert from "node:assert/strict";
import { normalizeIntakeApuFoundation, summarizeIntakeApuFoundation } from "./intake-apu-foundation";

const foundation = normalizeIntakeApuFoundation({
  participants: [
    { id: "BIMTECH", companyId: 1, companyName: "BIMTech", roles: ["service_provider"] },
    { id: "GC", companyId: 2, companyName: "General Contractor", roles: ["general_contractor", "customer"] },
    { id: "HVAC-A", companyId: 3, companyName: "HVAC Company A", roles: ["trade_contractor", "customer"] },
    { id: "OWNER", companyId: 4, companyName: "Project Owner", roles: ["owner", "customer"] },
  ],
  engagements: [
    { id: "ENG-GC", providerParticipantId: "BIMTECH", customerParticipantId: "GC" },
    { id: "ENG-HVAC", providerParticipantId: "BIMTECH", customerParticipantId: "HVAC-A" },
    { id: "ENG-OWNER", providerParticipantId: "BIMTECH", customerParticipantId: "OWNER" },
  ],
  contracts: [
    { id: "GC-BASE", engagementId: "ENG-GC", title: "BIM Coordination", type: "base_contract", status: "in_progress" },
    { id: "HVAC-BASE", engagementId: "ENG-HVAC", title: "Sheet Metal Drafting", type: "base_contract", status: "approved" },
    { id: "HVAC-CO1", engagementId: "ENG-HVAC", title: "Floors 4-8", type: "change_order", parentContractId: "HVAC-BASE", status: "draft" },
    { id: "OWNER-DOCS", engagementId: "ENG-OWNER", title: "Document Control", type: "base_contract", status: "in_progress" },
  ],
  apus: [
    { id: "APU-COORD", contractId: "GC-BASE", title: "BIM Coordination", serviceKey: "bim_coordination", estimateMethod: "hours_rate", rate: "37.99", rateSource: "portfolio_default" },
    { id: "APU-DRAFT", contractId: "HVAC-BASE", title: "Sheet Metal Drafting", serviceKey: "sheet_metal_drafting", estimateMethod: "hours_rate", rate: "35.47", rateSource: "portfolio_default" },
    { id: "APU-CO1", contractId: "HVAC-CO1", title: "Additional drafting Floors 4-8", serviceKey: "sheet_metal_drafting", estimateMethod: "floor_area" },
    { id: "APU-DOCS", contractId: "OWNER-DOCS", title: "Document Organization", serviceKey: "document_control", estimateMethod: "task_deliverable" },
  ],
  workPackages: [
    { id: "WP-F4", apuId: "APU-CO1", title: "Floor 4", floor: "4", task: "Drafting" },
    { id: "WP-F5", apuId: "APU-CO1", title: "Floor 5", floor: "5", task: "Drafting" },
  ],
});

assert.deepEqual(summarizeIntakeApuFoundation(foundation), {
  participatingCompanies: 4,
  customerRelationships: 3,
  contracts: 4,
  apus: 4,
  workPackages: 2,
  apusByContract: { "GC-BASE": 1, "HVAC-BASE": 1, "HVAC-CO1": 1, "OWNER-DOCS": 1 },
});
assert.throws(
  () => normalizeIntakeApuFoundation({ participants: foundation.participants, engagements: [], contracts: [{ id: "CO", engagementId: "missing", title: "CO", type: "change_order" }] }),
  /CONTRACT_ENGAGEMENT_UNKNOWN/,
);
assert.throws(
  () => normalizeIntakeApuFoundation({ participants: foundation.participants, engagements: foundation.engagements, contracts: [{ id: "CO", engagementId: "ENG-GC", title: "CO", type: "change_order" }] }),
  /PARENT_CONTRACT_REQUIRED/,
);
assert.throws(
  () => normalizeIntakeApuFoundation({ participants: foundation.participants, engagements: foundation.engagements, contracts: foundation.contracts, apus: [{ id: "A", contractId: "missing", title: "A", serviceKey: "drafting" }] }),
  /APU_CONTRACT_UNKNOWN/,
);

console.log("Intake/APU foundation behavior: PASS");
