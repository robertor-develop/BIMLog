export const LENS_TRADE_OPTIONS = [
  "Architectural",
  "Electrical",
  "Fire Protection",
  "General Contractor",
  "Geothermal",
  "HVAC",
  "Mechanical",
  "Owner",
  "Plumbing",
  "Pool",
  "Structural",
  "Other",
] as const;

export function mergeLensTradeOptions(
  projectTrades: readonly (string | null | undefined)[],
): string[] {
  return [
    ...new Set([
      ...LENS_TRADE_OPTIONS,
      ...projectTrades
        .map((trade) => trade?.trim())
        .filter((trade): trade is string => Boolean(trade)),
    ]),
  ].sort((left, right) => left.localeCompare(right));
}
