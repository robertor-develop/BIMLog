export const LENS_NEXT_ARCHITECTURE_BOUNDARY = Object.freeze({
  schemaVersion: "1.0.0",
  capabilityOwner: "BIMLog",
  ownedCapabilities: Object.freeze([
    "construction-project-binding",
    "construction-model-binding",
    "construction-issue-workflow",
    "construction-viewpoint-workflow",
  ]),
  consumers: Object.freeze([
    "BIMLog Navisworks Lens Next 2021",
    "BIMLog Navisworks Lens Next 2025",
    "BIMLog web workspace",
  ]),
  contracts: Object.freeze([
    "lens-next bridge protocol v1",
    "lens-next model-binding contract v1",
    "lens-next visual-state contract v1",
    "lens-next reconciliation contract v1",
    "versioned external handoff contracts",
  ]),
  explicitRefusals: Object.freeze([
    "marketing-execution-authority",
    "portfolio-finance-allocation-authority",
    "legal-approval-authority",
    "knowledge-intake-routing-authority",
  ]),
});

export function assertLensNextCapabilityBoundary(capability: string): void {
  const normalized = capability.trim().toLowerCase();
  if (!(LENS_NEXT_ARCHITECTURE_BOUNDARY.ownedCapabilities as readonly string[]).includes(normalized)) {
    throw new Error(`Lens Next capability is outside BIMLog authority: ${normalized || "empty"}`);
  }
}
