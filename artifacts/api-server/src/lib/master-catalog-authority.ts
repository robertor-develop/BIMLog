export const MASTER_CATALOG_AUTHORITY = {
  client: {
    source: "companies",
    projectBinding: "project_company_relationships",
    relationshipType: "client",
  },
  discipline: {
    source: "enterprise_trades",
    projectBinding: "company_trade_relationships",
  },
  service: {
    source: "enterprise_services",
    projectBinding: "project_service_relationships",
  },
  phase: {
    source: "enterprise_phases",
    projectBinding: "project_phase_relationships",
  },
} as const;

export type MasterCatalogKind = keyof typeof MASTER_CATALOG_AUTHORITY;

/**
 * Client and discipline already have canonical enterprise authorities. Keeping
 * this mapping explicit prevents Intake or Operations from introducing a
 * second, project-local catalog for the same business identity.
 */
export function masterCatalogAuthority(kind: MasterCatalogKind) {
  return MASTER_CATALOG_AUTHORITY[kind];
}
