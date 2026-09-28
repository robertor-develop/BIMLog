import crypto from "node:crypto";

export type ProfessionalReportSection = "identity" | "coordination" | "rfi" | "submittal" | "meetings" | "baseline";
export type ProfessionalReportActor = { tenantId: number; projectIds: readonly number[]; permissions: readonly string[] };
export type ProfessionalReportPreset = {
  id: string;
  tenantId: number;
  projectId: number;
  name: string;
  purpose: string;
  logoAssetId?: string;
  sections: readonly ProfessionalReportSection[];
};

const sectionPermission: Partial<Record<ProfessionalReportSection, string>> = {
  rfi: "rfi:read",
  submittal: "submittal:read",
  meetings: "meeting:read",
  baseline: "reporting-baseline:read",
};

export function governProfessionalReportPreset(preset: ProfessionalReportPreset, actor: ProfessionalReportActor) {
  if (preset.tenantId !== actor.tenantId || !actor.projectIds.includes(preset.projectId)) throw new Error("REPORT_PRESET_SCOPE_DENIED");
  if (!preset.id.trim() || !preset.name.trim() || !preset.purpose.trim()) throw new Error("REPORT_PRESET_IDENTITY_REQUIRED");
  const sections = [...new Set(preset.sections)].filter(section => {
    const required = sectionPermission[section];
    return !required || actor.permissions.includes(required);
  });
  if (!sections.includes("identity")) sections.unshift("identity");
  const model = { ...preset, sections };
  return Object.freeze({ ...model, presetFingerprint: crypto.createHash("sha256").update(JSON.stringify(model)).digest("hex") });
}
