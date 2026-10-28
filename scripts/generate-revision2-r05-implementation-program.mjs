import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const journeys = JSON.parse(fs.readFileSync(path.join(root, "evidence/revision2-r01-r05/R04_USER_JOURNEY_RECONCILIATION.json"), "utf8"));
const output = path.join(root, "evidence/revision2-r01-r05/R05_EXACT_IMPLEMENTATION_PROGRAM.json");

const definitions = [
  ["P001", 1, "Resolve dynamic frontend API construction into the capability matcher without changing runtime behavior.", ["GAP-PARITY-ADJUDICATION"]],
  ["P002", 1, "Adjudicate every read route as operable, read-only, partial, administrator-only, API/native-only, or missing frontend.", ["GAP-PARITY-ADJUDICATION"]],
  ["P003", 1, "Adjudicate every mutation route and verify the visible permission, success, error, and evidence states.", ["GAP-PARITY-ADJUDICATION"]],
  ["P004", 1, "Reconcile route families to modules so shared services are not mistaken for duplicate business concepts.", ["GAP-PARITY-ADJUDICATION"]],
  ["P005", 1, "Freeze the confirmed parity-gap set and permanent no-capability-loss regression gate.", ["GAP-PARITY-ADJUDICATION"]],
  ["P006", 2, "Define the complete role-filtered capability-directory contract from the adjudicated registry.", ["GAP-ALL-TOOLS"]],
  ["P007", 2, "Expose a visible authenticated All Tools destination without replacing daily navigation.", ["GAP-ALL-TOOLS"]],
  ["P008", 2, "Add searchable module, capability, task, and plain-language purpose indexing.", ["GAP-ALL-TOOLS"]],
  ["P009", 2, "Expose permission and administrator-only states without leaking unauthorized records.", ["GAP-ALL-TOOLS"]],
  ["P010", 2, "Verify direct expert navigation, browser history, refresh, reopen, localization, accessibility, and responsive containment.", ["GAP-ALL-TOOLS"]],
  ["P011", 3, "Align primary daily navigation to Home, Intake, Operations, Documents, Coordination, and Reports while preserving exact destinations.", ["GAP-ALL-TOOLS"]],
  ["P012", 3, "Group the full capability directory by stable business concepts without vague More or essential Advanced buckets.", ["GAP-ALL-TOOLS"]],
  ["P013", 3, "Add plain-language purpose, prerequisite, actor, and next-step explanations to complex modules.", ["GAP-LIFECYCLE-COMPREHENSION"]],
  ["P014", 3, "Preserve guided recommendations while enabling authorized users to bypass wizards through direct expert routes.", ["GAP-ALL-TOOLS", "GAP-LIFECYCLE-COMPREHENSION"]],
  ["P015", 3, "Run role, tenant, project, company, localization, accessibility, responsive, and navigation regression for both navigation levels.", ["GAP-ALL-TOOLS"]],
  ["P016", 4, "Inventory every dashboard card and bind it to governed underlying records and actions.", ["GAP-DASHBOARD-ACTIONABILITY"]],
  ["P017", 4, "Repair cards that summarize without an actionable destination; preserve the underlying working module.", ["GAP-DASHBOARD-ACTIONABILITY"]],
  ["P018", 4, "Expose record state, missing information, authorized actor, next action, and resulting destination for principal lifecycles.", ["GAP-LIFECYCLE-COMPREHENSION"]],
  ["P019", 4, "Verify create, edit, save, refresh, reopen, error recovery, evidence trail, report, and export continuity.", ["GAP-LIFECYCLE-COMPREHENSION", "GAP-DASHBOARD-ACTIONABILITY"]],
  ["P020", 4, "Run complete capability-parity and comprehension acceptance: novice principal journey plus unrestricted authorized expert reachability.", ["GAP-PARITY-ADJUDICATION", "GAP-ALL-TOOLS", "GAP-DASHBOARD-ACTIONABILITY", "GAP-LIFECYCLE-COMPREHENSION"]]
];

const builds = definitions.map(([id, block, objective, gaps]) => ({
  id, block, objective, gaps,
  protectedBehavior: "preserve_all_legitimate_capabilities_and_stable_business_identity",
  acceptance: "focused_positive_negative_permission_isolation_persistence_connected_regression",
  publicationBoundary: id === "P010" || id === "P020"
}));
const knownGaps = new Set(journeys.implementationCandidates.map(({ id }) => id));
for (const build of builds) for (const gap of build.gaps) if (!knownGaps.has(gap)) throw new Error(`Unknown gap ${gap}`);

const program = {
  schemaVersion: "bimlog-revision2-exact-implementation-program-v1",
  generatedFrom: "R01 identity disposition + R02 backend inventory + R03 frontend exposure + R04 journey reconciliation",
  buildCount: builds.length,
  blockCount: 4,
  buildsPerBlock: 5,
  publicationEveryBlocks: 2,
  programLaw: journeys.productLaw,
  prohibitedStrategies: journeys.protectedBehaviors,
  entryGate: "P001 begins from the preserved 796-route inventory and may not convert provisional missing-frontend candidates into deletion authority.",
  exitGate: "No completion until every backend capability has an intentional exposure disposition and novice plus expert acceptance both pass.",
  builds
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(program, null, 2)}\n`);
console.log(`R05_PROGRAM=WRITTEN builds=${program.buildCount} blocks=${program.blockCount} publicationBoundaries=2`);
