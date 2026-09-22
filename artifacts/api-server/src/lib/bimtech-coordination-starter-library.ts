import { validateCoordinationStarterSeed } from "./coordination-knowledge-starter-seed";

type ConflictInput = readonly [string, string, string, string, string, string, string, string];

const conflict = ([code, name, disciplineA, disciplineB, elementTypeA, elementTypeB, category, stage]: ConflictInput) => ({
  code,
  name,
  description: `Synthetic BIMTECH starter candidate for recurring ${name.toLocaleLowerCase("en-US")} coordination. Review, revise and approve through the governed professional workflow before operational use.`,
  disciplineA,
  disciplineB,
  elementTypeA,
  elementTypeB,
  conflictCategory: category,
  coordinationStage: stage,
  tags: ["bimtech-starter", "synthetic", "professional-review-required"],
});

const conflictTypes: readonly ConflictInput[] = [
  ["HVAC-DUCT-BEAM", "Duct versus structural beam", "HVAC", "Structural", "Duct", "Beam", "physical_clash", "coordination"],
  ["PLBG-PIPE-BEAM", "Pipe versus structural beam", "Plumbing", "Structural", "Pipe", "Beam", "physical_clash", "coordination"],
  ["HVAC-DUCT-WALL", "Duct versus wall", "HVAC", "Architectural", "Duct", "Wall", "penetration", "coordination"],
  ["PLBG-PIPE-DUCT", "Pipe versus duct", "Plumbing", "HVAC", "Pipe", "Duct", "physical_clash", "coordination"],
  ["ELEC-TRAY-DUCT", "Cable tray versus duct", "Electrical", "HVAC", "Cable tray", "Duct", "physical_clash", "coordination"],
  ["FP-SPRINKLER-FRAMING", "Sprinkler versus structural framing", "Fire Protection", "Structural", "Sprinkler pipe", "Structural framing", "physical_clash", "coordination"],
  ["MEP-EQUIPMENT-CLEARANCE", "Equipment service clearance", "Mechanical", "Architectural", "Equipment", "Access zone", "maintenance_clearance", "coordination"],
  ["MEP-CEILING-SERVICE-ZONE", "Ceiling and service-zone conflict", "MEP", "Architectural", "Building service", "Ceiling zone", "clearance", "coordination"],
  ["MEP-ACCESS-CLEARANCE", "Access and maintenance clearance", "MEP", "Architectural", "Serviceable element", "Access route", "maintenance_clearance", "coordination"],
  ["MEP-SLEEVE-OPENING", "Sleeve and opening coordination", "MEP", "Structural", "Sleeve", "Opening", "penetration", "design_development"],
  ["HVAC-DUCT-SLAB", "Duct versus slab", "HVAC", "Structural", "Duct", "Slab", "physical_clash", "coordination"],
  ["PLBG-PIPE-SLAB", "Pipe versus slab", "Plumbing", "Structural", "Pipe", "Slab", "penetration", "coordination"],
  ["ELEC-CONDUIT-BEAM", "Conduit versus structural beam", "Electrical", "Structural", "Conduit", "Beam", "physical_clash", "coordination"],
  ["FP-SPRINKLER-DUCT", "Sprinkler versus duct", "Fire Protection", "HVAC", "Sprinkler pipe", "Duct", "physical_clash", "coordination"],
  ["MECH-PIPE-CABLE-TRAY", "Mechanical pipe versus cable tray", "Mechanical", "Electrical", "Pipe", "Cable tray", "physical_clash", "coordination"],
  ["PLBG-DRAIN-SLOPE", "Drainage slope and clearance", "Plumbing", "Architectural", "Drain pipe", "Ceiling zone", "slope_clearance", "design_development"],
  ["HVAC-DAMPER-ACCESS", "Damper access clearance", "HVAC", "Architectural", "Damper", "Access zone", "maintenance_clearance", "coordination"],
  ["ELEC-PANEL-CLEARANCE", "Electrical panel working clearance", "Electrical", "Architectural", "Electrical panel", "Working clearance", "safety_clearance", "coordination"],
  ["MECH-EQUIPMENT-STRUCTURE", "Mechanical equipment versus structure", "Mechanical", "Structural", "Equipment", "Structural framing", "physical_clash", "design_development"],
  ["ARCH-DOOR-MEP", "Door operation versus building services", "Architectural", "MEP", "Door swing", "Building service", "operational_clearance", "coordination"],
  ["MEP-SHAFT-CAPACITY", "Shaft capacity and routing", "MEP", "Architectural", "Building services", "Shaft", "space_allocation", "design_development"],
  ["FP-HEAD-CEILING", "Sprinkler head versus ceiling feature", "Fire Protection", "Architectural", "Sprinkler head", "Ceiling feature", "layout_conflict", "coordination"],
  ["HVAC-DIFFUSER-LIGHT", "Air terminal versus lighting fixture", "HVAC", "Electrical", "Air terminal", "Light fixture", "layout_conflict", "coordination"],
  ["MEP-HANGER-STRUCTURE", "Support hanger versus structure", "MEP", "Structural", "Support hanger", "Structural framing", "attachment_coordination", "construction_documentation"],
] as const;

const rules = [
  { code: "RULE-STRUCTURAL-CHANGE", title: "Structural change requires professional approval", guidance: "Do not cut, drill, resize or relocate structural elements without documented approval from the responsible structural design authority.", rationale: "Coordination knowledge must not replace structural engineering judgment.", conflictTypeCodes: ["HVAC-DUCT-BEAM", "PLBG-PIPE-BEAM", "ELEC-CONDUIT-BEAM", "MECH-EQUIPMENT-STRUCTURE", "MEP-HANGER-STRUCTURE"], exceptions: ["Only an explicitly approved project procedure may define a narrower review path."] },
  { code: "RULE-PENETRATION-REVIEW", title: "Penetrations require coordinated review", guidance: "Confirm opening location, size, fire-rating, waterproofing and responsible-party approval before recording a penetration solution.", rationale: "A geometric fit alone does not establish a compliant opening.", conflictTypeCodes: ["HVAC-DUCT-WALL", "PLBG-PIPE-SLAB", "MEP-SLEEVE-OPENING"], exceptions: [] },
  { code: "RULE-MAINTAIN-ACCESS", title: "Maintain service and inspection access", guidance: "Evaluate manufacturer, code, safety and owner access requirements before accepting a routing or equipment arrangement.", rationale: "A clash-free arrangement may remain operationally unusable.", conflictTypeCodes: ["MEP-EQUIPMENT-CLEARANCE", "MEP-ACCESS-CLEARANCE", "HVAC-DAMPER-ACCESS", "ELEC-PANEL-CLEARANCE"], exceptions: [] },
  { code: "RULE-SYSTEM-PERFORMANCE", title: "Protect system performance", guidance: "Evaluate pressure, slope, drainage, airflow, electrical and fire-protection consequences before accepting a reroute or resize option.", rationale: "Coordination changes can alter design performance.", conflictTypeCodes: ["PLBG-PIPE-DUCT", "PLBG-DRAIN-SLOPE", "FP-SPRINKLER-DUCT", "HVAC-DIFFUSER-LIGHT"], exceptions: [] },
  { code: "RULE-DESIGN-AUTHORITY", title: "Escalate design changes to the responsible authority", guidance: "Use the project RFI or approved design-review process when a proposed resolution changes design intent, performance or specified clearances.", rationale: "BIMLog records options and decisions; it does not issue engineering direction.", conflictTypeCodes: ["MEP-SHAFT-CAPACITY", "MEP-CEILING-SERVICE-ZONE", "MECH-EQUIPMENT-STRUCTURE"], exceptions: [] },
  { code: "RULE-FIRE-LIFE-SAFETY", title: "Preserve fire and life-safety requirements", guidance: "Require the responsible fire-protection and design authorities to review changes affecting sprinklers, rated assemblies or egress-related clearances.", rationale: "Life-safety coordination requires accountable professional review.", conflictTypeCodes: ["FP-SPRINKLER-FRAMING", "FP-SPRINKLER-DUCT", "FP-HEAD-CEILING", "HVAC-DUCT-WALL"], exceptions: [] },
  { code: "RULE-ARCHITECTURAL-CLEARANCE", title: "Coordinate architectural operation and finish zones", guidance: "Confirm door operation, ceiling intent, finish tolerances and access zones before accepting service locations.", rationale: "Geometric coordination must preserve intended architectural function.", conflictTypeCodes: ["ARCH-DOOR-MEP", "MEP-CEILING-SERVICE-ZONE", "FP-HEAD-CEILING", "HVAC-DIFFUSER-LIGHT"], exceptions: [] },
  { code: "RULE-DOCUMENT-DECISION", title: "Document the approved project decision", guidance: "Record the actual resolution, responsible trade, applicable reference and evidence before closing the issue.", rationale: "Traceable project evidence is required before a case can inform organizational knowledge.", conflictTypeCodes: conflictTypes.map(item => item[0]), exceptions: [] },
] as const;

const methods = [
  { code: "METHOD-REROUTE-SERVICE", name: "Evaluate service rerouting", description: "Evaluate an alternate service route without presuming that the change is acceptable.", conflictTypeCodes: ["HVAC-DUCT-BEAM", "PLBG-PIPE-BEAM", "PLBG-PIPE-DUCT", "ELEC-TRAY-DUCT", "FP-SPRINKLER-DUCT", "MECH-PIPE-CABLE-TRAY"], ruleCodes: ["RULE-SYSTEM-PERFORMANCE", "RULE-DOCUMENT-DECISION"], responsibleTrade: null, constraints: ["Confirm available space and downstream system performance", "Coordinate supports and access"], advantages: ["May preserve primary structural and architectural intent"], disadvantages: ["May affect pressure, slope, length or installation sequence"], requiredApprovals: ["Responsible design authority", "Affected trade coordinator"], rfiRequirement: "conditional" },
  { code: "METHOD-CHANGE-ELEVATION", name: "Evaluate service elevation change", description: "Evaluate raising or lowering the coordinated service within the approved zone.", conflictTypeCodes: ["HVAC-DUCT-BEAM", "PLBG-PIPE-DUCT", "ELEC-TRAY-DUCT", "FP-SPRINKLER-DUCT", "MEP-CEILING-SERVICE-ZONE"], ruleCodes: ["RULE-SYSTEM-PERFORMANCE", "RULE-ARCHITECTURAL-CLEARANCE"], responsibleTrade: null, constraints: ["Confirm ceiling, slope, insulation and access clearances"], advantages: ["May resolve a local conflict without changing element size"], disadvantages: ["May transfer the conflict or reduce usable clearance"], requiredApprovals: ["Affected design authority"], rfiRequirement: "conditional" },
  { code: "METHOD-RESIZE-SERVICE", name: "Evaluate service resizing", description: "Evaluate a revised service size only through responsible design review.", conflictTypeCodes: ["HVAC-DUCT-BEAM", "HVAC-DUCT-SLAB", "MEP-SHAFT-CAPACITY"], ruleCodes: ["RULE-SYSTEM-PERFORMANCE", "RULE-DESIGN-AUTHORITY"], responsibleTrade: null, constraints: ["Design performance must be recalculated", "Specified clearances and fabrication limits remain applicable"], advantages: ["May preserve routing where space is constrained"], disadvantages: ["Can change system performance and cost"], requiredApprovals: ["Responsible engineer of record"], rfiRequirement: "required" },
  { code: "METHOD-COORDINATED-OPENING", name: "Evaluate coordinated opening", description: "Evaluate a sleeve or opening through the governed penetration workflow.", conflictTypeCodes: ["HVAC-DUCT-WALL", "PLBG-PIPE-SLAB", "MEP-SLEEVE-OPENING"], ruleCodes: ["RULE-PENETRATION-REVIEW", "RULE-FIRE-LIFE-SAFETY"], responsibleTrade: null, constraints: ["Structural, fire-rating and waterproofing requirements apply"], advantages: ["May preserve the intended service route"], disadvantages: ["May require engineering, detailing and field controls"], requiredApprovals: ["Structural design authority when applicable", "Architect or responsible assembly authority"], rfiRequirement: "required" },
  { code: "METHOD-RELOCATE-EQUIPMENT", name: "Evaluate equipment relocation", description: "Evaluate relocating equipment while preserving service, access and performance requirements.", conflictTypeCodes: ["MEP-EQUIPMENT-CLEARANCE", "MECH-EQUIPMENT-STRUCTURE", "ELEC-PANEL-CLEARANCE"], ruleCodes: ["RULE-MAINTAIN-ACCESS", "RULE-DESIGN-AUTHORITY"], responsibleTrade: null, constraints: ["Confirm connections, supports, working clearances and owner access"], advantages: ["May restore maintainable access"], disadvantages: ["Can affect layout, cost and connected systems"], requiredApprovals: ["Responsible design authority", "Owner representative when required"], rfiRequirement: "conditional" },
  { code: "METHOD-RESEQUENCE-ZONES", name: "Evaluate service-zone resequencing", description: "Evaluate a coordinated ordering of systems within the available zone.", conflictTypeCodes: ["MEP-CEILING-SERVICE-ZONE", "MEP-SHAFT-CAPACITY", "MECH-PIPE-CABLE-TRAY"], ruleCodes: ["RULE-ARCHITECTURAL-CLEARANCE", "RULE-SYSTEM-PERFORMANCE"], responsibleTrade: null, constraints: ["All affected disciplines and access requirements must be reviewed"], advantages: ["May resolve several related conflicts together"], disadvantages: ["Requires multi-trade agreement and careful sequencing"], requiredApprovals: ["Affected trade coordinators", "Project design authority when intent changes"], rfiRequirement: "conditional" },
  { code: "METHOD-RELOCATE-FIXTURE", name: "Evaluate fixture relocation", description: "Evaluate relocating a ceiling or wall fixture within approved design tolerances.", conflictTypeCodes: ["FP-HEAD-CEILING", "HVAC-DIFFUSER-LIGHT", "ARCH-DOOR-MEP"], ruleCodes: ["RULE-FIRE-LIFE-SAFETY", "RULE-ARCHITECTURAL-CLEARANCE"], responsibleTrade: null, constraints: ["Coverage, photometrics, airflow, accessibility and design intent may apply"], advantages: ["May resolve localized layout interference"], disadvantages: ["May affect performance or visual alignment"], requiredApprovals: ["Responsible design authority"], rfiRequirement: "conditional" },
  { code: "METHOD-ADJUST-SUPPORT", name: "Evaluate support adjustment", description: "Evaluate alternate support location or configuration without altering structural authority.", conflictTypeCodes: ["MEP-HANGER-STRUCTURE", "FP-SPRINKLER-FRAMING"], ruleCodes: ["RULE-STRUCTURAL-CHANGE", "RULE-DOCUMENT-DECISION"], responsibleTrade: null, constraints: ["Verify loads, attachment zones and manufacturer requirements"], advantages: ["May avoid service rerouting"], disadvantages: ["May require delegated-design review"], requiredApprovals: ["Responsible structural or delegated design authority"], rfiRequirement: "conditional" },
] as const;

export const BIMTECH_COORDINATION_STARTER_LIBRARY = validateCoordinationStarterSeed({
  schemaVersion: 1,
  seedKey: "BIMTECH.COORDINATION.STARTER.V1",
  displayName: "BIMTECH Coordination Starter Library v1",
  provenance: {
    source: "BIMLog controlled synthetic starter content; no project or customer records",
    preparedFor: "BIMTECH professional review",
    preparedAt: "2026-09-22",
    synthetic: true,
    professionalApproval: "not_reviewed",
  },
  conflictTypes: conflictTypes.map(conflict),
  rules,
  resolutionMethods: methods,
});
