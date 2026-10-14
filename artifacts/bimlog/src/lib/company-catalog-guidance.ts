export type CompanyCatalogKind = "client" | "discipline" | "service" | "phase";

export type CompanyCatalogEntryState = "active" | "inactive" | "retired";

export type CompanyCatalogSummary = {
  active: number;
  inactive: number;
  retired: number;
  total: number;
};

export const COMPANY_CATALOG_GUIDANCE: Record<CompanyCatalogKind, {
  purpose: { en: string; es: string };
  usedBy: { en: string; es: string };
}> = {
  client: {
    purpose: { en: "Approved customer companies available during Job Intake.", es: "Empresas cliente aprobadas disponibles durante el Ingreso del Trabajo." },
    usedBy: { en: "Project identity and contract setup", es: "Identidad del proyecto y configuración contractual" },
  },
  discipline: {
    purpose: { en: "Company disciplines used to classify scope and delivery work.", es: "Disciplinas de la empresa usadas para clasificar alcance y entregas." },
    usedBy: { en: "Job Intake, work packages, and operational tasks", es: "Ingreso del Trabajo, paquetes de trabajo y tareas operativas" },
  },
  service: {
    purpose: { en: "Services the company can provide or procure.", es: "Servicios que la empresa puede prestar o contratar." },
    usedBy: { en: "Job Intake and service relationships", es: "Ingreso del Trabajo y relaciones de servicio" },
  },
  phase: {
    purpose: { en: "Delivery phases used to organize planned work.", es: "Fases de entrega usadas para organizar el trabajo planificado." },
    usedBy: { en: "Job Intake, work packages, and operational tasks", es: "Ingreso del Trabajo, paquetes de trabajo y tareas operativas" },
  },
};

export function summarizeCompanyCatalog(entries: Array<{ state: CompanyCatalogEntryState }>): CompanyCatalogSummary {
  const summary: CompanyCatalogSummary = { active: 0, inactive: 0, retired: 0, total: entries.length };
  for (const entry of entries) summary[entry.state] += 1;
  return summary;
}

export function filterCompanyCatalogEntries<T extends { code: string; name: string; aliases: string[]; state: CompanyCatalogEntryState }>(
  entries: T[],
  query: string,
  state: CompanyCatalogEntryState | "all",
): T[] {
  const needle = query.trim().toLocaleLowerCase();
  return entries.filter((entry) => {
    if (state !== "all" && entry.state !== state) return false;
    if (!needle) return true;
    return [entry.code, entry.name, ...entry.aliases].some(value => value.toLocaleLowerCase().includes(needle));
  });
}
