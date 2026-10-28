import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const exposure = JSON.parse(fs.readFileSync(path.join(root, "evidence/revision2-r01-r05/R03_FRONTEND_EXPOSURE_INVENTORY.json"), "utf8"));
const output = path.join(root, "evidence/revision2-r01-r05/R04_USER_JOURNEY_RECONCILIATION.json");

const requirements = [
  ["J01", "complete_frontend_backend_parity", "needs_route_adjudication", "R03 exposes every backend capability and preserves unresolved dynamic-reference candidates for source review."],
  ["J02", "role_based_organization_without_capability_removal", "partial", "Role-specific defaults exist, but no universal visible searchable capability directory is present."],
  ["J03", "two_navigation_levels", "confirmed_gap", "Daily navigation exists; the full visible searchable All Tools level is absent."],
  ["J04", "guided_journeys_and_direct_expert_access", "partial", "Guided project journeys exist; direct expert access is not proven complete without All Tools."],
  ["J05", "explain_instead_of_conceal", "acceptance_rule", "Complex modules must retain specific names and receive plain-language purpose/help text."],
  ["J06", "operational_dashboards", "needs_actionability_audit", "Every dashboard card must be traced to its governed records and actions."],
  ["J07", "visible_lifecycle_states", "needs_lifecycle_audit", "Every principal record needs state, missing data, actor, next action, and destination evidence."],
  ["J08", "capability_parity_classification", "implemented_as_evidence", "R02 and R03 establish complete inventories and the required exposure classifications."],
  ["J09", "no_essential_work_hidden_as_advanced", "needs_navigation_audit", "Approvals, assignments, workflows, reports, exports, and integrations require visible placement."],
  ["J10", "novice_comprehension_and_expert_power", "needs_dual_acceptance", "Both principal-journey comprehension and unrestricted authorized expert reachability are required."]
].map(([id, rule, disposition, evidence]) => ({ id, rule, disposition, evidence }));

const reconciliation = {
  schemaVersion: "bimlog-revision2-user-journey-reconciliation-v1",
  productLaw: "complete_discoverable_understandable_progressively_organized_without_capability_loss",
  protectedBehaviors: [
    "no_module_deletion",
    "no_vague_more_menu_for_functional_pages",
    "no_summary_card_substitution_for_workflows",
    "no_backend_capability_left_inaccessible_without_explicit_disposition",
    "no_merging_distinct_business_concepts_for_cosmetic_simplicity",
    "no_completion_claim_without_discoverable_executable_ui"
  ],
  navigationModel: {
    primaryDailyWork: ["Home", "Intake", "Operations", "Documents", "Coordination", "Reports"],
    fullCapabilityLevel: { label: "All Tools", visible: true, searchable: true, currentState: "missing" },
    expertDirectAccessRequired: true,
    guidedJourneyRequired: true
  },
  lifecycleQuestions: ["where_am_i", "what_state", "what_is_missing", "who_can_act", "what_happens_next", "where_result_appears"],
  exposureSnapshot: exposure.counts,
  requirements,
  implementationCandidates: [
    { id: "GAP-ALL-TOOLS", source: "J02,J03,J04,J09,J10", state: "confirmed", rule: "add_visible_searchable_role_filtered_full_capability_directory" },
    { id: "GAP-PARITY-ADJUDICATION", source: "J01,J08", state: "required", rule: "adjudicate_every_candidate_missing_frontend_before_implementation" },
    { id: "GAP-DASHBOARD-ACTIONABILITY", source: "J06", state: "required", rule: "trace_every_summary_to_records_and_actions" },
    { id: "GAP-LIFECYCLE-COMPREHENSION", source: "J07,J10", state: "required", rule: "audit_principal_records_for_six_lifecycle_questions" }
  ]
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(reconciliation, null, 2)}\n`);
console.log(`R04_JOURNEYS=WRITTEN requirements=${requirements.length} candidates=${reconciliation.implementationCandidates.length}`);
