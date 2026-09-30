import type { CommercialPlanId } from "./commercial-packaging";

export type CatalogCurrency = "USD";
export type CatalogBillingCycle = "monthly" | "annual";
export type CatalogPrice = {
  planId: CommercialPlanId;
  version: number;
  currency: CatalogCurrency;
  monthlyAmount: number | null;
  annualAmount: number | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  status: "published" | "retired";
};

export const CATALOG_PRICES: readonly CatalogPrice[] = [
  { planId: "free", version: 1, currency: "USD", monthlyAmount: 0, annualAmount: 0, effectiveFrom: "2026-09-30", effectiveUntil: null, status: "published" },
  { planId: "professional", version: 1, currency: "USD", monthlyAmount: 149, annualAmount: 1490, effectiveFrom: "2026-09-30", effectiveUntil: null, status: "published" },
  { planId: "team", version: 1, currency: "USD", monthlyAmount: 249, annualAmount: 2490, effectiveFrom: "2026-09-30", effectiveUntil: null, status: "published" },
  { planId: "business", version: 1, currency: "USD", monthlyAmount: 399, annualAmount: 3990, effectiveFrom: "2026-09-30", effectiveUntil: null, status: "published" },
  { planId: "enterprise", version: 1, currency: "USD", monthlyAmount: null, annualAmount: null, effectiveFrom: "2026-09-30", effectiveUntil: null, status: "published" },
] as const;

export function publishedPriceFor(planId: CommercialPlanId, asOf: string): CatalogPrice {
  const instant = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(instant)) throw new Error("A valid YYYY-MM-DD catalog date is required");
  const candidates = CATALOG_PRICES.filter((price) =>
    price.planId === planId &&
    price.status === "published" &&
    Date.parse(`${price.effectiveFrom}T00:00:00Z`) <= instant &&
    (price.effectiveUntil === null || instant < Date.parse(`${price.effectiveUntil}T00:00:00Z`)),
  ).sort((left, right) => right.version - left.version);
  if (candidates.length !== 1) throw new Error(`Expected one published ${planId} price for ${asOf}`);
  return candidates[0];
}

export function priceSnapshot(price: CatalogPrice) {
  return Object.freeze({
    planId: price.planId,
    priceVersion: price.version,
    currency: price.currency,
    monthlyAmount: price.monthlyAmount,
    annualAmount: price.annualAmount,
    effectiveFrom: price.effectiveFrom,
  });
}

export type BillingTerm = {
  cycle: CatalogBillingCycle;
  serviceMonths: 1 | 12;
  chargeTiming: "in_advance";
  renewsAutomatically: boolean;
  cancellationEffective: "term_end";
  label: { en: string; es: string };
};

export const BILLING_TERMS: Readonly<Record<CatalogBillingCycle, BillingTerm>> = {
  monthly: {
    cycle: "monthly", serviceMonths: 1, chargeTiming: "in_advance", renewsAutomatically: true,
    cancellationEffective: "term_end", label: { en: "Monthly subscription", es: "Suscripción mensual" },
  },
  annual: {
    cycle: "annual", serviceMonths: 12, chargeTiming: "in_advance", renewsAutomatically: true,
    cancellationEffective: "term_end", label: { en: "Annual subscription", es: "Suscripción anual" },
  },
} as const;

export function quotedTerm(planId: CommercialPlanId, cycle: CatalogBillingCycle, asOf: string) {
  const price = publishedPriceFor(planId, asOf);
  return Object.freeze({
    ...priceSnapshot(price),
    cycle,
    amount: cycle === "monthly" ? price.monthlyAmount : price.annualAmount,
    ...BILLING_TERMS[cycle],
  });
}

export type CommercialAddonId = "project_capacity" | "approved_connector" | "extended_retention";
export type CommercialAddon = {
  id: CommercialAddonId;
  name: { en: string; es: string };
  eligiblePlans: readonly CommercialPlanId[];
  price: "custom_quote";
  availability: "review_required";
  prerequisite: { en: string; es: string };
};

export const COMMERCIAL_ADDONS: readonly CommercialAddon[] = [
  {
    id: "project_capacity",
    name: { en: "Additional active-project capacity", es: "Capacidad adicional de proyectos activos" },
    eligiblePlans: ["professional", "team", "business"], price: "custom_quote", availability: "review_required",
    prerequisite: { en: "Plan and operating-scope review", es: "Revisión del plan y alcance operativo" },
  },
  {
    id: "approved_connector",
    name: { en: "Approved connector enablement", es: "Habilitación de conector aprobado" },
    eligiblePlans: ["business", "enterprise"], price: "custom_quote", availability: "review_required",
    prerequisite: { en: "Security, destination and provider review", es: "Revisión de seguridad, destino y proveedor" },
  },
  {
    id: "extended_retention",
    name: { en: "Extended governed retention", es: "Retención gobernada extendida" },
    eligiblePlans: ["business", "enterprise"], price: "custom_quote", availability: "review_required",
    prerequisite: { en: "Signed retention schedule", es: "Programa de retención firmado" },
  },
] as const;

export function addonsForPlan(planId: CommercialPlanId): readonly CommercialAddon[] {
  return COMMERCIAL_ADDONS.filter((addon) => addon.eligiblePlans.includes(planId));
}
