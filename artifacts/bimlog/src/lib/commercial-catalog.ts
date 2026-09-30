import type { CommercialPlanId } from "./commercial-packaging";

export type CatalogCurrency = "USD";
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
