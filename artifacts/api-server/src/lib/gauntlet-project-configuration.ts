import { createHash } from "node:crypto";

export type GauntletProjectConfiguration = {
  projectId: number;
  code: string;
  name: string;
  description: string;
  companyId: number;
  clientCompanyId: number;
  location: string;
  projectType: string;
  deliveryMethod: string;
  startDate: string;
  endDate: string;
  currency: string;
  disciplineIds: readonly number[];
  roleCodes: readonly string[];
  workflowVersionIds: readonly string[];
  templateVersionId: string;
  namingConventionVersionId: string;
  synthetic: boolean;
  billingEnabled: boolean;
  externalNotificationsEnabled: boolean;
};

const text = (value: string, code: string) => {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
};

const uniquePositiveIds = (values: readonly number[], code: string) => {
  if (!values.length || values.some(value => !Number.isSafeInteger(value) || value <= 0) || new Set(values).size !== values.length)
    throw new Error(code);
  return [...values].sort((left, right) => left - right);
};

const uniqueCodes = (values: readonly string[], code: string) => {
  const normalized = values.map(value => text(value, code));
  if (!normalized.length || new Set(normalized).size !== normalized.length) throw new Error(code);
  return normalized.sort();
};

/** Read-only acceptance projection for any explicitly synthetic lifecycle project. */
export function inspectGauntletProjectConfiguration(input: GauntletProjectConfiguration) {
  if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0 || !Number.isSafeInteger(input.companyId) || input.companyId <= 0 || !Number.isSafeInteger(input.clientCompanyId) || input.clientCompanyId <= 0)
    throw new Error("GAUNTLET_PROJECT_IDENTITY_INVALID");
  if (!input.synthetic || input.billingEnabled || input.externalNotificationsEnabled)
    throw new Error("GAUNTLET_PROJECT_EXTERNAL_EFFECT_FORBIDDEN");
  const startDate = text(input.startDate, "GAUNTLET_PROJECT_DATES_INVALID");
  const endDate = text(input.endDate, "GAUNTLET_PROJECT_DATES_INVALID");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate)
    throw new Error("GAUNTLET_PROJECT_DATES_INVALID");
  const canonical = {
    schemaVersion: 1,
    projectId: input.projectId,
    code: text(input.code, "GAUNTLET_PROJECT_IDENTITY_INVALID"),
    name: text(input.name, "GAUNTLET_PROJECT_IDENTITY_INVALID"),
    description: text(input.description, "GAUNTLET_PROJECT_DESCRIPTION_REQUIRED"),
    companyId: input.companyId,
    clientCompanyId: input.clientCompanyId,
    location: text(input.location, "GAUNTLET_PROJECT_LOCATION_REQUIRED"),
    projectType: text(input.projectType, "GAUNTLET_PROJECT_TYPE_REQUIRED"),
    deliveryMethod: text(input.deliveryMethod, "GAUNTLET_PROJECT_DELIVERY_REQUIRED"),
    startDate,
    endDate,
    currency: text(input.currency, "GAUNTLET_PROJECT_CURRENCY_REQUIRED").toUpperCase(),
    disciplineIds: uniquePositiveIds(input.disciplineIds, "GAUNTLET_PROJECT_DISCIPLINES_REQUIRED"),
    roleCodes: uniqueCodes(input.roleCodes, "GAUNTLET_PROJECT_ROLES_REQUIRED"),
    workflowVersionIds: uniqueCodes(input.workflowVersionIds, "GAUNTLET_PROJECT_WORKFLOWS_REQUIRED"),
    templateVersionId: text(input.templateVersionId, "GAUNTLET_PROJECT_TEMPLATE_REQUIRED"),
    namingConventionVersionId: text(input.namingConventionVersionId, "GAUNTLET_PROJECT_NAMING_REQUIRED"),
    synthetic: true as const,
    billingEnabled: false as const,
    externalNotificationsEnabled: false as const,
  };
  return Object.freeze({ ...canonical, fingerprint: createHash("sha256").update(JSON.stringify(canonical)).digest("hex") });
}
