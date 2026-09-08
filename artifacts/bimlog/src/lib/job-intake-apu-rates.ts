export const INTAKE_APU_RATE_DEFAULTS = Object.freeze({
  drafting: "35.47",
  bim_coordinator: "37.99",
});

export type IntakeApuRateProfile = keyof typeof INTAKE_APU_RATE_DEFAULTS;

export function rateForApuProfile(profile: string) {
  return Object.prototype.hasOwnProperty.call(INTAKE_APU_RATE_DEFAULTS, profile)
    ? INTAKE_APU_RATE_DEFAULTS[profile as IntakeApuRateProfile]
    : null;
}

export function profileForApuRate(rate: unknown): IntakeApuRateProfile | "" {
  const value = String(rate ?? "").trim();
  return (
    Object.entries(INTAKE_APU_RATE_DEFAULTS).find(
      ([, defaultRate]) => defaultRate === value,
    )?.[0] as IntakeApuRateProfile | undefined
  ) ?? "";
}
