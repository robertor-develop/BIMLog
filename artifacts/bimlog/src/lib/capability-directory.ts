import type { AccessProfile, AccessSurface } from "@/lib/access-profile";

export type CapabilityAudience = "authenticated" | "project" | AccessSurface;
export type CapabilityGroup = "Home" | "Intake" | "Operations" | "Documents" | "Coordination" | "Reports" | "Administration" | "Settings";

export interface CapabilityDirectoryEntry {
  id: string;
  group: CapabilityGroup;
  name: { en: string; es: string };
  purpose: { en: string; es: string };
  tasks: string[];
  href: string;
  audience: CapabilityAudience;
  projectRequired?: boolean;
}

export const capabilityDirectory: CapabilityDirectoryEntry[] = [
  { id: "home", group: "Home", name: { en: "Home", es: "Inicio" }, purpose: { en: "Review projects, priorities, and company work.", es: "Revise proyectos, prioridades y trabajo de la empresa." }, tasks: ["dashboard", "projects", "priorities"], href: "/dashboard", audience: "dashboard" },
  { id: "pending", group: "Home", name: { en: "Pending items", es: "Pendientes" }, purpose: { en: "Open work waiting for your action.", es: "Abra trabajo que espera su acción." }, tasks: ["approvals", "assignments", "review"], href: "/pending", audience: "authenticated" },
  { id: "intake", group: "Intake", name: { en: "Job Intake", es: "Ingreso de trabajo" }, purpose: { en: "Define project identity, contracts, workflows, and activation readiness.", es: "Defina identidad, contratos, flujos y preparación de activación." }, tasks: ["activate", "contracts", "workflows"], href: "/projects/:projectId/intake", audience: "project", projectRequired: true },
  { id: "operations", group: "Operations", name: { en: "Operations", es: "Operaciones" }, purpose: { en: "Plan and execute governed project work.", es: "Planifique y ejecute trabajo gobernado del proyecto." }, tasks: ["tasks", "deliverables", "time"], href: "/projects/:projectId/operations", audience: "project", projectRequired: true },
  { id: "files", group: "Documents", name: { en: "Files", es: "Archivos" }, purpose: { en: "Manage project documents and custody.", es: "Gestione documentos y custodia del proyecto." }, tasks: ["documents", "uploads", "versions"], href: "/projects/:projectId/files", audience: "project", projectRequired: true },
  { id: "rfis", group: "Documents", name: { en: "RFIs", es: "RFI" }, purpose: { en: "Create, answer, track, report, and export RFIs.", es: "Cree, responda, siga, reporte y exporte RFI." }, tasks: ["questions", "responses", "exports"], href: "/projects/:projectId/rfis", audience: "project", projectRequired: true },
  { id: "submittals", group: "Documents", name: { en: "Submittals", es: "Submittals" }, purpose: { en: "Operate the submittal register and packages.", es: "Opere el registro y paquetes de submittals." }, tasks: ["register", "packages", "reviews"], href: "/projects/:projectId/submittals", audience: "project", projectRequired: true },
  { id: "coordination", group: "Coordination", name: { en: "Coordination", es: "Coordinación" }, purpose: { en: "Coordinate models, clashes, issues, and decisions.", es: "Coordine modelos, interferencias, incidencias y decisiones." }, tasks: ["clashes", "issues", "models"], href: "/projects/:projectId/coordination", audience: "project", projectRequired: true },
  { id: "lens", group: "Coordination", name: { en: "BIMLog Lens", es: "BIMLog Lens" }, purpose: { en: "Open the visual coordination workspace.", es: "Abra el espacio visual de coordinación." }, tasks: ["viewpoints", "markup", "model"], href: "/lens-next", audience: "authenticated" },
  { id: "knowledge", group: "Coordination", name: { en: "Coordination Knowledge", es: "Conocimiento de coordinación" }, purpose: { en: "Find reviewed precedents and resolution methods.", es: "Encuentre precedentes y métodos de resolución revisados." }, tasks: ["precedents", "methods", "guidance"], href: "/knowledge", audience: "authenticated" },
  { id: "reports", group: "Reports", name: { en: "Reports", es: "Reportes" }, purpose: { en: "Generate project reports and exports.", es: "Genere reportes y exportaciones del proyecto." }, tasks: ["reports", "pdf", "excel"], href: "/projects/:projectId/reports", audience: "project", projectRequired: true },
  { id: "project-admin", group: "Administration", name: { en: "Project Administration", es: "Administración de proyectos" }, purpose: { en: "Administer projects, membership, and governed access.", es: "Administre proyectos, membresía y acceso gobernado." }, tasks: ["projects", "members", "permissions"], href: "/admin", audience: "project_administration" },
  { id: "catalogs", group: "Administration", name: { en: "Company Catalogs", es: "Catálogos de empresa" }, purpose: { en: "Manage reusable company clients, disciplines, services, and phases.", es: "Gestione clientes, disciplinas, servicios y fases reutilizables." }, tasks: ["clients", "disciplines", "services"], href: "/company-catalogs", audience: "company_catalogs" },
  { id: "workflows", group: "Administration", name: { en: "Delivery Workflows", es: "Flujos de entrega" }, purpose: { en: "Publish reusable company workflows for project work.", es: "Publique flujos reutilizables para el trabajo del proyecto." }, tasks: ["workflow", "publish", "versions"], href: "/company-workflows", audience: "company_workflows" },
  { id: "governance", group: "Administration", name: { en: "Workflow Governance", es: "Gobernanza de flujos" }, purpose: { en: "Control which company workflows are approved and available to projects.", es: "Controle qué flujos están aprobados y disponibles para proyectos." }, tasks: ["approval", "policy", "governance"], href: "/company-workflow-governance", audience: "company_workflows" },
  { id: "pricing-templates", group: "Administration", name: { en: "APU Library", es: "Biblioteca APU" }, purpose: { en: "Manage approved reusable pricing templates.", es: "Gestione plantillas de precios reutilizables aprobadas." }, tasks: ["apu", "pricing", "templates"], href: "/company-pricing-templates", audience: "company_pricing" },
  { id: "profile", group: "Settings", name: { en: "Profile and feature visibility", es: "Perfil y visibilidad de funciones" }, purpose: { en: "Manage your profile and visible authorized features.", es: "Gestione su perfil y funciones autorizadas visibles." }, tasks: ["profile", "features", "visibility"], href: "/profile", audience: "authenticated" },
  { id: "notifications", group: "Settings", name: { en: "Notification Settings", es: "Configuración de notificaciones" }, purpose: { en: "Choose how BIMLog notifies you.", es: "Elija cómo BIMLog le notifica." }, tasks: ["notifications", "email", "telegram"], href: "/settings/notifications", audience: "authenticated" },
  { id: "financial-controls", group: "Settings", name: { en: "Financial Controls", es: "Controles financieros" }, purpose: { en: "Configure governed financial approval controls.", es: "Configure controles de aprobación financiera gobernados." }, tasks: ["finance", "approvals", "limits"], href: "/settings/financial-controls", audience: "authenticated" },
  { id: "billing", group: "Settings", name: { en: "Billing and Support", es: "Facturación y soporte" }, purpose: { en: "Manage subscription, invoices, and support cases.", es: "Gestione suscripción, facturas y casos de soporte." }, tasks: ["billing", "invoices", "support"], href: "/settings/billing-support", audience: "authenticated" }
];

export function resolveCapabilityDirectory(profile: AccessProfile): CapabilityDirectoryEntry[] {
  const projectId = profile.facts.activeProjects[0]?.id;
  return capabilityDirectory.filter((entry) => {
    if (entry.audience === "authenticated") return profile.facts.authenticated;
    if (entry.audience === "project") return profile.facts.isSuperAdmin || Boolean(projectId);
    return profile.decisions[entry.audience]?.allow === true;
  }).map((entry) => ({ ...entry, href: entry.href.replace(":projectId", String(projectId ?? "")) }));
}
