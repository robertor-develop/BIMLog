import { BIMLOG_BUDGET_GOVERNANCE_POLICIES, BIMLOG_DELIVERY_METHODS } from "./job-intake-configuration";

export type PolicyConfigurationField = {
  key: string;
  label: { en: string; es: string };
  description: { en: string; es: string };
  options: { value: string; label: { en: string; es: string } }[];
};

const option = (value: string, en: string, es: string) => ({ value, label: { en, es } });

const intakeConfiguration: PolicyConfigurationField[] = [
  {
    key: "delivery_method",
    label: { en: "Default Delivery Method", es: "Método de Entrega predeterminado" },
    description: { en: "Applied only when Intake has no saved Delivery Method.", es: "Se aplica solo cuando el Ingreso no tiene un Método de Entrega guardado." },
    options: BIMLOG_DELIVERY_METHODS.map((item) => option(item.key, item.label, item.labelEs)),
  },
  {
    key: "budget_governance_policy",
    label: { en: "Default Budget Governance", es: "Gobernanza de Presupuesto predeterminada" },
    description: { en: "References the existing Job Operations budget authority; it does not create a second financial record.", es: "Referencia la autoridad presupuestaria existente de Operaciones del Trabajo; no crea un segundo registro financiero." },
    options: BIMLOG_BUDGET_GOVERNANCE_POLICIES.map((item) => option(item.key, item.label, item.labelEs)),
  },
  {
    key: "enforcement_mode",
    label: { en: "Selection Mode", es: "Modo de selección" },
    description: { en: "Optional supplies defaults that users may change. Enforced locks the governed selections in Intake.", es: "Opcional proporciona valores que los usuarios pueden cambiar. Obligatorio bloquea las selecciones gobernadas en el Ingreso." },
    options: [option("optional", "Optional default", "Predeterminado opcional"), option("enforced", "Enforced by policy", "Obligatorio por política")],
  },
];

export function policyConfigurationDefinition(featureKey: string): PolicyConfigurationField[] {
  return featureKey === "project.intake.configuration" ? intakeConfiguration.map((field) => ({ ...field, options: field.options.map((item) => ({ ...item, label: { ...item.label } })) })) : [];
}
