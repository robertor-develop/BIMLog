export type BilingualLabel = { en: string; es: string };

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
