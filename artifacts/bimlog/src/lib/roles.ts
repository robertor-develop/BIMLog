// BIMLog project member roles — 6-tier system (Phase 2)
// Source of truth for role labels, descriptions, colors, and capabilities.

export type RoleKey =
  | "project_admin"
  | "convention_manager"
  | "discipline_lead"
  | "member"
  | "sub_trade"
  | "read_only";

export interface RoleInfo {
  key: RoleKey;
  label: string;
  labelEs: string;
  description: string;
  descriptionEs: string;
  color: string;       // Tailwind bg+text classes
  badgeBg: string;     // hex bg for inline-style badges
  badgeText: string;   // hex text for inline-style badges
  canTransfer: boolean;
  canUpload: boolean;
  canEditConvention: boolean;
}

export const ROLES: Record<RoleKey, RoleInfo> = {
  project_admin: {
    key: "project_admin",
    label: "Project Admin",
    labelEs: "Administrador de Proyecto",
    description: "Full control. Can transfer admin to another member. Only one per project.",
    descriptionEs: "Control total. Puede transferir el rol de administrador a otro miembro. Solo uno por proyecto.",
    color: "bg-blue-100 text-blue-800",
    badgeBg: "#DBEAFE",
    badgeText: "#1E40AF",
    canTransfer: true,
    canUpload: true,
    canEditConvention: true,
  },
  convention_manager: {
    key: "convention_manager",
    label: "Convention Manager",
    labelEs: "Gerente de Convención",
    description: "Can create and edit naming conventions. Delegated by Project Admin.",
    descriptionEs: "Puede crear y editar convenciones de nomenclatura. Delegado por el Administrador del Proyecto.",
    color: "bg-purple-100 text-purple-800",
    badgeBg: "#EDE9FE",
    badgeText: "#6D28D9",
    canTransfer: false,
    canUpload: true,
    canEditConvention: true,
  },
  discipline_lead: {
    key: "discipline_lead",
    label: "Discipline Lead",
    labelEs: "Líder de Disciplina",
    description: "Leads a specific discipline. Can approve files in their discipline.",
    descriptionEs: "Lidera una disciplina específica. Puede aprobar archivos en su disciplina.",
    color: "bg-cyan-100 text-cyan-800",
    badgeBg: "#CFFAFE",
    badgeText: "#155E75",
    canTransfer: false,
    canUpload: true,
    canEditConvention: false,
  },
  member: {
    key: "member",
    label: "Member",
    labelEs: "Miembro",
    description: "Standard team member. Can upload and use Coordination Hub.",
    descriptionEs: "Miembro estándar del equipo. Puede subir archivos y usar el Coordination Hub.",
    color: "bg-green-100 text-green-800",
    badgeBg: "#DCFCE7",
    badgeText: "#166534",
    canTransfer: false,
    canUpload: true,
    canEditConvention: false,
  },
  sub_trade: {
    key: "sub_trade",
    label: "Sub-trade",
    labelEs: "Subcontratista",
    description: "External subcontractor. Can only upload via Coordination Hub. Cannot view other modules.",
    descriptionEs: "Subcontratista externo. Solo puede subir archivos via Coordination Hub. No puede ver otros módulos.",
    color: "bg-amber-100 text-amber-800",
    badgeBg: "#FEF3C7",
    badgeText: "#92400E",
    canTransfer: false,
    canUpload: true,
    canEditConvention: false,
  },
  read_only: {
    key: "read_only",
    label: "Read Only",
    labelEs: "Solo Lectura",
    description: "Can view files and reports. Cannot upload or edit.",
    descriptionEs: "Puede ver archivos e informes. No puede subir ni editar.",
    color: "bg-gray-100 text-gray-700",
    badgeBg: "#F3F4F6",
    badgeText: "#374151",
    canTransfer: false,
    canUpload: false,
    canEditConvention: false,
  },
};

export const ROLE_KEYS: RoleKey[] = [
  "project_admin",
  "convention_manager",
  "discipline_lead",
  "member",
  "sub_trade",
  "read_only",
];

export function getRole(role: string | undefined | null): RoleInfo | undefined {
  if (!role) return undefined;
  return ROLES[role as RoleKey];
}

export function isAdminRole(role: string | undefined | null): boolean {
  return role === "project_admin";
}

export function canEditConvention(role: string | undefined | null): boolean {
  return role === "project_admin" || role === "convention_manager";
}

export function canUpload(role: string | undefined | null): boolean {
  if (!role) return false;
  const r = ROLES[role as RoleKey];
  return r ? r.canUpload : false;
}
