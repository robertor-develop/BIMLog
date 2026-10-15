/** An accepted empty catalog is still authoritative; never resurrect an older version. */
export function latestConventionVersion<T extends { conventionVersion: number }>(versions: T[]): T | null {
  if (!Array.isArray(versions)) throw new Error("Invalid convention version response");
  const seen = new Set<number>();
  for (const version of versions) {
    if (!version || !Number.isSafeInteger(version.conventionVersion) || version.conventionVersion < 1
      || seen.has(version.conventionVersion)) throw new Error("Invalid or ambiguous convention version");
    seen.add(version.conventionVersion);
  }
  return versions.reduce<T | null>((latest, version) =>
    !latest || version.conventionVersion > latest.conventionVersion ? version : latest, null);
}
