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
  rules: [],
  resolutionMethods: [],
});
