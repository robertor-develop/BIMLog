export type AdoptionLocale = "en" | "es";
export type AdoptionStageId = "account" | "verify" | "company" | "project" | "control" | "first_value";

export const ACTIVATION_MILESTONE = Object.freeze({
  id: "first_controlled_record",
  label: {
    en: "Create the first controlled project record",
    es: "Crear el primer registro controlado del proyecto",
  },
  evidence: "A saved RFI, Submittal, governed file, or BIMLog viewpoint in an authorized project.",
});

export const ADOPTION_JOURNEY = Object.freeze([
  { id: "account", label: { en: "Create account", es: "Crear cuenta" }, completion: "authenticated_account" },
  { id: "verify", label: { en: "Verify email", es: "Verificar correo" }, completion: "verified_email" },
  { id: "company", label: { en: "Confirm company", es: "Confirmar empresa" }, completion: "confirmed_company" },
  { id: "project", label: { en: "Open first project", es: "Abrir el primer proyecto" }, completion: "authorized_project" },
  { id: "control", label: { en: "Choose project controls", es: "Elegir controles del proyecto" }, completion: "saved_project_controls" },
  { id: "first_value", label: ACTIVATION_MILESTONE.label, completion: ACTIVATION_MILESTONE.id },
] satisfies ReadonlyArray<{ id: AdoptionStageId; label: Record<AdoptionLocale, string>; completion: string }>);

export const PRODUCT_TERMS = Object.freeze({
  headquarters: { en: "Headquarters", es: "Sede BIMLog" },
  project: { en: "Project", es: "Proyecto" },
  jobIntake: { en: "Job Intake & Setup", es: "Ingreso y configuración del trabajo" },
  contractItem: { en: "Contract Item", es: "Partida de contrato" },
  counterparty: { en: "Counterparty", es: "Contraparte" },
  deliveryWorkflow: { en: "Delivery workflow", es: "Flujo de entrega" },
  workPackage: { en: "Work Package", es: "Paquete de trabajo" },
});

export const EMAIL_VERIFICATION_POLICY = Object.freeze({
  requiredBeforeProjectSetup: true,
  reason: {
    en: "Email verification protects invitations and account recovery before project setup.",
    es: "La verificación del correo protege las invitaciones y la recuperación de la cuenta antes de configurar proyectos.",
  },
});

export function adoptionStageLabel(id: AdoptionStageId, locale: AdoptionLocale) {
  return ADOPTION_JOURNEY.find(stage => stage.id === id)?.label[locale] ?? id;
}
