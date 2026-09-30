export type BilingualLabel = { en: string; es: string };
export type CommercialPlanId = "free" | "professional" | "team" | "business" | "enterprise";

export type BuyerProfileId =
  | "bim_coordinator"
  | "coordination_firm"
  | "general_contractor"
  | "owner_operator";

export type BuyerProfile = {
  id: BuyerProfileId;
  name: BilingualLabel;
  buyingJob: BilingualLabel;
  proofNeeded: readonly BilingualLabel[];
};

export const BUYER_PROFILES: readonly BuyerProfile[] = [
  {
    id: "bim_coordinator",
    name: { en: "BIM coordinator", es: "Coordinador BIM" },
    buyingJob: {
      en: "Coordinate shop drawings and close model issues without losing the project record.",
      es: "Coordinar planos de taller y cerrar incidencias del modelo sin perder el registro del proyecto.",
    },
    proofNeeded: [
      { en: "Shop-drawing delivery continuity", es: "Continuidad de entrega de planos de taller" },
      { en: "Navisworks viewpoint continuity", es: "Continuidad de puntos de vista de Navisworks" },
    ],
  },
  {
    id: "coordination_firm",
    name: { en: "Coordination firm", es: "Empresa de coordinación" },
    buyingJob: {
      en: "Run several projects with repeatable intake, delivery and evidence workflows.",
      es: "Gestionar varios proyectos con flujos repetibles de ingreso, entrega y evidencia.",
    },
    proofNeeded: [
      { en: "Reusable company libraries", es: "Bibliotecas reutilizables de la empresa" },
      { en: "Team workload and cost visibility", es: "Visibilidad de carga y costo del equipo" },
    ],
  },
  {
    id: "general_contractor",
    name: { en: "General contractor", es: "Contratista general" },
    buyingJob: {
      en: "Connect coordination decisions to controlled RFIs, submittals, contracts and reports.",
      es: "Conectar decisiones de coordinación con RFI, submittals, contratos e informes controlados.",
    },
    proofNeeded: [
      { en: "Cross-record traceability", es: "Trazabilidad entre registros" },
      { en: "Governed client-ready exports", es: "Exportaciones gobernadas listas para el cliente" },
    ],
  },
  {
    id: "owner_operator",
    name: { en: "Owner or operator", es: "Propietario u operador" },
    buyingJob: {
      en: "Receive an auditable project record that can continue into handover and operations.",
      es: "Recibir un registro auditable que pueda continuar hacia la entrega y la operación.",
    },
    proofNeeded: [
      { en: "Verified project memory", es: "Memoria verificada del proyecto" },
      { en: "Portable handover evidence", es: "Evidencia portátil de entrega" },
    ],
  },
] as const;

export function getBuyerProfile(id: BuyerProfileId): BuyerProfile {
  const profile = BUYER_PROFILES.find((candidate) => candidate.id === id);
  if (!profile) throw new Error(`Unknown buyer profile: ${id}`);
  return profile;
}

export type PackageCapability = {
  key: string;
  group: BilingualLabel;
  name: BilingualLabel;
  includedFrom: CommercialPlanId;
  evidence: BilingualLabel;
};

export const PLAN_ORDER: readonly CommercialPlanId[] = [
  "free",
  "professional",
  "team",
  "business",
  "enterprise",
] as const;

export const PACKAGE_CAPABILITIES: readonly PackageCapability[] = [
  {
    key: "coordination.records",
    group: { en: "Coordination", es: "Coordinación" },
    name: { en: "Core coordination records", es: "Registros principales de coordinación" },
    includedFrom: "free",
    evidence: { en: "RFI and Submittal registers", es: "Registros de RFI y Submittals" },
  },
  {
    key: "coordination.naming",
    group: { en: "Coordination", es: "Coordinación" },
    name: { en: "Naming Convention Builder", es: "Constructor de convenciones de nombres" },
    includedFrom: "free",
    evidence: { en: "Governed file naming", es: "Nomenclatura de archivos gobernada" },
  },
  {
    key: "evidence.audit",
    group: { en: "Evidence", es: "Evidencia" },
    name: { en: "Document integrity and audit records", es: "Integridad documental y registros de auditoría" },
    includedFrom: "professional",
    evidence: { en: "Traceable record history", es: "Historial trazable del registro" },
  },
  {
    key: "evidence.exports",
    group: { en: "Evidence", es: "Evidencia" },
    name: { en: "Governed exports and reporting", es: "Exportaciones e informes gobernados" },
    includedFrom: "professional",
    evidence: { en: "Client-ready controlled output", es: "Salida controlada lista para el cliente" },
  },
  {
    key: "operations.team",
    group: { en: "Operations", es: "Operaciones" },
    name: { en: "Team coordination workflows", es: "Flujos de coordinación del equipo" },
    includedFrom: "team",
    evidence: { en: "Assigned and unassigned work visibility", es: "Visibilidad de trabajo asignado y sin asignar" },
  },
  {
    key: "operations.daily_reports",
    group: { en: "Operations", es: "Operaciones" },
    name: { en: "Daily Reports", es: "Informes diarios" },
    includedFrom: "team",
    evidence: { en: "Structured daily project record", es: "Registro diario estructurado del proyecto" },
  },
  {
    key: "governance.meetings",
    group: { en: "Governance", es: "Gobernanza" },
    name: { en: "Transmittals and Meeting Minutes", es: "Transmittals y minutas de reunión" },
    includedFrom: "business",
    evidence: { en: "Connected communication record", es: "Registro conectado de comunicaciones" },
  },
  {
    key: "governance.portfolio",
    group: { en: "Governance", es: "Gobernanza" },
    name: { en: "Portfolio and branding options", es: "Opciones de portafolio y marca" },
    includedFrom: "enterprise",
    evidence: { en: "Customer-agreement scope", es: "Alcance definido en el acuerdo del cliente" },
  },
] as const;

export function planIncludesCapability(planId: CommercialPlanId, capability: PackageCapability): boolean {
  return PLAN_ORDER.indexOf(planId) >= PLAN_ORDER.indexOf(capability.includedFrom);
}

export function capabilitiesForPlan(planId: CommercialPlanId): readonly PackageCapability[] {
  return PACKAGE_CAPABILITIES.filter((capability) => planIncludesCapability(planId, capability));
}

export type PackageLimits = {
  projectLimit: number | null;
  memberLimit: number | null;
};

export type PackageLimitSummary = {
  projects: string;
  members: string;
  enforcement: string;
};

export function summarizePackageLimits(
  planId: CommercialPlanId,
  limits: PackageLimits,
  locale: "en" | "es",
): PackageLimitSummary {
  const es = locale === "es";
  const projects = limits.projectLimit === null
    ? (es ? "Definidos por acuerdo" : "Defined by agreement")
    : `${limits.projectLimit} ${es
      ? (limits.projectLimit === 1 ? "proyecto activo" : "proyectos activos")
      : (limits.projectLimit === 1 ? "active project" : "active projects")}`;
  const members = limits.memberLimit === null
    ? (es ? "Definidos por habilitación" : "Defined by entitlement")
    : `${limits.memberLimit} ${es
      ? (limits.memberLimit === 1 ? "miembro por proyecto" : "miembros por proyecto")
      : (limits.memberLimit === 1 ? "member per project" : "members per project")}`;
  const enforcement = planId === "enterprise"
    ? (es
      ? "Los límites contratados se aplican según el acuerdo del cliente."
      : "Contracted limits are enforced according to the customer agreement.")
    : (es
      ? "Al alcanzar un límite, el trabajo existente permanece disponible y un administrador debe ampliar el plan antes de agregar capacidad."
      : "At a limit, existing work remains available and an administrator must expand the plan before adding capacity.");
  return { projects, members, enforcement };
}
